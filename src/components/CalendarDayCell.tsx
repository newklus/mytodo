"use client";

import Link from "next/link";

export type CalendarChip = { id: string; title: string; color: string };

export default function CalendarDayCell({
  dateKey,
  monthParam,
  dayNumber,
  isSelected,
  isToday,
  inMonth,
  chips,
  overflow,
}: {
  dateKey: string;
  monthParam: string;
  dayNumber: number;
  isSelected: boolean;
  isToday: boolean;
  inMonth: boolean;
  chips: CalendarChip[];
  overflow: number;
}) {
  return (
    <Link
      href={{ pathname: "/calendar", query: { month: monthParam, date: dateKey } }}
      onDoubleClick={() => {
        window.dispatchEvent(new CustomEvent("quickadd:open", { detail: { dueDate: dateKey } }));
      }}
      className={`block min-h-[92px] rounded border p-1 text-left text-xs ${
        isSelected
          ? "border-black dark:border-white"
          : "border-black/10 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
      } ${inMonth ? "" : "opacity-40"}`}
    >
      <span
        className={
          isToday
            ? "flex h-5 w-5 items-center justify-center rounded-full bg-black text-white dark:bg-white dark:text-black"
            : ""
        }
      >
        {dayNumber}
      </span>
      <div className="mt-1 flex flex-col gap-0.5">
        {chips.map((t) => (
          <span key={t.id} className="flex items-center gap-1 truncate rounded bg-black/5 px-1 py-0.5 dark:bg-white/10">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: t.color }} />
            <span className="truncate">{t.title}</span>
          </span>
        ))}
        {overflow > 0 && <span className="text-zinc-400">+{overflow}개</span>}
      </div>
    </Link>
  );
}
