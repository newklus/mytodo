import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createTestDb, disconnectPrisma, type TestDb } from "../helpers/testDb";
import { insertProject, insertTag, insertTask, linkTag, openDb, projectNames, tagNames, type Db } from "../helpers/factory";

// 프로젝트·태그는 수동 삭제 버튼이 없고 "참조가 하나도 없어지면 자동 삭제"된다(requirements 5.3/5.4).
// 조건이 미묘해서 회귀하기 쉽다 — 특히 "완료된 태스크가 참조 중이면 살려둬야 한다"는 부분.
let db: Db;
let testDb: TestDb;
let cleanupUnusedProjectAndTags: typeof import("@/lib/cleanupUnused").cleanupUnusedProjectAndTags;
let deleteTask: typeof import("@/lib/actions/tasks").deleteTask;

before(async () => {
  testDb = createTestDb("cleanup");
  ({ cleanupUnusedProjectAndTags } = await import("@/lib/cleanupUnused"));
  ({ deleteTask } = await import("@/lib/actions/tasks"));
  db = openDb(testDb.path);
});

after(async () => {
  db?.close();
  await disconnectPrisma();
  await testDb?.dispose();
});

test("마지막 참조가 사라진 프로젝트는 자동 삭제된다", async () => {
  const project = insertProject(db, { name: "버려질프로젝트" });
  const task = insertTask(db, { title: "유일한 참조", projectId: project.id });

  await deleteTask(task.id);

  assert.ok(!projectNames(db).includes("버려질프로젝트"));
});

// 완료 여부와 무관하게 "참조가 하나라도 있으면" 살아 있어야 한다
test("완료된 태스크가 참조 중이면 프로젝트를 지우지 않는다", async () => {
  const project = insertProject(db, { name: "완료가지킨프로젝트" });
  insertTask(db, { title: "완료된 참조", projectId: project.id, completed: true, completedAt: new Date(2026, 0, 5) });
  const doomed = insertTask(db, { title: "지워질 참조", projectId: project.id });

  await deleteTask(doomed.id);

  assert.ok(projectNames(db).includes("완료가지킨프로젝트"));
});

test("서브태스크가 참조 중이어도 프로젝트를 지우지 않는다", async () => {
  const project = insertProject(db, { name: "서브가지킨프로젝트" });
  const keeper = insertTask(db, { title: "남는 부모", projectId: project.id });
  insertTask(db, { title: "남는 자식", parentId: keeper.id, projectId: project.id });
  const doomed = insertTask(db, { title: "지워질 별개", projectId: project.id });

  await deleteTask(doomed.id);

  assert.ok(projectNames(db).includes("서브가지킨프로젝트"));
});

test("마지막 참조가 사라진 태그는 자동 삭제된다", async () => {
  const tag = insertTag(db, { name: "버려질태그" });
  const task = insertTask(db, { title: "유일한 태그 참조" });
  linkTag(db, task.id, tag.id);

  await deleteTask(task.id);

  assert.ok(!tagNames(db).includes("버려질태그"));
});

test("다른 태스크가 아직 쓰는 태그는 남긴다", async () => {
  const tag = insertTag(db, { name: "공유태그" });
  const keeper = insertTask(db, { title: "태그 유지" });
  const doomed = insertTask(db, { title: "태그 해제" });
  linkTag(db, keeper.id, tag.id);
  linkTag(db, doomed.id, tag.id);

  await deleteTask(doomed.id);

  assert.ok(tagNames(db).includes("공유태그"));
});

test("여러 후보를 한 번에 넘겨도 쓰이는 것만 살아남는다", async () => {
  const used = insertProject(db, { name: "쓰이는프로젝트" });
  const unused = insertProject(db, { name: "안쓰이는프로젝트" });
  const usedTag = insertTag(db, { name: "쓰이는태그" });
  const unusedTag = insertTag(db, { name: "안쓰이는태그" });
  const task = insertTask(db, { title: "참조 보유", projectId: used.id });
  linkTag(db, task.id, usedTag.id);

  await cleanupUnusedProjectAndTags([used.id, unused.id], [usedTag.id, unusedTag.id]);

  const projects = projectNames(db);
  const tags = tagNames(db);
  assert.ok(projects.includes("쓰이는프로젝트"));
  assert.ok(!projects.includes("안쓰이는프로젝트"));
  assert.ok(tags.includes("쓰이는태그"));
  assert.ok(!tags.includes("안쓰이는태그"));
});

test("빈 후보 목록이면 아무것도 지우지 않는다", async () => {
  const project = insertProject(db, { name: "무사한프로젝트" });
  await cleanupUnusedProjectAndTags([], []);
  assert.ok(projectNames(db).includes("무사한프로젝트"));
  assert.ok(project.id);
});

// 같은 id가 여러 번 들어와도(중복 제거 안 되면 쿼리가 이상해질 수 있다) 결과가 같아야 한다
test("후보에 중복이 있어도 결과가 같다", async () => {
  const unused = insertProject(db, { name: "중복후보프로젝트" });
  await cleanupUnusedProjectAndTags([unused.id, unused.id, unused.id], []);
  assert.ok(!projectNames(db).includes("중복후보프로젝트"));
});
