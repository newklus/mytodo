"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createProject } from "@/lib/actions/projects";
import PriorityColorPicker from "@/components/PriorityColorPicker";
import TagColorPicker from "@/components/TagColorPicker";
import { DEFAULT_MEMO_EXPANDED, getMemoDefaultExpanded, setMemoDefaultExpanded } from "@/lib/memoSettings";
import { DEFAULT_PRIORITY_COLORS } from "@/lib/priorityColors";
import {
  DEFAULT_SIDEBAR_WIDTH,
  MAX_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
  announceSidebarWidth,
  getSidebarWidth,
} from "@/lib/sidebarWidth";
import {
  DEFAULT_START_PAGE,
  START_PAGE_LABELS,
  getStartPageFromCookieString,
  setStartPageCookie,
  type StartPage,
} from "@/lib/startPage";
import type { Project, Tag } from "@/lib/types";

type View = "today" | "upcoming" | "all" | "completed";

const VIEW_LABELS: Record<View, string> = {
  all: "전체",
  today: "오늘",
  upcoming: "예정",
  completed: "완료",
};

export default function Sidebar({
  projects,
  tags = [],
  priorityColors = DEFAULT_PRIORITY_COLORS,
  activeView,
  activeProjectId,
  isReportPage = false,
  isCalendarPage = false,
}: {
  projects: Project[];
  tags?: Tag[];
  priorityColors?: Record<number, string>;
  activeView?: View;
  activeProjectId?: string;
  isReportPage?: boolean;
  isCalendarPage?: boolean;
}) {
  const router = useRouter();
  const [width, setWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [dragging, setDragging] = useState(false);
  const [memoDefault, setMemoDefault] = useState(DEFAULT_MEMO_EXPANDED);
  const [startPage, setStartPage] = useState<StartPage>(DEFAULT_START_PAGE);
  const asideRef = useRef<HTMLElement>(null);
  const settingsRef = useRef<HTMLDetailsElement>(null);

  // 마운트 후에 저장된 값을 읽어야 SSR 결과(기본값)와 하이드레이션이 어긋나지 않는다.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWidth(getSidebarWidth());
    setMemoDefault(getMemoDefaultExpanded());
    setStartPage(getStartPageFromCookieString(document.cookie));
  }, []);

  const handleMove = useCallback((clientX: number) => {
    const aside = asideRef.current;
    if (!aside) return;
    const rect = aside.getBoundingClientRect();
    const next = clientX - rect.left;
    const clamped = Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, next));
    setWidth(clamped);
    // 드래그 중에도 하단 단축키 바 등 다른 컴포넌트가 실시간으로 폭을 따라오게 알린다(저장은 안 함).
    announceSidebarWidth(clamped, false);
  }, []);

  useEffect(() => {
    if (!dragging) return;
    function onMouseMove(e: MouseEvent) {
      handleMove(e.clientX);
    }
    function onMouseUp() {
      setDragging(false);
      setWidth((w) => {
        announceSidebarWidth(w, true);
        return w;
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
    <aside
      ref={asideRef}
      style={{ width }}
      className="relative flex min-h-0 shrink-0 flex-col gap-6 overflow-y-auto border-r border-black/10 p-4 dark:border-white/10"
    >
      <div
        onMouseDown={() => setDragging(true)}
        role="separator"
        aria-orientation="vertical"
        aria-label="사이드바 크기 조절"
        className={`absolute right-0 top-0 h-full w-1.5 -translate-x-1/2 cursor-col-resize hover:bg-black/10 dark:hover:bg-white/10 ${
          dragging ? "bg-black/20 dark:bg-white/20" : ""
        }`}
      />
      <nav className="flex flex-col gap-1">
        {(Object.keys(VIEW_LABELS) as View[]).map((v) => (
          <Link
            key={v}
            href={{ pathname: "/", query: { view: v, ...(activeProjectId ? { project: activeProjectId } : {}) } }}
            className={`rounded px-3 py-1.5 text-sm ${
              !isReportPage && !isCalendarPage && activeView === v
                ? "bg-black text-white dark:bg-white dark:text-black"
                : "hover:bg-black/5 dark:hover:bg-white/10"
            }`}
          >
            {VIEW_LABELS[v]}
          </Link>
        ))}
        <div className="mt-1 flex flex-col gap-1 border-t border-black/10 pt-2 dark:border-white/10">
          <Link
            href="/calendar"
            className={`rounded px-3 py-1.5 text-sm ${
              isCalendarPage
                ? "bg-black text-white dark:bg-white dark:text-black"
                : "hover:bg-black/5 dark:hover:bg-white/10"
            }`}
          >
            캘린더
          </Link>
          <Link
            href="/report"
            className={`rounded px-3 py-1.5 text-sm ${
              isReportPage
                ? "bg-black text-white dark:bg-white dark:text-black"
                : "hover:bg-black/5 dark:hover:bg-white/10"
            }`}
          >
            주간보고
          </Link>
        </div>
      </nav>

      <div>
        <div className="mb-2 text-xs font-semibold uppercase text-zinc-500">프로젝트</div>
        <ul className="flex flex-col gap-1">
          <li>
            <Link
              href={{ pathname: "/", query: { view: activeView ?? "today" } }}
              className={`block rounded px-3 py-1.5 text-sm ${
                !activeProjectId ? "bg-black/5 dark:bg-white/10" : "hover:bg-black/5 dark:hover:bg-white/10"
              }`}
            >
              전체 프로젝트
            </Link>
          </li>
          {projects.map((p) => (
            <li key={p.id}>
              <Link
                href={{ pathname: "/", query: { view: activeView ?? "today", project: p.id } }}
                className={`flex items-center gap-2 truncate rounded px-3 py-1.5 text-sm ${
                  activeProjectId === p.id ? "bg-black/5 dark:bg-white/10" : "hover:bg-black/5 dark:hover:bg-white/10"
                }`}
              >
                <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: p.color ?? "#999" }} />
                <span className="truncate">{p.name}</span>
              </Link>
            </li>
          ))}
        </ul>

        <form action={createProject} className="mt-2 flex gap-1">
          <input
            name="name"
            placeholder="+ 새 프로젝트"
            className="w-full min-w-0 flex-1 rounded border border-black/10 bg-transparent px-2 py-1 text-sm outline-none focus:border-black/30 dark:border-white/10"
          />
          <button
            type="submit"
            className="shrink-0 rounded border border-black/10 px-2 py-1 text-sm hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
          >
            추가
          </button>
        </form>
      </div>

      <details
        ref={settingsRef}
        onToggle={() => {
          const details = settingsRef.current;
          const aside = asideRef.current;
          if (!details?.open || !aside) return;
          // scrollIntoView({block:"nearest"})는 summary가 이미 보이면 "충분히 보인다"고
          // 판단해 안 움직이길래, 펼쳐진 영역의 아래쪽까지 직접 계산해서 스크롤한다.
          // offsetHeight/scrollHeight를 읽는 순간 브라우저가 최신 레이아웃을 강제로
          // 반영하므로(synchronous reflow), 타이머 없이 바로 계산해도 된다.
          const detailsBottom = details.offsetTop + details.offsetHeight;
          const maxScroll = aside.scrollHeight - aside.clientHeight;
          const target = Math.min(maxScroll, Math.max(0, detailsBottom - aside.clientHeight));
          aside.scrollTop = target;
        }}
      >
        <summary className="cursor-pointer select-none text-xs font-semibold uppercase text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
          ⚙ 설정
        </summary>

        <div className="mt-3 flex flex-col gap-4">
          <div>
            <div className="mb-2 text-xs font-semibold uppercase text-zinc-500">시작 페이지</div>
            <select
              value={startPage}
              onChange={(e) => {
                const value = e.target.value as StartPage;
                setStartPage(value);
                setStartPageCookie(value);
                // 쿠키는 다음에 "/"를 파라미터 없이 열 때를 위한 것이고, 지금 당장은
                // 바로 그 화면으로 이동시켜준다 — 안 그러면 다른 페이지(예: 캘린더)에
                // 머무른 채로는 설정을 바꿔도 아무 일도 안 일어나는 것처럼 보인다.
                router.push(value === "calendar" ? "/calendar" : `/?view=${value}`);
              }}
              className="w-full rounded border border-black/10 bg-transparent px-2 py-1 text-sm outline-none dark:border-white/10"
            >
              {(Object.keys(START_PAGE_LABELS) as StartPage[]).map((key) => (
                <option key={key} value={key}>
                  {START_PAGE_LABELS[key]}
                </option>
              ))}
            </select>
          </div>

          {tags.length > 0 && (
            <div>
              <div className="mb-2 text-xs font-semibold uppercase text-zinc-500">태그 색상</div>
              <ul className="flex flex-col gap-1">
                {tags.map((t) => (
                  <li key={t.id} className="flex items-center gap-2 px-3 py-1 text-sm">
                    <TagColorPicker tagId={t.id} color={t.color ?? "#999999"} />
                    <span className="flex-1 truncate text-zinc-600 dark:text-zinc-300">#{t.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <div className="mb-2 text-xs font-semibold uppercase text-zinc-500">우선순위 색상</div>
            <ul className="flex flex-col gap-1">
              {[1, 2, 3, 4].map((p) => (
                <li key={p} className="flex items-center gap-2 px-3 py-1 text-sm">
                  <PriorityColorPicker priority={p} color={priorityColors[p] ?? DEFAULT_PRIORITY_COLORS[p]} />
                  <span className="text-zinc-600 dark:text-zinc-300">P{p}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="mb-2 text-xs font-semibold uppercase text-zinc-500">메모 표시</div>
            <label className="flex items-center gap-2 px-3 py-1 text-sm text-zinc-600 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={memoDefault}
                onChange={(e) => {
                  setMemoDefault(e.target.checked);
                  setMemoDefaultExpanded(e.target.checked);
                }}
              />
              태스크 메모 기본으로 펼치기
            </label>
          </div>
        </div>
      </details>
    </aside>
  );
}
