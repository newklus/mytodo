"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

const STORAGE_KEY = "mytodo:calendarGridPercent";
const DEFAULT_PERCENT = 60; // 기존 flex-[3]:flex-[2] 비율과 동일 (3/5)
const MIN_PERCENT = 30;
const MAX_PERCENT = 80;

export default function CalendarSplit({ left, right }: { left: ReactNode; right: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [percent, setPercent] = useState(DEFAULT_PERCENT);
  const [dragging, setDragging] = useState(false);

  // 마운트 후에 저장된 값을 읽어야 SSR 결과(기본값)와 하이드레이션이 어긋나지 않는다.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = Number(saved);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (Number.isFinite(parsed) && parsed >= MIN_PERCENT && parsed <= MAX_PERCENT) setPercent(parsed);
      }
    } catch {}
  }, []);

  const handleMove = useCallback((clientX: number) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const next = ((clientX - rect.left) / rect.width) * 100;
    setPercent(Math.min(MAX_PERCENT, Math.max(MIN_PERCENT, next)));
  }, []);

  useEffect(() => {
    if (!dragging) return;
    function onMouseMove(e: MouseEvent) {
      handleMove(e.clientX);
    }
    function onMouseUp() {
      setDragging(false);
      setPercent((p) => {
        try {
          window.localStorage.setItem(STORAGE_KEY, String(p));
        } catch {}
        return p;
      });
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
      <div className="min-w-0" style={{ width: `calc(${percent}% - 0.75rem)` }}>
        {left}
      </div>
      <div
        onMouseDown={() => setDragging(true)}
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
