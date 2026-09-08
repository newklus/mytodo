"use client";

import { useEffect, useState } from "react";
import {
  MODIFIER_LABELS,
  SHORTCUT_ACTIONS,
  SHORTCUT_LABELS,
  formatBinding,
  setMultiSelectModifier,
  setShortcut,
  useMultiSelectModifier,
  useShortcuts,
  type ModifierKey,
  type ShortcutAction,
  type ShortcutBinding,
} from "@/lib/shortcuts";
import { SIDEBAR_WIDTH_VAR } from "@/lib/sidebarWidth";

const IGNORED_KEYS = ["Shift", "Control", "Alt", "Meta"];
const MODIFIER_KEY_MAP: Record<string, ModifierKey> = {
  Control: "ctrl",
  Alt: "alt",
  Shift: "shift",
  Meta: "meta",
};

const MULTI_SELECT_CAPTURE = "multiSelectModifier" as const;
type Capturing = ShortcutAction | typeof MULTI_SELECT_CAPTURE | null;

function LockIcon({ locked }: { locked: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="5" y="11" width="14" height="10" rx="2" />
      {locked ? <path d="M8 11V7a4 4 0 0 1 8 0v4" /> : <path d="M8 11V7a4 4 0 0 1 7.5-2" />}
    </svg>
  );
}

export default function ShortcutBar() {
  const shortcuts = useShortcuts();
  const multiSelectModifier = useMultiSelectModifier();
  const [capturing, setCapturing] = useState<Capturing>(null);
  // 항상 잠금 상태로 시작한다(새로고침/재접속 시 리셋) — 실수로 단축키가 바뀌는 걸 막기 위함.
  const [locked, setLocked] = useState(true);

  // 캡처 단계에서 document에 걸어 stopPropagation하면, 같은 이벤트가 버블 단계로
  // 다시 document까지 올라오지 못해 TaskList/QuickAddModal 등의 기존 단축키 핸들러가
  // 새 키 입력을 오작동시키지 않는다.
  useEffect(() => {
    if (!capturing) return;
    const action = capturing;

    function handleCapture(e: KeyboardEvent) {
      // 다중 선택 조합키는 일반 단축키와 달리 "어떤 키를 누르는지"가 아니라
      // "어떤 수정자 키를 누르고 있는지"를 고른다 — Ctrl/Alt/Shift/Meta 중 하나만 받는다.
      if (action === MULTI_SELECT_CAPTURE) {
        e.preventDefault();
        e.stopPropagation();
        if (e.key === "Escape" || e.key === "Enter") {
          setCapturing(null);
          return;
        }
        const modifier = MODIFIER_KEY_MAP[e.key];
        if (!modifier) {
          setCapturing(null);
          return;
        }
        setMultiSelectModifier(modifier);
        setCapturing(null);
        return;
      }

      if (IGNORED_KEYS.includes(e.key)) return;
      e.preventDefault();
      e.stopPropagation();

      // Esc와 마찬가지로 Enter 단독도 취소로 처리한다 — 폼 제출 등 곳곳에서 이미 쓰이는
      // 키라 단축키로 지정할 수 없게 막는 것도 겸한다(수정자와 조합한 Enter는 배정 가능).
      if ((e.key === "Escape" || e.key === "Enter") && !e.shiftKey) {
        setCapturing(null);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) {
        setCapturing(null);
        return;
      }

      const binding: ShortcutBinding = { key: e.key, shift: e.shiftKey };
      const conflict = SHORTCUT_ACTIONS.find(
        (a) =>
          a !== action &&
          shortcuts[a].key.toLowerCase() === binding.key.toLowerCase() &&
          Boolean(shortcuts[a].shift) === Boolean(binding.shift)
      );
      if (conflict && !confirm(`이미 "${SHORTCUT_LABELS[conflict]}" 단축키로 쓰이고 있어요. 그래도 바꿀까요?`)) {
        setCapturing(null);
        return;
      }

      setShortcut(action, binding);
      setCapturing(null);
    }

    document.addEventListener("keydown", handleCapture, true);
    return () => document.removeEventListener("keydown", handleCapture, true);
  }, [capturing, shortcuts]);

  return (
    <footer
      // 사이드바 폭을 구독해 리렌더하는 대신 같은 CSS 변수를 그대로 참조한다 (sidebarWidth.ts 참고).
      style={{ marginLeft: SIDEBAR_WIDTH_VAR }}
      className="flex shrink-0 flex-wrap items-center gap-x-1.5 gap-y-1 border-t border-black/10 px-4 py-1.5 text-xs text-zinc-500 dark:border-white/10 dark:text-zinc-400"
    >
      <button
        type="button"
        onClick={() => {
          setCapturing(null);
          setLocked((l) => !l);
        }}
        aria-label={locked ? "단축키 잠금 해제" : "단축키 잠금"}
        aria-pressed={!locked}
        title={locked ? "잠금 해제하면 단축키를 수정할 수 있어요" : "단축키를 수정할 수 있어요 (다시 눌러 잠금)"}
        className="mr-0.5 shrink-0 rounded p-1 text-zinc-400 hover:bg-black/5 hover:text-zinc-600 dark:text-zinc-500 dark:hover:bg-white/10 dark:hover:text-zinc-300"
      >
        <LockIcon locked={locked} />
      </button>
      <span className="mr-0.5 shrink-0 text-zinc-400 dark:text-zinc-500">단축키</span>
      {SHORTCUT_ACTIONS.map((action) => (
        <button
          key={action}
          type="button"
          disabled={locked}
          onClick={() => setCapturing(action)}
          className={`rounded border px-1.5 py-0.5 ${
            capturing === action
              ? "border-blue-500 text-blue-600 dark:text-blue-400"
              : locked
                ? "cursor-default border-black/10 dark:border-white/10"
                : "border-black/10 hover:border-black/30 dark:border-white/10 dark:hover:border-white/30"
          }`}
        >
          {capturing === action ? (
            "키 입력…"
          ) : (
            <>
              <kbd className="font-semibold">{formatBinding(shortcuts[action])}</kbd> {SHORTCUT_LABELS[action]}
            </>
          )}
        </button>
      ))}
      <button
        type="button"
        disabled={locked}
        onClick={() => setCapturing(MULTI_SELECT_CAPTURE)}
        title="클릭할 때 이 키를 누르고 있으면 다중 선택(토글)이 됩니다. 안 누르면 일반 선택(단일)"
        className={`rounded border px-1.5 py-0.5 ${
          capturing === MULTI_SELECT_CAPTURE
            ? "border-blue-500 text-blue-600 dark:text-blue-400"
            : locked
              ? "cursor-default border-black/10 dark:border-white/10"
              : "border-black/10 hover:border-black/30 dark:border-white/10 dark:hover:border-white/30"
        }`}
      >
        {capturing === MULTI_SELECT_CAPTURE ? (
          "키 입력…"
        ) : (
          <>
            <kbd className="font-semibold">{MODIFIER_LABELS[multiSelectModifier]}</kbd>+클릭 다중선택
          </>
        )}
      </button>
      {capturing && <span className="text-zinc-400 dark:text-zinc-500">(Esc 또는 Enter로 취소)</span>}
    </footer>
  );
}
