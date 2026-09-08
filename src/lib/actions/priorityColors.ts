"use server";

import { prisma } from "@/lib/prisma";
import { refresh } from "next/cache";

export async function updatePriorityColor(priority: number, color: string) {
  await prisma.priorityColor.upsert({
    where: { priority },
    update: { color },
    create: { priority, color },
  });
  refresh();
}
