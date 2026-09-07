"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function updatePriorityColor(priority: number, color: string) {
  await prisma.priorityColor.upsert({
    where: { priority },
    update: { color },
    create: { priority, color },
  });
  revalidatePath("/");
}
