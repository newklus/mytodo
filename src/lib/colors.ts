export const PALETTE = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899"];

export function randomColor(): string {
  return PALETTE[Math.floor(Math.random() * PALETTE.length)];
}
