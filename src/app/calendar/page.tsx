import Link from "next/link";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import CalendarDayCell, { type CalendarChip } from "@/components/CalendarDayCell";
import CalendarSplit from "@/components/CalendarSplit";
import CollapsibleSection from "@/components/CollapsibleSection";
import ListPagination from "@/components/ListPagination";
import QuickAddModal from "@/components/QuickAddModal";
import Sidebar from "@/components/Sidebar";
import TaskList from "@/components/TaskList";
import UndoToast from "@/components/UndoToast";
import { getPriorityColors } from "@/lib/priorityColors.server";
import { PAGE_SIZE_COOKIE, parsePageParam, parsePageSize } from "@/lib/pageSize";
import { DEFAULT_PRIORITY_COLORS } from "@/lib/priorityColors";

const MAX_CHIPS_PER_CELL = 3;
const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function toDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseMonthParam(value: string | undefined) {
  if (value && /^\d{4}-\d{2}$/.test(value)) {
    const [y, m] = value.split("-").map(Number);
    if (m >= 1 && m <= 12) return { year: y, month: m - 1 };
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

// month은 0-index로 받되, 범위를 벗어나도(-1, 12 등) Date가 알아서 연도를 굴려준다.
function monthParam(year: number, month: number) {
  const d = new Date(year, month, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; date?: string; project?: string; unscheduled?: string }>;
}) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const { year, month } = parseMonthParam(params.month);
  const projectId = params.project;
  // "미등록 일정"도 목록 화면과 같은 "페이지당 개수" 설정을 따른다 (5.2.2절).
  const pageSize = parsePageSize(cookieStore.get(PAGE_SIZE_COOKIE)?.value);
  const requestedUnscheduledPage = parsePageParam(params.unscheduled);

  const firstOfMonth = new Date(year, month, 1);
  const firstWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;

  // 그리드에 걸치는 앞뒤 달의 패딩 날짜까지 한 번에 조회 범위로 잡는다.
  const gridStart = new Date(year, month, 1 - firstWeekday);
  gridStart.setHours(0, 0, 0, 0);
  const gridEnd = new Date(gridStart);
  gridEnd.setDate(gridEnd.getDate() + totalCells - 1);
  gridEnd.setHours(23, 59, 59, 999);

  const todayKey = toDateKey(new Date());
  const selectedKey = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : todayKey;

  // 선택된 날짜의 0시~24시 — 사이드 패널만 관계까지 필요한 범위다.
  const selectedStart = new Date(`${selectedKey}T00:00:00`);
  const selectedEnd = new Date(selectedStart);
  selectedEnd.setHours(23, 59, 59, 999);

  const listInclude = {
    project: true,
    subtasks: { orderBy: { createdAt: "asc" } },
    tags: { include: { tag: true } },
  } as const;
  const listOrder = [{ priority: "asc" }, { createdAt: "asc" }, { id: "asc" }] as const;

  const unscheduledWhere = {
    parentId: null,
    completed: false,
    dueDate: null,
    ...(projectId ? { projectId } : {}),
  } as const;

  // 마감일이 없는 태스크는 어느 달을 보고 있든 그리드에 걸릴 일이 없으니 달 범위와 무관하게 항상 조회한다.
  // 예전에는 전건을 가져와 클라이언트에서 10개씩 잘라 보여줬는데(PaginatedTaskList), 화면에
  // 10개만 보여주려고 서버가 전부 조회·직렬화하고 있었다. 지금은 목록 화면과 같은 방식으로
  // 쿼리에서 한 페이지만 잘라 온다.
  const unscheduledQuery = (skip: number) =>
    prisma.task.findMany({
      where: unscheduledWhere,
      include: listInclude,
      orderBy: [...listOrder],
      skip,
      take: pageSize,
    });

  const [projects, tags, priorityColors, gridTasks, selectedTasks, unscheduledCount, requestedUnscheduled] =
    await Promise.all([
      prisma.project.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.tag.findMany({ orderBy: { name: "asc" } }),
      getPriorityColors(),
      // 그리드 칸의 칩이 쓰는 건 제목·우선순위색·날짜뿐이다. 예전에는 여기서도 프로젝트·서브태스크·
      // 태그를 통째로 붙여 왔는데, 화면에 쓰이지도 않으면서 조회·직렬화·전송량만 키웠다.
      prisma.task.findMany({
        where: {
          parentId: null,
          completed: false,
          dueDate: { gte: gridStart, lte: gridEnd },
          ...(projectId ? { projectId } : {}),
        },
        select: { id: true, title: true, priority: true, dueDate: true },
        orderBy: [...listOrder],
      }),
      // 패널은 "선택한 하루"만 보여주므로 그 하루치만 관계까지 붙여서 따로 가져온다.
      prisma.task.findMany({
        where: {
          parentId: null,
          completed: false,
          dueDate: { gte: selectedStart, lte: selectedEnd },
          ...(projectId ? { projectId } : {}),
        },
        include: listInclude,
        orderBy: [...listOrder],
      }),
      prisma.task.count({ where: unscheduledWhere }),
      unscheduledQuery(requestedUnscheduledPage * pageSize),
    ]);

  const unscheduledTotalPages = Math.max(1, Math.ceil(unscheduledCount / pageSize));
  const unscheduledPage = Math.min(requestedUnscheduledPage, unscheduledTotalPages - 1);
  const unscheduledTasks =
    unscheduledPage === requestedUnscheduledPage
      ? requestedUnscheduled
      : await unscheduledQuery(unscheduledPage * pageSize);

  const chipsByDate = new Map<string, CalendarChip[]>();
  for (const t of gridTasks) {
    if (!t.dueDate) continue;
    const key = toDateKey(t.dueDate);
    const chip: CalendarChip = {
      id: t.id,
      title: t.title,
      color: priorityColors[t.priority] ?? DEFAULT_PRIORITY_COLORS[t.priority],
    };
    const list = chipsByDate.get(key);
    if (list) list.push(chip);
    else chipsByDate.set(key, [chip]);
  }

  const cells = Array.from({ length: totalCells }, (_, i) => {
    const date = new Date(gridStart);
    date.setDate(date.getDate() + i);
    const key = toDateKey(date);
    return { date, key, inMonth: date.getMonth() === month, chips: chipsByDate.get(key) ?? [] };
  });

  const currentMonthParam = monthParam(year, month);
  const prevMonthParam = monthParam(year, month - 1);
  const nextMonthParam = monthParam(year, month + 1);
  const monthLabel = `${year}년 ${month + 1}월`;

  const selectedLabel = new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(selectedStart);

  return (
    <div className="flex flex-1 min-h-0">
      <Sidebar
        projects={projects}
        tags={tags}
        priorityColors={priorityColors}
        isCalendarPage
        activeProjectId={projectId}
        calendarMonth={currentMonthParam}
        calendarDate={selectedKey}
      />

      <main className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">{monthLabel}</h1>
          <div className="flex gap-2 text-sm">
            <Link
              href={{ pathname: "/calendar", query: { month: prevMonthParam, date: `${prevMonthParam}-01` } }}
              className="rounded border border-black/10 px-3 py-1.5 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
            >
              ← 이전 달
            </Link>
            <Link
              href={{ pathname: "/calendar", query: { month: monthParam(new Date().getFullYear(), new Date().getMonth()), date: todayKey } }}
              className="rounded border border-black/10 px-3 py-1.5 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
            >
              오늘
            </Link>
            <Link
              href={{ pathname: "/calendar", query: { month: nextMonthParam, date: `${nextMonthParam}-01` } }}
              className="rounded border border-black/10 px-3 py-1.5 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
            >
              다음 달 →
            </Link>
          </div>
        </div>

        <CalendarSplit
          left={
            <>
              <div className="grid grid-cols-7 gap-1 text-center text-xs text-zinc-500">
                {WEEKDAY_LABELS.map((w) => (
                  <div key={w} className="py-1">
                    {w}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {cells.map((cell) => (
                  <CalendarDayCell
                    key={cell.key}
                    dateKey={cell.key}
                    monthParam={currentMonthParam}
                    dayNumber={cell.date.getDate()}
                    isSelected={cell.key === selectedKey}
                    isToday={cell.key === todayKey}
                    inMonth={cell.inMonth}
                    overflow={Math.max(0, cell.chips.length - MAX_CHIPS_PER_CELL)}
                    chips={cell.chips.slice(0, MAX_CHIPS_PER_CELL)}
                  />
                ))}
              </div>
            </>
          }
          right={
            <>
              <h2 className="mb-1 text-sm font-semibold">{selectedLabel}</h2>
              <p className="mb-3 text-xs text-zinc-500">할 일 {selectedTasks.length}개</p>
              {selectedTasks.length === 0 ? (
                <p className="text-sm text-zinc-400">이 날짜에 마감인 할 일이 없습니다.</p>
              ) : (
                <TaskList tasks={selectedTasks} projects={projects} tags={tags} priorityColors={priorityColors} layout="list" />
              )}
            </>
          }
        />

        {unscheduledCount > 0 && (
          <CollapsibleSection
            summary={`미등록 일정 (${unscheduledCount}개)`}
            className="border-t border-black/10 pt-4 dark:border-white/10"
            defaultOpen={unscheduledPage > 0}
          >
            <div className="mt-3">
              <TaskList
                tasks={unscheduledTasks}
                projects={projects}
                tags={tags}
                priorityColors={priorityColors}
                layout="list"
              />
              <ListPagination
                page={unscheduledPage}
                totalPages={unscheduledTotalPages}
                totalCount={unscheduledCount}
                pageSize={pageSize}
                pathname="/calendar"
                paramName="unscheduled"
                query={{
                  month: currentMonthParam,
                  date: selectedKey,
                  ...(projectId ? { project: projectId } : {}),
                }}
              />
            </div>
          </CollapsibleSection>
        )}
      </main>

      <QuickAddModal projects={projects} tags={tags} />
      <UndoToast />
    </div>
  );
}
