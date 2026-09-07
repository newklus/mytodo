import type { Prisma } from "@/generated/prisma/client";

export type TaskWithRelations = Prisma.TaskGetPayload<{
  include: {
    project: true;
    subtasks: true;
    tags: { include: { tag: true } };
  };
}>;

export type { Project } from "@/generated/prisma/client";
