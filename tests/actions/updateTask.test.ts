import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createTestDb, disconnectPrisma, type TestDb } from "../helpers/testDb";
import {
  getTask,
  insertProject,
  insertTag,
  insertTask,
  linkTag,
  localDateKey,
  openDb,
  projectNames,
  tagNames,
  type Db,
} from "../helpers/factory";

// updateTask 는 태그를 통째로 갈아끼우고(deleteMany + create) 그 과정에서 떨어져 나간
// 프로젝트·태그를 자동정리한다. "바꾼 것"과 "치운 것"이 한 액션에 섞여 있어 회귀가 잦은 자리다.
let db: Db;
let testDb: TestDb;
let updateTask: typeof import("@/lib/actions/tasks").updateTask;
let renameTask: typeof import("@/lib/actions/tasks").renameTask;

before(async () => {
  testDb = createTestDb("update-task");
  ({ updateTask, renameTask } = await import("@/lib/actions/tasks"));
  db = openDb(testDb.path);
});

after(async () => {
  db?.close();
  await disconnectPrisma();
  await testDb?.dispose();
});

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

function tagNamesOf(taskId: string): string[] {
  return db
    .prepare("select g.name from TaskTag tt join Tag g on g.id = tt.tagId where tt.taskId = ? order by g.name")
    .all(taskId)
    .map((r: { name: string }) => r.name);
}

test("제목·메모·우선순위·마감일·반복을 바꾼다", async () => {
  const task = insertTask(db, { title: "수정 전", priority: 4 });

  await updateTask(
    form({
      id: task.id,
      title: "수정 후",
      description: "새 메모",
      dueDate: "2026-11-11",
      priority: "1",
      recurrence: "MONTHLY",
    })
  );

  const after = getTask(db, task.id);
  assert.equal(after.title, "수정 후");
  assert.equal(after.description, "새 메모");
  assert.equal(after.priority, 1);
  assert.equal(after.recurrence, "MONTHLY");
  assert.equal(localDateKey(after.dueDate), "2026-11-11");
});

test("빈 값은 null 로 저장된다 (빈 문자열이 남지 않는다)", async () => {
  const task = insertTask(db, { title: "비우기", description: "있던 메모", recurrence: "DAILY" });

  await updateTask(form({ id: task.id, title: "비우기", description: "", dueDate: "", recurrence: "" }));

  const after = getTask(db, task.id);
  assert.equal(after.description, null);
  assert.equal(after.dueDate, null);
  assert.equal(after.recurrence, null);
});

test("태그를 통째로 교체한다", async () => {
  const oldTag = insertTag(db, { name: "옛태그" });
  const shared = insertTag(db, { name: "공용" });
  const other = insertTask(db, { title: "옛태그 유지자" });
  linkTag(db, other.id, oldTag.id);

  const task = insertTask(db, { title: "태그 교체" });
  linkTag(db, task.id, oldTag.id);
  linkTag(db, task.id, shared.id);

  await updateTask(form({ id: task.id, title: "태그 교체", tags: "새태그, 공용" }));

  assert.deepEqual(tagNamesOf(task.id), ["공용", "새태그"]);
});

test("교체로 아무도 안 쓰게 된 태그는 자동 삭제된다", async () => {
  const lonely = insertTag(db, { name: "외톨이태그" });
  const task = insertTask(db, { title: "외톨이 유발" });
  linkTag(db, task.id, lonely.id);

  await updateTask(form({ id: task.id, title: "외톨이 유발", tags: "대체태그" }));

  assert.ok(!tagNames(db).includes("외톨이태그"));
  assert.ok(tagNames(db).includes("대체태그"));
});

test("다른 태스크가 아직 쓰는 태그는 교체해도 남는다", async () => {
  const shared = insertTag(db, { name: "살아남을태그" });
  const keeper = insertTask(db, { title: "태그 계속 씀" });
  linkTag(db, keeper.id, shared.id);
  const task = insertTask(db, { title: "태그 뗌" });
  linkTag(db, task.id, shared.id);

  await updateTask(form({ id: task.id, title: "태그 뗌", tags: "" }));

  assert.deepEqual(tagNamesOf(task.id), []);
  assert.ok(tagNames(db).includes("살아남을태그"));
});

test("프로젝트를 떼면 아무도 안 쓰는 프로젝트는 자동 삭제된다", async () => {
  const project = insertProject(db, { name: "떨어질프로젝트" });
  const task = insertTask(db, { title: "프로젝트 뗌", projectId: project.id });

  await updateTask(form({ id: task.id, title: "프로젝트 뗌", projectId: "" }));

  assert.equal(getTask(db, task.id).projectId, null);
  assert.ok(!projectNames(db).includes("떨어질프로젝트"));
});

test("프로젝트를 옮기면 새 프로젝트가 붙고 옛 프로젝트는 정리된다", async () => {
  const from = insertProject(db, { name: "출발프로젝트" });
  const to = insertProject(db, { name: "도착프로젝트" });
  const task = insertTask(db, { title: "프로젝트 이동", projectId: from.id });

  await updateTask(form({ id: task.id, title: "프로젝트 이동", projectId: to.id }));

  assert.equal(getTask(db, task.id).projectId, to.id);
  assert.ok(!projectNames(db).includes("출발프로젝트"));
  assert.ok(projectNames(db).includes("도착프로젝트"));
});

test("id 가 없거나 제목이 비면 아무것도 바꾸지 않는다", async () => {
  const task = insertTask(db, { title: "안 바뀜" });

  await updateTask(form({ title: "id 없음" }));
  await updateTask(form({ id: task.id, title: "   " }));

  assert.equal(getTask(db, task.id).title, "안 바뀜");
});

// 서브태스크 제목 인라인 수정 경로
test("renameTask 는 제목만 바꾼다", async () => {
  const task = insertTask(db, { title: "이름 전", priority: 2, description: "메모 유지" });

  await renameTask(task.id, "  이름 후  ");

  const after = getTask(db, task.id);
  assert.equal(after.title, "이름 후", "앞뒤 공백은 다듬는다");
  assert.equal(after.priority, 2);
  assert.equal(after.description, "메모 유지");
});

test("renameTask 에 빈 제목을 주면 무시한다", async () => {
  const task = insertTask(db, { title: "빈 이름 무시" });
  await renameTask(task.id, "   ");
  assert.equal(getTask(db, task.id).title, "빈 이름 무시");
});
