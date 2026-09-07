"use client";

import { useEffect, useState, useTransition } from "react";
import { deleteTask, toggleTaskComplete } from "@/lib/actions/tasks";
import TaskItem from "@/components/TaskItem";
import type { Project, Tag, TaskWithRelations } from "@/lib/types";

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

const PRIORITY_LABELS: Record<number, string> = {
  1: "P1 · 긴급",
  2: "P2 · 높음",
  3: "P3 · 보통",
  4: "P4 · 낮음",
};

type Layout = "list" | "priority" | "project" | "tag";

type Column = {
  key: string;
  label: string;
  color?: string | null;
  tasks: TaskWithRelations[];
};

export default function TaskList({
  tasks,
  projects,
  tags,
  priorityColors,
  layout = "list",
}: {
  tasks: TaskWithRelations[];
  projects: Project[];
  tags: Tag[];
  priorityColors: Record<number, string>;
  layout?: Layout;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // d(완료)/r(삭제) 단축키: 체크된(선택된) 태스크들에 대해 일괄 실행, 실행 전 확인 1회
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (selectedIds.size === 0) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isEditableTarget(e.target)) return;

      if (e.key === "d") {
        e.preventDefault();
        const ids = [...selectedIds];
        if (!confirm(`선택한 ${ids.length}개 작업을 완료 처리할까요?`)) return;
        setSelectedIds(new Set());
        startTransition(async () => {
          await Promise.all(ids.map((id) => toggleTaskComplete(id, true)));
        });
      } else if (e.key === "r") {
        e.preventDefault();
        const ids = [...selectedIds];
        if (!confirm(`선택한 ${ids.length}개 작업을 삭제할까요?`)) return;
        setSelectedIds(new Set());
        startTransition(async () => {
          await Promise.all(ids.map((id) => deleteTask(id)));
        });
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedIds, startTransition]);

  const selectionBar = selectedIds.size > 0 && (
    <div className="flex items-center gap-2 rounded-lg bg-black/5 px-3 py-2 text-xs text-zinc-600 dark:bg-white/10 dark:text-zinc-300">
      {selectedIds.size}개 선택됨 · <kbd className="rounded border border-black/20 px-1 dark:border-white/20">d</kbd> 완료 ·{" "}
      <kbd className="rounded border border-black/20 px-1 dark:border-white/20">r</kbd> 삭제
    </div>
  );

  if (layout !== "list") {
    let columns: Column[];

    if (layout === "priority") {
      columns = [1, 2, 3, 4].map((p) => ({
        key: String(p),
        label: PRIORITY_LABELS[p],
        color: priorityColors[p],
        tasks: tasks.filter((t) => t.priority === p),
      }));
    } else if (layout === "project") {
      columns = [
        ...projects.map((p) => ({
          key: p.id,
          label: p.name,
          color: p.color,
          tasks: tasks.filter((t) => t.projectId === p.id),
        })),
        { key: "__none__", label: "프로젝트 없음", color: null, tasks: tasks.filter((t) => !t.projectId) },
      ];
    } else {
      columns = [
        ...tags.map((tg) => ({
          key: tg.id,
          label: `#${tg.name}`,
          color: tg.color,
          tasks: tasks.filter((t) => t.tags.some(({ tag }) => tag.id === tg.id)),
        })),
        { key: "__none__", label: "태그 없음", color: null, tasks: tasks.filter((t) => t.tags.length === 0) },
      ];
    }

    return (
      <>
        {selectionBar}
        <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {columns.map((col) => (
            <div
              key={col.key}
              className="flex min-w-0 flex-col gap-1 rounded-lg border border-black/10 p-2 dark:border-white/10"
            >
              <div className="flex items-center gap-2 px-1 py-1 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                {col.color && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: col.color }} />}
                <span className="truncate">
                  {col.label} ({col.tasks.length})
                </span>
              </div>
              <ul className="flex flex-col divide-y divide-black/5 dark:divide-white/10">
                {col.tasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    projects={projects}
                    priorityColors={priorityColors}
                    selected={selectedIds.has(task.id)}
                    onToggleSelect={toggleSelect}
                  />
                ))}
                {col.tasks.length === 0 && <li className="py-4 text-center text-xs text-zinc-400">없음</li>}
              </ul>
            </div>
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      {selectionBar}
      <ul className="flex flex-col divide-y divide-black/5 dark:divide-white/10">
        {tasks.map((task) => (
          <TaskItem
            key={task.id}
            task={task}
            projects={projects}
            priorityColors={priorityColors}
            selected={selectedIds.has(task.id)}
            onToggleSelect={toggleSelect}
          />
        ))}
        {tasks.length === 0 && <li className="py-8 text-center text-sm text-zinc-400">할 일이 없습니다.</li>}
      </ul>
    </>
  );
}
