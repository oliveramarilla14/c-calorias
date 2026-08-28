import { describe, it, expect } from "vitest";
import { getWeekRange, weeksAgoRange, toISODate, daysElapsedInWeek } from "../src/week.js";

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
