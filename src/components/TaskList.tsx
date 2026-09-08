"use client";

import { useCallback, useEffect, useMemo, useOptimistic, useState, useTransition } from "react";
import { completeTasks, deleteTasks } from "@/lib/actions/tasks";
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

const NO_GROUP = "__none__";

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

  // 완료/완료취소/삭제는 전부 "이 태스크가 현재 뷰에서 빠진다"로 귀결된다.
  // (완료 뷰에서는 완료 취소한 것이, 나머지 뷰에서는 완료 처리한 것이 목록을 떠난다.)
  // 그래서 서버 응답을 기다리지 않고 해당 행을 즉시 감춰 클릭이 바로 반영되게 한다.
  // 트랜잭션이 끝나면 서버가 내려준 실제 목록으로 자연히 대체된다.
  const [visibleTasks, hideTasks] = useOptimistic(tasks, (current: TaskWithRelations[], removedIds: string[]) => {
    const removed = new Set(removedIds);
    return current.filter((t) => !removed.has(t.id));
  });

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // d(완료)/r(삭제) 단축키: 체크된(선택된) 태스크들에 대해 일괄 실행, 실행 전 확인 1회.
  // 예전에는 선택한 개수만큼 서버 액션을 각각 호출해 페이지를 그 횟수만큼 다시 그렸다.
  // 이제 일괄 액션 하나로 왕복 1회 · 화면 갱신 1회만 일어난다.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (selectedIds.size === 0) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isEditableTarget(e.target)) return;
      if (e.key !== "d" && e.key !== "r") return;

      const isComplete = e.key === "d";
      e.preventDefault();
      const ids = [...selectedIds];
      const verb = isComplete ? "완료 처리" : "삭제";
      if (!confirm(`선택한 ${ids.length}개 작업을 ${verb}할까요?`)) return;
      setSelectedIds(new Set());
      startTransition(async () => {
        hideTasks(ids);
        await (isComplete ? completeTasks(ids, true) : deleteTasks(ids));
      });
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedIds, startTransition, hideTasks]);

  // 칸반 3종은 예전에 컬럼마다 tasks 전체를 filter로 훑어서 태스크×컬럼 만큼 비교했다.
  // 한 번만 순회하며 그룹으로 나눠 담고, 입력이 그대로면 다시 계산하지도 않는다.
  const columns = useMemo<Column[] | null>(() => {
    if (layout === "list") return null;

    const buckets = new Map<string, TaskWithRelations[]>();
    const push = (key: string, task: TaskWithRelations) => {
      const bucket = buckets.get(key);
      if (bucket) bucket.push(task);
      else buckets.set(key, [task]);
    };

    if (layout === "priority") {
      for (const task of visibleTasks) push(String(task.priority), task);
      return [1, 2, 3, 4].map((p) => ({
        key: String(p),
        label: PRIORITY_LABELS[p],
        color: priorityColors[p],
        tasks: buckets.get(String(p)) ?? [],
      }));
    }

    if (layout === "project") {
      for (const task of visibleTasks) push(task.projectId ?? NO_GROUP, task);
      return [
        ...projects.map((p) => ({ key: p.id, label: p.name, color: p.color, tasks: buckets.get(p.id) ?? [] })),
        { key: NO_GROUP, label: "프로젝트 없음", color: null, tasks: buckets.get(NO_GROUP) ?? [] },
      ];
    }

    // 태그별: 태그가 여러 개면 해당하는 모든 컬럼에 카드가 중복으로 나타난다 (Notion 스타일)
    for (const task of visibleTasks) {
      if (task.tags.length === 0) push(NO_GROUP, task);
      else for (const { tag } of task.tags) push(tag.id, task);
    }
    return [
      ...tags.map((tg) => ({ key: tg.id, label: `#${tg.name}`, color: tg.color, tasks: buckets.get(tg.id) ?? [] })),
      { key: NO_GROUP, label: "태그 없음", color: null, tasks: buckets.get(NO_GROUP) ?? [] },
    ];
  }, [layout, visibleTasks, projects, tags, priorityColors]);

  const selectionBar = selectedIds.size > 0 && (
    <div className="flex items-center gap-2 rounded-lg bg-black/5 px-3 py-2 text-xs text-zinc-600 dark:bg-white/10 dark:text-zinc-300">
      {selectedIds.size}개 선택됨 · <kbd className="rounded border border-black/20 px-1 dark:border-white/20">d</kbd> 완료 ·{" "}
      <kbd className="rounded border border-black/20 px-1 dark:border-white/20">r</kbd> 삭제
    </div>
  );

  const renderTask = (task: TaskWithRelations) => (
    <TaskItem
      key={task.id}
      task={task}
      projects={projects}
      priorityColors={priorityColors}
      selected={selectedIds.has(task.id)}
      onToggleSelect={toggleSelect}
      onLeaveView={hideTasks}
    />
  );

  if (columns) {
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
                {col.tasks.map(renderTask)}
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
        {visibleTasks.map(renderTask)}
        {visibleTasks.length === 0 && <li className="py-8 text-center text-sm text-zinc-400">할 일이 없습니다.</li>}
      </ul>
    </>
  );
}
