"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { randomColor } from "@/lib/colors";
import { findOrCreateProject } from "@/lib/actions/projects";
import { parsePlusDate } from "@/lib/plusDate";
import { cleanupUnusedProjectAndTags } from "@/lib/cleanupUnused";

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
        create: { name, color: randomColor() },
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

// SmartTitleInput에서 @/#를 드롭다운으로 확정하지 않고 그냥 Enter로 제출한 경우를 위한
// 안전망: 제목에 남아있는 "@단어"/"#단어" 토큰을 여기서 마저 뽑아내고 제목에서는 지운다.
function extractMentions(rawTitle: string): { title: string; projectQuery: string | null; tagNames: string[] } {
  const tagNames: string[] = [];
  let projectQuery: string | null = null;

  const title = rawTitle
    .replace(/(^|\s)([@#])(\S+)/g, (_match, lead: string, trigger: string, word: string) => {
      if (trigger === "@") {
        projectQuery = word;
      } else if (!tagNames.includes(word)) {
        tagNames.push(word);
      }
      return lead;
    })
    .replace(/ {2,}/g, " ")
    .trim();

  return { title, projectQuery, tagNames };
}

export async function createTask(formData: FormData) {
  const rawTitle = String(formData.get("title") ?? "").trim();
  if (!rawTitle) return;

  const { title: afterMentions, projectQuery, tagNames: mentionedTagNames } = extractMentions(rawTitle);

  // "+N" 안전망: 날짜 필드가 비어있을 때만 제목에 남은 "+N"으로 마감일을 채운다
  // (사용자가 날짜 선택기로 직접 고른 값이 있으면 그걸 절대 덮어쓰지 않음)
  let dueDate = parseDueDate(formData.get("dueDate"));
  let title = afterMentions;
  if (!dueDate) {
    const parsed = parsePlusDate(afterMentions);
    title = parsed.title;
    if (parsed.dueDate) dueDate = parseDueDate(parsed.dueDate);
  }
  if (!title) return;

  const projectIdField = formData.get("projectId");
  const priority = formData.get("priority");
  const recurrence = formData.get("recurrence");
  const tagNames = [...new Set([...parseTagNames(formData.get("tags")), ...mentionedTagNames])];

  let projectId = projectIdField && projectIdField !== "" ? String(projectIdField) : null;
  if (!projectId && projectQuery) {
    const project = await findOrCreateProject(projectQuery);
    projectId = project?.id ?? null;
  }

  await prisma.task.create({
    data: {
      title,
      dueDate,
      priority: priority ? Number(priority) : 4,
      projectId,
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

  const before = await prisma.task.findUnique({ where: { id }, include: { tags: true } });

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

  if (before) {
    await cleanupUnusedProjectAndTags(before.projectId, before.tags.map((t) => t.tagId));
  }

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
  const task = await prisma.task.findUnique({ where: { id }, include: { tags: true } });
  await prisma.task.delete({ where: { id } });
  if (task) {
    await cleanupUnusedProjectAndTags(task.projectId, task.tags.map((t) => t.tagId));
  }
  revalidatePath("/");
}

export async function renameTask(id: string, title: string) {
  const trimmed = title.trim();
  if (!trimmed) return;
  await prisma.task.update({ where: { id }, data: { title: trimmed } });
  revalidatePath("/");
}

export async function moveSubtask(subtaskId: string, newParentId: string) {
  if (subtaskId === newParentId) return;

  const newParent = await prisma.task.findUnique({ where: { id: newParentId } });
  if (!newParent) return;

  const subtask = await prisma.task.findUnique({ where: { id: subtaskId } });
  if (!subtask) return;

  await prisma.task.update({
    where: { id: subtaskId },
    data: { parentId: newParentId, projectId: newParent.projectId },
  });

  if (subtask.projectId && subtask.projectId !== newParent.projectId) {
    await cleanupUnusedProjectAndTags(subtask.projectId, []);
  }

  revalidatePath("/");
}
