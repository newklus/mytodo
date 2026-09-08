import Link from "next/link";

// 목록의 페이지 이동. 캘린더 "미등록 일정"도 같은 컴포넌트를 쓴다(각자 pathname과 파라미터 이름만 다름).
// 예전의 PaginatedTaskList는 이미 받아온 배열을 클라이언트에서 잘라 보여주는 방식이었는데,
// 그러면 서버는 여전히 전건을 조회·직렬화해야 했다. 지금은 서버 쿼리 자체가 잘려 있어서
// 페이지 이동이 곧 새 조회다. 그래서 버튼이 아니라 Link로 두고 페이지를 URL에 남긴다
// (새로고침·뒤로가기·북마크가 전부 자연스럽게 동작한다).
export default function ListPagination({
  page,
  totalPages,
  totalCount,
  pageSize,
  pathname = "/",
  paramName = "page",
  query,
}: {
  page: number; // 0-based
  totalPages: number;
  totalCount: number;
  pageSize: number;
  pathname?: string;
  paramName?: string;
  query: Record<string, string>;
}) {
  if (totalPages <= 1) return null;

  const hrefFor = (p: number) => ({
    pathname,
    // 첫 페이지는 파라미터를 아예 빼서 URL을 깨끗하게 둔다.
    query: { ...query, ...(p > 0 ? { [paramName]: String(p + 1) } : {}) },
  });

  const linkClass = "rounded border border-black/10 px-3 py-1 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10";
  const disabledClass = "rounded border border-black/10 px-3 py-1 opacity-40 dark:border-white/10";

  const from = page * pageSize + 1;
  const to = Math.min(totalCount, (page + 1) * pageSize);

  return (
    <div className="mt-2 flex items-center justify-center gap-3 text-sm">
      {page === 0 ? (
        <span className={disabledClass}>이전</span>
      ) : (
        <Link href={hrefFor(page - 1)} className={linkClass}>
          이전
        </Link>
      )}
      <span className="text-zinc-500">
        {page + 1} / {totalPages} · {from}–{to} / 총 {totalCount}개
      </span>
      {page >= totalPages - 1 ? (
        <span className={disabledClass}>다음</span>
      ) : (
        <Link href={hrefFor(page + 1)} className={linkClass}>
          다음
        </Link>
      )}
    </div>
  );
}
