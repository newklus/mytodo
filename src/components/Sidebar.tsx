"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createProject } from "@/lib/actions/projects";
import PriorityColorPicker from "@/components/PriorityColorPicker";
import TagColorPicker from "@/components/TagColorPicker";
import { DEFAULT_MEMO_EXPANDED, getMemoDefaultExpanded, setMemoDefaultExpanded } from "@/lib/memoSettings";
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MIN_PAGE_SIZE,
  clampPageSize,
  getPageSizeFromCookieString,
  setPageSizeCookie,
} from "@/lib/pageSize";
import { DEFAULT_PRIORITY_COLORS } from "@/lib/priorityColors";
import {
  DEFAULT_SIDEBAR_WIDTH,
  MAX_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
  SIDEBAR_WIDTH_VAR,
  applySidebarWidth,
  getSidebarWidth,
  useStoredSidebarWidth,
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

function ProjectFilterCheck() {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className="h-3.5 w-3.5 shrink-0 text-zinc-400 dark:text-zinc-500"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 10.5l3.5 3.5L16 6" />
    </svg>
  );
}

export default function Sidebar({
  projects,
  tags = [],
  priorityColors = DEFAULT_PRIORITY_COLORS,
  activeView,
  activeProjectId,
  isReportPage = false,
  isCalendarPage = false,
  calendarMonth,
  calendarDate,
}: {
  projects: Project[];
  tags?: Tag[];
  priorityColors?: Record<number, string>;
  activeView?: View;
  activeProjectId?: string;
  isReportPage?: boolean;
  isCalendarPage?: boolean;
  calendarMonth?: string;
  calendarDate?: string;
}) {
  const router = useRouter();
  const [dragging, setDragging] = useState(false);
  const [memoDefault, setMemoDefault] = useState(DEFAULT_MEMO_EXPANDED);
  const [startPage, setStartPage] = useState<StartPage>(DEFAULT_START_PAGE);
  // 입력 중에는 지우거나 잘못 쳐도 그대로 두고(문자열 상태), 확정할 때만 범위로 맞춰 저장한다.
  const [pageSizeInput, setPageSizeInput] = useState(String(DEFAULT_PAGE_SIZE));
  const asideRef = useRef<HTMLElement>(null);
  const settingsRef = useRef<HTMLDetailsElement>(null);
  // 드래그 중 매 mousemove마다 getBoundingClientRect()를 부르면 그때마다 강제 레이아웃이 걸린다.
  // 사이드바의 왼쪽 좌표는 드래그하는 동안 변하지 않으므로 시작할 때 한 번만 재둔다.
  const dragLeftRef = useRef(0);
  const widthRef = useRef(DEFAULT_SIDEBAR_WIDTH);

  // 저장된 사이드바 폭은 CSS 변수로만 반영한다(리액트 상태 아님) — 아래 드래그 참고.
  useStoredSidebarWidth();

  // 마운트 후에 저장된 값을 읽어야 SSR 결과(기본값)와 하이드레이션이 어긋나지 않는다.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMemoDefault(getMemoDefaultExpanded());
    setStartPage(getStartPageFromCookieString(document.cookie));
    setPageSizeInput(String(getPageSizeFromCookieString(document.cookie)));
    widthRef.current = getSidebarWidth();
  }, []);

  // 목록을 자르는 건 서버 쿼리라, 값을 바꾸면 쿠키에 저장하고 현재 라우트를 다시 그리게 한다.
  // (범위를 벗어난 ?page= 는 서버가 마지막 페이지로 알아서 당겨준다.)
  const commitPageSize = useCallback(
    (raw: string) => {
      const parsed = Number(raw);
      const next = Number.isFinite(parsed) && raw.trim() !== "" ? clampPageSize(parsed) : DEFAULT_PAGE_SIZE;
      setPageSizeInput(String(next));
      if (next === getPageSizeFromCookieString(document.cookie)) return;
      setPageSizeCookie(next);
      router.refresh();
    },
    [router]
  );

  // 드래그 중에는 리액트 상태를 건드리지 않고 CSS 변수만 갱신한다. 예전에는 mousemove마다
  // setState가 돌아 사이드바와 하단 단축키 바가 통째로 리렌더됐는데, 폭은 스타일 값 하나일 뿐이라
  // 렌더 트리를 다시 만들 이유가 없다. 저장은 드래그가 끝났을 때 한 번만 한다.
  const handleMove = useCallback((clientX: number) => {
    const next = clientX - dragLeftRef.current;
    const clamped = Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, next));
    widthRef.current = clamped;
    applySidebarWidth(clamped, false);
  }, []);

  useEffect(() => {
    if (!dragging) return;
    function onMouseMove(e: MouseEvent) {
      handleMove(e.clientX);
    }
    function onMouseUp() {
      setDragging(false);
      applySidebarWidth(widthRef.current, true);
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
      style={{ width: SIDEBAR_WIDTH_VAR }}
      className="relative flex min-h-0 shrink-0 flex-col gap-6 overflow-y-auto border-r border-black/10 p-4 dark:border-white/10"
    >
      <div
        onMouseDown={() => {
          dragLeftRef.current = asideRef.current?.getBoundingClientRect().left ?? 0;
          setDragging(true);
        }}
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
              href={
                isCalendarPage
                  ? { pathname: "/calendar", query: { ...(calendarMonth ? { month: calendarMonth } : {}), ...(calendarDate ? { date: calendarDate } : {}) } }
                  : { pathname: "/", query: { view: activeView ?? "today" } }
              }
              className={`flex items-center justify-between gap-2 rounded px-3 py-1.5 text-sm ${
                !activeProjectId ? "bg-black/5 dark:bg-white/10" : "hover:bg-black/5 dark:hover:bg-white/10"
              }`}
            >
              <span className="truncate">전체 프로젝트</span>
              {!activeProjectId && <ProjectFilterCheck />}
            </Link>
          </li>
          {projects.map((p) => (
            <li key={p.id}>
              <Link
                href={
                  isCalendarPage
                    ? {
                        pathname: "/calendar",
                        query: { ...(calendarMonth ? { month: calendarMonth } : {}), ...(calendarDate ? { date: calendarDate } : {}), project: p.id },
                      }
                    : { pathname: "/", query: { view: activeView ?? "today", project: p.id } }
                }
                className={`flex items-center gap-2 rounded px-3 py-1.5 text-sm ${
                  activeProjectId === p.id ? "bg-black/5 dark:bg-white/10" : "hover:bg-black/5 dark:hover:bg-white/10"
                }`}
              >
                <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: p.color ?? "#999" }} />
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                {activeProjectId === p.id && <ProjectFilterCheck />}
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

          <div>
            <div className="mb-2 text-xs font-semibold uppercase text-zinc-500">페이지당 개수</div>
            <input
              type="number"
              inputMode="numeric"
              min={MIN_PAGE_SIZE}
              max={MAX_PAGE_SIZE}
              value={pageSizeInput}
              onChange={(e) => setPageSizeInput(e.target.value)}
              onBlur={(e) => commitPageSize(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.currentTarget.blur();
                }
              }}
              aria-label="목록 한 페이지에 표시할 개수"
              className="w-full rounded border border-black/10 bg-transparent px-2 py-1 text-sm outline-none dark:border-white/10"
            />
            <p className="mt-1 px-1 text-xs text-zinc-400">
              목록 화면 기준 {MIN_PAGE_SIZE}~{MAX_PAGE_SIZE}개 (기본 {DEFAULT_PAGE_SIZE})
            </p>
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
