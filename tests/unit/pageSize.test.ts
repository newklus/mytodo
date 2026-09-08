import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MIN_PAGE_SIZE,
  PAGE_SIZE_COOKIE,
  clampPageSize,
  getPageSizeFromCookieString,
  parsePageParam,
  parsePageSize,
} from "@/lib/pageSize";

test("clampPageSize: 범위를 벗어나면 끌어당긴다", () => {
  assert.equal(clampPageSize(50), 50);
  assert.equal(clampPageSize(500), MAX_PAGE_SIZE);
  assert.equal(clampPageSize(0), MIN_PAGE_SIZE);
  assert.equal(clampPageSize(-5), MIN_PAGE_SIZE);
  assert.equal(clampPageSize(MAX_PAGE_SIZE), MAX_PAGE_SIZE);
});

test("clampPageSize: 소수점은 버리고, 숫자가 아니면 기본값", () => {
  assert.equal(clampPageSize(10.9), 10);
  assert.equal(clampPageSize(NaN), DEFAULT_PAGE_SIZE);
  assert.equal(clampPageSize(Infinity), DEFAULT_PAGE_SIZE);
});

// 설정 입력창에 사용자가 무엇을 넣든 앱이 깨지면 안 된다 (빈 값·문자·공백)
test("parsePageSize: 쓰레기 입력은 전부 기본값으로", () => {
  for (const bad of [undefined, null, "", "abc", "  ", "-", "1e999"]) {
    assert.equal(parsePageSize(bad as string | undefined | null), DEFAULT_PAGE_SIZE, `입력 ${JSON.stringify(bad)}`);
  }
});

test("parsePageSize: 정상 입력과 범위 보정", () => {
  assert.equal(parsePageSize("10"), 10);
  assert.equal(parsePageSize("999"), MAX_PAGE_SIZE);
  assert.equal(parsePageSize("0"), DEFAULT_PAGE_SIZE); // 1 미만은 기본값으로 되돌린다
});

test("getPageSizeFromCookieString: 쿠키가 여러 개 섞여 있어도 자기 값만 읽는다", () => {
  assert.equal(getPageSizeFromCookieString(`${PAGE_SIZE_COOKIE}=25`), 25);
  assert.equal(getPageSizeFromCookieString(`mytodo_start_page=all; ${PAGE_SIZE_COOKIE}=25; other=1`), 25);
  assert.equal(getPageSizeFromCookieString("mytodo_start_page=all"), DEFAULT_PAGE_SIZE);
  assert.equal(getPageSizeFromCookieString(""), DEFAULT_PAGE_SIZE);
});

// 이름이 겹치는 쿠키에 낚이면 안 된다
test("getPageSizeFromCookieString: 접두사만 같은 쿠키에 속지 않는다", () => {
  assert.equal(getPageSizeFromCookieString(`not_${PAGE_SIZE_COOKIE}=7`), DEFAULT_PAGE_SIZE);
});

// URL의 ?page= 는 1-based, 내부 계산은 0-based
test("parsePageParam: 1-based 파라미터를 0-based 인덱스로", () => {
  assert.equal(parsePageParam("1"), 0);
  assert.equal(parsePageParam("99"), 98);
});

test("parsePageParam: 없거나 이상한 값이면 첫 페이지", () => {
  for (const bad of [undefined, "", "0", "-3", "abc", "1.5.2"]) {
    assert.equal(parsePageParam(bad as string | undefined), 0, `입력 ${JSON.stringify(bad)}`);
  }
});
