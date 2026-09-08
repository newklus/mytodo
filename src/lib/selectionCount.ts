"use client";

import { useEffect, useState } from "react";

const EVENT = "mytodo:selection-count-change";

// TaskList가 선택 개수를 알리면, 페이지 헤딩 옆의 SelectionCountBadge가 그걸 받아 표시한다.
// 둘 다 같은 페이지 트리 안에서 같이 마운트/언마운트되므로 라우트를 넘나드는 잔상 걱정은 없다.
export function announceSelectionCount(count: number) {
  window.dispatchEvent(new CustomEvent<number>(EVENT, { detail: count }));
}

export function useSelectionCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    function handleChange(e: Event) {
      setCount((e as CustomEvent<number>).detail ?? 0);
    }
    window.addEventListener(EVENT, handleChange);
    return () => window.removeEventListener(EVENT, handleChange);
  }, []);

  return count;
}
