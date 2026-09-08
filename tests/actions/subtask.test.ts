import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createTestDb, disconnectPrisma, type TestDb } from "../helpers/testDb";
import { countTasks, getTask, insertProject, insertTask, openDb, projectNames, type Db } from "../helpers/factory";

// 서브태스크는 자체 프로젝트를 갖지 않고 부모 것을 상속한다. 드래그로 다른 부모에 옮기면
// 그 상속을 다시 해야 하고, 그러면서 옛 프로젝트가 고아가 될 수 있다.
let db: Db;
let testDb: TestDb;
let createSubtask: typeof import("@/lib/actions/tasks").createSubtask;
let moveSubtask: typeof import("@/lib/actions/tasks").moveSubtask;

before(async () => {
  testDb = createTestDb("subtask");
  ({ createSubtask, moveSubtask } = await import("@/lib/actions/tasks"));
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

function childOf(parentId: string, title: string) {
  return db.prepare("select * from Task where parentId = ? and title = ?").get(parentId, title) ?? null;
}

test("서브태스크는 부모의 프로젝트를 상속한다", async () => {
  const project = insertProject(db, { name: "상속프로젝트" });
  const parent = insertTask(db, { title: "상속 부모", projectId: project.id });

  await createSubtask(parent.id, form({ title: "상속 자식" }));

  const child = childOf(parent.id, "상속 자식");
  assert.ok(child);
  assert.equal(child.projectId, project.id);
});

test("부모에 프로젝트가 없으면 서브태스크도 없다", async () => {
  const parent = insertTask(db, { title: "무소속 부모" });
  await createSubtask(parent.id, form({ title: "무소속 자식" }));
  assert.equal(childOf(parent.id, "무소속 자식").projectId, null);
});

test("제목이 비면 서브태스크를 만들지 않는다", async () => {
  const parent = insertTask(db, { title: "빈 자식 부모" });
  await createSubtask(parent.id, form({ title: "  " }));
  assert.equal(countTasks(db, `parentId = '${parent.id}'`), 0);
});

test("없는 부모에는 만들지 않는다", async () => {
  const before = countTasks(db);
  await createSubtask("없는-부모-id", form({ title: "떠도는 자식" }));
  assert.equal(countTasks(db), before);
});

test("다른 부모로 옮기면 부모와 프로젝트가 함께 바뀐다", async () => {
  const fromProject = insertProject(db, { name: "이동전프로젝트" });
  const toProject = insertProject(db, { name: "이동후프로젝트" });
  const from = insertTask(db, { title: "옛 부모", projectId: fromProject.id });
  const to = insertTask(db, { title: "새 부모", projectId: toProject.id });
  const child = insertTask(db, { title: "이사하는 자식", parentId: from.id, projectId: fromProject.id });

  await moveSubtask(child.id, to.id);

  const moved = getTask(db, child.id);
  assert.equal(moved.parentId, to.id);
  assert.equal(moved.projectId, toProject.id, "새 부모의 프로젝트를 다시 상속해야 한다");
});

test("옮기고 나서 아무도 안 쓰는 옛 프로젝트는 자동 삭제된다", async () => {
  const orphaned = insertProject(db, { name: "고아될프로젝트" });
  const from = insertTask(db, { title: "주는 부모", projectId: orphaned.id });
  const to = insertTask(db, { title: "받는 부모" }); // 프로젝트 없음
  // 옛 프로젝트를 참조하는 건 이 서브태스크 하나뿐이다 (부모는 옮긴 뒤에도 남지만 아래서 지운다)
  const child = insertTask(db, { title: "유일 참조 자식", parentId: from.id, projectId: orphaned.id });
  db.prepare("update Task set projectId = null where id = ?").run(from.id);

  await moveSubtask(child.id, to.id);

  assert.equal(getTask(db, child.id).projectId, null, "새 부모에 프로젝트가 없으면 상속도 없다");
  assert.ok(!projectNames(db).includes("고아될프로젝트"));
});

test("자기 자신에게는 옮길 수 없다", async () => {
  const task = insertTask(db, { title: "자기 자신" });
  await moveSubtask(task.id, task.id);
  assert.equal(getTask(db, task.id).parentId, null);
});

test("없는 대상이면 아무 일도 하지 않는다", async () => {
  const parent = insertTask(db, { title: "그대로 부모" });
  const child = insertTask(db, { title: "그대로 자식", parentId: parent.id });

  await moveSubtask(child.id, "없는-부모-id");
  await moveSubtask("없는-자식-id", parent.id);

  assert.equal(getTask(db, child.id).parentId, parent.id);
});

// 최상위 태스크를 다른 태스크 위에 드롭하면 그 하위로 편입된다 (같은 액션을 쓴다)
test("최상위 태스크도 다른 태스크의 하위로 편입할 수 있다", async () => {
  const newParent = insertTask(db, { title: "새 상위" });
  const top = insertTask(db, { title: "최상위였던 것" });

  await moveSubtask(top.id, newParent.id);

  assert.equal(getTask(db, top.id).parentId, newParent.id);
});
