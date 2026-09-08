"use client";

import { useState } from "react";
import TaskList from "@/components/TaskList";
import type { Project, Tag, TaskWithRelations } from "@/lib/types";

const PAGE_SIZE = 10;

export default function PaginatedTaskList({
  tasks,
  projects,
  tags,
  priorityColors,
}: {
  tasks: TaskWithRelations[];
  projects: Project[];
  tags: Tag[];
  priorityColors: Record<number, string>;
}) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(tasks.length / PAGE_SIZE));
  // 완료/삭제로 목록이 줄어들어 현재 페이지가 범위를 벗어나면 마지막 페이지로 당겨온다.
  const clampedPage = Math.min(page, totalPages - 1);
  const start = clampedPage * PAGE_SIZE;
  const pageTasks = tasks.slice(start, start + PAGE_SIZE);

  return (
    <div>
      <TaskList tasks={pageTasks} projects={projects} tags={tags} priorityColors={priorityColors} layout="list" />
      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-center gap-3 text-sm">
          <button
            type="button"
            disabled={clampedPage === 0}
            onClick={() => setPage(clampedPage - 1)}
            className="rounded border border-black/10 px-3 py-1 disabled:opacity-40 dark:border-white/10 dark:hover:bg-white/10 hover:bg-black/5"
          >
            이전
          </button>
          <span className="text-zinc-500">
            {clampedPage + 1} / {totalPages}
          </span>
          <button
            type="button"
            disabled={clampedPage >= totalPages - 1}
            onClick={() => setPage(clampedPage + 1)}
            className="rounded border border-black/10 px-3 py-1 disabled:opacity-40 dark:border-white/10 dark:hover:bg-white/10 hover:bg-black/5"
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}
