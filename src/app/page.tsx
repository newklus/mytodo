import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { START_PAGE_COOKIE, isStartPage } from "@/lib/startPage";
import QuickAddForm from "@/components/QuickAddForm";
import QuickAddModal from "@/components/QuickAddModal";
import SelectionCountBadge from "@/components/SelectionCountBadge";
import Sidebar from "@/components/Sidebar";
import TaskList from "@/components/TaskList";
import UndoToast from "@/components/UndoToast";
import { getPriorityColors } from "@/lib/priorityColors.server";
import type { Prisma } from "@/generated/prisma/client";

type View = "today" | "upcoming" | "all" | "completed";
type Layout = "list" | "priority" | "project" | "tag";

const VIEW_LABELS: Record<View, string> = {
  all: "전체",
  today: "오늘",
  upcoming: "예정",
  completed: "완료",
};

const LAYOUT_LABELS: Record<Layout, string> = {
  list: "목록",
  priority: "우선순위별",
  project: "프로젝트별",
  tag: "태그별",
};

function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

const COMPLETED_VIEW_DAYS = 15;

function daysAgoStart(days: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d;
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; project?: string; layout?: string }>;
}) {
  const params = await searchParams;

  // view가 명시되지 않은 "맨 URL" 진입(=앱을 새로 켰을 때)에만 설정된 시작 페이지를 따른다.
  // 사이드바의 "전체"/"오늘" 링크 등은 항상 view를 명시하므로 이 로직과 무관하게 그대로 동작한다.
  let view: View;
  if (params.view) {
    view = params.view as View;
  } else {
    const cookieStore = await cookies();
    const startPage = cookieStore.get(START_PAGE_COOKIE)?.value;
    if (isStartPage(startPage) && startPage === "calendar") redirect("/calendar");
    view = isStartPage(startPage) && startPage === "all" ? "all" : "today";
  }

  const projectId = params.project;
  const validLayouts: Layout[] = ["list", "priority", "project", "tag"];
  const layout: Layout = validLayouts.includes(params.layout as Layout) ? (params.layout as Layout) : "list";

  const where: Prisma.TaskWhereInput = {
    parentId: null,
    ...(projectId ? { projectId } : {}),
  };

  if (view === "completed") {
    where.completed = true;
    where.completedAt = { gte: daysAgoStart(COMPLETED_VIEW_DAYS) };
  } else {
    where.completed = false;
    if (view === "today") {
      where.dueDate = { lte: endOfToday() };
    } else if (view === "upcoming") {
      where.dueDate = { gt: endOfToday() };
    }
  }

  // 완료 뷰는 최신 완료된 것이 위(우선순위 무관). 나머지는 우선순위 → 생성일(빠를수록 위) 순.
  const orderBy: Prisma.TaskOrderByWithRelationInput[] =
    view === "completed"
      ? [{ completedAt: "desc" }]
      : [{ priority: "asc" }, { createdAt: "asc" }];

  // 네 쿼리는 서로 의존하지 않으므로 순차로 await 하지 않고 한꺼번에 보낸다.
  const [projects, tags, priorityColors, tasks] = await Promise.all([
    prisma.project.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.tag.findMany({ orderBy: { name: "asc" } }),
    getPriorityColors(),
    prisma.task.findMany({
      where,
      include: {
        project: true,
        subtasks: { orderBy: { createdAt: "asc" } },
        tags: { include: { tag: true } },
      },
      orderBy,
    }),
  ]);

  return (
    <div className="flex flex-1 min-h-0">
      <Sidebar
        projects={projects}
        tags={tags}
        priorityColors={priorityColors}
        activeView={view}
        activeProjectId={projectId}
      />

      <main className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">{VIEW_LABELS[view]}</h1>
            <SelectionCountBadge />
          </div>
          <div className="flex gap-1 text-sm">
            {(Object.keys(LAYOUT_LABELS) as Layout[]).map((l) => (
              <Link
                key={l}
                href={{ pathname: "/", query: { view, ...(projectId ? { project: projectId } : {}), layout: l } }}
                className={`rounded border border-black/10 px-3 py-1 dark:border-white/10 ${
                  layout === l ? "bg-black text-white dark:bg-white dark:text-black" : "hover:bg-black/5 dark:hover:bg-white/10"
                }`}
              >
                {LAYOUT_LABELS[l]}
              </Link>
            ))}
          </div>
        </div>

        <QuickAddForm projects={projects} tags={tags} defaultProjectId={projectId} />

        <TaskList tasks={tasks} projects={projects} tags={tags} priorityColors={priorityColors} layout={layout} />
      </main>

      <QuickAddModal projects={projects} tags={tags} />
      <UndoToast />
    </div>
  );
}
