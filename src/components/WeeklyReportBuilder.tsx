"use client";

import { useMemo, useState } from "react";
import { renderWeeklyReport } from "@/lib/weeklyReportTemplate";

type CompletedCandidate = {
  id: string;
  title: string;
  projectName: string | null;
  completedAt: string;
};

type ProgressCandidate = {
  id: string;
  title: string;
  projectName: string | null;
  dueDate: string | null;
};

export default function WeeklyReportBuilder({
  weekLabel,
  completedCandidates,
  progressCandidates,
}: {
  weekLabel: string;
  completedCandidates: CompletedCandidate[];
  progressCandidates: ProgressCandidate[];
}) {
  // 기본값: 완료 후보는 전체 체크, 진행/미완료 후보는 전체 체크 해제
  const [completedChecked, setCompletedChecked] = useState<Set<string>>(
    () => new Set(completedCandidates.map((c) => c.id)),
  );
  const [progressChecked, setProgressChecked] = useState<Set<string>>(() => new Set());
  const [copied, setCopied] = useState(false);

  function toggleCompleted(id: string) {
    setCompletedChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleProgress(id: string) {
    setProgressChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const markdown = useMemo(() => {
    return renderWeeklyReport({
      weekLabel,
      completedItems: completedCandidates
        .filter((c) => completedChecked.has(c.id))
        .map((c) => ({ title: c.title, projectName: c.projectName, completedAt: new Date(c.completedAt) })),
      progressItems: progressCandidates
        .filter((c) => progressChecked.has(c.id))
        .map((c) => ({ title: c.title, projectName: c.projectName, dueDate: c.dueDate ? new Date(c.dueDate) : null })),
    });
  }, [weekLabel, completedCandidates, progressCandidates, completedChecked, progressChecked]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 클립보드 접근이 막힌 환경에서는 조용히 무시 (미리보기에서 수동 복사 가능)
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6 lg:flex-row">
      <div className="flex flex-1 flex-col gap-6">
        <section>
          <h2 className="mb-2 text-sm font-semibold text-zinc-600 dark:text-zinc-300">
            ✅ 완료 업무 ({completedCandidates.length})
          </h2>
          {completedCandidates.length === 0 ? (
            <p className="text-sm text-zinc-400">이번 주 완료된 업무가 없습니다.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {completedCandidates.map((c) => (
                <li key={c.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={completedChecked.has(c.id)}
                    onChange={() => toggleCompleted(c.id)}
                    className="h-4 w-4"
                  />
                  <span>{c.projectName ? `[${c.projectName}] ` : ""}{c.title}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-zinc-600 dark:text-zinc-300">
            🔄 진행 중 / 미완료 업무 ({progressCandidates.length})
          </h2>
          {progressCandidates.length === 0 ? (
            <p className="text-sm text-zinc-400">해당하는 업무가 없습니다.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {progressCandidates.map((c) => (
                <li key={c.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={progressChecked.has(c.id)}
                    onChange={() => toggleProgress(c.id)}
                    className="h-4 w-4"
                  />
                  <span>{c.projectName ? `[${c.projectName}] ` : ""}{c.title}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="flex flex-1 flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">미리보기</h2>
          <button
            onClick={handleCopy}
            className="rounded bg-black px-3 py-1.5 text-sm font-medium text-white dark:bg-white dark:text-black"
          >
            {copied ? "복사됨" : "복사"}
          </button>
        </div>
        <pre className="min-h-[240px] flex-1 whitespace-pre-wrap rounded-lg border border-black/10 bg-black/[.02] p-4 text-sm dark:border-white/10 dark:bg-white/[.03]">
          {markdown}
        </pre>
      </div>
    </div>
  );
}
