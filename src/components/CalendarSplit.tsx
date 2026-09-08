"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

const STORAGE_KEY = "mytodo:calendarGridPercent";
const DEFAULT_PERCENT = 60; // 기존 flex-[3]:flex-[2] 비율과 동일 (3/5)
const MIN_PERCENT = 30;
const MAX_PERCENT = 80;

// 사이드바(sidebarWidth.ts)와 같은 이유로, 드래그 중에는 리액트 상태 대신 CSS 변수만 갱신한다.
// 예전에는 mousemove마다 setState가 돌면서 그리드와 사이드 패널(=TaskList 전체)이 통째로
// 다시 렌더됐다. 비율은 스타일 값 하나일 뿐이라 렌더 트리를 다시 만들 이유가 없다.
const CSS_VAR = "--mytodo-calendar-grid-percent";
const PERCENT_VAR = `var(${CSS_VAR}, ${DEFAULT_PERCENT})`;

function readStoredPercent() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = Number(saved);
      if (Number.isFinite(parsed) && parsed >= MIN_PERCENT && parsed <= MAX_PERCENT) return parsed;
    }
  } catch {}
  return DEFAULT_PERCENT;
}

function applyPercent(percent: number, persist: boolean) {
  document.documentElement.style.setProperty(CSS_VAR, String(percent));
  if (persist) {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(percent));
    } catch {}
  }
}

export default function CalendarSplit({ left, right }: { left: ReactNode; right: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  // 컨테이너의 좌표·폭은 드래그하는 동안 변하지 않으므로 시작할 때 한 번만 재둔다
  // (mousemove마다 getBoundingClientRect()를 부르면 그때마다 강제 레이아웃이 걸린다).
  const dragRectRef = useRef({ left: 0, width: 1 });
  const percentRef = useRef(DEFAULT_PERCENT);

  // 저장된 값은 렌더 결과가 아니라 DOM 스타일(CSS 변수)로만 반영하므로 하이드레이션과 무관하다.
  useEffect(() => {
    percentRef.current = readStoredPercent();
    applyPercent(percentRef.current, false);
  }, []);

  const handleMove = useCallback((clientX: number) => {
    const { left: originX, width } = dragRectRef.current;
    const next = ((clientX - originX) / width) * 100;
    const clamped = Math.min(MAX_PERCENT, Math.max(MIN_PERCENT, next));
    percentRef.current = clamped;
    applyPercent(clamped, false);
  }, []);

  useEffect(() => {
    if (!dragging) return;
    function onMouseMove(e: MouseEvent) {
      handleMove(e.clientX);
    }
    function onMouseUp() {
      setDragging(false);
      applyPercent(percentRef.current, true);
    }
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [dragging, handleMove]);

  return (
    <div ref={containerRef} className="flex">
      <div className="min-w-0" style={{ width: `calc(${PERCENT_VAR} * 1% - 0.75rem)` }}>
        {left}
      </div>
      <div
        onMouseDown={() => {
          const rect = containerRef.current?.getBoundingClientRect();
          if (rect) dragRectRef.current = { left: rect.left, width: rect.width || 1 };
          setDragging(true);
        }}
        role="separator"
        aria-orientation="vertical"
        aria-label="캘린더/패널 크기 조절"
        className={`mx-1 w-1.5 shrink-0 cursor-col-resize rounded hover:bg-black/10 dark:hover:bg-white/10 ${
          dragging ? "bg-black/20 dark:bg-white/20" : ""
        }`}
      />
      <div className="min-w-0 flex-1 border-l border-black/10 pl-6 dark:border-white/10">{right}</div>
    </div>
  );
}
