import type { CompleteUndoSnapshot, DeleteUndoSnapshot } from "@/lib/actions/tasks";

export type UndoOffer =
  | { type: "complete"; message: string; snapshot: CompleteUndoSnapshot }
  | { type: "delete"; message: string; snapshot: DeleteUndoSnapshot };

export const UNDO_EVENT = "undo:offer";

// 완료/삭제 액션이 끝난 뒤 호출하면 전역 UndoToast가 받아서 띄운다.
// snapshot이 없으면(대상이 이미 사라졌던 경우 등) 아무 일도 하지 않는다 — 1단계 undo이므로
// 새 offer가 이전 것을 그대로 대체한다(스택 아님).
export function offerUndo(offer: { type: "complete"; message: string; snapshot: CompleteUndoSnapshot | null } | { type: "delete"; message: string; snapshot: DeleteUndoSnapshot | null }) {
  if (!offer.snapshot) return;
  window.dispatchEvent(new CustomEvent<UndoOffer>(UNDO_EVENT, { detail: offer as UndoOffer }));
}
