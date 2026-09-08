"use server";

import { prisma } from "@/lib/prisma";
import { refresh } from "next/cache";

export async function updateTagColor(id: string, color: string) {
  await prisma.tag.update({
    where: { id },
    data: { color },
  });
  refresh();
}
