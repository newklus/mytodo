import { prisma } from "@/lib/prisma";

// 태스크에서 떨어져 나간 프로젝트/태그가 더는 어디에도(완료·미완료 무관) 안 쓰이면 자동으로 지운다.
// 수동 삭제 버튼 대신 쓰는 정리 로직 — deleteTask/updateTask/moveSubtask에서 연결이 끊어질 때마다 호출.
export async function cleanupUnusedProjectAndTags(projectId: string | null, tagIds: string[]) {
  if (projectId) {
    const count = await prisma.task.count({ where: { projectId } });
    if (count === 0) {
      await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
    }
  }

  for (const tagId of tagIds) {
    const count = await prisma.taskTag.count({ where: { tagId } });
    if (count === 0) {
      await prisma.tag.delete({ where: { id: tagId } }).catch(() => {});
    }
  }
}
