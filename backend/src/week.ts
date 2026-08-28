export function getWeekRange(date: Date): { start: Date; end: Date } {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay(); // 0 = Sunday .. 6 = Saturday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const start = new Date(d);
  start.setUTCDate(d.getUTCDate() + diffToMonday);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return { start, end };
}

export function weeksAgoRange(date: Date, weeksAgo: number): { start: Date; end: Date } {
  const { start, end } = getWeekRange(date);
  start.setUTCDate(start.getUTCDate() - 7 * weeksAgo);
  end.setUTCDate(end.getUTCDate() - 7 * weeksAgo);
  return { start, end };
}

export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function daysElapsedInWeek(date: Date): number {
  const day = date.getUTCDay();
  return day === 0 ? 7 : day;
}
