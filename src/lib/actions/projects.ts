"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

const PROJECT_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899"];

export async function createProject(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const color = PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)];

  await prisma.project.create({
    data: { name, color },
  });

  revalidatePath("/");
}

export async function deleteProject(id: string) {
  await prisma.project.delete({ where: { id } });
  revalidatePath("/");
}
