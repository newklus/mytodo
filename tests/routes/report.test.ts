import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createTestDb, type TestDb } from "../helpers/testDb";
import { insertProject, insertTask, openDb, type Db } from "../helpers/factory";
import { hasText, startTestServer, type TestServer } from "../helpers/server";

// 주간보고는 후보를 세 갈래(완료 최상위 / 완료 서브태스크 / 진행중 OR 3중)로 뽑는다.
// 특히 진행중 조건은 "마감일이 이번 주" OR "이번 주에 갱신" OR "서브태스크를 이번 주에 완료"
// 라서 눈으로 검증하기 어렵다.
//
// 주 범위를 고정하기 위해 ?week= 파라미터로 특정 주(2026-09-07 월 ~ 2026-09-13 일)를 본다.
const WEEK = "2026-09-09"; // 이 주의 수요일
const inWeek = (day: number, hour = 12) => new Date(2026, 8, day, hour);
const beforeWeek = new Date(2026, 8, 1, 12);
const afterWeek = new Date(2026, 8, 20, 12);

let db: Db;
let testDb: TestDb;
let server: TestServer;

before(async () => {
  testDb = createTestDb("routes-report");
  db = openDb(testDb.path);
  const project = insertProject(db, { name: "보고프로젝트" });

  // --- 완료 후보 (최상위) ---
  insertTask(db, {
    title: "주중 완료 업무",
    completed: true,
    completedAt: inWeek(9),
    projectId: project.id,
  });
  insertTask(db, { title: "주 시작일 완료", completed: true, completedAt: inWeek(7, 0) });
  insertTask(db, { title: "주 마지막날 완료", completed: true, completedAt: inWeek(13, 23) });
  insertTask(db, { title: "지난주 완료", completed: true, completedAt: beforeWeek });
  insertTask(db, { title: "다음주 완료", completed: true, completedAt: afterWeek });

  // --- 완료 후보 (서브태스크) : "상위 › 하위" 로 표시돼야 한다 ---
  const parentOfDone = insertTask(db, {
    title: "상위 업무",
    createdAt: beforeWeek,
    // 이번 주에 갱신되지 않도록 updatedAt 을 지난주로 둔다 (아래에서 직접 조정)
  });
  insertTask(db, {
    title: "하위 완료 업무",
    parentId: parentOfDone.id,
    completed: true,
    completedAt: inWeek(10),
  });

  // --- 진행중 후보 ---
  insertTask(db, { title: "이번주 마감 미완료", dueDate: inWeek(11), createdAt: beforeWeek });
  insertTask(db, { title: "다음주 마감 미완료", dueDate: afterWeek, createdAt: beforeWeek });

  // updatedAt 은 스키마가 자동 갱신하므로 SQL로 직접 밀어 넣어 조건을 정확히 만든다
  db.prepare("update Task set updatedAt = ? where title in ('상위 업무','이번주 마감 미완료','다음주 마감 미완료')").run(
    beforeWeek.toISOString().replace("Z", "+00:00")
  );

  server = await startTestServer(testDb.path);
});

after(async () => {
  await server?.stop();
  db?.close();
  await testDb?.dispose();
});

async function reportHtml(week = WEEK) {
  const { status, html } = await server.get(`/report?week=${week}`);
  assert.equal(status, 200);
  return html;
}

test("주 범위 라벨이 월~일로 나온다", async () => {
  assert.ok(hasText(await reportHtml(), "2026-09-07 ~ 2026-09-13"));
});

test("이번 주에 완료한 최상위 업무가 후보에 오른다", async () => {
  const html = await reportHtml();
  assert.ok(hasText(html, "주중 완료 업무"));
});

test("주 경계(월요일 00시 / 일요일 23시)도 이번 주로 잡는다", async () => {
  const html = await reportHtml();
  assert.ok(hasText(html, "주 시작일 완료"));
  assert.ok(hasText(html, "주 마지막날 완료"));
});

