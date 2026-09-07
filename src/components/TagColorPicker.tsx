"use client";

import { useTransition } from "react";
import { updateTagColor } from "@/lib/actions/tags";

export default function TagColorPicker({ tagId, color }: { tagId: string; color: string }) {
  const [, startTransition] = useTransition();

  return (
    <input
      type="color"
      defaultValue={color}
      onChange={(e) => {
        const value = e.target.value;
        startTransition(async () => {
          await updateTagColor(tagId, value);
        });
      }}
      title="태그 색상 변경"
      className="h-3.5 w-3.5 shrink-0 cursor-pointer appearance-none rounded-full border-0 bg-transparent p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:rounded-full [&::-webkit-color-swatch-wrapper]:p-0"
    />
  );
}
