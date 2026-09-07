export type CompletedReportItem = {
  title: string;
  projectName: string | null;
  completedAt: Date;
};

export type ProgressReportItem = {
  title: string;
  projectName: string | null;
  dueDate: Date | null;
};

function formatShortDate(date: Date) {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function withProjectPrefix(title: string, projectName: string | null) {
  return projectName ? `[${projectName}] ${title}` : title;
}

export function renderWeeklyReport({
  weekLabel,
  completedItems,
  progressItems,
}: {
  weekLabel: string;
  completedItems: CompletedReportItem[];
  progressItems: ProgressReportItem[];
}) {
  const lines: string[] = [];

  lines.push(`## 주간업무보고 (${weekLabel})`);
  lines.push("");
  lines.push("### ✅ 금주 완료 업무");
  if (completedItems.length === 0) {
    lines.push("- (없음)");
  } else {
    for (const item of completedItems) {
      lines.push(`- ${withProjectPrefix(item.title, item.projectName)} (완료일: ${formatShortDate(item.completedAt)})`);
    }
  }

  lines.push("");
  lines.push("### 🔄 진행 중 / 미완료 업무");
  if (progressItems.length === 0) {
    lines.push("- (없음)");
  } else {
    for (const item of progressItems) {
      const dueLabel = item.dueDate ? `마감: ${formatShortDate(item.dueDate)}` : "진행 중";
      lines.push(`- ${withProjectPrefix(item.title, item.projectName)} — ${dueLabel}`);
    }
  }

  return lines.join("\n");
}
