import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createTestDb, type TestDb } from "../helpers/testDb";
import { insertProject, insertTask, openDb, type Db } from "../helpers/factory";
import { hasText, paginationInfo, renderedTaskTitles, startTestServer, type TestServer } from "../helpers/server";

// 캘린더는 달 범위 계산·그리드 매핑·사이드 패널·미등록 일정이 한 페이지에 얽혀 있고,
// 6회차에 쿼리를 셋으로 쪼개면서 구조가 많이 바뀌었다.
let db: Db;
let testDb: TestDb;
let server: TestServer;
let projectId: string;

// 달이 바뀌어도 결과가 같도록 고정된 달을 쓴다. 2026-09-01은 화요일이라
// 그리드가 8/30(일)부터 시작하고, 앞뒤 달 패딩 칸이 생긴다.
const MONTH = "2026-09";

before(async () => {
  testDb = createTestDb("routes-calendar");
  db = openDb(testDb.path);

  const project = insertProject(db, { name: "캘린더프로젝트" });
  projectId = project.id;

  insertTask(db, { title: "9월 10일 일정", dueDate: new Date(2026, 8, 10) });
  insertTask(db, { title: "9월 10일 두번째", dueDate: new Date(2026, 8, 10) });
  insertTask(db, { title: "9월 25일 일정", dueDate: new Date(2026, 8, 25) });
  // 그리드 앞쪽 패딩(8/31)과 뒤쪽 패딩(10/3)에 걸리는 날짜
  insertTask(db, { title: "8월 31일 일정", dueDate: new Date(2026, 7, 31) });
  insertTask(db, { title: "10월 3일 일정", dueDate: new Date(2026, 9, 3) });
  // 다른 달이라 9월 그리드에 안 걸림
  insertTask(db, { title: "11월 일정", dueDate: new Date(2026, 10, 15) });
  // 완료된 것은 캘린더에 안 나온다
  insertTask(db, {
    title: "완료된 9월 일정",
    dueDate: new Date(2026, 8, 12),
    completed: true,
    completedAt: new Date(2026, 8, 12),
  });
  insertTask(db, { title: "프로젝트 9월 일정", dueDate: new Date(2026, 8, 18), projectId: project.id });

  // 미등록 일정(마감일 없음) — 페이지네이션을 보려면 기본 50보다 많아야 한다
  const seed = db.transaction(() => {
    for (let i = 0; i < 62; i++) insertTask(db, { title: `미등록 ${String(i).padStart(2, "0")}`, dueDate: null });
  });
  seed();

  server = await startTestServer(testDb.path);
});

after(async () => {
  await server?.stop();
  db?.close();
  await testDb?.dispose();
});

test("그리드에 그 달과 앞뒤 패딩 날짜의 태스크가 칩으로 나온다", async () => {
  const { status, html } = await server.get(`/calendar?month=${MONTH}&date=2026-09-01`);
  assert.equal(status, 200);

  for (const title of ["9월 10일 일정", "9월 25일 일정", "8월 31일 일정", "10월 3일 일정"]) {
    assert.ok(html.includes(title), `${title} 이 그리드에 있어야 한다`);
  }
  assert.ok(!html.includes("11월 일정"), "그리드 범위 밖은 안 나온다");
});

test("완료된 태스크는 캘린더에 나오지 않는다", async () => {
  const { html } = await server.get(`/calendar?month=${MONTH}&date=2026-09-01`);
  assert.ok(!html.includes("완료된 9월 일정"));
});

test("사이드 패널은 선택한 날짜의 태스크만 보여준다", async () => {
  const { html } = await server.get(`/calendar?month=${MONTH}&date=2026-09-10`);
  assert.ok(hasText(html, "할 일 2개"), "선택 날짜의 개수를 보여준다");

  const { html: other } = await server.get(`/calendar?month=${MONTH}&date=2026-09-25`);
  assert.ok(hasText(other, "할 일 1개"));
});

