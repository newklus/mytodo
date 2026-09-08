import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePlusDate } from "@/lib/plusDate";

// 기준일을 고정해서 "오늘"에 따라 결과가 달라지지 않게 한다.
const REF = new Date(2026, 0, 30, 12, 0, 0); // 2026-01-30 (월말·월 넘김 확인용)

test("+N을 N일 뒤 마감일로 바꾸고 제목에서 지운다", () => {
  assert.deepEqual(parsePlusDate("보고서 +1", REF), { title: "보고서", dueDate: "2026-01-31" });
  assert.deepEqual(parsePlusDate("보고서 +3", REF), { title: "보고서", dueDate: "2026-02-02" });
});

test("+0은 오늘", () => {
  assert.equal(parsePlusDate("오늘까지 +0", REF).dueDate, "2026-01-30");
});

test("+N이 없으면 제목 그대로, 마감일 없음", () => {
  assert.deepEqual(parsePlusDate("그냥 할일", REF), { title: "그냥 할일", dueDate: null });
});

test("문장 시작의 +N도 인식한다", () => {
  assert.deepEqual(parsePlusDate("+2 회의 준비", REF), { title: "회의 준비", dueDate: "2026-02-01" });
});

// 앞뒤가 공백/문장 경계일 때만 인식한다 — 아니면 "a+3" 같은 평범한 텍스트가 날짜로 둔갑한다.
test("앞뒤가 공백이 아니면 마감일로 보지 않는다", () => {
  for (const text of ["버전 v1+2", "1+2 계산", "+3일치"]) {
    assert.equal(parsePlusDate(text, REF).dueDate, null, `"${text}" 는 +N이 아니어야 함`);
  }
});

test("숫자가 아니면 무시한다", () => {
  assert.deepEqual(parsePlusDate("할일 +abc", REF), { title: "할일 +abc", dueDate: null });
});

// 정규식에 /g 가 없다 — 여러 개가 있어도 첫 번째만 소비하는 게 의도된 동작이다.
test("+N이 여러 개면 첫 번째만 쓰고 나머지는 제목에 남는다", () => {
  const r = parsePlusDate("할일 +1 그리고 +5", REF);
  assert.equal(r.dueDate, "2026-01-31");
  assert.equal(r.title, "할일 그리고 +5");
});

test("+N을 걷어낸 자리에 공백이 겹쳐 남지 않는다", () => {
  assert.equal(parsePlusDate("앞 +1 뒤", REF).title, "앞 뒤");
});

// UTC 변환 과정에서 하루가 밀리지 않는지 (로컬 자정 기준으로 잘라야 한다)
test("연말을 넘겨도 날짜가 밀리지 않는다", () => {
  const yearEnd = new Date(2026, 11, 31, 23, 30, 0);
  assert.equal(parsePlusDate("송년 정리 +1", yearEnd).dueDate, "2027-01-01");
});
