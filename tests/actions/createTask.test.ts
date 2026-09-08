import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createTestDb, disconnectPrisma, type TestDb } from "../helpers/testDb";
import { insertProject, localDateKey, openDb, projectNames, tagNames, type Db } from "../helpers/factory";

// @/# 멘션과 +N 은 클라이언트 드롭다운(SmartTitleInput)과 서버 안전망(createTask) 두 곳에
// 같은 규칙이 구현돼 있고, 여기서 세 번 버그가 났다. 이 파일은 **서버 안전망** 쪽을 고정한다
// — 드롭다운을 전혀 안 써도 @/#/+N 문법 자체는 항상 동작해야 한다는 계약이다.
let db: Db;
let testDb: TestDb;
let createTask: typeof import("@/lib/actions/tasks").createTask;

before(async () => {
  testDb = createTestDb("create-task");
  ({ createTask } = await import("@/lib/actions/tasks"));
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

function findByTitle(title: string) {
  return db.prepare("select * from Task where title = ?").get(title) ?? null;
}

function tagNamesOf(taskId: string): string[] {
  return db
    .prepare("select g.name from TaskTag tt join Tag g on g.id = tt.tagId where tt.taskId = ? order by g.name")
    .all(taskId)
    .map((r: { name: string }) => r.name);
}

test("@프로젝트를 제목에서 뽑아 연결하고 제목에는 남기지 않는다", async () => {
  await createTask(form({ title: "보고서 작성 @영업팀" }));

  const task = findByTitle("보고서 작성");
  assert.ok(task, "제목에서 @토큰이 지워져야 한다");
  assert.ok(projectNames(db).includes("영업팀"));
  const project = db.prepare("select name from Project where id = ?").get(task.projectId);
  assert.equal(project.name, "영업팀");
});

test("#태그 여러 개를 뽑아 연결한다", async () => {
  await createTask(form({ title: "회의 준비 #긴급 #회의" }));

  const task = findByTitle("회의 준비");
  assert.ok(task);
  assert.deepEqual(tagNamesOf(task.id), ["긴급", "회의"]);
});

test("@와 #와 +N을 한 번에 처리한다", async () => {
  await createTask(form({ title: "출장 정산 @총무 #영수증 +2" }));

  const task = findByTitle("출장 정산");
  assert.ok(task, "세 토큰이 모두 제목에서 빠져야 한다");
  assert.ok(task.projectId);
  assert.deepEqual(tagNamesOf(task.id), ["영수증"]);
  assert.ok(task.dueDate);
});

// 실제로 있었던 오인식 버그: 이메일 주소가 프로젝트로 잡히면 안 된다
test("앞에 공백이 없는 @는 멘션이 아니다", async () => {
  const beforeProjects = projectNames(db).length;
  await createTask(form({ title: "hello@world 로 메일 보내기" }));

  assert.ok(findByTitle("hello@world 로 메일 보내기"), "제목이 그대로 남아야 한다");
  assert.equal(projectNames(db).length, beforeProjects, "프로젝트가 생기면 안 된다");
});

test("기존 프로젝트가 있으면 새로 만들지 않고 그것에 연결한다", async () => {
  const existing = insertProject(db, { name: "기존프로젝트" });
  await createTask(form({ title: "기존 연결 @기존프로젝트" }));

  const task = findByTitle("기존 연결");
  assert.equal(task.projectId, existing.id);
  assert.equal(projectNames(db).filter((n) => n === "기존프로젝트").length, 1);
});

test("같은 태그를 두 번 써도 연결은 하나만 생긴다", async () => {
  await createTask(form({ title: "중복 태그 #같은거 #같은거" }));
  const task = findByTitle("중복 태그");
  assert.deepEqual(tagNamesOf(task.id), ["같은거"]);
});

test("쉼표로 넣은 태그와 #멘션 태그가 합쳐진다", async () => {
  await createTask(form({ title: "합산 #멘션태그", tags: "폼태그1, 폼태그2" }));
  const task = findByTitle("합산");
  assert.deepEqual(tagNamesOf(task.id), ["멘션태그", "폼태그1", "폼태그2"]);
});

// 명시적으로 고른 값이 항상 이긴다 — 자동 추론이 사용자의 선택을 덮으면 안 된다
test("날짜를 직접 골랐으면 +N이 있어도 덮어쓰지 않는다", async () => {
  await createTask(form({ title: "명시 우선 +9", dueDate: "2026-12-25" }));
  const task = findByTitle("명시 우선 +9");
  assert.equal(localDateKey(task.dueDate), "2026-12-25");
});

test("프로젝트를 직접 골랐으면 @멘션보다 우선한다", async () => {
  const chosen = insertProject(db, { name: "직접고른프로젝트" });
  await createTask(form({ title: "선택 우선 @무시될프로젝트", projectId: chosen.id }));

  const task = findByTitle("선택 우선");
  assert.equal(task.projectId, chosen.id);
  assert.ok(!projectNames(db).includes("무시될프로젝트"), "멘션 프로젝트는 만들지 않는다");
});

test("기본 우선순위는 P3", async () => {
  await createTask(form({ title: "기본 우선순위" }));
  assert.equal(findByTitle("기본 우선순위").priority, 3);
});

test("우선순위·반복을 넘기면 그대로 저장된다", async () => {
  await createTask(form({ title: "옵션 지정", priority: "1", recurrence: "WEEKLY" }));
  const task = findByTitle("옵션 지정");
  assert.equal(task.priority, 1);
  assert.equal(task.recurrence, "WEEKLY");
});

test("제목이 비면 아무것도 만들지 않는다", async () => {
  const before = db.prepare("select count(*) c from Task").get().c;
  await createTask(form({ title: "   " }));
  assert.equal(db.prepare("select count(*) c from Task").get().c, before);
});

// 토큰만 있고 남는 제목이 없으면 만들 게 없다
test("제목이 멘션뿐이면 만들지 않는다", async () => {
  const before = db.prepare("select count(*) c from Task").get().c;
  await createTask(form({ title: "#태그만" }));
  assert.equal(db.prepare("select count(*) c from Task").get().c, before);
  assert.ok(!tagNames(db).includes("태그만"), "태스크를 안 만들었으면 태그도 안 생겨야 한다");
});

test("새로 만든 프로젝트·태그는 입력한 대소문자를 그대로 쓴다", async () => {
  await createTask(form({ title: "대소문자 @MyProject #TagName" }));
  assert.ok(projectNames(db).includes("MyProject"));
  assert.ok(tagNames(db).includes("TagName"));
});
