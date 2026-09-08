"use client";

import { useRef, type ReactNode } from "react";

// "⚙ 설정"(Sidebar.tsx)에 적용한 것과 동일한 관례: 브라우저의 <details> 펼침 동작만으로는
// 스크롤이 안 따라오는 경우가 있어서, 펼치면 그 위치가 보이게 직접 스크롤하고
// 접으면 펼치기 전 스크롤 위치로 되돌린다. 가장 가까운 스크롤 컨테이너를 찾아 사용한다.
export default function CollapsibleSection({
  summary,
  children,
  className = "",
}: {
  summary: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const scrollBeforeOpenRef = useRef(0);

  function handleToggle() {
    const details = detailsRef.current;
    const container = details?.closest("main");
    if (!details || !(container instanceof HTMLElement)) return;

    if (details.open) {
      scrollBeforeOpenRef.current = container.scrollTop;
      const detailsRect = details.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      container.scrollTop += detailsRect.top - containerRect.top;
    } else {
      container.scrollTop = scrollBeforeOpenRef.current;
    }
  }

  return (
    <details ref={detailsRef} onToggle={handleToggle} className={className}>
      <summary className="cursor-pointer select-none text-sm font-semibold hover:text-zinc-600 dark:hover:text-zinc-300">
        {summary}
      </summary>
      {children}
    </details>
  );
}
