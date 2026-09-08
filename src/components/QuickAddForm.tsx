"use client";

import { useRef, useState, useTransition } from "react";
import { createTask } from "@/lib/actions/tasks";
import SmartTitleInput from "@/components/SmartTitleInput";
import type { Project, Tag } from "@/lib/types";

const PRIORITIES = [
  { value: 1, label: "P1 · 긴급" },
  { value: 2, label: "P2 · 높음" },
  { value: 3, label: "P3 · 보통" },
  { value: 4, label: "P4 · 낮음" },
];

export default function QuickAddForm({
  projects,
  tags,
  defaultProjectId,
}: {
  projects: Project[];
  tags: Tag[];
  defaultProjectId?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const dueDateRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [resetKey, setResetKey] = useState(0);
  const [projectPending, setProjectPending] = useState(false);

  const defaultProject = projects.find((p) => p.id === defaultProjectId) ?? null;

  return (
    <form
      ref={formRef}
      action={(formData) => {
        startTransition(async () => {
          await createTask(formData);
          formRef.current?.reset();
          setResetKey((k) => k + 1);
        });
      }}
      className="flex flex-wrap items-center gap-2 rounded-lg border border-black/10 p-3 dark:border-white/10"
    >
      <SmartTitleInput
        key={resetKey}
        projects={projects}
        tags={tags}
        defaultProject={defaultProject}
        onPendingChange={setProjectPending}
        onDueDateResolved={(date) => {
          if (dueDateRef.current) dueDateRef.current.value = date;
        }}
      />
      <input
        ref={dueDateRef}
        type="date"
        name="dueDate"
        className="rounded border border-black/10 bg-transparent px-2 py-1 text-sm outline-none dark:border-white/10"
      />
      <select
        name="priority"
        defaultValue={3}
        className="rounded border border-black/10 bg-transparent px-2 py-1 text-sm outline-none dark:border-white/10"
      >
        {PRIORITIES.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
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
      <button
        type="submit"
        disabled={isPending || projectPending}
        className="rounded bg-black px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {projectPending ? "프로젝트 생성 중…" : "추가"}
      </button>
    </form>
  );
}
