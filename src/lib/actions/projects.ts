"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { randomColor } from "@/lib/colors";

export async function createProject(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const color = randomColor();

  await prisma.project.create({
    data: { name, color },
  });

  revalidatePath("/");
}

// @멘션에서 이름으로 프로젝트를 찾고, 없으면 랜덤 색상으로 새로 만든다.
export async function findOrCreateProject(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const existing = await prisma.project.findFirst({ where: { name: trimmed } });
  if (existing) return existing;

  const created = await prisma.project.create({
    data: { name: trimmed, color: randomColor() },
  });
  revalidatePath("/");
  return created;
}
