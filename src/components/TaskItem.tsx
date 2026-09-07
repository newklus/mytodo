"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createSubtask, deleteTask, moveSubtask, renameTask, toggleTaskComplete, updateTask } from "@/lib/actions/tasks";
import { DEFAULT_PRIORITY_COLORS } from "@/lib/priorityColors";
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
        onClick={() => startTransition(async () => toggleTaskComplete(subtask.id, !subtask.completed))}
        disabled={isPending}
        aria-label="완료 토글"
        className={`h-3 w-3 shrink-0 rounded-full border-2 ${
          subtask.completed ? "border-zinc-400 bg-zinc-400" : "border-zinc-400"
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
          onClick={() => setEditing(true)}
          className={`flex-1 cursor-text text-xs ${subtask.completed ? "text-zinc-400 line-through" : ""}`}
        >
          {subtask.title}
        </span>
      )}
      <button
        onClick={() => startTransition(async () => deleteTask(subtask.id))}
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

export default function TaskItem({
  task,
  projects,
  priorityColors = DEFAULT_PRIORITY_COLORS,
}: {
  task: TaskWithRelations;
  projects: Project[];
  priorityColors?: Record<number, string>;
}) {
  const [editing, setEditing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isPending, startTransition] = useTransition();
  const editFormRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!editing) return;

    function handleClickOutside(e: MouseEvent) {
      const form = editFormRef.current;
      if (!form || form.contains(e.target as Node)) return;

      const fd = new FormData(form);
      const unchanged =
        String(fd.get("title") ?? "").trim() === task.title &&
        String(fd.get("description") ?? "").trim() === (task.description ?? "") &&
        String(fd.get("dueDate") ?? "") === toDateInputValue(task.dueDate) &&
        String(fd.get("priority") ?? "") === String(task.priority) &&
        String(fd.get("projectId") ?? "") === (task.projectId ?? "") &&
        String(fd.get("recurrence") ?? "") === (task.recurrence ?? "") &&
        String(fd.get("tags") ?? "") === task.tags.map((t) => t.tag.name).join(", ");

      if (unchanged) setEditing(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [editing, task]);

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

  function handleToggle() {
    startTransition(async () => {
      await toggleTaskComplete(task.id, !task.completed);
    });
  }

  function handleDelete() {
    if (!confirm(`"${task.title}"을(를) 삭제할까요?`)) return;
    startTransition(async () => {
      await deleteTask(task.id);
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
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="rounded bg-black px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
            >
              저장
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded border border-black/10 px-3 py-1.5 text-sm dark:border-white/10"
            >
              취소
            </button>
          </div>
        </form>
      </li>
    );
  }

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
        <button
          onClick={handleToggle}
          disabled={isPending}
          aria-label="완료 토글"
          className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 ${
            task.completed ? "border-zinc-400 bg-zinc-400" : "border-current"
          }`}
          style={{ borderColor: task.completed ? undefined : priorityColor(task.priority, priorityColors) }}
        />

        <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setEditing(true)}>
          <p className={`text-sm ${task.completed ? "text-zinc-400 line-through" : ""}`}>{task.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            {task.dueDate && (
              <span className={isOverdue(task.dueDate, task.completed) ? "font-medium text-red-500" : ""}>
                {formatDate(task.dueDate)}
              </span>
            )}
            {task.recurrence && <span>↻ {RECURRENCE_LABELS[task.recurrence]}</span>}
            {task.description && <span title={task.description}>📝</span>}
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
        </div>

        <button
          onClick={handleDelete}
          disabled={isPending}
          className="hidden shrink-0 px-2 text-xs text-zinc-400 hover:text-red-500 group-hover:block"
          title="삭제"
        >
          삭제
        </button>
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
