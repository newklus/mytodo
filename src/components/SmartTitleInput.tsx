"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { findOrCreateProject } from "@/lib/actions/projects";
import { parsePlusDate } from "@/lib/plusDate";
import { truncateMiddle } from "@/lib/truncate";
import type { Project, Tag } from "@/lib/types";

type ActiveToken = { trigger: "@" | "#"; query: string; start: number };

type SuggestionItem = { key: string; label: string; color: string | null; isCreate: boolean };

function getActiveToken(text: string, cursorPos: number): ActiveToken | null {
  const upToCursor = text.slice(0, cursorPos);
  const start = Math.max(upToCursor.lastIndexOf("@"), upToCursor.lastIndexOf("#"));
  if (start === -1) return null;
  const between = upToCursor.slice(start + 1);
  if (/\s/.test(between)) return null;
  return { trigger: upToCursor[start] as "@" | "#", query: between, start };
}

// 커서 위치와 상관없이 텍스트 전체에서 "@단어"/"#단어" 패턴을 전부 뽑아내고 지운다.
// (createTask 서버 액션의 extractMentions와 같은 규칙 — 한 번의 Enter로 전부 해소하기 위함)
function parseAllMentions(rawText: string): { title: string; projectQuery: string | null; tagQueries: string[] } {
  const tagQueries: string[] = [];
  let projectQuery: string | null = null;

  const title = rawText
    .replace(/(^|\s)([@#])(\S+)/g, (_match, lead: string, trigger: string, word: string) => {
      if (trigger === "@") {
        projectQuery = word;
      } else if (!tagQueries.includes(word)) {
        tagQueries.push(word);
      }
      return lead;
    })
    .replace(/ {2,}/g, " ")
    .trim();

  return { title, projectQuery, tagQueries };
}

export default function SmartTitleInput({
  projects,
  tags,
  defaultProject = null,
  placeholder = "할 일 추가... (@프로젝트, #태그, +N일)",
  autoFocus = false,
  className = "",
  onPendingChange,
  onDueDateResolved,
}: {
  projects: Project[];
  tags: Tag[];
  defaultProject?: Project | null;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  /** @로 새 프로젝트를 만드는 중(서버 왕복 진행 중)인지 알려준다 — 이 동안 부모 폼의 제출 버튼을 막아야 함 */
  onPendingChange?: (pending: boolean) => void;
  /** "+N" 표기로 마감일이 계산되면 그 값(YYYY-MM-DD)을 부모의 날짜 필드에 반영하라고 알려준다 */
  onDueDateResolved?: (dueDate: string) => void;
}) {
  const [text, setText] = useState("");
  const [cursorPos, setCursorPos] = useState(0);
  const [highlight, setHighlight] = useState(0);
  const [selectedProject, setSelectedProject] = useState<{ id: string | null; name: string; color: string | null; pending?: boolean } | null>(
    defaultProject ? { id: defaultProject.id, name: defaultProject.name, color: defaultProject.color } : null,
  );
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [, startTransition] = useTransition();
  const localInputRef = useRef<HTMLInputElement>(null);

  const activeToken = useMemo(
    () => (dismissed ? null : getActiveToken(text, cursorPos)),
    [text, cursorPos, dismissed],
  );

  const suggestions = useMemo<SuggestionItem[]>(() => {
    if (!activeToken) return [];
    const rawQuery = activeToken.query;
    const q = rawQuery.toLowerCase();
    const pool =
      activeToken.trigger === "@"
        ? projects.map((p) => ({ key: p.id, label: p.name, color: p.color, isCreate: false }))
        : tags.map((t) => ({ key: t.id, label: t.name, color: t.color, isCreate: false }));

    const matches = pool.filter((item) => item.label.toLowerCase().includes(q)).slice(0, 6);
    const exact = pool.some((item) => item.label.toLowerCase() === q);

    if (rawQuery.length > 0 && !exact) {
      // 입력한 대소문자 그대로 새로 생성할 항목의 라벨로 사용 (검색 매칭에만 소문자 비교를 씀)
      matches.push({ key: "__create__", label: rawQuery, color: null, isCreate: true });
    }
    return matches;
  }, [activeToken, projects, tags]);

  function syncCursor(el: HTMLInputElement) {
    setCursorPos(el.selectionStart ?? el.value.length);
  }

  function selectSuggestion(item: SuggestionItem) {
    if (!activeToken) return;

    const newText = (text.slice(0, activeToken.start) + text.slice(cursorPos)).replace(/ {2,}/g, " ");
    setText(newText);
    setCursorPos(activeToken.start);
    setHighlight(0);

    if (activeToken.trigger === "@") {
      if (item.isCreate) {
        setSelectedProject({ id: null, name: item.label, color: null, pending: true });
        onPendingChange?.(true);
        startTransition(async () => {
          const created = await findOrCreateProject(item.label);
          if (created) setSelectedProject({ id: created.id, name: created.name, color: created.color });
          onPendingChange?.(false);
        });
      } else {
        setSelectedProject({ id: item.key, name: item.label, color: item.color });
      }
    } else {
      setSelectedTags((prev) => (prev.includes(item.label) ? prev : [...prev, item.label]));
    }

    requestAnimationFrame(() => localInputRef.current?.focus());
  }

  // Enter 한 번으로 텍스트에 남아있는 @/# 전부를 한꺼번에 칩으로 확정한다.
  // (커서 위치의 토큰 하나만이 아니라 문자열 전체를 훑음) 확정할 게 있었으면
  // true를 반환하고, 이땐 그 Enter는 제출로 이어지지 않는다 — 남은 게 하나도
  // 없어야("정리된 제목만 남음") 다음 Enter가 실제로 폼을 제출한다.
  function resolveAllMentions(): boolean {
    const { title: afterMentions, projectQuery, tagQueries } = parseAllMentions(text);
    const { title: cleaned, dueDate } = parsePlusDate(afterMentions);
    if (!projectQuery && tagQueries.length === 0 && !dueDate) return false;

    setText(cleaned);
    setCursorPos(cleaned.length);
    setHighlight(0);
    setDismissed(false);

    if (tagQueries.length > 0) {
      setSelectedTags((prev) => {
        const merged = [...prev];
        for (const t of tagQueries) if (!merged.includes(t)) merged.push(t);
        return merged;
      });
    }

    if (projectQuery && !selectedProject) {
      const query = projectQuery;
      const existing = projects.find((p) => p.name.toLowerCase() === query.toLowerCase());
      if (existing) {
        setSelectedProject({ id: existing.id, name: existing.name, color: existing.color });
      } else {
        setSelectedProject({ id: null, name: query, color: null, pending: true });
        onPendingChange?.(true);
        startTransition(async () => {
          const created = await findOrCreateProject(query);
          if (created) setSelectedProject({ id: created.id, name: created.name, color: created.color });
          onPendingChange?.(false);
        });
      }
    }

    if (dueDate) onDueDateResolved?.(dueDate);

    requestAnimationFrame(() => localInputRef.current?.focus());
    return true;
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (activeToken && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) => Math.max(h - 1, 0));
        return;
      }
      if (e.key === "Tab") {
        // Tab은 드롭다운에서 강조된 항목 하나만 콕 집어 고르는 용도로 남겨둔다.
        e.preventDefault();
        selectSuggestion(suggestions[highlight]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setDismissed(true);
        return;
      }
    }

    if (e.key === "Enter" && resolveAllMentions()) {
      // 아직 정리할 @/#가 남아있었으면 이 Enter는 제출로 넘어가지 않는다.
      // 남은 게 없을 때(=이 함수가 false 반환)만 브라우저 기본 제출 동작이 그대로 진행됨.
      e.preventDefault();
    }
  }

  return (
    <div className={`relative flex min-w-[180px] flex-1 flex-wrap items-center gap-1.5 ${className}`}>
      <input
        ref={localInputRef}
        name="title"
        required
        autoFocus={autoFocus}
        value={text}
        placeholder={placeholder}
        onChange={(e) => {
          setText(e.target.value);
          syncCursor(e.target);
          setHighlight(0);
          setDismissed(false);
        }}
        onClick={(e) => {
          syncCursor(e.currentTarget);
          setDismissed(false);
        }}
        onKeyUp={(e) => syncCursor(e.currentTarget)}
        onKeyDown={handleKeyDown}
        onBlur={() => setDismissed(true)}
        className="min-w-[140px] flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-400"
      />

      {selectedProject && (
        <span className="flex items-center gap-1 rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: selectedProject.color ?? "#999" }}
          />
          {selectedProject.pending ? "생성 중…" : truncateMiddle(selectedProject.name)}
          <button
            type="button"
            onClick={() => setSelectedProject(null)}
            className="text-zinc-400 hover:text-red-500"
          >
            ✕
          </button>
        </span>
      )}

      {selectedTags.map((name) => (
        <span
          key={name}
          className="flex items-center gap-1 rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10"
        >
          #{truncateMiddle(name)}
          <button
            type="button"
            onClick={() => setSelectedTags((prev) => prev.filter((t) => t !== name))}
            className="text-zinc-400 hover:text-red-500"
          >
            ✕
          </button>
        </span>
      ))}

      <input type="hidden" name="projectId" value={selectedProject?.id ?? ""} />
      <input type="hidden" name="tags" value={selectedTags.join(", ")} />

      {activeToken && suggestions.length > 0 && (
        <ul className="absolute left-0 top-full z-10 mt-1 max-h-48 w-56 overflow-y-auto rounded-lg border border-black/10 bg-white py-1 text-sm shadow-lg dark:border-white/10 dark:bg-zinc-900">
          {suggestions.map((item, i) => (
            <li key={item.key}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectSuggestion(item);
                }}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left ${
                  i === highlight
                    ? "bg-black text-white dark:bg-white dark:text-black"
                    : "hover:bg-black/5 dark:hover:bg-white/10"
                }`}
              >
                {!item.isCreate && (
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: item.color ?? "#999" }} />
                )}
                <span className="truncate">
                  {item.isCreate
                    ? `+ 새로 만들기: ${activeToken.trigger}${truncateMiddle(item.label)}`
                    : `${activeToken.trigger}${truncateMiddle(item.label)}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
