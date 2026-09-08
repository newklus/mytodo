import Link from "next/link";
import { prisma } from "@/lib/prisma";
import CalendarDayCell from "@/components/CalendarDayCell";
import QuickAddModal from "@/components/QuickAddModal";
import Sidebar from "@/components/Sidebar";
import TaskList from "@/components/TaskList";
import UndoToast from "@/components/UndoToast";
import { getPriorityColors } from "@/lib/priorityColors.server";
import { DEFAULT_PRIORITY_COLORS } from "@/lib/priorityColors";
import type { TaskWithRelations } from "@/lib/types";

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
  searchParams: Promise<{ month?: string; date?: string }>;
}) {
  const params = await searchParams;
  const { year, month } = parseMonthParam(params.month);

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

  const [projects, tags, priorityColors, tasks, unscheduledTasks] = await Promise.all([
    prisma.project.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.tag.findMany({ orderBy: { name: "asc" } }),
    getPriorityColors(),
    prisma.task.findMany({
      where: {
        parentId: null,
        completed: false,
        dueDate: { gte: gridStart, lte: gridEnd },
      },
      include: {
        project: true,
        subtasks: { orderBy: { createdAt: "asc" } },
        tags: { include: { tag: true } },
      },
      orderBy: [{ priority: "asc" }, { dueDate: "asc" }, { createdAt: "asc" }],
    }),
    // 마감일이 없는 태스크는 어느 달을 보고 있든 그리드에 걸릴 일이 없으니 달 범위와 무관하게 항상 조회한다.
    prisma.task.findMany({
      where: { parentId: null, completed: false, dueDate: null },
      include: {
        project: true,
        subtasks: { orderBy: { createdAt: "asc" } },
        tags: { include: { tag: true } },
      },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const tasksByDate = new Map<string, TaskWithRelations[]>();
  for (const t of tasks) {
    if (!t.dueDate) continue;
    const key = toDateKey(t.dueDate);
    const list = tasksByDate.get(key);
    if (list) list.push(t);
    else tasksByDate.set(key, [t]);
  }

  const cells = Array.from({ length: totalCells }, (_, i) => {
    const date = new Date(gridStart);
    date.setDate(date.getDate() + i);
    const key = toDateKey(date);
    return { date, key, inMonth: date.getMonth() === month, tasks: tasksByDate.get(key) ?? [] };
  });

  const currentMonthParam = monthParam(year, month);
  const prevMonthParam = monthParam(year, month - 1);
  const nextMonthParam = monthParam(year, month + 1);
  const monthLabel = `${year}년 ${month + 1}월`;

  const selectedDate = new Date(`${selectedKey}T00:00:00`);
  const selectedTasks = tasksByDate.get(selectedKey) ?? [];
  const selectedLabel = new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(selectedDate);

  return (
    <div className="flex flex-1 min-h-0">
      <Sidebar projects={projects} tags={tags} priorityColors={priorityColors} isCalendarPage />

      <main className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
        <div className="flex items-center justify-between">
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

        <div className="flex min-h-0 flex-1 gap-6">
          <div className="min-w-0 flex-[3]">
            <div className="grid grid-cols-7 gap-1 text-center text-xs text-zinc-500">
              {WEEKDAY_LABELS.map((w) => (
                <div key={w} className="py-1">
                  {w}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((cell) => {
                const visible = cell.tasks.slice(0, MAX_CHIPS_PER_CELL);
                const overflow = cell.tasks.length - visible.length;
                return (
                  <CalendarDayCell
                    key={cell.key}
                    dateKey={cell.key}
                    monthParam={currentMonthParam}
                    dayNumber={cell.date.getDate()}
                    isSelected={cell.key === selectedKey}
                    isToday={cell.key === todayKey}
                    inMonth={cell.inMonth}
                    overflow={overflow}
                    chips={visible.map((t) => ({
                      id: t.id,
                      title: t.title,
                      color: priorityColors[t.priority] ?? DEFAULT_PRIORITY_COLORS[t.priority],
                    }))}
                  />
                );
              })}
            </div>
          </div>

          <div className="min-w-0 flex-[2] border-l border-black/10 pl-6 dark:border-white/10">
            <h2 className="mb-1 text-sm font-semibold">{selectedLabel}</h2>
            <p className="mb-3 text-xs text-zinc-500">할 일 {selectedTasks.length}개</p>
            {selectedTasks.length === 0 ? (
              <p className="text-sm text-zinc-400">이 날짜에 마감인 할 일이 없습니다.</p>
            ) : (
              <TaskList tasks={selectedTasks} projects={projects} tags={tags} priorityColors={priorityColors} layout="list" />
            )}
          </div>
        </div>

        {unscheduledTasks.length > 0 && (
          <details className="border-t border-black/10 pt-4 dark:border-white/10">
            <summary className="cursor-pointer select-none text-sm font-semibold hover:text-zinc-600 dark:hover:text-zinc-300">
              미등록 일정 ({unscheduledTasks.length}개)
            </summary>
            <div className="mt-3">
              <TaskList tasks={unscheduledTasks} projects={projects} tags={tags} priorityColors={priorityColors} layout="list" />
            </div>
          </details>
        )}
      </main>

      <QuickAddModal projects={projects} tags={tags} />
      <UndoToast />
    </div>
  );
}
