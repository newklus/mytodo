"use client";

import { memo, useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { createSubtask, deleteTask, moveSubtask, renameTask, toggleTaskComplete, updateTask } from "@/lib/actions/tasks";
import { DEFAULT_MEMO_EXPANDED, getMemoDefaultExpanded } from "@/lib/memoSettings";
import { DEFAULT_PRIORITY_COLORS } from "@/lib/priorityColors";
import { isModifierPressed, useMultiSelectModifier } from "@/lib/shortcuts";
import { offerUndo } from "@/lib/undoBus";
import type { Project, TaskWithRelations } from "@/lib/types";

const SUBTASK_DRAG_TYPE = "application/x-subtask-id";

const PRIORITIES = [
  { value: 1, label: "P1 · 긴급" },
  { value: 2, label: "P2 · 높음" },
  { value: 3, label: "P3 · 보통" },
  { value: 4, label: "P4 · 낮음" },
];

const RECURRENCE_LABELS: Record<string, string> = {
  DAILY: "매일",
  WEEKLY: "매주",
  MONTHLY: "매월",
};

function priorityColor(priority: number, colors: Record<number, string>) {
  return colors[priority] ?? DEFAULT_PRIORITY_COLORS[priority] ?? "#9ca3af";
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric" }).format(date);
}

function isOverdue(dueDate: Date | null, completed: boolean) {
  if (!dueDate || completed) return false;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  return dueDate.getTime() < startOfToday.getTime();
}

function toDateInputValue(date: Date | null) {
  if (!date) return "";
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

function SubtaskRow({ subtask }: { subtask: TaskWithRelations["subtasks"][number] }) {
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(subtask.title);
  // 서버 왕복을 기다리지 않고 체크 표시를 먼저 바꾼다.
  const [completed, setCompletedOptimistic] = useOptimistic(subtask.completed);
  // 삭제도 마찬가지 — 응답 전에 행을 먼저 지운다.
  const [removed, markRemoved] = useOptimistic(false, () => true);

  function commitRename() {
    setEditing(false);
    const trimmed = title.trim();
    if (!trimmed || trimmed === subtask.title) {
      setTitle(subtask.title);
      return;
    }
    startTransition(async () => {
      await renameTask(subtask.id, trimmed);
    });
  }

  if (removed) return null;

  return (
    <li className="flex items-center gap-2 py-1">
      <span
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData(SUBTASK_DRAG_TYPE, subtask.id);
          e.dataTransfer.effectAllowed = "move";
        }}
        title="드래그해서 다른 태스크의 하위로 이동"
        className="shrink-0 cursor-grab select-none text-zinc-300 active:cursor-grabbing"
      >
        ⠿
      </span>
      <button
        onClick={() => {
          const nextCompleted = !completed;
          startTransition(async () => {
            setCompletedOptimistic(nextCompleted);
            const snapshot = await toggleTaskComplete(subtask.id, nextCompleted);
            offerUndo({
              type: "complete",
              message: `"${subtask.title}" ${nextCompleted ? "완료 처리" : "완료 취소"}함`,
              snapshot,
            });
          });
        }}
        disabled={isPending}
        aria-label="완료 토글"
        className={`h-3 w-3 shrink-0 rounded-full border-2 ${
          completed ? "border-zinc-400 bg-zinc-400" : "border-zinc-400"
        }`}
      />
      {editing ? (
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              setTitle(subtask.title);
              setEditing(false);
            }
          }}
          className="flex-1 border-b border-black/20 bg-transparent text-xs outline-none dark:border-white/20"
        />
      ) : (
        <span
          onClick={() => {
            if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
            setEditing(true);
          }}
          className={`flex-1 cursor-text text-xs ${completed ? "text-zinc-400 line-through" : ""}`}
        >
          {subtask.title}
        </span>
      )}
      <button
        onClick={() =>
          startTransition(async () => {
            markRemoved(null);
            const snapshot = await deleteTask(subtask.id);
            offerUndo({ type: "delete", message: `"${subtask.title}" 삭제함`, snapshot });
          })
        }
        disabled={isPending}
        className="text-xs text-zinc-300 hover:text-red-500"
      >
        ✕
      </button>
    </li>
  );
}

