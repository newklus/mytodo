"use client";

import { useEffect, useState } from "react";

export const DEFAULT_SIDEBAR_WIDTH = 224; // 기존 w-56(14rem)과 동일
export const MIN_SIDEBAR_WIDTH = 180;
export const MAX_SIDEBAR_WIDTH = 400;

const STORAGE_KEY = "mytodo:sidebarWidth";
const CHANGE_EVENT = "mytodo:sidebar-width-change";

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

// live: 드래그 중 실시간 폭(하단 단축키 바가 같이 따라오도록). persist: 드래그가 끝났을 때만 저장.
export function announceSidebarWidth(width: number, persist: boolean) {
  if (persist) {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(width));
    } catch {}
  }
  window.dispatchEvent(new CustomEvent<number>(CHANGE_EVENT, { detail: width }));
}

// ShortcutBar처럼 사이드바 자신이 아닌 다른 컴포넌트가 현재 폭을 따라가야 할 때 사용.
export function useSidebarWidth() {
  const [width, setWidth] = useState(DEFAULT_SIDEBAR_WIDTH);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWidth(getSidebarWidth());
    function handleChange(e: Event) {
      const detail = (e as CustomEvent<number>).detail;
      setWidth(typeof detail === "number" ? detail : getSidebarWidth());
    }
    window.addEventListener(CHANGE_EVENT, handleChange);
    return () => window.removeEventListener(CHANGE_EVENT, handleChange);
  }, []);

  return width;
}