test("아무 일정 없는 날짜를 고르면 빈 안내가 나온다", async () => {
  const { html } = await server.get(`/calendar?month=${MONTH}&date=2026-09-02`);
  assert.ok(hasText(html, "이 날짜에 마감인 할 일이 없습니다"));
});

test("월 표시와 이전/다음 달 링크가 맞다", async () => {
  const { html } = await server.get(`/calendar?month=${MONTH}&date=2026-09-01`);
  assert.ok(hasText(html, "2026년 9월"));
  assert.ok(html.includes("month=2026-08"), "이전 달 링크");
  assert.ok(html.includes("month=2026-10"), "다음 달 링크");
});

test("연말/연초를 넘어가는 달 이동도 정상", async () => {
  const { status, html } = await server.get("/calendar?month=2026-12&date=2026-12-01");
  assert.equal(status, 200);
  assert.ok(html.includes("2027년 1월") || html.includes("month=2027-01"), "다음 달이 2027-01");
});

test("이상한 month 파라미터는 이번 달로 떨어진다 (500 아님)", async () => {
  for (const bad of ["2026-13", "abcd", "", "2026-9"]) {
    const { status } = await server.get(`/calendar?month=${bad}`);
    assert.equal(status, 200, `month=${bad}`);
  }
});

test("미등록 일정은 마감일 없는 미완료만, 전체 개수를 요약에 보여준다", async () => {
  const { html } = await server.get(`/calendar?month=${MONTH}&date=2026-09-01`);
  assert.ok(hasText(html, "미등록 일정 (62개)"), "현재 페이지가 아니라 전체 개수를 보여준다");
});

test("미등록 일정도 서버 페이지네이션을 쓴다", async () => {
  const { html } = await server.get(`/calendar?month=${MONTH}&date=2026-09-01`);
  const info = paginationInfo(html);
  assert.deepEqual(info, { page: 1, totalPages: 2, from: 1, to: 50, total: 62 });
  assert.ok(html.includes("unscheduled=2"), "다음 페이지 링크가 있어야 한다");
});

test("미등록 일정 2페이지로 가면 나머지가 나오고 섹션이 펼쳐진 채다", async () => {
  const { status, html } = await server.get(`/calendar?month=${MONTH}&date=2026-09-01&unscheduled=2`);
  assert.equal(status, 200);
  assert.equal(paginationInfo(html)?.page, 2);
  // details 가 open 으로 렌더돼야 페이지를 넘겨도 섹션이 닫히지 않는다
  assert.ok(/<details[^>]*\sopen/.test(html), "2페이지에서는 미등록 섹션이 열린 채여야 한다");
});

test("미등록 일정 전 페이지를 훑으면 중복도 누락도 없다", async () => {
  const seen: string[] = [];
  for (const page of [1, 2]) {
    const { html } = await server.get(`/calendar?month=${MONTH}&date=2026-09-01&unscheduled=${page}`);
    seen.push(...renderedTaskTitles(html).filter((t) => t.startsWith("미등록 ")));
  }
  assert.equal(seen.length, 62);
  assert.equal(new Set(seen).size, 62);
});

test("프로젝트 필터가 그리드·패널·미등록 세 곳에 모두 걸린다", async () => {
  const { status, html } = await server.get(`/calendar?month=${MONTH}&date=2026-09-18&project=${projectId}`);
  assert.equal(status, 200);
  assert.ok(html.includes("프로젝트 9월 일정"));
  assert.ok(!html.includes("9월 10일 일정"), "다른 프로젝트 일정은 그리드에서 빠진다");
  assert.ok(!hasText(html, "미등록 일정 ("), "이 프로젝트엔 마감일 없는 태스크가 없다");
});

test("프로젝트 필터를 걸어도 보던 달/날짜는 유지된다", async () => {
  const { html } = await server.get(`/calendar?month=${MONTH}&date=2026-09-18&project=${projectId}`);
  assert.ok(hasText(html, "2026년 9월"));
  assert.ok(html.includes("date=2026-09-18"), "링크들이 선택 날짜를 유지해야 한다");
});
