export function getWeekRange(reference: Date): { start: Date; end: Date } {
  const start = new Date(reference);
  const day = start.getDay(); // 0=Sun, 1=Mon, ... 6=Sat
  const diffToMonday = (day + 6) % 7;
  start.setDate(start.getDate() - diffToMonday);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function formatISODate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function formatWeekLabel(start: Date, end: Date) {
  return `${formatISODate(start)} ~ ${formatISODate(end)}`;
}
