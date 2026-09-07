// "+3" 같은 표기를 오늘부터 N일 뒤 날짜로 바꾼다. "+1"이면 내일, "+3"이면 3일 뒤.
export function parsePlusDate(
  rawText: string,
  referenceDate: Date = new Date(),
): { title: string; dueDate: string | null } {
  let dueDate: string | null = null;

  const title = rawText
    .replace(/(^|\s)\+(\d+)(?=\s|$)/, (_match, lead: string, days: string) => {
      const d = new Date(referenceDate);
      d.setDate(d.getDate() + Number(days));
      const offset = d.getTimezoneOffset();
      const local = new Date(d.getTime() - offset * 60 * 1000);
      dueDate = local.toISOString().slice(0, 10);
      return lead;
    })
    .replace(/ {2,}/g, " ")
    .trim();

  return { title, dueDate };
}
