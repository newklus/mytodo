import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createTestDb, disconnectPrisma, type TestDb } from "../helpers/testDb";
import {
  countTasks,
  getTask,
  insertProject,
  insertTag,
  insertTask,
  linkTag,
  openDb,
  projectNames,
  tagIdsOf,
  tagNames,
  type Db,
} from "../helpers/factory";

// 앱에서 가장 복잡한 코드다. 삭제는 하드 삭제라 되돌리려면 지우기 전에 남겨둔 스냅샷으로
// 원래 id 그대로 되살려야 하고, 자동정리로 같이 사라진 프로젝트·태그도 복원해야 한다.
// 6회차에서 한 트랜잭션으로 묶어 "절반만 복원"이 불가능해졌는데, 그 계약도 여기서 고정한다.
let db: Db;
let testDb: TestDb;
let actions: typeof import("@/lib/actions/tasks");

before(async () => {
  testDb = createTestDb("undo");
  actions = await import("@/lib/actions/tasks");
  db = openDb(testDb.path);
});

after(async () => {
  db?.close();
  await disconnectPrisma();
  await testDb?.dispose();
});

// ---- 완료 되돌리기 ----

test("완료 되돌리기: 토글 전 상태로 정확히 돌아간다", async () => {
  const task = insertTask(db, { title: "완료 되돌리기" });
  const snapshot = await actions.toggleTaskComplete(task.id, true);
  assert.equal(getTask(db, task.id).completed, 1);

  await actions.undoComplete(snapshot);

  const after = getTask(db, task.id);
  assert.equal(after.completed, 0);
  assert.equal(after.completedAt, null);
});

// 반복 태스크를 완료하면 다음 회차가 생긴다. 되돌릴 때 그것도 같이 치워야
// "원본 1건, 미완료" 라는 원래 상태로 정확히 돌아간다.
test("완료 되돌리기: 완료로 생겨난 다음 회차도 같이 삭제된다", async () => {
  const task = insertTask(db, {
    title: "반복 되돌리기",
    dueDate: new Date(2026, 3, 10),
    recurrence: "WEEKLY",
  });
  const snapshot = await actions.toggleTaskComplete(task.id, true);
  assert.equal(countTasks(db, "title = '반복 되돌리기'"), 2);
  assert.equal(snapshot?.spawnedIds.length, 1);

  await actions.undoComplete(snapshot);

  assert.equal(countTasks(db, "title = '반복 되돌리기'"), 1);
  assert.equal(getTask(db, task.id).completed, 0);
});

test("일괄 완료 되돌리기: 원래 완료 상태가 섞여 있어도 각자 제 상태로 돌아간다", async () => {
  const open = insertTask(db, { title: "일괄-미완료였음" });
  const done = insertTask(db, {
    title: "일괄-완료였음",
    completed: true,
    completedAt: new Date(2026, 2, 3),
  });

  const snapshot = await actions.completeTasks([open.id, done.id], true);
  await actions.undoComplete(snapshot);

  assert.equal(getTask(db, open.id).completed, 0);
  assert.equal(getTask(db, done.id).completed, 1, "원래 완료였던 건 완료로 돌아가야 한다");
  assert.ok(getTask(db, done.id).completedAt);
});

test("완료 취소를 되돌리면 다시 완료 상태가 된다", async () => {
  const task = insertTask(db, {
    title: "취소 되돌리기",
    completed: true,
    completedAt: new Date(2026, 4, 5),
  });
  const snapshot = await actions.toggleTaskComplete(task.id, false);
  assert.equal(getTask(db, task.id).completed, 0);

  await actions.undoComplete(snapshot);
  assert.equal(getTask(db, task.id).completed, 1);
});

test("스냅샷이 null 이면 아무 일도 하지 않는다", async () => {
  const before = countTasks(db);
  await actions.undoComplete(null);
  await actions.undoDelete(null);
  assert.equal(countTasks(db), before);
});

// ---- 삭제 되돌리기 ----

test("삭제 되돌리기: 원래 id 그대로 되살아난다", async () => {
  const task = insertTask(db, { title: "삭제 되돌리기", priority: 2, description: "메모" });
  const snapshot = await actions.deleteTask(task.id);
  assert.equal(getTask(db, task.id), null);

  await actions.undoDelete(snapshot);

  const revived = getTask(db, task.id);
  assert.ok(revived, "같은 id로 되살아나야 한다");
  assert.equal(revived.title, "삭제 되돌리기");
  assert.equal(revived.priority, 2);
  assert.equal(revived.description, "메모");
});

