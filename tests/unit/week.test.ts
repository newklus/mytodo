import { test } from "node:test";
import assert from "node:assert/strict";
import { formatISODate, formatWeekLabel, getWeekRange } from "@/lib/week";

// 주간보고는 "월요일 00:00 ~ 일요일 23:59:59.999" 를 한 주로 본다.
test("주의 시작은 항상 월요일 00:00", () => {
  // 2026-09-09 는 수요일
  const { start } = getWeekRange(new Date(2026, 8, 9, 15, 30));
  assert.equal(start.getDay(), 1);
  assert.equal(formatISODate(start), "2026-09-07");
  assert.deepEqual(
    [start.getHours(), start.getMinutes(), start.getSeconds(), start.getMilliseconds()],
    [0, 0, 0, 0]
  );
});

test("주의 끝은 일요일 23:59:59.999", () => {
  const { end } = getWeekRange(new Date(2026, 8, 9, 15, 30));
  assert.equal(end.getDay(), 0);
  assert.equal(formatISODate(end), "2026-09-13");
  assert.deepEqual(
    [end.getHours(), end.getMinutes(), end.getSeconds(), end.getMilliseconds()],
    [23, 59, 59, 999]
  );
});

// 일요일은 "다음 주 시작"이 아니라 "이번 주 마지막 날"이다 — 경계에서 가장 틀리기 쉬운 지점
test("일요일을 기준으로 잡아도 그 주(월~일)가 나온다", () => {
  const { start, end } = getWeekRange(new Date(2026, 8, 13, 0, 0)); // 일요일
  assert.equal(formatISODate(start), "2026-09-07");
  assert.equal(formatISODate(end), "2026-09-13");
});

test("월요일을 기준으로 잡으면 그날이 시작", () => {
  const { start } = getWeekRange(new Date(2026, 8, 7, 23, 59));
  assert.equal(formatISODate(start), "2026-09-07");
});

test("주가 달을 걸쳐도 정상", () => {
  const { start, end } = getWeekRange(new Date(2026, 8, 2)); // 2026-09-02 수요일
  assert.equal(formatISODate(start), "2026-08-31");
  assert.equal(formatISODate(end), "2026-09-06");
});

test("주가 연말을 걸쳐도 정상", () => {
  const { start, end } = getWeekRange(new Date(2026, 11, 31)); // 목요일
  assert.equal(formatISODate(start), "2026-12-28");
  assert.equal(formatISODate(end), "2027-01-03");
});

test("formatISODate는 한 자리 월/일에 0을 채운다", () => {
  assert.equal(formatISODate(new Date(2026, 0, 5)), "2026-01-05");
});

test("formatWeekLabel", () => {
  const { start, end } = getWeekRange(new Date(2026, 8, 9));
  assert.equal(formatWeekLabel(start, end), "2026-09-07 ~ 2026-09-13");
});

test("기준으로 넘긴 Date를 훼손하지 않는다", () => {
  const ref = new Date(2026, 8, 9, 15, 30);
  const snapshot = ref.getTime();
  getWeekRange(ref);
  assert.equal(ref.getTime(), snapshot);
});
