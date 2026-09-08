import { test } from "node:test";
import assert from "node:assert/strict";
import { renderWeeklyReport } from "@/lib/weeklyReportTemplate";

// 회사 정식 양식이 정해지면 이 함수만 교체하기로 되어 있다(requirements 7.3).
// 그래서 여기 테스트는 "지금 포맷의 계약"을 고정해 두는 역할이다.
const WEEK = "2026-09-07 ~ 2026-09-13";

test("완료·진행중 항목을 각 섹션에 렌더한다", () => {
  const out = renderWeeklyReport({
    weekLabel: WEEK,
    completedItems: [{ title: "보고서 작성", projectName: "영업", completedAt: new Date(2026, 8, 9) }],
    progressItems: [{ title: "리팩터링", projectName: "플랫폼", dueDate: new Date(2026, 8, 20) }],
  });

  assert.ok(out.startsWith(`## 주간업무보고 (${WEEK})`));
  assert.ok(out.includes("- [영업] 보고서 작성 (완료일: 9/9)"));
  assert.ok(out.includes("- [플랫폼] 리팩터링 — 마감: 9/20"));
});

test("프로젝트가 없으면 대괄호 접두사를 붙이지 않는다", () => {
  const out = renderWeeklyReport({
    weekLabel: WEEK,
    completedItems: [{ title: "잡무", projectName: null, completedAt: new Date(2026, 8, 8) }],
    progressItems: [],
  });
  assert.ok(out.includes("- 잡무 (완료일: 9/8)"));
  assert.ok(!out.includes("[null]"));
});

test("마감일이 없는 진행중 항목은 '진행 중'으로 적는다", () => {
  const out = renderWeeklyReport({
    weekLabel: WEEK,
    completedItems: [],
    progressItems: [{ title: "조사", projectName: null, dueDate: null }],
  });
  assert.ok(out.includes("- 조사 — 진행 중"));
});

test("항목이 없으면 (없음)을 넣는다 — 섹션이 사라지지 않는다", () => {
  const out = renderWeeklyReport({ weekLabel: WEEK, completedItems: [], progressItems: [] });
  assert.ok(out.includes("### ✅ 금주 완료 업무"));
  assert.ok(out.includes("### 🔄 진행 중 / 미완료 업무"));
  assert.equal(out.split("- (없음)").length - 1, 2);
});

test("날짜는 M/D 로 (0을 채우지 않는다)", () => {
  const out = renderWeeklyReport({
    weekLabel: WEEK,
    completedItems: [{ title: "x", projectName: null, completedAt: new Date(2026, 0, 5) }],
    progressItems: [],
  });
  assert.ok(out.includes("(완료일: 1/5)"));
});

test("여러 건이 순서대로 각각 한 줄씩 나온다", () => {
  const out = renderWeeklyReport({
    weekLabel: WEEK,
    completedItems: [
      { title: "첫째", projectName: null, completedAt: new Date(2026, 8, 8) },
      { title: "둘째", projectName: null, completedAt: new Date(2026, 8, 9) },
    ],
    progressItems: [],
  });
  const lines = out.split("\n");
  assert.ok(lines.indexOf("- 첫째 (완료일: 9/8)") < lines.indexOf("- 둘째 (완료일: 9/9)"));
});