test("삭제 되돌리기: 서브태스크와 부모 관계까지 복원된다", async () => {
  const parent = insertTask(db, { title: "복원 부모" });
  const child = insertTask(db, { title: "복원 자식", parentId: parent.id });

  const snapshot = await actions.deleteTask(parent.id);
  await actions.undoDelete(snapshot);

  assert.ok(getTask(db, parent.id));
  const revivedChild = getTask(db, child.id);
  assert.ok(revivedChild);
  assert.equal(revivedChild.parentId, parent.id);
});

test("삭제 되돌리기: 태그 연결이 복원된다", async () => {
  const tag = insertTag(db, { name: "복원태그" });
  const other = insertTask(db, { title: "태그 유지자2" });
  linkTag(db, other.id, tag.id);
  const task = insertTask(db, { title: "태그 복원 대상" });
  linkTag(db, task.id, tag.id);

  const snapshot = await actions.deleteTask(task.id);
  await actions.undoDelete(snapshot);

  assert.deepEqual(tagIdsOf(db, task.id), [tag.id]);
});

// 자동정리가 프로젝트·태그까지 같이 지웠을 수 있으므로, 되살릴 때 그것들부터 복원해야 한다.
test("삭제 되돌리기: 자동정리로 같이 사라진 프로젝트·태그까지 되살린다", async () => {
  const project = insertProject(db, { name: "동반삭제프로젝트" });
  const tag = insertTag(db, { name: "동반삭제태그" });
  const task = insertTask(db, { title: "동반삭제 유발", projectId: project.id });
  linkTag(db, task.id, tag.id);

  const snapshot = await actions.deleteTask(task.id);
  assert.ok(!projectNames(db).includes("동반삭제프로젝트"), "선행 조건: 자동정리로 사라져야 함");
  assert.ok(!tagNames(db).includes("동반삭제태그"));

  await actions.undoDelete(snapshot);

  assert.ok(projectNames(db).includes("동반삭제프로젝트"));
  assert.ok(tagNames(db).includes("동반삭제태그"));
  const revived = getTask(db, task.id);
  assert.equal(revived.projectId, project.id);
  assert.deepEqual(tagIdsOf(db, task.id), [tag.id]);
});

test("일괄 삭제 되돌리기: 전부 되살아난다", async () => {
  const ids = ["일괄복원1", "일괄복원2", "일괄복원3"].map((title) => insertTask(db, { title }).id);
  ids.forEach((id) => insertTask(db, { title: "자식", parentId: id }));

  const snapshot = await actions.deleteTasks(ids);
  assert.equal(countTasks(db, "title like '일괄복원%'"), 0);

  await actions.undoDelete(snapshot);

  assert.equal(countTasks(db, "title like '일괄복원%'"), 3);
  for (const id of ids) assert.equal(countTasks(db, `parentId = '${id}'`), 1);
});

// 6회차에 한 트랜잭션으로 묶으면서 생긴 계약: 중간에 충돌이 나면 절반만 복원되지 않는다.
test("복원 중 충돌이 나면 전부 롤백된다 (절반 복원 없음)", async () => {
  const a = insertTask(db, { title: "원자성A" });
  const b = insertTask(db, { title: "원자성B" });
  const snapshot = await actions.deleteTasks([a.id, b.id]);

  // 되돌리기 전에 같은 id 하나를 다시 만들어 충돌을 유발한다
  insertTask(db, { id: a.id, title: "선점" });

  await actions.undoDelete(snapshot);

  assert.equal(getTask(db, a.id).title, "선점", "선점한 행은 그대로여야 한다");
  assert.equal(getTask(db, b.id), null, "충돌이 났으므로 B도 복원되지 않아야 한다");
});

// "next/cache" 로 임포트하면 TypeScript가 진짜 Next 타입을 보므로, 훅이 실제로 끼워 넣는
// 스텁 파일을 직접 가리킨다. 같은 파일 URL이라 액션이 쓰는 모듈 인스턴스와 동일하다.
test("되돌리기는 화면 갱신을 요청한다 (refresh 호출)", async () => {
  const { refreshCallCount } = await import("../helpers/nextCacheStub");
  const task = insertTask(db, { title: "refresh 확인" });
  const snapshot = await actions.deleteTask(task.id);

  const before = refreshCallCount();
  await actions.undoDelete(snapshot);
  assert.ok(refreshCallCount() > before);
});
