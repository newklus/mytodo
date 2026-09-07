"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

function parseDueDate(value: FormDataEntryValue | null): Date | null {
  if (!value || typeof value !== "string" || value.trim() === "") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseTagNames(value: FormDataEntryValue | null): string[] {
  if (!value || typeof value !== "string") return [];
  return [...new Set(value.split(",").map((t) => t.trim()).filter(Boolean))];
}

function tagsCreateInput(tagNames: string[]) {
  return tagNames.map((name) => ({
    tag: {
      connectOrCreate: {
        where: { name },
        create: { name },
      },
    },
  }));
}

function nextDueDate(from: Date, recurrence: string): Date {
  const next = new Date(from);
  if (recurrence === "DAILY") next.setDate(next.getDate() + 1);
  else if (recurrence === "WEEKLY") next.setDate(next.getDate() + 7);
  else if (recurrence === "MONTHLY") next.setMonth(next.getMonth() + 1);
  return next;
}

export async function createTask(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  const projectId = formData.get("projectId");
  const priority = formData.get("priority");
  const recurrence = formData.get("recurrence");
  const tagNames = parseTagNames(formData.get("tags"));

  await prisma.task.create({
    data: {
      title,
      dueDate: parseDueDate(formData.get("dueDate")),
      priority: priority ? Number(priority) : 4,
      projectId: projectId && projectId !== "" ? String(projectId) : null,
      recurrence: recurrence && recurrence !== "" ? String(recurrence) : null,
      tags: { create: tagsCreateInput(tagNames) },
    },
  });

  revalidatePath("/");
}

export async function createSubtask(parentId: string, formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  const parent = await prisma.task.findUnique({ where: { id: parentId } });
  if (!parent) return;

  await prisma.task.create({
    data: {
      title,
      parentId,
      projectId: parent.projectId,
    },
  });

  revalidatePath("/");
}

export async function updateTask(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  const description = String(formData.get("description") ?? "").trim();
  const projectId = formData.get("projectId");
  const priority = Number(formData.get("priority") ?? 4);
  const recurrence = formData.get("recurrence");
  const tagNames = parseTagNames(formData.get("tags"));

  await prisma.task.update({
    where: { id },
    data: {
      title,
      description: description || null,
      dueDate: parseDueDate(formData.get("dueDate")),
      priority,
      projectId: projectId && projectId !== "" ? String(projectId) : null,
      recurrence: recurrence && recurrence !== "" ? String(recurrence) : null,
      tags: {
        deleteMany: {},
        create: tagsCreateInput(tagNames),
      },
    },
  });

  revalidatePath("/");
}

export async function toggleTaskComplete(id: string, completed: boolean) {
  const task = await prisma.task.update({
    where: { id },
    data: {
      completed,
      completedAt: completed ? new Date() : null,
    },
  });

  if (completed && task.recurrence && task.dueDate) {
    await prisma.task.create({
      data: {
        title: task.title,
        description: task.description,
        dueDate: nextDueDate(task.dueDate, task.recurrence),
        priority: task.priority,
        recurrence: task.recurrence,
        projectId: task.projectId,
      },
    });
  }

  revalidatePath("/");
}

export async function deleteTask(id: string) {
  await prisma.task.delete({ where: { id } });
  revalidatePath("/");
}
