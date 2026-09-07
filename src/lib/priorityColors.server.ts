import { prisma } from "@/lib/prisma";
import { DEFAULT_PRIORITY_COLORS } from "@/lib/priorityColors";

export async function getPriorityColors(): Promise<Record<number, string>> {
  const rows = await prisma.priorityColor.findMany();
  const colors = { ...DEFAULT_PRIORITY_COLORS };
  for (const row of rows) {
    colors[row.priority] = row.color;
  }
  return colors;
}
