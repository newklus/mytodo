export function truncateMiddle(text: string, max = 24): string {
  if (text.length <= max) return text;
  const keep = max - 1; // 생략 부호(…) 1글자 자리 확보
  const head = Math.ceil(keep / 2);
  const tail = Math.floor(keep / 2);
  return `${text.slice(0, head)}…${text.slice(text.length - tail)}`;
}
