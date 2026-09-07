"use client";

import { useRef, useTransition } from "react";
import { createTask } from "@/lib/actions/tasks";
import type { Project } from "@/lib/types";

const PRIORITIES = [
  { value: 1, label: "P1 · 긴급" },
  { value: 2, label: "P2 · 높음" },
  { value: 3, label: "P3 · 보통" },
  { value: 4, label: "P4 · 낮음" },
];

export default function QuickAddForm({
  projects,
  defaultProjectId,
}: {
  projects: Project[];
  defaultProjectId?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      ref={formRef}
      action={(formData) => {
        startTransition(async () => {
          await createTask(formData);
          formRef.current?.reset();
        });
      }}
      className="flex flex-wrap items-center gap-2 rounded-lg border border-black/10 p-3 dark:border-white/10"
    >
      <input
        name="title"
        required
        placeholder="할 일 추가..."
        className="min-w-[180px] flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-400"
      />
      <input
        type="date"
        name="dueDate"
        className="rounded border border-black/10 bg-transparent px-2 py-1 text-sm outline-none dark:border-white/10"
      />
      <select
        name="priority"
        defaultValue={4}
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
        defaultValue={defaultProjectId ?? ""}
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
        defaultValue=""
        className="rounded border border-black/10 bg-transparent px-2 py-1 text-sm outline-none dark:border-white/10"
      >
        <option value="">반복 없음</option>
        <option value="DAILY">매일</option>
        <option value="WEEKLY">매주</option>
        <option value="MONTHLY">매월</option>
      </select>
      <input
        name="tags"
        placeholder="태그 (쉼표로 구분)"
        className="w-32 rounded border border-black/10 bg-transparent px-2 py-1 text-sm outline-none dark:border-white/10"
      />
      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-black px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        추가
      </button>
    </form>
  );
}