function AddSubtaskForm({ parentId }: { parentId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      ref={formRef}
      action={(formData) => {
        startTransition(async () => {
          await createSubtask(parentId, formData);
          formRef.current?.reset();
        });
      }}
      className="flex items-center gap-2 py-1"
    >
      <input
        name="title"
        placeholder="+ 하위 작업 추가"
        disabled={isPending}
        className="flex-1 bg-transparent text-xs text-zinc-500 outline-none placeholder:text-zinc-400"
      />
      <button
        type="submit"
        disabled={isPending}
        className="text-xs text-zinc-400 hover:text-zinc-600 disabled:opacity-50 dark:hover:text-zinc-200"
      >
        추가
      </button>
    </form>
  );
}

function TaskItem({
  task,
  projects,
  priorityColors = DEFAULT_PRIORITY_COLORS,
  selected = false,
  isSoleSelection = false,
  onToggleSelect,
  onSelectOnly,
  onLeaveView,
}: {
  task: TaskWithRelations;
  projects: Project[];
  priorityColors?: Record<number, string>;
  selected?: boolean;
  // 현재 선택된 태스크가 이 하나뿐인지 — 본문을 다시 클릭했을 때 편집으로 들어갈지 판단하는 데 쓰인다.
  isSoleSelection?: boolean;
  // 다중 선택 조합키(기본 Ctrl)를 누른 채 클릭 — 기존 선택을 유지하며 토글.
  onToggleSelect?: (id: string) => void;
  // 조합키 없이 클릭(일반 선택) — 기존 선택을 지우고 이 태스크만 선택.
  onSelectOnly?: (id: string) => void;
  // 완료/완료취소/삭제하면 이 태스크는 현재 뷰의 조건에서 벗어난다.
  // 서버 응답 전에 목록에서 먼저 치워 클릭이 즉시 반영되게 하는 콜백.
  onLeaveView?: (ids: string[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isPending, startTransition] = useTransition();
  const editFormRef = useRef<HTMLFormElement>(null);
  const [memoExpanded, setMemoExpanded] = useState(DEFAULT_MEMO_EXPANDED);
  const multiSelectModifier = useMultiSelectModifier();

  // 마운트 후에 저장된 기본값을 읽어야 SSR 결과와 하이드레이션이 어긋나지 않는다.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMemoExpanded(getMemoDefaultExpanded());
  }, []);

  function isFormUnchanged(form: HTMLFormElement) {
    const fd = new FormData(form);
    return (
      String(fd.get("title") ?? "").trim() === task.title &&
      String(fd.get("description") ?? "").trim() === (task.description ?? "") &&
      String(fd.get("dueDate") ?? "") === toDateInputValue(task.dueDate) &&
      String(fd.get("priority") ?? "") === String(task.priority) &&
      String(fd.get("projectId") ?? "") === (task.projectId ?? "") &&
      String(fd.get("recurrence") ?? "") === (task.recurrence ?? "") &&
      String(fd.get("tags") ?? "") === task.tags.map((t) => t.tag.name).join(", ")
    );
  }

  // 폼 바깥으로 포커스가 이동하면(다른 필드로 이동하는 게 아니라 완전히 벗어나면)
  // 변경사항이 있을 때만 자동 저장하고, 없으면 그냥 보기 화면으로 돌아간다.
  function handleFormBlur(e: React.FocusEvent<HTMLFormElement>) {
    const form = e.currentTarget;
    if (e.relatedTarget && form.contains(e.relatedTarget as Node)) return;

    if (isFormUnchanged(form)) {
      setEditing(false);
      return;
    }

    const formData = new FormData(form);
    startTransition(async () => {
      await updateTask(formData);
      setEditing(false);
    });
  }

  function handleDragOver(e: React.DragEvent<HTMLElement>) {
    if (!e.dataTransfer.types.includes(SUBTASK_DRAG_TYPE)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function handleDrop(e: React.DragEvent<HTMLElement>) {
    const subtaskId = e.dataTransfer.getData(SUBTASK_DRAG_TYPE);
    if (!subtaskId) return;
    e.preventDefault();
    setIsDragOver(false);
    startTransition(async () => {
      await moveSubtask(subtaskId, task.id);
    });
  }

  function handleComplete() {
    const nextCompleted = !task.completed;
    const verb = task.completed ? "완료를 취소" : "완료 처리";
    if (!confirm(`"${task.title}"을(를) ${verb}할까요?`)) return;
    startTransition(async () => {
      onLeaveView?.([task.id]);
      const snapshot = await toggleTaskComplete(task.id, nextCompleted);
      offerUndo({
        type: "complete",
        message: `"${task.title}" ${nextCompleted ? "완료 처리" : "완료 취소"}함`,
        snapshot,
      });
    });
  }

  function handleDelete() {
    if (!confirm(`"${task.title}"을(를) 삭제할까요?`)) return;
    startTransition(async () => {
      onLeaveView?.([task.id]);
      const snapshot = await deleteTask(task.id);
      offerUndo({ type: "delete", message: `"${task.title}" 삭제함`, snapshot });
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await updateTask(formData);
      setEditing(false);
    });
  }

  if (editing) {
    return (
      <li className="py-3">
        <form
          ref={editFormRef}
          onSubmit={handleSubmit}
          onBlur={handleFormBlur}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.requestSubmit();
            }
          }}
          className="flex flex-wrap items-center gap-2"
        >
          <input type="hidden" name="id" value={task.id} />
          <input
            name="title"
            defaultValue={task.title}
            required
            autoFocus
            className="min-w-[160px] flex-1 rounded border border-black/10 bg-transparent px-2 py-1 text-sm outline-none dark:border-white/10"
          />
          <input
            type="date"
            name="dueDate"
            defaultValue={toDateInputValue(task.dueDate)}
            className="rounded border border-black/10 bg-transparent px-2 py-1 text-sm outline-none dark:border-white/10"
          />
          <select
            name="priority"
            defaultValue={task.priority}
            className="rounded border border-black/10 bg-transparent px-2 py-1 text-sm outline-none dark:border-white/10"
          >
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <select
            name="projectId"
            defaultValue={task.projectId ?? ""}
            className="rounded border border-black/10 bg-transparent px-2 py-1 text-sm outline-none dark:border-white/10"
          >
            <option value="">프로젝트 없음</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            name="recurrence"
            defaultValue={task.recurrence ?? ""}
            className="rounded border border-black/10 bg-transparent px-2 py-1 text-sm outline-none dark:border-white/10"
          >
            <option value="">반복 없음</option>
            <option value="DAILY">매일</option>
            <option value="WEEKLY">매주</option>
            <option value="MONTHLY">매월</option>
          </select>
          <input
            name="tags"
            defaultValue={task.tags.map((t) => t.tag.name).join(", ")}
            placeholder="태그 (쉼표로 구분)"
            className="w-40 rounded border border-black/10 bg-transparent px-2 py-1 text-sm outline-none dark:border-white/10"
          />
          <textarea
            name="description"
            defaultValue={task.description ?? ""}
            placeholder="메모 (선택, 나중에 자세한 내용을 적어둘 수 있어요) — Ctrl+Enter로 저장"
            rows={3}
            className="w-full rounded border border-black/10 bg-transparent px-2 py-1.5 text-sm outline-none dark:border-white/10"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded border border-black/10 px-3 py-1.5 text-sm dark:border-white/10"
            >
              취소
            </button>
            <span className="text-xs text-zinc-400">다른 곳을 클릭하면 자동 저장됩니다</span>
          </div>
        </form>
      </li>
    );
  }

  const accentStyle = { "--task-accent": priorityColor(task.priority, priorityColors) } as React.CSSProperties;

  return (
    <li
      onDragOver={handleDragOver}
      onDragEnter={(e) => {
        if (e.dataTransfer.types.includes(SUBTASK_DRAG_TYPE)) setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      className={`group py-3 ${isDragOver ? "rounded-lg bg-black/5 dark:bg-white/10" : ""}`}
    >
      <div className="flex items-start gap-3">
        <div
          className="-mx-1 flex min-w-0 flex-1 items-start gap-3 rounded border border-transparent px-1 hover:border-[var(--task-accent)]"
          style={accentStyle}
        >
          <button
            onClick={(e) => {
              // 다중 선택 조합키(기본 Ctrl)를 누른 채면 기존 선택에 토글, 아니면 이 태스크만 선택.
              if (isModifierPressed(e, multiSelectModifier)) onToggleSelect?.(task.id);
              else onSelectOnly?.(task.id);
            }}
            aria-label="선택"
            aria-pressed={selected}
            className="mt-0.5 h-4 w-4 shrink-0 rounded-full border-2"
            style={{
              borderColor: priorityColor(task.priority, priorityColors),
              background: selected ? priorityColor(task.priority, priorityColors) : undefined,
            }}
          />

          <div
            className="min-w-0 flex-1 cursor-pointer"
            onClick={(e) => {
              if (isModifierPressed(e, multiSelectModifier)) {
                onToggleSelect?.(task.id);
                return;
              }
              // 이미 이 태스크 하나만 선택된 상태에서 다시 클릭해야 편집 모드로 들어간다.
              // 그 외(선택 안 됨, 또는 다른 태스크들과 함께 다중 선택된 상태)에는 이 태스크만
              // 선택한다(이전 선택은 해제) — 일반 선택으로 옮기면 이전 선택이 취소되는 동작.
              if (isSoleSelection) {
                // 클릭한 곳(div)은 포커스를 못 받는 요소라, 다른 태스크가 편집 중이어도
                // 자동으로 blur가 안 걸린다. 명시적으로 blur를 걸어서 그쪽의 자동저장/취소
                // 로직(onBlur)이 먼저 돌게 한 다음 이 태스크를 편집 모드로 연다.
                if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
                setEditing(true);
                return;
              }
              onSelectOnly?.(task.id);
            }}
          >
            <p className={`text-sm ${task.completed ? "text-zinc-400 line-through" : ""}`}>{task.title}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
              {task.dueDate && (
                <span className={isOverdue(task.dueDate, task.completed) ? "font-medium text-red-500" : ""}>
                  {formatDate(task.dueDate)}
                </span>
              )}
              {task.recurrence && <span>↻ {RECURRENCE_LABELS[task.recurrence]}</span>}
              {task.description && (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    setMemoExpanded((v) => !v);
                  }}
                  title={memoExpanded ? "메모 접기" : task.description}
                  className="cursor-pointer"
                >
                  📝
                </span>
              )}
              {task.project && (
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: task.project.color ?? "#999" }} />
                  {task.project.name}
                </span>
              )}
              {task.tags.map(({ tag }) => (
                <span
                  key={tag.id}
                  className="flex items-center gap-1 rounded-full bg-black/5 px-2 py-0.5 dark:bg-white/10"
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: tag.color ?? "#999" }} />
                  {tag.name}
                </span>
              ))}
            </div>
            {task.description && memoExpanded && (
              <p
                onClick={(e) => {
                  e.stopPropagation();
                  setMemoExpanded(false);
                }}
                className="mt-1 cursor-pointer whitespace-pre-wrap text-xs text-zinc-500 dark:text-zinc-400"
              >
                {task.description}
              </p>
            )}
          </div>
        </div>

        <div
          className={`shrink-0 items-center gap-1 ${
            task.completed ? "flex" : "hidden group-hover:flex"
          }`}
        >
          <button
            onClick={handleComplete}
            disabled={isPending}
            className="px-2 text-xs text-zinc-400 hover:text-emerald-600"
          >
            {task.completed ? "완료 취소" : "완료"}
          </button>
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="px-2 text-xs text-zinc-400 hover:text-red-500"
          >
            삭제
          </button>
        </div>
      </div>

      <div className="ml-7 mt-1">
        <ul>
          {task.subtasks.map((subtask) => (
            <SubtaskRow key={subtask.id} subtask={subtask} />
          ))}
        </ul>
        <AddSubtaskForm parentId={task.id} />
      </div>
    </li>
  );
}

// 태스크를 하나 선택하면 목록 전체가 다시 렌더된다. 실제로 달라지는 건 그 행뿐이라
// props가 그대로인 행은 렌더를 건너뛴다 (TaskList가 콜백을 안정적으로 넘겨주고 있다).
export default memo(TaskItem);
