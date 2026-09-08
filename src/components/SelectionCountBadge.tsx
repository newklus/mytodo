"use client";

import { useSelectionCount } from "@/lib/selectionCount";

export default function SelectionCountBadge() {
  const count = useSelectionCount();
  if (count === 0) return null;
  return <span className="text-sm font-normal text-zinc-500 dark:text-zinc-400">{count}개 선택됨</span>;
}
