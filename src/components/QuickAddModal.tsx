"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createTask } from "@/lib/actions/tasks";
import SmartTitleInput from "@/components/SmartTitleInput";
import type { Project, Tag } from "@/lib/types";

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

export default function QuickAddModal({ projects, tags }: { projects: Project[]; tags: Tag[] }) {
  const [open, setOpen] = useState(false);
  const [initialDueDate, setInitialDueDate] = useState("");
  const [isPending, startTransition] = useTransition();
  const [projectPending, setProjectPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const dueDateRef = useRef<HTMLInputElement>(null);

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
        setInitialDueDate("");
        setOpen(true);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  // 캘린더 칸을 더블클릭하면(CalendarDayCell) 그 날짜를 마감일로 미리 채운 채 팝업을 연다.
  useEffect(() => {
    function handleOpenWithDate(e: Event) {
      const dueDate = (e as CustomEvent<{ dueDate?: string }>).detail?.dueDate ?? "";
      setInitialDueDate(dueDate);
      setOpen(true);
    }
    window.addEventListener("quickadd:open", handleOpenWithDate);
    return () => window.removeEventListener("quickadd:open", handleOpenWithDate);
  }, []);

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (projectPending) return;
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
        <SmartTitleInput
          projects={projects}
          tags={tags}
          autoFocus
          placeholder="할 일 추가... (@프로젝트, #태그, +N일, Enter 저장, Esc 취소)"
          onPendingChange={setProjectPending}
          onDueDateResolved={(date) => {
            if (dueDateRef.current) dueDateRef.current.value = date;
          }}
        />
        <div className="flex flex-wrap gap-2">
          <input
            ref={dueDateRef}
            type="date"
            name="dueDate"
            defaultValue={initialDueDate}
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
        </div>
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
            disabled={isPending || projectPending}
            className="rounded bg-black px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {projectPending ? "프로젝트 생성 중…" : "추가 (Enter)"}
          </button>
        </div>
      </form>
    </div>
  );
}
