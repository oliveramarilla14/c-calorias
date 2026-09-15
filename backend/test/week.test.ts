import { describe, it, expect, afterEach } from "vitest";
import { getWeekRange, weeksAgoRange, toISODate, daysElapsedInWeek, appToday } from "../src/week.js";

describe("getWeekRange", () => {
  it("returns Monday-Sunday for a Wednesday", () => {
    const { start, end } = getWeekRange(new Date("2026-08-26T12:00:00Z")); // Wed
    expect(toISODate(start)).toBe("2026-08-24"); // Mon
    expect(toISODate(end)).toBe("2026-08-30"); // Sun
  });

  it("returns the same week for the Sunday itself", () => {
    const { start, end } = getWeekRange(new Date("2026-08-30T23:00:00Z")); // Sun
    expect(toISODate(start)).toBe("2026-08-24");
    expect(toISODate(end)).toBe("2026-08-30");
  });

  it("returns the same week for the Monday itself", () => {
    const { start, end } = getWeekRange(new Date("2026-08-24T00:00:00Z")); // Mon
    expect(toISODate(start)).toBe("2026-08-24");
    expect(toISODate(end)).toBe("2026-08-30");
  });
});

describe("weeksAgoRange", () => {
  it("shifts back N full weeks", () => {
    const { start, end } = weeksAgoRange(new Date("2026-08-26T12:00:00Z"), 2);
    expect(toISODate(start)).toBe("2026-08-10");
    expect(toISODate(end)).toBe("2026-08-16");
  });
});

describe("daysElapsedInWeek", () => {
  it("is 1 for Monday", () => {
    expect(daysElapsedInWeek(new Date("2026-08-24T10:00:00Z"))).toBe(1);
  });
  it("is 3 for Wednesday", () => {
    expect(daysElapsedInWeek(new Date("2026-08-26T10:00:00Z"))).toBe(3);
  });
  it("is 7 for Sunday", () => {
    expect(daysElapsedInWeek(new Date("2026-08-30T10:00:00Z"))).toBe(7);
  });
});

describe("appToday", () => {
  const original = process.env.APP_TIMEZONE;
  afterEach(() => {
    if (original === undefined) delete process.env.APP_TIMEZONE;
    else process.env.APP_TIMEZONE = original;
  });

  it("is still Monday late on a Monday night in Asunción", () => {
    process.env.APP_TIMEZONE = "America/Asuncion";
    // 01:30 UTC Tuesday = 22:30 Monday in Asunción (UTC-3).
    const today = appToday(new Date("2026-09-15T01:30:00Z"));
    expect(toISODate(today)).toBe("2026-09-14");
    expect(daysElapsedInWeek(today)).toBe(1);
  });

  it("rolls over once the local day changes", () => {
    process.env.APP_TIMEZONE = "America/Asuncion";
    const today = appToday(new Date("2026-09-15T04:00:00Z")); // 01:00 Tuesday local
    expect(toISODate(today)).toBe("2026-09-15");
    expect(daysElapsedInWeek(today)).toBe(2);
  });

  it("falls back to UTC for an unknown time zone", () => {
    process.env.APP_TIMEZONE = "Not/AZone";
    expect(toISODate(appToday(new Date("2026-09-15T01:30:00Z")))).toBe("2026-09-15");
  });
});
