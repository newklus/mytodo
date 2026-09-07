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

export async function deleteProject(id: string) {
  await prisma.project.delete({ where: { id } });
  revalidatePath("/");
}
