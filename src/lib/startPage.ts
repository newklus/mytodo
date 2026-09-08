// "/"를 파라미터 없이 열었을 때(=앱을 새로 켰을 때) 어느 화면으로 보여줄지 정하는 설정.
// 서버(page.tsx)와 클라이언트(Sidebar.tsx) 양쪽에서 쓰므로 훅이나 "use client" 없이 순수하게 둔다.
// 값 자체는 쿠키에 저장한다 — localStorage와 달리 서버 컴포넌트가 첫 렌더에서 바로 읽을 수 있어서,
// 클라이언트 리다이렉트로 인한 깜빡임 없이 시작 페이지를 고를 수 있다.
export type StartPage = "today" | "all" | "calendar";

export const DEFAULT_START_PAGE: StartPage = "today";

export const START_PAGE_LABELS: Record<StartPage, string> = {
  today: "오늘",
  all: "전체",
  calendar: "캘린더",
};

export const START_PAGE_COOKIE = "mytodo_start_page";

export function isStartPage(value: string | undefined | null): value is StartPage {
  return value === "today" || value === "all" || value === "calendar";
}

export function getStartPageFromCookieString(cookieString: string): StartPage {
  const match = cookieString.match(new RegExp(`(?:^|; )${START_PAGE_COOKIE}=([^;]*)`));
  const value = match ? decodeURIComponent(match[1]) : null;
  return isStartPage(value) ? value : DEFAULT_START_PAGE;
}

export function setStartPageCookie(value: StartPage) {
  if (typeof document === "undefined") return;
  document.cookie = `${START_PAGE_COOKIE}=${value}; path=/; max-age=31536000; samesite=lax`;
}
