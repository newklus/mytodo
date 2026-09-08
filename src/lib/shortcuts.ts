"use client";

import { useEffect, useState } from "react";

export type ShortcutAction = "quickAdd" | "complete" | "uncomplete" | "delete" | "clearSelection" | "undo";

export interface ShortcutBinding {
  key: string;
  shift?: boolean;
}

export const SHORTCUT_LABELS: Record<ShortcutAction, string> = {
  quickAdd: "새 할일",
  complete: "완료",
  uncomplete: "완료 취소",
  delete: "삭제",
  clearSelection: "선택 해제",
  undo: "실행취소",
};

// 표시/저장 순서
export const SHORTCUT_ACTIONS: ShortcutAction[] = [
  "quickAdd",
  "complete",
  "uncomplete",
  "delete",
  "clearSelection",
  "undo",
];

export const DEFAULT_SHORTCUTS: Record<ShortcutAction, ShortcutBinding> = {
  quickAdd: { key: "n" },
  complete: { key: "d" },
  uncomplete: { key: "d", shift: true },
  delete: { key: "r" },
  clearSelection: { key: "Escape" },
  undo: { key: "u" },
};

const STORAGE_KEY = "mytodo:shortcuts";
const CHANGE_EVENT = "mytodo:shortcuts-change";

function loadOverrides(): Partial<Record<ShortcutAction, ShortcutBinding>> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function getShortcuts(): Record<ShortcutAction, ShortcutBinding> {
  return { ...DEFAULT_SHORTCUTS, ...loadOverrides() };
}

export function setShortcut(action: ShortcutAction, binding: ShortcutBinding) {
  const overrides = loadOverrides();
  overrides[action] = binding;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch {}
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function useShortcuts() {
  const [shortcuts, setShortcuts] = useState<Record<ShortcutAction, ShortcutBinding>>(DEFAULT_SHORTCUTS);

  // 마운트 후에 저장된 값을 읽어야 SSR 결과(기본값)와 하이드레이션이 어긋나지 않는다.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShortcuts(getShortcuts());
    function handleChange() {
      setShortcuts(getShortcuts());
    }
    window.addEventListener(CHANGE_EVENT, handleChange);
    return () => window.removeEventListener(CHANGE_EVENT, handleChange);
  }, []);

  return shortcuts;
}

// 문자 키는 대소문자 무시, Escape 등 특수 키는 그대로 비교.
export function matchesShortcut(e: KeyboardEvent, binding: ShortcutBinding) {
  const eventKey = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const bindingKey = binding.key.length === 1 ? binding.key.toLowerCase() : binding.key;
  return eventKey === bindingKey && e.shiftKey === Boolean(binding.shift);
}

export function formatBinding(binding: ShortcutBinding) {
  const keyLabel = binding.key === "Escape" ? "Esc" : binding.key.length === 1 ? binding.key.toUpperCase() : binding.key;
  return binding.shift ? `⇧${keyLabel}` : keyLabel;
}

// 다중 선택 조합키: 클릭할 때 이 키를 누르고 있으면 일반 선택(단일, 이전 선택 해제) 대신
// 다중 선택(토글, 기존 선택 유지)이 된다. 키보드 단축키(ShortcutBinding)와는 별개 개념이라
// 따로 관리한다.
export type ModifierKey = "ctrl" | "alt" | "shift" | "meta";

export const MODIFIER_LABELS: Record<ModifierKey, string> = {
  ctrl: "Ctrl",
  alt: "Alt",
  shift: "Shift",
  meta: "Cmd/Win",
};

export const DEFAULT_MULTI_SELECT_MODIFIER: ModifierKey = "ctrl";

const MULTI_SELECT_STORAGE_KEY = "mytodo:multiSelectModifier";
const MULTI_SELECT_CHANGE_EVENT = "mytodo:multiselect-modifier-change";

function isModifierKey(value: string | null): value is ModifierKey {
  return value === "ctrl" || value === "alt" || value === "shift" || value === "meta";
}

export function getMultiSelectModifier(): ModifierKey {
  if (typeof window === "undefined") return DEFAULT_MULTI_SELECT_MODIFIER;
  try {
    const saved = window.localStorage.getItem(MULTI_SELECT_STORAGE_KEY);
    if (isModifierKey(saved)) return saved;
  } catch {}
  return DEFAULT_MULTI_SELECT_MODIFIER;
}

export function setMultiSelectModifier(modifier: ModifierKey) {
  try {
    window.localStorage.setItem(MULTI_SELECT_STORAGE_KEY, modifier);
  } catch {}
  window.dispatchEvent(new CustomEvent(MULTI_SELECT_CHANGE_EVENT));
}

export function useMultiSelectModifier() {
  const [modifier, setModifier] = useState<ModifierKey>(DEFAULT_MULTI_SELECT_MODIFIER);

  // 마운트 후에 저장된 값을 읽어야 SSR 결과(기본값)와 하이드레이션이 어긋나지 않는다.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setModifier(getMultiSelectModifier());
    function handleChange() {
      setModifier(getMultiSelectModifier());
    }
    window.addEventListener(MULTI_SELECT_CHANGE_EVENT, handleChange);
    return () => window.removeEventListener(MULTI_SELECT_CHANGE_EVENT, handleChange);
  }, []);

  return modifier;
}

export function isModifierPressed(
  e: { ctrlKey: boolean; altKey: boolean; shiftKey: boolean; metaKey: boolean },
  modifier: ModifierKey
) {
  switch (modifier) {
    case "ctrl":
      return e.ctrlKey;
    case "alt":
      return e.altKey;
    case "shift":
      return e.shiftKey;
    case "meta":
      return e.metaKey;
  }
}
