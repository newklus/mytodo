import Link from "next/link";
import { prisma } from "@/lib/prisma";
import Sidebar from "@/components/Sidebar";
import WeeklyReportBuilder from "@/components/WeeklyReportBuilder";
import { formatWeekLabel, getWeekRange } from "@/lib/week";

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

  const projects = await prisma.project.findMany({ orderBy: { createdAt: "asc" } });

  const [completedTasks, progressTasks] = await Promise.all([
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
        parentId: null,
        completed: false,
        OR: [{ dueDate: { gte: start, lte: end } }, { updatedAt: { gte: start, lte: end } }],
      },
      include: { project: true },
      orderBy: [{ dueDate: "asc" }, { updatedAt: "asc" }],
    }),
  ]);

  const completedCandidates = completedTasks.map((t) => ({
    id: t.id,
    title: t.title,
    projectName: t.project?.name ?? null,
    completedAt: (t.completedAt ?? t.updatedAt).toISOString(),
  }));

  const progressCandidates = progressTasks.map((t) => ({
    id: t.id,
    title: t.title,
    projectName: t.project?.name ?? null,
    dueDate: t.dueDate ? t.dueDate.toISOString() : null,
  }));

  const weekLabel = formatWeekLabel(start, end);

  return (
    <div className="flex flex-1 min-h-0">
      <Sidebar projects={projects} isReportPage />

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
    </div>
  );
}
