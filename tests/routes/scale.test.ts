import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createTestDb, type TestDb } from "../helpers/testDb";
import { insertProject, insertTag, insertTask, linkTag, openDb, type Db } from "../helpers/factory";
import { paginationInfo, renderedTaskTitles, startTestServer, type TestServer } from "../helpers/server";

// 6회차에 발견한 버그를 잡아두는 테스트다.
//
// 목록이 조건에 맞는 태스크를 **전부** 가져오던 시절, 관계까지 include 하는 조회라
// Prisma가 행 수만큼 바인드 파라미터를 만들었고, SQLite 한도(999)를 넘으면 페이지가
// 느려지는 게 아니라 **500(P2029)으로 죽었다**. 실측 임계점은 미완료 최상위 900건 정상 /
// 1,125건 실패. 그래서 그 한참 위인 1,500건으로 시드해 전 라우트가 200인지 확인한다.
//
// 페이지네이션이 있는 한 화면 비용은 페이지 크기에만 비례하므로 이 테스트는 빨라야 정상이다.
const TOP_LEVEL = 1500;
let db: Db;
let testDb: TestDb;
let server: TestServer;

before(async () => {
  testDb = createTestDb("routes-scale");
  db = openDb(testDb.path);

  const seed = db.transaction(() => {
    const projects = Array.from({ length: 5 }, (_, i) => insertProject(db, { name: `대량프로젝트${i}` }));
    const tags = Array.from({ length: 5 }, (_, i) => insertTag(db, { name: `대량태그${i}` }));
    const now = Date.now();

    for (let i = 0; i < TOP_LEVEL; i++) {
      // 미완료가 1,000건을 넉넉히 넘도록 완료는 20%만
      const completed = i % 5 === 0;
      const hasDue = i % 10 < 6;
      const task = insertTask(db, {
        id: `sc${String(i).padStart(5, "0")}`,
        title: `대량 태스크 ${i}`,
        // 마감일을 오늘 기준 ±10일에 몰아 넣어 오늘/예정/캘린더 뷰에도 대량으로 걸리게 한다
        dueDate: hasDue ? new Date(now + ((i % 21) - 10) * 86400000) : null,
        priority: (i % 4) + 1,
        completed,
        completedAt: completed ? new Date(now - (i % 10) * 86400000) : null,
        projectId: i % 7 === 0 ? null : projects[i % projects.length].id,
        createdAt: new Date(2026, 0, 1, 0, 0, i % 60),
      });
      if (i % 3 === 0) linkTag(db, task.id, tags[i % tags.length].id);
      if (i % 20 === 0) insertTask(db, { title: `대량 자식 ${i}`, parentId: task.id });
    }
  });
  seed();

  server = await startTestServer(testDb.path);
});

after(async () => {
  await server?.stop();
  db?.close();
  await testDb?.dispose();
});

test("선행 조건: 미완료 최상위가 1,000건을 넘는다 (예전이라면 죽는 구간)", () => {
  const open = db.prepare("select count(*) c from Task where parentId is null and completed = 0").get().c;
  assert.ok(open > 1000, `미완료 최상위 ${open}건`);
});

test("1,500건에서 모든 목록 뷰가 200을 낸다", async () => {
  for (const view of ["all", "today", "upcoming", "completed"]) {
    const { status } = await server.get(`/?view=${view}`);
    assert.equal(status, 200, `view=${view}`);
  }
});

test("1,500건에서 칸반 3종이 200을 낸다", async () => {
  for (const layout of ["priority", "project", "tag"]) {
    const { status } = await server.get(`/?view=all&layout=${layout}`);
    assert.equal(status, 200, `layout=${layout}`);
  }
});

test("1,500건에서 캘린더와 주간보고가 200을 낸다", async () => {
  assert.equal((await server.get("/calendar")).status, 200);
  assert.equal((await server.get("/report")).status, 200);
});

test("페이지 크기를 상한(200)으로 올려도 죽지 않는다", async () => {
  const { status, html } = await server.get("/?view=all", { cookie: "mytodo_page_size=200" });
  assert.equal(status, 200);
  assert.equal(renderedTaskTitles(html).length, 200);
});

// "데이터가 늘어도 화면 비용은 페이지 크기에만 비례한다"는 게 6회차 최적화의 요점이다.
test("렌더되는 행 수는 데이터량이 아니라 페이지 크기를 따른다", async () => {
  const { html } = await server.get("/?view=all");
  assert.equal(renderedTaskTitles(html).length, 50);
  assert.ok((paginationInfo(html)?.total ?? 0) > 1000, "총 개수는 전체를 세서 보여준다");
});

test("마지막 페이지까지 이동해도 200이다", async () => {
  const info = paginationInfo((await server.get("/?view=all")).html);
  assert.ok(info);
  const { status, html } = await server.get(`/?view=all&page=${info.totalPages}`);
  assert.equal(status, 200);
  assert.equal(paginationInfo(html)?.page, info.totalPages);
});

test("프로젝트 필터를 걸어도 200이다", async () => {
  const projectId = db.prepare("select id from Project limit 1").get().id;
  assert.equal((await server.get(`/?view=all&project=${projectId}`)).status, 200);
  assert.equal((await server.get(`/calendar?project=${projectId}`)).status, 200);
});
