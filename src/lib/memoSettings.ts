"use client";

import { useEffect, useState } from "react";

// 태스크 메모(설명)를 목록에서 기본으로 펼쳐 보여줄지 여부. 태스크마다 클릭으로 개별
// 접고 펼 수 있는 것과는 별개로, "새로 볼 때 처음 상태"를 여기서 정한다.
export const DEFAULT_MEMO_EXPANDED = true;

const STORAGE_KEY = "mytodo:memoDefaultExpanded";
const CHANGE_EVENT = "mytodo:memo-default-change";

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
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

// 예전에는 태스크 행마다 이 값을 각자 localStorage에서 읽었다(행 수 × 1회 읽기 + 행마다
// 마운트 직후 setState 한 번 = 목록 전체가 한 번 더 렌더). 목록을 감싸는 TaskList가 한 번만
// 읽어 내려주면 되는 값이라 훅으로 올렸다 — useShortcuts/useMultiSelectModifier와 같은 관례.
export function useMemoDefaultExpanded() {
  const [expanded, setExpanded] = useState(DEFAULT_MEMO_EXPANDED);

  // 마운트 후에 저장된 값을 읽어야 SSR 결과(기본값)와 하이드레이션이 어긋나지 않는다.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExpanded(getMemoDefaultExpanded());
    function handleChange() {
      setExpanded(getMemoDefaultExpanded());
    }
    window.addEventListener(CHANGE_EVENT, handleChange);
    return () => window.removeEventListener(CHANGE_EVENT, handleChange);
  }, []);

  return expanded;
}
