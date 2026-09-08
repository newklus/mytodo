"use client";

// 태스크 메모(설명)를 목록에서 기본으로 펼쳐 보여줄지 여부. 태스크마다 클릭으로 개별
// 접고 펼 수 있는 것과는 별개로, "새로 볼 때 처음 상태"를 여기서 정한다.
export const DEFAULT_MEMO_EXPANDED = true;

const STORAGE_KEY = "mytodo:memoDefaultExpanded";

export function getMemoDefaultExpanded(): boolean {
  if (typeof window === "undefined") return DEFAULT_MEMO_EXPANDED;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "true") return true;
    if (saved === "false") return false;
  } catch {}
  return DEFAULT_MEMO_EXPANDED;
}

export function setMemoDefaultExpanded(value: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(value));
  } catch {}
}
