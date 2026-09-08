import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createTestDb, disconnectPrisma, type TestDb } from "../helpers/testDb";
import { countTasks, getTask, insertTag, insertTask, linkTag, openDb, type Db } from "../helpers/factory";

// 1회차 성능 최적화에서 delete → deleteMany 로 바꾸며 가장 위험했던 지점이다.
// 부모를 지울 때 서브태스크와 태그 연결이 같이 사라져야 하고(스키마의 onDelete: Cascade),
// 무관한 태스크는 절대 건드리면 안 된다.
let db: Db;
let testDb: TestDb;
let actions: typeof import("@/lib/actions/tasks");

before(async () => {
  testDb = createTestDb("delete-cascade");
  actions = await import("@/lib/actions/tasks");
  db = openDb(testDb.path);
});

after(async () => {
  db?.close();
  await disconnectPrisma();
  await testDb?.dispose();
});

test("단건 삭제: 서브태스크까지 같이 사라진다", async () => {
  const parent = insertTask(db, { title: "부모" });
  insertTask(db, { title: "자식1", parentId: parent.id });
  insertTask(db, { title: "자식2", parentId: parent.id });
  const bystander = insertTask(db, { title: "무관한 태스크" });

  await actions.deleteTask(parent.id);

  assert.equal(getTask(db, parent.id), null);
  assert.equal(countTasks(db, `parentId = '${parent.id}'`), 0);
  assert.ok(getTask(db, bystander.id), "무관한 태스크는 남아 있어야 한다");
});

test("단건 삭제: 태그 연결(TaskTag)도 같이 사라진다", async () => {
  const tag = insertTag(db, { name: "공용태그" });
  const keeper = insertTask(db, { title: "태그 유지자" });
  const victim = insertTask(db, { title: "태그 삭제자" });
  linkTag(db, keeper.id, tag.id);
  linkTag(db, victim.id, tag.id);

  await actions.deleteTask(victim.id);

  const links = db.prepare("select taskId from TaskTag where tagId = ?").all(tag.id);
  assert.deepEqual(
    links.map((r: { taskId: string }) => r.taskId),
    [keeper.id]
  );
});

test("일괄 삭제: 여러 부모와 그 서브태스크가 한 번에 사라진다", async () => {
  const a = insertTask(db, { title: "일괄A" });
  const b = insertTask(db, { title: "일괄B" });
  insertTask(db, { title: "일괄A-자식", parentId: a.id });
  insertTask(db, { title: "일괄B-자식", parentId: b.id });
  const survivor = insertTask(db, { title: "일괄생존" });

  await actions.deleteTasks([a.id, b.id]);

  assert.equal(countTasks(db, "title like '일괄A%' or title like '일괄B%'"), 0);
  assert.ok(getTask(db, survivor.id));
});

test("서브태스크만 지우면 부모는 남는다", async () => {
  const parent = insertTask(db, { title: "부모 유지" });
  const child = insertTask(db, { title: "자식만 삭제", parentId: parent.id });

  await actions.deleteTask(child.id);

  assert.equal(getTask(db, child.id), null);
  assert.ok(getTask(db, parent.id));
});

test("없는 id를 지우면 조용히 넘어간다 (스냅샷 null)", async () => {
  const snapshot = await actions.deleteTask("존재하지-않는-id");
  assert.equal(snapshot, null);
});

test("빈 배열을 지우면 아무 일도 없다", async () => {
  const beforeCount = countTasks(db);
  const snapshot = await actions.deleteTasks([]);
  assert.equal(snapshot, null);
  assert.equal(countTasks(db), beforeCount);
});

test("삭제 스냅샷에 서브태스크와 태그 연결이 담긴다 (실행취소의 전제)", async () => {
  const tag = insertTag(db, { name: "스냅샷태그" });
  const parent = insertTask(db, { title: "스냅샷 부모" });
  const child = insertTask(db, { title: "스냅샷 자식", parentId: parent.id });
  linkTag(db, parent.id, tag.id);

  const snapshot = await actions.deleteTask(parent.id);

  assert.ok(snapshot);
  assert.deepEqual(
    snapshot.tasks.map((t) => t.id),
    [parent.id]
  );
  assert.deepEqual(
    snapshot.subtasks.map((t) => t.id),
    [child.id]
  );
  assert.deepEqual(snapshot.tasks[0].tagIds, [tag.id]);
});
