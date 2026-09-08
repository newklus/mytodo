"use server";

import { prisma } from "@/lib/prisma";
import { refresh } from "next/cache";
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
  else if (recurrence === "MONTHLY") {
    // setMonth()를 그대로 쓰면 1/31 + 1개월처럼 대상 월에 없는 날짜(2/31)가
    // 다음 달로 오버플로된다(→ 3/3). 일(day)을 대상 월의 말일로 클램프해서 방지.
    const day = next.getDate();
    next.setDate(1);
    next.setMonth(next.getMonth() + 1);
    const lastDayOfTargetMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    next.setDate(Math.min(day, lastDayOfTargetMonth));
  }
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

  refresh();
}

export async function createSubtask(parentId: string, formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  const parent = await prisma.task.findUnique({
    where: { id: parentId },
    select: { projectId: true },
  });
  if (!parent) return;

  await prisma.task.create({
    data: {
      title,
      parentId,
      projectId: parent.projectId,
    },
  });

  refresh();
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

  const before = await prisma.task.findUnique({
    where: { id },
    select: { projectId: true, tags: { select: { tagId: true } } },
  });

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
    await cleanupUnusedProjectAndTags(
      before.projectId ? [before.projectId] : [],
      before.tags.map((t) => t.tagId)
    );
  }

  refresh();
}

// 반복 태스크의 다음 회차 생성까지 포함해 완료 상태를 뒤집는다.
// 여러 건을 한 번에 처리해도 DB 왕복과 화면 갱신은 각각 한 번만 일어난다.
async function applyComplete(ids: string[], completed: boolean) {
  if (ids.length === 0) return;

  const completedAt = completed ? new Date() : null;
  const tasks = await prisma.task.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      title: true,
      description: true,
      dueDate: true,
      priority: true,
      recurrence: true,
      projectId: true,
    },
  });

  const recurringNext = completed
    ? tasks
        .filter((t) => t.recurrence && t.dueDate)
        .map((t) => ({
          title: t.title,
          description: t.description,
          dueDate: nextDueDate(t.dueDate!, t.recurrence!),
          priority: t.priority,
          recurrence: t.recurrence,
          projectId: t.projectId,
        }))
    : [];

  // 상태 변경과 다음 회차 생성을 한 트랜잭션(=커밋 1회)으로 묶는다.
  await prisma.$transaction([
    prisma.task.updateMany({ where: { id: { in: ids } }, data: { completed, completedAt } }),
    ...recurringNext.map((data) => prisma.task.create({ data })),
  ]);
}

export async function toggleTaskComplete(id: string, completed: boolean) {
  await applyComplete([id], completed);
  refresh();
}

// 다중 선택 후 d 단축키: 예전에는 태스크 수만큼 서버 액션을 각각 호출해
// 매번 페이지 전체를 다시 그렸다. 이제 왕복 1회 · 화면 갱신 1회로 끝난다.
export async function completeTasks(ids: string[], completed: boolean) {
  await applyComplete(ids, completed);
  refresh();
}

async function applyDelete(ids: string[]) {
  if (ids.length === 0) return;

  const tasks = await prisma.task.findMany({
    where: { id: { in: ids } },
    select: { projectId: true, tags: { select: { tagId: true } } },
  });
  if (tasks.length === 0) return;

  await prisma.task.deleteMany({ where: { id: { in: ids } } });

  const projectIds = [...new Set(tasks.map((t) => t.projectId).filter((p): p is string => !!p))];
  const tagIds = [...new Set(tasks.flatMap((t) => t.tags.map((tag) => tag.tagId)))];
  await cleanupUnusedProjectAndTags(projectIds, tagIds);
}

export async function deleteTask(id: string) {
  await applyDelete([id]);
  refresh();
}

// 다중 선택 후 r 단축키: completeTasks 와 같은 이유로 일괄 처리한다.
export async function deleteTasks(ids: string[]) {
  await applyDelete(ids);
  refresh();
}

export async function renameTask(id: string, title: string) {
  const trimmed = title.trim();
  if (!trimmed) return;
  await prisma.task.update({ where: { id }, data: { title: trimmed } });
  refresh();
}

export async function moveSubtask(subtaskId: string, newParentId: string) {
  if (subtaskId === newParentId) return;

  const [newParent, subtask] = await Promise.all([
    prisma.task.findUnique({ where: { id: newParentId }, select: { projectId: true } }),
    prisma.task.findUnique({ where: { id: subtaskId }, select: { projectId: true } }),
  ]);
  if (!newParent || !subtask) return;

  await prisma.task.update({
    where: { id: subtaskId },
    data: { parentId: newParentId, projectId: newParent.projectId },
  });

  if (subtask.projectId && subtask.projectId !== newParent.projectId) {
    await cleanupUnusedProjectAndTags([subtask.projectId], []);
  }

  refresh();
}
