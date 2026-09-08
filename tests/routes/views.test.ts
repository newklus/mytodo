import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createTestDb, type TestDb } from "../helpers/testDb";
import { insertProject, insertTask, openDb, type Db } from "../helpers/factory";
import { renderedTaskTitles, startTestServer, type TestServer } from "../helpers/server";

// 뷰 4개는 조건이 서로 조금씩 다르고, 한 뷰를 고치다 다른 뷰가 깨진 이력이 있다.
// 시드는 "오늘"을 기준으로 상대적으로 잡아야 아무 날에 돌려도 결과가 같다.
let db: Db;
let testDb: TestDb;
let server: TestServer;
let projectId: string;

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};
const daysFromToday = (n: number, hour = 12) => {
  const d = startOfToday();
  d.setDate(d.getDate() + n);
  d.setHours(hour, 0, 0, 0);
  return d;
};

before(async () => {
  testDb = createTestDb("routes-views");
  db = openDb(testDb.path);

  const project = insertProject(db, { name: "뷰프로젝트" });
  projectId = project.id;

  // --- 미완료 ---
  insertTask(db, { title: "지난주 마감", dueDate: daysFromToday(-7) });
  insertTask(db, { title: "오늘 마감", dueDate: daysFromToday(0) });
  insertTask(db, { title: "오늘 늦은 마감", dueDate: daysFromToday(0, 23) });
  insertTask(db, { title: "내일 마감", dueDate: daysFromToday(1) });
  insertTask(db, { title: "다음달 마감", dueDate: daysFromToday(30) });
  insertTask(db, { title: "마감 없음", dueDate: null });
  insertTask(db, { title: "프로젝트 소속", dueDate: daysFromToday(2), projectId: project.id });

  // --- 완료 (완료 뷰는 최근 15일만 보여준다) ---
  insertTask(db, { title: "어제 완료", completed: true, completedAt: daysFromToday(-1) });
  insertTask(db, { title: "14일전 완료", completed: true, completedAt: daysFromToday(-14) });
  insertTask(db, { title: "20일전 완료", completed: true, completedAt: daysFromToday(-20) });

  // --- 서브태스크는 어느 목록 뷰에도 안 나온다 ---
  const parent = insertTask(db, { title: "서브 보유 부모", dueDate: daysFromToday(0) });
  insertTask(db, { title: "숨어야 할 서브태스크", parentId: parent.id, dueDate: daysFromToday(0) });

  server = await startTestServer(testDb.path);
});

after(async () => {
  await server?.stop();
  db?.close();
  await testDb?.dispose();
});

async function titles(path: string) {
  const { status, html } = await server.get(path);
  assert.equal(status, 200, path);
  return renderedTaskTitles(html);
}

test("전체: 미완료 전부 (마감일 유무 무관), 완료는 제외", async () => {
  const list = await titles("/?view=all");
  assert.ok(list.includes("마감 없음"));
  assert.ok(list.includes("지난주 마감"));
  assert.ok(list.includes("다음달 마감"));
  assert.ok(!list.includes("어제 완료"));
});

test("오늘: 오늘 자정까지가 마감인 미완료만 (지난 것 포함)", async () => {
  const list = await titles("/?view=today");
  assert.ok(list.includes("지난주 마감"), "지난 마감도 '오늘' 뷰에 남는다");
  assert.ok(list.includes("오늘 마감"));
  assert.ok(list.includes("오늘 늦은 마감"), "오늘 23시도 오늘이다");
  assert.ok(!list.includes("내일 마감"));
  assert.ok(!list.includes("마감 없음"), "마감일 없는 태스크는 안 보인다");
});

test("예정: 내일 이후 마감인 미완료만", async () => {
  const list = await titles("/?view=upcoming");
  assert.ok(list.includes("내일 마감"));
  assert.ok(list.includes("다음달 마감"));
  assert.ok(!list.includes("오늘 마감"));
  assert.ok(!list.includes("오늘 늦은 마감"));
  assert.ok(!list.includes("마감 없음"));
});

// "오늘"과 "예정"은 겹치지도 빠뜨리지도 않아야 한다 (마감일 있는 미완료 기준)
test("오늘과 예정을 합치면 '마감일 있는 미완료' 전부가 정확히 한 번씩", async () => {
  const today = await titles("/?view=today");
  const upcoming = await titles("/?view=upcoming");
  const withDue = db
    .prepare("select title from Task where parentId is null and completed = 0 and dueDate is not null")
    .all()
    .map((r: { title: string }) => r.title);

  const merged = [...today, ...upcoming];
  assert.equal(new Set(merged).size, merged.length, "겹치는 항목이 없어야 한다");
  assert.deepEqual([...merged].sort(), [...withDue].sort());
});

test("완료: 최근 15일 안에 완료한 것만", async () => {
  const list = await titles("/?view=completed");
  assert.ok(list.includes("어제 완료"));
  assert.ok(list.includes("14일전 완료"));
  assert.ok(!list.includes("20일전 완료"), "15일보다 오래된 완료는 화면에서 제외");
});

// 화면에서만 빼는 것이지 DB에서 지우는 게 아니다 (실행취소 등 참조 로직이 있다)
test("완료 뷰에서 빠진 오래된 항목도 DB에는 남아 있다", () => {
  const row = db.prepare("select * from Task where title = '20일전 완료'").get();
  assert.ok(row);
  assert.equal(row.completed, 1);
});

test("완료 뷰는 최신 완료일이 위 (우선순위 무관)", async () => {
  const list = await titles("/?view=completed");
  assert.ok(list.indexOf("어제 완료") < list.indexOf("14일전 완료"));
});

test("서브태스크는 어느 목록 뷰에도 안 나온다", async () => {
  for (const view of ["all", "today", "upcoming", "completed"]) {
    const list = await titles(`/?view=${view}`);
    assert.ok(!list.includes("숨어야 할 서브태스크"), `view=${view}`);
  }
});

test("프로젝트 필터는 그 프로젝트 것만 보여준다", async () => {
  const list = await titles(`/?view=all&project=${projectId}`);
    assert.deepEqual(list, ["프로젝트 소속"]);
});

test("view 없이 열면 기본은 오늘, 쿠키로 바꿀 수 있다", async () => {
  const plain = renderedTaskTitles((await server.get("/")).html);
  assert.ok(!plain.includes("마감 없음"), "기본은 오늘 뷰라 마감 없는 건 안 보인다");

  const { html } = await server.get("/", { cookie: "mytodo_start_page=all" });
  assert.ok(renderedTaskTitles(html).includes("마감 없음"), "쿠키가 all 이면 전체 뷰");
});

test("시작 페이지가 calendar 면 /calendar 로 보낸다", async () => {
  const { status, html } = await server.get("/", { cookie: "mytodo_start_page=calendar" });
  assert.equal(status, 200);
  assert.ok(html.includes("미등록 일정") || html.includes("년") , "캘린더 화면이 나와야 한다");
});

test("모르는 view 값이어도 500이 나지 않는다", async () => {
  const { status } = await server.get("/?view=nonsense");
  assert.equal(status, 200);
});
