"use client";

import { useTransition } from "react";
import { updatePriorityColor } from "@/lib/actions/priorityColors";

export default function PriorityColorPicker({ priority, color }: { priority: number; color: string }) {
  const [, startTransition] = useTransition();

  return (
    <input
      type="color"
      defaultValue={color}
      onChange={(e) => {
        const value = e.target.value;
        startTransition(async () => {
          await updatePriorityColor(priority, value);
        });
      }}
      title={`P${priority} 색상 변경`}
      className="h-3.5 w-3.5 shrink-0 cursor-pointer appearance-none rounded-full border-0 bg-transparent p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:rounded-full [&::-webkit-color-swatch-wrapper]:p-0"
    />
  );
}
