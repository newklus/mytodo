import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_START_PAGE,
  START_PAGE_COOKIE,
  START_PAGE_LABELS,
  getStartPageFromCookieString,
  isStartPage,
} from "@/lib/startPage";

test("isStartPage: 허용된 세 값만 통과", () => {
  for (const ok of ["today", "all", "calendar"]) assert.equal(isStartPage(ok), true, ok);
  for (const bad of ["upcoming", "completed", "report", "", undefined, null, "TODAY"]) {
    assert.equal(isStartPage(bad as string | undefined | null), false, JSON.stringify(bad));
  }
});

// "예정"·"완료"는 시작 페이지 선택지가 아니다 — 라벨과 타입이 어긋나면 설정 화면이 깨진다
test("라벨은 허용된 값 전부에 대해, 그것만 있다", () => {
  assert.deepEqual(Object.keys(START_PAGE_LABELS).sort(), ["all", "calendar", "today"]);
  for (const key of Object.keys(START_PAGE_LABELS)) assert.equal(isStartPage(key), true);
});

test("쿠키에서 값을 읽는다", () => {
  assert.equal(getStartPageFromCookieString(`${START_PAGE_COOKIE}=all`), "all");
  assert.equal(getStartPageFromCookieString(`${START_PAGE_COOKIE}=calendar`), "calendar");
});

test("쿠키가 여러 개 섞여 있어도 자기 값만 읽는다", () => {
  assert.equal(
    getStartPageFromCookieString(`mytodo_page_size=25; ${START_PAGE_COOKIE}=all; foo=bar`),
    "all"
  );
});

test("없거나 이상한 값이면 기본값(오늘)", () => {
  assert.equal(getStartPageFromCookieString(""), DEFAULT_START_PAGE);
  assert.equal(getStartPageFromCookieString("foo=bar"), DEFAULT_START_PAGE);
  assert.equal(getStartPageFromCookieString(`${START_PAGE_COOKIE}=upcoming`), DEFAULT_START_PAGE);
});

test("접두사만 같은 쿠키에 속지 않는다", () => {
  assert.equal(getStartPageFromCookieString(`not_${START_PAGE_COOKIE}=all`), DEFAULT_START_PAGE);
});
