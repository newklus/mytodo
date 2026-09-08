import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { START_PAGE_COOKIE, isStartPage } from "@/lib/startPage";
import { PAGE_SIZE_COOKIE, parsePageParam, parsePageSize } from "@/lib/pageSize";
import ListPagination from "@/components/ListPagination";
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
  searchParams: Promise<{ view?: string; project?: string; layout?: string; page?: string }>;
}) {
  const params = await searchParams;
  const cookieStore = await cookies();

  // view가 명시되지 않은 "맨 URL" 진입(=앱을 새로 켰을 때)에만 설정된 시작 페이지를 따른다.
  // 사이드바의 "전체"/"오늘" 링크 등은 항상 view를 명시하므로 이 로직과 무관하게 그대로 동작한다.
  let view: View;
  if (params.view) {
    view = params.view as View;
  } else {
    const startPage = cookieStore.get(START_PAGE_COOKIE)?.value;
    if (isStartPage(startPage) && startPage === "calendar") redirect("/calendar");
    view = isStartPage(startPage) && startPage === "all" ? "all" : "today";
  }

  const pageSize = parsePageSize(cookieStore.get(PAGE_SIZE_COOKIE)?.value);
  const requestedPage = parsePageParam(params.page);

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
  // 마지막 id는 화면상 순서를 바꾸려는 게 아니라 "완전한 순서"를 만들기 위한 것이다:
  // skip/take로 페이지를 자르려면 동점일 때 순서가 매번 같아야 하는데, 일괄 완료는 선택한
  // 전부에 같은 completedAt을 넣고(10.4절) 생성일도 같은 밀리초로 겹칠 수 있다. 동점이 남아
  // 있으면 같은 태스크가 두 페이지에 나오거나 아예 빠질 수 있어서 id로 확정해 둔다.
  const orderBy: Prisma.TaskOrderByWithRelationInput[] =
    view === "completed"
      ? [{ completedAt: "desc" }, { id: "asc" }]
      : [{ priority: "asc" }, { createdAt: "asc" }, { id: "asc" }];

  // 예전에는 조건에 맞는 태스크를 전부 가져와 전부 렌더했다. 그래서 화면에 보이는 개수와
  // 무관하게 서버 렌더·직렬화·하이드레이션 비용이 데이터량에 정비례했고, 관계까지 include 하는
  // 조회라 1,000건 근처에서 SQLite 파라미터 한도(999)에 걸려 페이지 자체가 500으로 죽었다.
  // 이제 DB 쿼리 단계에서 한 페이지만 잘라 온다.
  const taskPageQuery = (skip: number) =>
    prisma.task.findMany({
      where,
      include: {
        project: true,
        subtasks: { orderBy: { createdAt: "asc" } },
        tags: { include: { tag: true } },
      },
      orderBy,
      skip,
      take: pageSize,
    });

  // count는 인덱스만 훑는 가벼운 쿼리라 목록 조회와 같이 한 번에 보낸다(왕복 추가 없음).
  const [projects, tags, priorityColors, totalCount, requestedTasks] = await Promise.all([
    prisma.project.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.tag.findMany({ orderBy: { name: "asc" } }),
    getPriorityColors(),
    prisma.task.count({ where }),
    taskPageQuery(requestedPage * pageSize),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  // 완료/삭제로 목록이 줄어 현재 페이지가 범위를 벗어나면 마지막 페이지로 당겨온다
  // (캘린더 "미등록 일정"도 같은 규칙). 이때만 한 번 더 조회한다.
  const page = Math.min(requestedPage, totalPages - 1);
  const tasks = page === requestedPage ? requestedTasks : await taskPageQuery(page * pageSize);

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

        <QuickAddForm projects={projects} tags={tags} />

        <TaskList tasks={tasks} projects={projects} tags={tags} priorityColors={priorityColors} layout={layout} />

        <ListPagination
          page={page}
          totalPages={totalPages}
          totalCount={totalCount}
          pageSize={pageSize}
          query={{ view, ...(projectId ? { project: projectId } : {}), ...(layout !== "list" ? { layout } : {}) }}
        />
      </main>

      <QuickAddModal projects={projects} tags={tags} />
      <UndoToast />
    </div>
  );
}
