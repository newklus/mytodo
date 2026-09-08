import { test } from "node:test";
import assert from "node:assert/strict";
import { truncateMiddle } from "@/lib/truncate";

test("기준 길이 이하면 그대로 둔다", () => {
  assert.equal(truncateMiddle("짧은 이름"), "짧은 이름");
  assert.equal(truncateMiddle("a".repeat(24)), "a".repeat(24));
});

test("기준을 넘으면 가운데를 …으로 줄인다", () => {
  const out = truncateMiddle("a".repeat(30));
  assert.ok(out.includes("…"));
  assert.equal(out.length, 24);
  assert.ok(out.startsWith("a"));
  assert.ok(out.endsWith("a"));
});

// 25자(=경계 바로 위)에서 잘못 잘라 길이가 넘치는 일이 없어야 한다
test("경계 바로 위에서도 결과가 기준 길이를 넘지 않는다", () => {
  for (let n = 1; n <= 60; n++) {
    const out = truncateMiddle("가".repeat(n));
    assert.ok(out.length <= 24, `길이 ${n} → 결과 ${out.length}자`);
  }
});

test("max를 직접 주면 그 길이를 따른다", () => {
  const out = truncateMiddle("abcdefghij", 5);
  assert.equal(out.length, 5);
  assert.ok(out.includes("…"));
});

// 앞뒤를 균등하게 남기고, 남길 글자 수가 홀수면 앞쪽이 하나 더 가져간다.
test("앞뒤를 모두 남긴다 (앞만 남기지 않는다)", () => {
  assert.equal(truncateMiddle("1234567890", 5), "12…90"); // 남길 4자 → 앞 2 / 뒤 2
  assert.equal(truncateMiddle("1234567890", 6), "123…90"); // 남길 5자 → 앞 3 / 뒤 2
});
