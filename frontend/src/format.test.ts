import { describe, it, expect } from "vitest";
import { formatDate, localISODate } from "./format";

describe("formatDate", () => {
  it("turns an ISO date into dd/mm/yyyy", () => {
    expect(formatDate("2026-08-28")).toBe("28/08/2026");
    expect(formatDate("2026-08-28T23:15:00.000Z")).toBe("28/08/2026");
  });
});

describe("localISODate", () => {
  it("uses the local calendar date, not UTC", () => {
    // 2026-08-28 01:30 in UTC-03:00 is still Aug 28 locally,
    // but toISOString() would report Aug 28 04:30 — same day here.
    // The failing case is the evening: 22:00 local on Aug 28 is
    // Aug 29 in UTC. Build such a Date explicitly.
    const eveningLocal = new Date(2026, 7, 28, 22, 0, 0); // month is 0-indexed
    expect(localISODate(eveningLocal)).toBe("2026-08-28");
  });

  it("pads month and day", () => {
    expect(localISODate(new Date(2026, 0, 5, 12))).toBe("2026-01-05");
  });

  it("defaults to today", () => {
    const now = new Date();
    expect(localISODate()).toBe(localISODate(now));
  });
});
