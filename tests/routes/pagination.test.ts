import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createTestDb, type TestDb } from "../helpers/testDb";
import { insertTask, openDb, type Db } from "../helpers/factory";
import { paginationInfo, renderedTaskTitles, startTestServer, type TestServer } from "../helpers/server";

// 6회차에 넣은 서버 페이지네이션의 계약을 고정한다.
// 특히 "페이지를 전부 훑었을 때 중복도 누락도 없다"는 건 눈으로는 절대 확인 못 하는 종류다.
const TOTAL = 118; // 페이지 크기(50)로 나누어떨어지지 않게 잡아 마지막 페이지 경계까지 본다
let db: Db;
let testDb: TestDb;
let server: TestServer;

before(async () => {
  testDb = createTestDb("routes-pagination");
  db = openDb(testDb.path);

  // 정렬 규칙(우선순위 → 생성일 → id)이 실제로 갈리도록 우선순위를 섞고,
  // 일부는 생성일까지 같게 만들어 동점 상황을 일부러 만든다.
  const insertMany = db.transaction(() => {
    for (let i = 0; i < TOTAL; i++) {
      insertTask(db, {
        id: `pg${String(i).padStart(4, "0")}`,
        title: `페이지 태스크 ${String(i).padStart(3, "0")}`,
        priority: (i % 4) + 1,
        // 40건은 생성일을 완전히 동일하게 → 타이브레이커 없이는 페이지 경계가 흔들린다
        createdAt: i < 40 ? new Date(2026, 0, 1) : new Date(2026, 0, 1, 0, i),
      });
    }
  });
  insertMany();

  server = await startTestServer(testDb.path);
});

after(async () => {
  await server?.stop();
  db?.close();
  await testDb?.dispose();
});

test("기본 페이지 크기는 50이고, 1페이지에 50건이 보인다", async () => {
  const { status, html } = await server.get("/?view=all");
  assert.equal(status, 200);
  assert.equal(renderedTaskTitles(html).length, 50);

  const info = paginationInfo(html);
  assert.deepEqual(info, { page: 1, totalPages: 3, from: 1, to: 50, total: TOTAL });
});

// 이 테스트가 페이지네이션의 핵심 계약이다
test("모든 페이지를 훑으면 중복도 누락도 없다", async () => {
  const seen: string[] = [];
  for (let page = 1; page <= 3; page++) {
    const { status, html } = await server.get(`/?view=all&page=${page}`);
    assert.equal(status, 200, `${page}페이지`);
    seen.push(...renderedTaskTitles(html));
  }

  assert.equal(seen.length, TOTAL, "전부 합치면 총 개수와 같아야 한다");
  assert.equal(new Set(seen).size, TOTAL, "같은 항목이 두 페이지에 나오면 안 된다");
});

test("마지막 페이지는 나머지 개수만 보여준다", async () => {
  const { html } = await server.get("/?view=all&page=3");
  assert.equal(renderedTaskTitles(html).length, TOTAL - 100);
  assert.deepEqual(paginationInfo(html), { page: 3, totalPages: 3, from: 101, to: 118, total: TOTAL });
});

test("범위를 넘는 ?page= 는 마지막 페이지로 당겨온다", async () => {
  const { status, html } = await server.get("/?view=all&page=99");
  assert.equal(status, 200);
  assert.equal(paginationInfo(html)?.page, 3);
});

test("이상한 ?page= 값은 첫 페이지로 취급한다", async () => {
  for (const bad of ["0", "-1", "abc", ""]) {
    const { status, html } = await server.get(`/?view=all&page=${bad}`);
    assert.equal(status, 200, `page=${bad}`);
    assert.equal(paginationInfo(html)?.page, 1, `page=${bad}`);
  }
});

test("페이지당 개수 쿠키를 따른다", async () => {
  const { html } = await server.get("/?view=all", { cookie: "mytodo_page_size=10" });
  assert.equal(renderedTaskTitles(html).length, 10);
  assert.deepEqual(paginationInfo(html), { page: 1, totalPages: 12, from: 1, to: 10, total: TOTAL });
});

test("페이지당 개수를 바꿔도 전 페이지 합계는 그대로다 (중복/누락 없음)", async () => {
  const seen: string[] = [];
  for (let page = 1; page <= 12; page++) {
    const { html } = await server.get(`/?view=all&page=${page}`, { cookie: "mytodo_page_size=10" });
    seen.push(...renderedTaskTitles(html));
  }
  assert.equal(seen.length, TOTAL);
  assert.equal(new Set(seen).size, TOTAL);
});

test("쿠키의 페이지 크기가 상한을 넘으면 200으로 잘린다", async () => {
  const { html } = await server.get("/?view=all", { cookie: "mytodo_page_size=9999" });
  assert.equal(renderedTaskTitles(html).length, TOTAL, "118건이 전부 한 페이지에 들어간다");
  assert.equal(paginationInfo(html), null, "한 페이지면 표시줄이 없다");
});

test("칸반 레이아웃에도 페이지네이션이 적용된다", async () => {
  for (const layout of ["priority", "project", "tag"]) {
    const { status, html } = await server.get(`/?view=all&layout=${layout}`);
    assert.equal(status, 200, layout);
    assert.equal(paginationInfo(html)?.total, TOTAL, layout);
    // 칸반은 한 페이지분을 컬럼으로 재배열할 뿐이라 카드 수는 페이지 크기와 같다
    assert.equal(renderedTaskTitles(html).length, 50, layout);
  }
});

test("한 페이지에 다 들어가면 페이지 표시줄이 아예 없다", async () => {
  const { html } = await server.get("/?view=completed"); // 완료 태스크는 시드에 없음
  assert.equal(paginationInfo(html), null);
});

// 정렬은 우선순위 → 생성일 → id. 동점이 40건 섞여 있어도 페이지 경계가 흔들리면 안 된다.
test("정렬 순서가 페이지를 넘나들며 유지된다 (우선순위 오름차순)", async () => {
  const titles: string[] = [];
  for (let page = 1; page <= 3; page++) {
    const { html } = await server.get(`/?view=all&page=${page}`);
    titles.push(...renderedTaskTitles(html));
  }
  // 시드에서 priority = (i % 4) + 1 이므로 P1이 30건(0,4,8,...116), P2~P4가 각 29/30건.
  const priorityOf = (title: string) => (Number(title.slice(-3)) % 4) + 1;
  const priorities = titles.map(priorityOf);
  const sorted = [...priorities].sort((a, b) => a - b);
  assert.deepEqual(priorities, sorted, "전체를 이어붙이면 우선순위 오름차순이어야 한다");
});

test("같은 요청을 두 번 해도 같은 결과가 나온다 (동점 정렬이 안정적)", async () => {
  const first = renderedTaskTitles((await server.get("/?view=all&page=2")).html);
  const second = renderedTaskTitles((await server.get("/?view=all&page=2")).html);
  assert.deepEqual(first, second);
});
