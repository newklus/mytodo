"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { undoComplete, undoDelete } from "@/lib/actions/tasks";
import { UNDO_EVENT, type UndoOffer } from "@/lib/undoBus";

const AUTO_DISMISS_MS = 8000;

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

export default function UndoToast() {
  const [offer, setOffer] = useState<UndoOffer | null>(null);
  const [isPending, startTransition] = useTransition();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleOffer(e: Event) {
      setOffer((e as CustomEvent<UndoOffer>).detail);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setOffer(null), AUTO_DISMISS_MS);
    }
    window.addEventListener(UNDO_EVENT, handleOffer);
    return () => {
      window.removeEventListener(UNDO_EVENT, handleOffer);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function handleUndo() {
    if (!offer) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    startTransition(async () => {
      if (offer.type === "complete") await undoComplete(offer.snapshot);
      else await undoDelete(offer.snapshot);
      setOffer(null);
    });
  }

  // u: 토스트가 떠 있을 때만 실행취소. 입력 필드에 포커스가 있거나 수정자 키가 눌려있으면 무시.
  useEffect(() => {
    if (!offer) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      if (isEditableTarget(e.target)) return;
      if (e.key !== "u") return;
      e.preventDefault();
      handleUndo();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offer]);

  if (!offer) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-black/10 bg-white px-4 py-2.5 text-sm shadow-xl dark:border-white/10 dark:bg-zinc-900">
      <span>{offer.message}</span>
      <button
        type="button"
        onClick={handleUndo}
        disabled={isPending}
        className="font-medium text-blue-600 hover:underline disabled:opacity-50 dark:text-blue-400"
      >
        실행취소
      </button>
      <button
        type="button"
        onClick={() => setOffer(null)}
        aria-label="닫기"
        className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
      >
        ✕
      </button>
    </div>
  );
}
