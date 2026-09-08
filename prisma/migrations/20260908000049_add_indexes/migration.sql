-- CreateIndex
CREATE INDEX "Task_parentId_completed_dueDate_idx" ON "Task"("parentId", "completed", "dueDate");

-- CreateIndex
CREATE INDEX "Task_parentId_idx" ON "Task"("parentId");

-- CreateIndex
CREATE INDEX "Task_projectId_idx" ON "Task"("projectId");

-- CreateIndex
CREATE INDEX "Task_completed_completedAt_idx" ON "Task"("completed", "completedAt");

-- CreateIndex
CREATE INDEX "TaskTag_tagId_idx" ON "TaskTag"("tagId");
