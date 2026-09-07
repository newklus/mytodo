import Link from "next/link";
import { createProject, deleteProject } from "@/lib/actions/projects";
import type { Project } from "@/lib/types";

type View = "today" | "upcoming" | "all" | "completed";

const VIEW_LABELS: Record<View, string> = {
  today: "오늘",
  upcoming: "예정",
  all: "전체",
  completed: "완료",
};

export default function Sidebar({
  projects,
  activeView,
  activeProjectId,
  isReportPage = false,
}: {
  projects: Project[];
  activeView?: View;
  activeProjectId?: string;
  isReportPage?: boolean;
}) {
  return (
    <aside className="flex w-56 shrink-0 flex-col gap-6 border-r border-black/10 p-4 dark:border-white/10">
      <nav className="flex flex-col gap-1">
        {(Object.keys(VIEW_LABELS) as View[]).map((v) => (
          <Link
            key={v}
            href={{ pathname: "/", query: { view: v, ...(activeProjectId ? { project: activeProjectId } : {}) } }}
            className={`rounded px-3 py-1.5 text-sm ${
              !isReportPage && activeView === v
                ? "bg-black text-white dark:bg-white dark:text-black"
                : "hover:bg-black/5 dark:hover:bg-white/10"
            }`}
          >
            {VIEW_LABELS[v]}
          </Link>
        ))}
        <Link
          href="/report"
          className={`mt-1 rounded border-t border-black/10 px-3 pb-1 pt-2 text-sm dark:border-white/10 ${
            isReportPage
              ? "bg-black text-white dark:bg-white dark:text-black"
              : "hover:bg-black/5 dark:hover:bg-white/10"
          }`}
        >
          주간보고
        </Link>
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
            <li key={p.id} className="group flex items-center justify-between">
              <Link
                href={{ pathname: "/", query: { view: activeView ?? "today", project: p.id } }}
                className={`flex flex-1 items-center gap-2 truncate rounded px-3 py-1.5 text-sm ${
                  activeProjectId === p.id ? "bg-black/5 dark:bg-white/10" : "hover:bg-black/5 dark:hover:bg-white/10"
                }`}
              >
                <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: p.color ?? "#999" }} />
                <span className="truncate">{p.name}</span>
              </Link>
              <form action={deleteProject.bind(null, p.id)}>
                <button
                  className="hidden px-2 text-xs text-zinc-400 hover:text-red-500 group-hover:block"
                  title="프로젝트 삭제"
                >
                  ✕
                </button>
              </form>
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
    </aside>
  );
}
