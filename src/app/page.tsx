import { prisma } from "@/lib/prisma";
import QuickAddForm from "@/components/QuickAddForm";
import Sidebar from "@/components/Sidebar";
import TaskItem from "@/components/TaskItem";
import type { Prisma } from "@/generated/prisma/client";

type View = "today" | "upcoming" | "all" | "completed";

const VIEW_LABELS: Record<View, string> = {
  today: "오늘",
  upcoming: "예정",
  all: "전체",
  completed: "완료",
};

function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; project?: string }>;
}) {
  const params = await searchParams;
  const view: View = (params.view as View) ?? "today";
  const projectId = params.project;

  const projects = await prisma.project.findMany({ orderBy: { createdAt: "asc" } });

  const where: Prisma.TaskWhereInput = {
    parentId: null,
    ...(projectId ? { projectId } : {}),
  };

  if (view === "completed") {
    where.completed = true;
  } else {
    where.completed = false;
    if (view === "today") {
      where.dueDate = { lte: endOfToday() };
    } else if (view === "upcoming") {
      where.dueDate = { gt: endOfToday() };
    }
  }

  const tasks = await prisma.task.findMany({
    where,
    include: {
      project: true,
      subtasks: { orderBy: { createdAt: "asc" } },
      tags: { include: { tag: true } },
    },
    orderBy: [{ priority: "asc" }, { dueDate: "asc" }, { createdAt: "asc" }],
  });

  return (
    <div className="flex flex-1 min-h-0">
      <Sidebar projects={projects} activeView={view} activeProjectId={projectId} />

      <main className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
        <h1 className="text-xl font-semibold">{VIEW_LABELS[view]}</h1>

        <QuickAddForm projects={projects} defaultProjectId={projectId} />

        <ul className="flex flex-col divide-y divide-black/5 dark:divide-white/10">
          {tasks.map((task) => (
            <TaskItem key={task.id} task={task} projects={projects} />
          ))}
          {tasks.length === 0 && <li className="py-8 text-center text-sm text-zinc-400">할 일이 없습니다.</li>}
        </ul>
      </main>
    </div>
  );
}
