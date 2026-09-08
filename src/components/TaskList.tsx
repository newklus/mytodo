"use client";

import { useCallback, useEffect, useMemo, useOptimistic, useState, useTransition } from "react";
import { completeTasks, deleteTasks } from "@/lib/actions/tasks";
import TaskItem from "@/components/TaskItem";
import { offerUndo } from "@/lib/undoBus";
import { matchesShortcut, useMultiSelectModifier, useShortcuts } from "@/lib/shortcuts";
import { useMemoDefaultExpanded } from "@/lib/memoSettings";
import { announceSelectionCount } from "@/lib/selectionCount";
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
  const [rawSelectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();
  const shortcuts = useShortcuts();
  // 목록 전체가 공유하는 설정 두 가지. 예전엔 TaskItem마다 각자 읽어서 행 수만큼
  // localStorage 읽기·window 리스너·마운트 직후 추가 렌더가 생겼다 (측정: 234행 → 468회 읽기).
  const multiSelectModifier = useMultiSelectModifier();
  const memoDefaultExpanded = useMemoDefaultExpanded();

  // 목록이 페이지 단위로 잘려 오면서 "선택해둔 태스크가 화면에서 사라지는" 상황이 생겼다
  // (페이지 이동, 페이지당 개수 변경, 다른 조작으로 목록이 갱신될 때). 그대로 두면 d/r
  // 단축키가 지금 보이지도 않는 항목까지 건드린다. 이건 상태를 고쳐 쓰는 게 아니라 렌더할
  // 때마다 "지금 목록에 실제로 있는 것"만 남기고 걸러내면 되는 파생값이라 useMemo로 둔다.
  const selectedIds = useMemo(() => {
    if (rawSelectedIds.size === 0) return rawSelectedIds;
    const present = new Set(tasks.map((t) => t.id));
    let hasMissing = false;
    for (const id of rawSelectedIds) {
      if (!present.has(id)) {
        hasMissing = true;
        break;
      }
    }
    if (!hasMissing) return rawSelectedIds;
    const next = new Set<string>();
    for (const id of rawSelectedIds) if (present.has(id)) next.add(id);
    return next;
  }, [rawSelectedIds, tasks]);

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

  // 일반 선택(다중 선택 조합키 없이 클릭): 이전 선택은 지우고 이 태스크만 선택한다.
  const selectOnly = useCallback((id: string) => {
    setSelectedIds(new Set([id]));
  }, []);

  // 선택 개수는 더 이상 목록 위 바에 표시하지 않고, 페이지 헤딩 옆 SelectionCountBadge가 보여준다
  // (단축키 힌트는 화면 하단 ShortcutBar에 항상 떠 있어 여기서 중복 표시할 필요가 없어짐).
  useEffect(() => {
    announceSelectionCount(selectedIds.size);
  }, [selectedIds]);

  // d(완료)/Shift+d(완료 취소)/r(삭제)/Esc(선택 해제) 단축키: 선택된 태스크가 있을 때만 동작.
  // 완료·삭제는 체크된 태스크 전체에 일괄 실행(실행 전 확인 1회) — 예전에는 선택한 개수만큼
  // 서버 액션을 각각 호출해 페이지를 그 횟수만큼 다시 그렸지만, 이제 일괄 액션 하나로
  // 왕복 1회 · 화면 갱신 1회만 일어난다. Shift+r은 마땅한 반대 동작이 없어 계속 비워둔다.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (selectedIds.size === 0) return;
      if (isEditableTarget(e.target)) return;

      if (matchesShortcut(e, shortcuts.clearSelection)) {
        setSelectedIds(new Set());
        return;
      }

      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (matchesShortcut(e, shortcuts.uncomplete)) {
        e.preventDefault();
        const ids = [...selectedIds];
        if (!confirm(`선택한 ${ids.length}개 작업을 완료 취소할까요?`)) return;
        setSelectedIds(new Set());
        startTransition(async () => {
          hideTasks(ids);
          const snapshot = await completeTasks(ids, false);
          offerUndo({ type: "complete", message: `${ids.length}개 완료 취소함`, snapshot });
        });
        return;
      }

      const isComplete = matchesShortcut(e, shortcuts.complete);
      const isDelete = matchesShortcut(e, shortcuts.delete);
      if (!isComplete && !isDelete) return;

      e.preventDefault();
      const ids = [...selectedIds];
      const verb = isComplete ? "완료 처리" : "삭제";
      if (!confirm(`선택한 ${ids.length}개 작업을 ${verb}할까요?`)) return;
      setSelectedIds(new Set());
      startTransition(async () => {
        hideTasks(ids);
        if (isComplete) {
          const snapshot = await completeTasks(ids, true);
          offerUndo({ type: "complete", message: `${ids.length}개 완료 처리함`, snapshot });
        } else {
          const snapshot = await deleteTasks(ids);
          offerUndo({ type: "delete", message: `${ids.length}개 삭제함`, snapshot });
        }
      });
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedIds, startTransition, hideTasks, shortcuts]);

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

  const renderTask = (task: TaskWithRelations) => (
    <TaskItem
      key={task.id}
      task={task}
      projects={projects}
      priorityColors={priorityColors}
      selected={selectedIds.has(task.id)}
      isSoleSelection={selectedIds.size === 1 && selectedIds.has(task.id)}
      multiSelectModifier={multiSelectModifier}
      memoDefaultExpanded={memoDefaultExpanded}
      onToggleSelect={toggleSelect}
      onSelectOnly={selectOnly}
      onLeaveView={hideTasks}
    />
  );

  if (columns) {
    return (
      <>
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
      <ul className="flex flex-col divide-y divide-black/5 dark:divide-white/10">
        {visibleTasks.map(renderTask)}
        {visibleTasks.length === 0 && <li className="py-8 text-center text-sm text-zinc-400">할 일이 없습니다.</li>}
      </ul>
    </>
  );
}
