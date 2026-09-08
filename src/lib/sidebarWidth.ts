"use client";

import { useEffect } from "react";

export const DEFAULT_SIDEBAR_WIDTH = 224; // 기존 w-56(14rem)과 동일
export const MIN_SIDEBAR_WIDTH = 180;
export const MAX_SIDEBAR_WIDTH = 400;

const STORAGE_KEY = "mytodo:sidebarWidth";
// 사이드바 폭은 사이드바 자신(width)과 하단 단축키 바(margin-left) 두 군데가 같이 따라가야 한다.
// 예전에는 커스텀 이벤트로 폭을 흘려보내고 양쪽이 useState로 받았는데, 그러면 드래그하는 동안
// mousemove마다 두 컴포넌트가 각각 리렌더됐다(태스크 1,000건 화면에서 1틱 55ms까지 나옴).
// 지금은 :root의 CSS 변수 하나만 갱신하고 양쪽 스타일이 그 변수를 참조한다 — 드래그 중
// 리액트 렌더는 0회가 되고, 브라우저가 스타일만 다시 계산한다.
const CSS_VAR = "--mytodo-sidebar-width";

export const SIDEBAR_WIDTH_VAR = `var(${CSS_VAR}, ${DEFAULT_SIDEBAR_WIDTH}px)`;

export function getSidebarWidth(): number {
  if (typeof window === "undefined") return DEFAULT_SIDEBAR_WIDTH;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = Number(saved);
      if (Number.isFinite(parsed) && parsed >= MIN_SIDEBAR_WIDTH && parsed <= MAX_SIDEBAR_WIDTH) return parsed;
    }
  } catch {}
  return DEFAULT_SIDEBAR_WIDTH;
}

// 드래그 중에는 persist=false로 화면만 따라오게 하고, 드래그가 끝났을 때만 저장한다.
export function applySidebarWidth(width: number, persist: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty(CSS_VAR, `${width}px`);
  if (persist) {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(width));
    } catch {}
  }
}

// 저장된 폭을 CSS 변수로 올려둔다. 서버 렌더 결과에는 변수가 없어 기본값(224px)으로 그려지고,
// 마운트 직후 이 훅이 실제 값으로 바꾼다 — 렌더 결과를 바꾸는 게 아니라 DOM 스타일만 건드리므로
// 하이드레이션 불일치가 나지 않는다.
export function useStoredSidebarWidth() {
  useEffect(() => {
    applySidebarWidth(getSidebarWidth(), false);
  }, []);
}
