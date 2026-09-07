"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createTask } from "@/lib/actions/tasks";
import type { Project } from "@/lib/types";

const PRIORITIES = [
  { value: 1, label: "P1 · 긴급" },
  { value: 2, label: "P2 · 높음" },
  { value: 3, label: "P3 · 보통" },
  { value: 4, label: "P4 · 낮음" },
];

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

export default function QuickAddModal({ projects }: { projects: Project[] }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  // 전역 단축키: "n" → 팝업 열기 (입력 필드에 포커스 없을 때만), "Esc" → 닫기
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (open) {
        if (e.key === "Escape") {
          e.preventDefault();
          setOpen(false);
        }
        return;
      }
      if (e.key === "n" && !e.metaKey && !e.ctrlKey && !e.altKey && !isEditableTarget(e.target)) {
        e.preventDefault();
        setOpen(true);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  useEffect(() => {
    if (open) titleRef.current?.focus();
  }, [open]);

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const form = formRef.current;
    if (!form) return;
    const formData = new FormData(form);
    if (!String(formData.get("title") ?? "").trim()) return;

    startTransition(async () => {
      await createTask(formData);
    });
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-32"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className="flex w-full max-w-md flex-col gap-3 rounded-lg border border-black/10 bg-white p-4 shadow-xl dark:border-white/10 dark:bg-zinc-900"
      >
        <input
          ref={titleRef}
          name="title"
          required
          placeholder="할 일 추가... (Enter 저장, Esc 취소)"
          className="rounded border border-black/10 bg-transparent px-2 py-1.5 text-sm outline-none dark:border-white/10"
        />
        <div className="flex flex-wrap gap-2">
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
            defaultValue=""
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
        </div>
        <input
          name="tags"
          placeholder="태그 (쉼표로 구분)"
          className="rounded border border-black/10 bg-transparent px-2 py-1 text-sm outline-none dark:border-white/10"
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded border border-black/10 px-3 py-1.5 text-sm dark:border-white/10"
          >
            취소 (Esc)
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="rounded bg-black px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            추가 (Enter)
          </button>
        </div>
      </form>
    </div>
  );
}
