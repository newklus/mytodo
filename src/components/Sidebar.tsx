import Link from "next/link";
import { createProject } from "@/lib/actions/projects";
import PriorityColorPicker from "@/components/PriorityColorPicker";
import TagColorPicker from "@/components/TagColorPicker";
import { DEFAULT_PRIORITY_COLORS } from "@/lib/priorityColors";
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
  return (
    <aside className="flex w-56 shrink-0 flex-col gap-6 border-r border-black/10 p-4 dark:border-white/10">
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

      <details className="mt-auto">
        <summary className="cursor-pointer select-none text-xs font-semibold uppercase text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
          ⚙ 설정
        </summary>

        <div className="mt-3 flex flex-col gap-4">
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
        </div>
      </details>
    </aside>
  );
}
