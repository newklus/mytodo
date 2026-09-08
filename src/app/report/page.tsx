import Link from "next/link";
import { prisma } from "@/lib/prisma";
import QuickAddModal from "@/components/QuickAddModal";
import Sidebar from "@/components/Sidebar";
import UndoToast from "@/components/UndoToast";
import WeeklyReportBuilder from "@/components/WeeklyReportBuilder";
import { formatWeekLabel, getWeekRange } from "@/lib/week";
import { getPriorityColors } from "@/lib/priorityColors.server";

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const params = await searchParams;
  const reference = params.week ? new Date(params.week) : new Date();
  const { start, end } = getWeekRange(Number.isNaN(reference.getTime()) ? new Date() : reference);

  const prevWeek = new Date(start);
  prevWeek.setDate(prevWeek.getDate() - 7);
  const nextWeek = new Date(start);
  nextWeek.setDate(nextWeek.getDate() + 7);

  // 사이드바용 쿼리도 보고서 쿼리와 함께 한꺼번에 보낸다 (서로 의존하지 않음).
  const [projects, tags, priorityColors, completedTasks, completedSubtasks, progressTasks] = await Promise.all([
    prisma.project.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.tag.findMany({ orderBy: { name: "asc" } }),
    getPriorityColors(),
    prisma.task.findMany({
      where: {
        parentId: null,
        completed: true,
        completedAt: { gte: start, lte: end },
      },
      include: { project: true },
      orderBy: { completedAt: "asc" },
    }),
    prisma.task.findMany({
      where: {
        parentId: { not: null },
        completed: true,
        completedAt: { gte: start, lte: end },
      },
      include: { project: true, parent: true },
      orderBy: { completedAt: "asc" },
    }),
    prisma.task.findMany({
      where: {
        parentId: null,
        completed: false,
        OR: [
          { dueDate: { gte: start, lte: end } },
          { updatedAt: { gte: start, lte: end } },
          { subtasks: { some: { completedAt: { gte: start, lte: end } } } },
        ],
      },
      include: { project: true },
      orderBy: [{ dueDate: "asc" }, { updatedAt: "asc" }],
    }),
  ]);

  const completedCandidates = [
    ...completedTasks.map((t) => ({
      id: t.id,
      title: t.title,
      projectName: t.project?.name ?? null,
      completedAt: (t.completedAt ?? t.updatedAt).toISOString(),
    })),
    // 서브태스크 완료도 "완료" 후보에 개별로 보여준다 — 어느 상위 태스크의 하위인지
    // 알 수 있게 "상위 › 하위" 형식으로 표시 (상위 태스크 이름만 뜨던 문제 수정)
    ...completedSubtasks.map((t) => ({
      id: t.id,
      title: t.parent ? `${t.parent.title} › ${t.title}` : t.title,
      projectName: t.project?.name ?? null,
      completedAt: (t.completedAt ?? t.updatedAt).toISOString(),
    })),
  ].sort((a, b) => a.completedAt.localeCompare(b.completedAt));

  const progressCandidates = progressTasks.map((t) => ({
    id: t.id,
    title: t.title,
    projectName: t.project?.name ?? null,
    dueDate: t.dueDate ? t.dueDate.toISOString() : null,
  }));

  const weekLabel = formatWeekLabel(start, end);

  return (
    <div className="flex flex-1 min-h-0">
      <Sidebar projects={projects} tags={tags} priorityColors={priorityColors} isReportPage />

      <main className="flex min-w-0 flex-1 flex-col gap-6 overflow-y-auto p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">주간보고 · {weekLabel}</h1>
          <div className="flex gap-2 text-sm">
            <Link
              href={{ pathname: "/report", query: { week: prevWeek.toISOString().slice(0, 10) } }}
              className="rounded border border-black/10 px-3 py-1.5 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
            >
              ← 지난 주
            </Link>
            <Link
              href={{ pathname: "/report", query: { week: nextWeek.toISOString().slice(0, 10) } }}
              className="rounded border border-black/10 px-3 py-1.5 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
            >
              다음 주 →
            </Link>
          </div>
        </div>

        <WeeklyReportBuilder
          weekLabel={weekLabel}
          completedCandidates={completedCandidates}
          progressCandidates={progressCandidates}
        />
      </main>

      <QuickAddModal projects={projects} tags={tags} />
      <UndoToast />
    </div>
  );
}
