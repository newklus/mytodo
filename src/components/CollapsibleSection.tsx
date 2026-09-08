"use client";

import { useRef, type ReactNode } from "react";

// "⚙ 설정"(Sidebar.tsx)에 적용한 것과 동일한 관례: 브라우저의 <details> 펼침 동작만으로는
// 스크롤이 안 따라오는 경우가 있어서, 펼치면 그 위치가 보이게 직접 스크롤하고
// 접으면 펼치기 전 스크롤 위치로 되돌린다. 가장 가까운 스크롤 컨테이너를 찾아 사용한다.
export default function CollapsibleSection({
  summary,
  children,
  className = "",
  defaultOpen = false,
}: {
  summary: ReactNode;
  children: ReactNode;
  className?: string;
  // 안의 목록이 서버 페이지네이션을 쓰면 "다음" 링크가 곧 페이지 이동이라, 그때 이 섹션이
  // 닫혀버리면 안 된다. 첫 페이지가 아닐 때 열린 채로 그려지도록 서버가 알려준다.
  // (사용자가 직접 펼치고 접는 건 여전히 브라우저의 <details> 기본 동작 그대로다.)
  defaultOpen?: boolean;
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
    <details ref={detailsRef} open={defaultOpen} onToggle={handleToggle} className={className}>
      <summary className="cursor-pointer select-none text-sm font-semibold hover:text-zinc-600 dark:hover:text-zinc-300">
        {summary}
      </summary>
      {children}
    </details>
  );
}
