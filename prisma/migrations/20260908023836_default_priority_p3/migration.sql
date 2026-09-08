-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" DATETIME,
    "priority" INTEGER NOT NULL DEFAULT 3,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" DATETIME,
    "recurrence" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "projectId" TEXT,
    "parentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Task" ("completed", "completedAt", "createdAt", "description", "dueDate", "id", "order", "parentId", "priority", "projectId", "recurrence", "title", "updatedAt") SELECT "completed", "completedAt", "createdAt", "description", "dueDate", "id", "order", "parentId", "priority", "projectId", "recurrence", "title", "updatedAt" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
CREATE INDEX "Task_parentId_completed_dueDate_idx" ON "Task"("parentId", "completed", "dueDate");
CREATE INDEX "Task_parentId_idx" ON "Task"("parentId");
CREATE INDEX "Task_projectId_idx" ON "Task"("projectId");
CREATE INDEX "Task_completed_completedAt_idx" ON "Task"("completed", "completedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
