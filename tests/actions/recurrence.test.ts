import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createTestDb, disconnectPrisma, type TestDb } from "../helpers/testDb";
import { getTask, insertTask, localDateKey, openDb, taskTitles, type Db } from "../helpers/factory";

// ⚠ DB부터 만들고 DATABASE_URL을 돌려놓은 뒤에 액션을 늦게 불러온다.
// src/lib/prisma.ts 는 모듈 로드 시점에 DATABASE_URL 을 붙잡기 때문이다.
let db: Db;
let testDb: TestDb;
let toggleTaskComplete: typeof import("@/lib/actions/tasks").toggleTaskComplete;

before(async () => {
  testDb = createTestDb("recurrence");
  ({ toggleTaskComplete } = await import("@/lib/actions/tasks"));
  db = openDb(testDb.path);
});

after(async () => {
  db?.close();
  await disconnectPrisma();
  await testDb?.dispose();
});

async function completeAndGetNext(seed: Parameters<typeof insertTask>[1]) {
  const before = insertTask(db, seed);
  await toggleTaskComplete(before.id, true);
  const spawned = db
    .prepare("select * from Task where id != ? and title = ? order by createdAt desc")
    .all(before.id, before.title);
  return { original: getTask(db, before.id), spawned };
}

// 실제로 있었던 버그: setMonth()를 그대로 쓰면 1/31 + 1개월이 2/31 → 3/3 으로 넘쳐버렸다.
test("매월 반복: 1/31 완료 → 다음 회차는 2/28 (말일로 클램프)", async () => {
  const { spawned } = await completeAndGetNext({
    title: "월말 정산 2026",
    dueDate: new Date(2026, 0, 31),
    recurrence: "MONTHLY",
  });
  assert.equal(spawned.length, 1);
  assert.equal(localDateKey(spawned[0].dueDate), "2026-02-28");
});

test("매월 반복: 윤년이면 2/29 로 클램프", async () => {
  const { spawned } = await completeAndGetNext({
    title: "월말 정산 2028",
    dueDate: new Date(2028, 0, 31), // 2028은 윤년
    recurrence: "MONTHLY",
  });
  assert.equal(localDateKey(spawned[0].dueDate), "2028-02-29");
});

test("매월 반복: 대상 월에 그 날짜가 있으면 그대로 유지", async () => {
  const { spawned } = await completeAndGetNext({
    title: "중순 점검",
    dueDate: new Date(2026, 2, 15),
    recurrence: "MONTHLY",
  });
  assert.equal(localDateKey(spawned[0].dueDate), "2026-04-15");
});

test("매월 반복: 연말을 넘어가면 해가 바뀐다", async () => {
  const { spawned } = await completeAndGetNext({
    title: "연말 마감",
    dueDate: new Date(2026, 11, 31),
    recurrence: "MONTHLY",
  });
  assert.equal(localDateKey(spawned[0].dueDate), "2027-01-31");
});

test("매일 반복: 다음 날", async () => {
  const { spawned } = await completeAndGetNext({
    title: "일일 스탠드업",
    dueDate: new Date(2026, 1, 28),
    recurrence: "DAILY",
  });
  assert.equal(localDateKey(spawned[0].dueDate), "2026-03-01");
});

test("매주 반복: 7일 뒤", async () => {
  const { spawned } = await completeAndGetNext({
    title: "주간 회의",
    dueDate: new Date(2026, 8, 9),
    recurrence: "WEEKLY",
  });
  assert.equal(localDateKey(spawned[0].dueDate), "2026-09-16");
});

test("원본은 완료 상태로 보존된다 (이력이 남아야 함)", async () => {
  const { original } = await completeAndGetNext({
    title: "보존 확인",
    dueDate: new Date(2026, 5, 1),
    recurrence: "MONTHLY",
  });
  assert.equal(original.completed, 1);
  assert.ok(original.completedAt);
});

test("다음 회차는 제목·설명·우선순위·프로젝트·반복규칙만 복사하고 미완료로 생긴다", async () => {
  const parentSeed = {
    title: "속성 복사 확인",
    description: "메모 내용",
    dueDate: new Date(2026, 5, 10),
    priority: 1,
    recurrence: "WEEKLY" as const,
  };
  const { spawned } = await completeAndGetNext(parentSeed);
  const next = spawned[0];
  assert.equal(next.description, "메모 내용");
  assert.equal(next.priority, 1);
  assert.equal(next.recurrence, "WEEKLY");
  assert.equal(next.completed, 0);
  assert.equal(next.completedAt, null);
});

test("마감일이 없는 반복 태스크는 다음 회차를 만들지 않는다", async () => {
  const { spawned } = await completeAndGetNext({
    title: "마감일 없는 반복",
    dueDate: null,
    recurrence: "MONTHLY",
  });
  assert.equal(spawned.length, 0);
});

test("반복이 아니면 다음 회차를 만들지 않는다", async () => {
  const { spawned } = await completeAndGetNext({
    title: "일반 태스크",
    dueDate: new Date(2026, 5, 20),
    recurrence: null,
  });
  assert.equal(spawned.length, 0);
});

test("완료 취소는 다음 회차를 만들지 않는다", async () => {
  const t = insertTask(db, {
    title: "취소 확인",
    dueDate: new Date(2026, 6, 1),
    recurrence: "MONTHLY",
    completed: true,
    completedAt: new Date(2026, 6, 1),
  });
  await toggleTaskComplete(t.id, false);
  assert.equal(taskTitles(db, "title = '취소 확인'").length, 1);
  assert.equal(getTask(db, t.id).completed, 0);
  assert.equal(getTask(db, t.id).completedAt, null);
});
