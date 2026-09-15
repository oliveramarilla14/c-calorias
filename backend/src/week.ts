import { config } from "./config.js";

/**
 * The app's civil date "right now": the year/month/day showing on the user's
 * wall clock (APP_TIMEZONE, Asunción by default), anchored at UTC midnight.
 *
 * The server runs in UTC, so between local midnight and UTC midnight a plain
 * `new Date()` is already on the next calendar day for the user — which made
 * the current week count one day too many (e.g. "2 días" on a Monday night).
 */
export function appToday(now: Date = new Date()): Date {
  const timeZone = config.appTimeZone;
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    return new Date(Date.UTC(get("year"), get("month") - 1, get("day")));
  } catch {
    // Unknown time zone: fall back to UTC rather than breaking the request.
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }
}

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