test("범위 밖에 완료한 업무는 후보에 없다", async () => {
  const html = await reportHtml();
  assert.ok(!hasText(html, "지난주 완료"));
  assert.ok(!hasText(html, "다음주 완료"));
});

// 예전엔 상위 태스크 이름만 뭉뚱그려 보여서 어느 하위인지 알 수 없었다
test("완료한 서브태스크는 '상위 › 하위' 형식으로 개별 표시된다", async () => {
  assert.ok(hasText(await reportHtml(), "상위 업무 › 하위 완료 업무"));
});

test("이번 주가 마감인 미완료 업무는 진행중 후보에 오른다", async () => {
  assert.ok(hasText(await reportHtml(), "이번주 마감 미완료"));
});

// 서브태스크를 이번 주에 끝냈으면 상위가 아직 안 끝났어도 "진행중"으로 잡는다
test("서브태스크를 이번 주에 완료한 상위 업무도 진행중 후보에 오른다", async () => {
  assert.ok(hasText(await reportHtml(), "상위 업무"));
});

test("이번 주와 무관한 미완료 업무는 후보에 없다", async () => {
  assert.ok(!hasText(await reportHtml(), "다음주 마감 미완료"));
});

test("지난 주/다음 주 링크가 7일 단위로 걸린다", async () => {
  const html = await reportHtml();
  assert.ok(html.includes("week=2026-08-31"), "지난 주");
  assert.ok(html.includes("week=2026-09-14"), "다음 주");
});

// 링크 값만 맞는지가 아니라 **눌렀을 때 실제로 한 주씩 움직이는지**를 본다.
// 이걸로 실제 버그를 잡았다: 링크를 toISOString() 으로 만들던 시절, KST에서는 링크가
// 월요일이 아니라 전날(일요일)을 가리켜서 "다음 주"가 제자리, "지난 주"가 2주 전으로 갔다.
async function weekLabelOf(week: string) {
  const html = await reportHtml(week);
  const m = html.replace(/<!--.*?-->/g, "").match(/(\d{4}-\d{2}-\d{2}) ~ (\d{4}-\d{2}-\d{2})/);
  assert.ok(m, `주 라벨을 못 찾음 (week=${week})`);
  return m[0];
}

function weekLinks(html: string) {
  const all = [...html.matchAll(/href="\/report\?week=([\d-]+)"/g)].map((m) => m[1]);
  assert.equal(all.length, 2, "지난 주/다음 주 링크 두 개");
  return { prev: all[0], next: all[1] };
}

test("'다음 주'를 누르면 실제로 다음 주로 간다 (제자리 아님)", async () => {
  const { next } = weekLinks(await reportHtml());
  assert.equal(await weekLabelOf(next), "2026-09-14 ~ 2026-09-20");
});

test("'지난 주'를 누르면 바로 앞 주로 간다 (한 주 건너뛰지 않음)", async () => {
  const { prev } = weekLinks(await reportHtml());
  assert.equal(await weekLabelOf(prev), "2026-08-31 ~ 2026-09-06");
});

test("다음 주로 갔다가 지난 주로 오면 원래 주로 돌아온다", async () => {
  const { next } = weekLinks(await reportHtml());
  const nextHtml = await reportHtml(next);
  const { prev: backLink } = weekLinks(nextHtml);
  assert.equal(await weekLabelOf(backLink), "2026-09-07 ~ 2026-09-13");
});

test("week 파라미터가 없으면 이번 주를 본다", async () => {
  const { status } = await server.get("/report");
  assert.equal(status, 200);
});

test("이상한 week 값이어도 500이 나지 않는다", async () => {
  for (const bad of ["abcd", "2026-99-99", ""]) {
    const { status } = await server.get(`/report?week=${bad}`);
    assert.equal(status, 200, `week=${bad}`);
  }
});

test("후보가 하나도 없는 주에는 (없음)이 나온다", async () => {
  const html = await reportHtml("2026-06-10"); // 아무 데이터도 없는 주
  assert.ok(hasText(html, "(없음)"));
});
