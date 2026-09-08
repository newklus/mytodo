// 목록 화면(전체/오늘/예정/완료)에서 한 페이지에 보여줄 태스크 개수.
// 자르는 일을 클라이언트가 아니라 DB 쿼리에서 하므로, 서버 컴포넌트가 첫 렌더에서 값을 알아야 한다.
// 그래서 startPage.ts와 같은 이유·같은 방식으로 훅이나 "use client" 없이 순수하게 두고 쿠키에 저장한다.
export const PAGE_SIZE_COOKIE = "mytodo_page_size";

export const DEFAULT_PAGE_SIZE = 50;
export const MIN_PAGE_SIZE = 1;
// SQLite 파라미터 한도(999) 때문에 관계까지 include 한 조회는 대략 1000행에서 터진다.
// 200이면 그 한참 아래라 안전하고, 한 화면에서 다루기에도 이 정도가 상한선이다.
export const MAX_PAGE_SIZE = 200;

export function clampPageSize(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_PAGE_SIZE;
  return Math.min(MAX_PAGE_SIZE, Math.max(MIN_PAGE_SIZE, Math.trunc(value)));
}

export function parsePageSize(value: string | undefined | null): number {
  if (!value) return DEFAULT_PAGE_SIZE;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= MIN_PAGE_SIZE ? clampPageSize(parsed) : DEFAULT_PAGE_SIZE;
}

export function getPageSizeFromCookieString(cookieString: string): number {
  const match = cookieString.match(new RegExp(`(?:^|; )${PAGE_SIZE_COOKIE}=([^;]*)`));
  return parsePageSize(match ? decodeURIComponent(match[1]) : null);
}

export function setPageSizeCookie(value: number) {
  if (typeof document === "undefined") return;
  document.cookie = `${PAGE_SIZE_COOKIE}=${clampPageSize(value)}; path=/; max-age=31536000; samesite=lax`;
}

// "?page=2" 파라미터 → 0-based 페이지 인덱스. 이상한 값은 전부 첫 페이지로.
export function parsePageParam(value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return 0;
  return Math.trunc(parsed) - 1;
}
