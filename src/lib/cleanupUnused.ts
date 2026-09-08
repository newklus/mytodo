import { prisma } from "@/lib/prisma";

// 태스크에서 떨어져 나간 프로젝트/태그가 더는 어디에도(완료·미완료 무관) 안 쓰이면 자동으로 지운다.
// 수동 삭제 버튼 대신 쓰는 정리 로직 — deleteTask/updateTask/moveSubtask에서 연결이 끊어질 때마다 호출.
//
// 예전에는 후보 하나마다 count 쿼리를 따로 날리고(1+N 왕복) 삭제도 개별로 했다.
// 지금은 "아직 쓰이는 것"을 각각 한 번의 groupBy로 모아 확인하고, 남은 것만 한꺼번에 지운다.
export async function cleanupUnusedProjectAndTags(projectIds: string[], tagIds: string[]) {
  const projects = [...new Set(projectIds.filter(Boolean))];
  const tags = [...new Set(tagIds.filter(Boolean))];
  if (projects.length === 0 && tags.length === 0) return;

  const [usedProjects, usedTags] = await Promise.all([
    projects.length
      ? prisma.task.groupBy({ by: ["projectId"], where: { projectId: { in: projects } } })
      : Promise.resolve([]),
    tags.length
      ? prisma.taskTag.groupBy({ by: ["tagId"], where: { tagId: { in: tags } } })
      : Promise.resolve([]),
  ]);

  const usedProjectIds = new Set(usedProjects.map((p) => p.projectId));
  const usedTagIds = new Set(usedTags.map((t) => t.tagId));

  const orphanProjects = projects.filter((id) => !usedProjectIds.has(id));
  const orphanTags = tags.filter((id) => !usedTagIds.has(id));
  if (orphanProjects.length === 0 && orphanTags.length === 0) return;

  const deletes = [];
  if (orphanProjects.length) deletes.push(prisma.project.deleteMany({ where: { id: { in: orphanProjects } } }));
  if (orphanTags.length) deletes.push(prisma.tag.deleteMany({ where: { id: { in: orphanTags } } }));
  await prisma.$transaction(deletes);
}
