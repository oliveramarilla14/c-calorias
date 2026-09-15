import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "../src/db.js";
import { authedAgent } from "./helpers/testApp.js";
import { getWeeklySummary, getExportRows } from "../src/summary/summary.service.js";
import { _resetCacheForTests } from "../src/settings/settings.service.js";
import { daysElapsedInWeek } from "../src/week.js";

beforeEach(async () => {
  await prisma.meal.deleteMany();
  await prisma.weight.deleteMany();
  await prisma.setting.deleteMany();
  _resetCacheForTests();
});

describe("GET /api/summary/weekly", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-26T12:00:00Z")); // Wed, day 3 of its week
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("aggregates current-week totals, per-type averages and weigh-in status", async () => {
    const { agent } = await authedAgent();

    // Monday and Wednesday of the week containing 2026-08-26 (Wed)
    await agent.post("/api/meals").send({ type: "Desayuno", description: "a", calories: 400, consumedAt: "2026-08-24" });
    await agent.post("/api/meals").send({ type: "Desayuno", description: "b", calories: 300, consumedAt: "2026-08-26" });
    await agent.post("/api/meals").send({ type: "Almuerzo", description: "c", calories: 700, consumedAt: "2026-08-26" });
    // outside this week
    await agent.post("/api/meals").send({ type: "Desayuno", description: "d", calories: 999, consumedAt: "2026-08-10" });

    const res = await agent.get("/api/summary/weekly?weeks=3");
    expect(res.status).toBe(200);
    expect(res.body.weekTotal).toBe(1400);
    expect(res.body.weeks).toHaveLength(3);
    // current (last) week is partial: avg = total / days elapsed so far in that week
    expect(res.body.weeks[res.body.weeks.length - 1].avg).toBe(Math.round(1400 / daysElapsedInWeek(new Date())));

    const desayuno = res.body.byType.find((t: any) => t.type === "Desayuno");
    expect(desayuno.avg).toBe(350); // (400+300)/2
    expect(desayuno.count).toBe(2);

    const cena = res.body.byType.find((t: any) => t.type === "Cena");
    expect(cena.avg).toBe(0);
    expect(cena.count).toBe(0);

    expect(res.body.hasWeighedThisWeek).toBe(false);

    expect(res.body.days).toHaveLength(7);
    const mon = res.body.days.find((d: any) => d.date === "2026-08-24");
    expect(mon.total).toBe(400);
    expect(mon.weightKg).toBeNull();
    const wed = res.body.days.find((d: any) => d.date === "2026-08-26");
    expect(wed.total).toBe(1000); // 300 + 700

    expect(res.body.topMeals).toHaveLength(3);
    expect(res.body.topMeals[0]).toMatchObject({ description: "c", calories: 700 });
    expect(res.body.topMeals[1]).toMatchObject({ description: "a", calories: 400 });
    expect(res.body.topMeals[2]).toMatchObject({ description: "b", calories: 300 });

    await agent.post("/api/weights").send({ weightKg: 80, recordedAt: "2026-08-26" });
    const res2 = await agent.get("/api/summary/weekly");
    expect(res2.body.hasWeighedThisWeek).toBe(true);
    const wedWithWeight = res2.body.days.find((d: any) => d.date === "2026-08-26");
    expect(wedWithWeight.weightKg).toBe("80");
  });
});

describe("weekly summary week navigation and deficit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-26T12:00:00Z")); // Wed, day 3 of its week
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("serves a past week with offset and counts all 7 of its days", async () => {
    const { agent } = await authedAgent();
    // previous week runs 2026-08-17 (Mon) .. 2026-08-23 (Sun)
    await agent.post("/api/meals").send({ type: "Almuerzo", description: "prev", calories: 2100, consumedAt: "2026-08-18" });
    await agent.post("/api/meals").send({ type: "Cena", description: "now", calories: 900, consumedAt: "2026-08-26" });

    const res = await agent.get("/api/summary/weekly?weeks=2&offset=1").expect(200);
    expect(res.body.weekStart).toBe("2026-08-17");
    expect(res.body.weekEnd).toBe("2026-08-23");
    expect(res.body.weekOffset).toBe(1);
    expect(res.body.isCurrentWeek).toBe(false);
    expect(res.body.daysCounted).toBe(7);
    expect(res.body.weekTotal).toBe(2100); // the current-week meal is excluded
    expect(res.body.topMeals).toHaveLength(1);
  });

  it("computes the weekly deficit against maintenance and converts it to kg", async () => {
    const { agent } = await authedAgent();
    await agent.put("/api/settings/goals").send({ dailyGoal: 2000, maintenanceCalories: 2500 }).expect(200);
    await agent.post("/api/meals").send({ type: "Almuerzo", description: "a", calories: 1400, consumedAt: "2026-08-24" });

    const res = await agent.get("/api/summary/weekly").expect(200);
    expect(res.body.daysCounted).toBe(3); // Mon-Wed
    expect(res.body.maintenanceCalories).toBe(2500);
    expect(res.body.dailyGoal).toBe(2000);
    expect(res.body.maintenanceTarget).toBe(7500);
    expect(res.body.deficit).toBe(6100);
    expect(res.body.deficitKg).toBe(0.79); // 6100 / 7700
  });

  it("counts the local day, not the UTC one, late on a Monday night", async () => {
    // 01:00 UTC Tuesday is still 22:00 Monday in Asunción: one day elapsed, not two.
    vi.setSystemTime(new Date("2026-09-15T01:00:00Z"));
    const { agent } = await authedAgent();
    await agent.post("/api/meals").send({ type: "Cena", description: "a", calories: 2020, consumedAt: "2026-09-14" });

    const res = await agent.get("/api/summary/weekly").expect(200);
    expect(res.body.weekStart).toBe("2026-09-14");
    expect(res.body.daysCounted).toBe(1);
    expect(res.body.maintenanceTarget).toBe(2500);
    expect(res.body.deficit).toBe(480);
    expect(res.body.weekAvg).toBe(2020);
  });

  it("reports a surplus as a negative deficit", async () => {
    const { agent } = await authedAgent();
    await agent.post("/api/meals").send({ type: "Cena", description: "a", calories: 9000, consumedAt: "2026-08-24" });

    const res = await agent.get("/api/summary/weekly").expect(200);
    expect(res.body.deficit).toBe(7500 - 9000); // defaults: 2500 maintenance x 3 days
    expect(res.body.deficitKg).toBeLessThan(0);
  });
});

describe("GET /api/summary/export", () => {
  it("returns one row per day with data, including the weight when recorded", async () => {
    const { agent } = await authedAgent();
    await agent.post("/api/meals").send({ type: "Desayuno", description: "a", calories: 400, consumedAt: "2026-08-24" });
    await agent.post("/api/meals").send({ type: "Cena", description: "b", calories: 600, consumedAt: "2026-08-24" });
    await agent.post("/api/meals").send({ type: "Almuerzo", description: "c", calories: 700, consumedAt: "2026-08-26" });
    await agent.post("/api/weights").send({ weightKg: 80.5, recordedAt: "2026-08-26" });
    // outside the requested range
    await agent.post("/api/meals").send({ type: "Cena", description: "d", calories: 999, consumedAt: "2026-09-05" });

    const res = await agent.get("/api/summary/export?from=2026-08-24&to=2026-08-30").expect(200);
    expect(res.body.rows).toEqual([
      { date: "2026-08-24", calories: 1000, weightKg: null },
      { date: "2026-08-26", calories: 700, weightKg: "80.5" },
    ]);
  });

  it("includes a day that only has a weight", async () => {
    const { agent } = await authedAgent();
    await agent.post("/api/weights").send({ weightKg: 79, recordedAt: "2026-08-25" });

    const rows = await getExportRows("2026-08-24", "2026-08-30");
    expect(rows).toEqual([{ date: "2026-08-25", calories: 0, weightKg: "79" }]);
  });

  it("rejects a malformed or inverted range", async () => {
    const { agent } = await authedAgent();
    await agent.get("/api/summary/export?from=nope&to=2026-08-30").expect(400);
    await agent.get("/api/summary/export?from=2026-08-30&to=2026-08-24").expect(400);
  });
});

describe("getWeeklySummary (pinned date)", () => {
  it("computes totals for the week containing the given date", async () => {
    const { agent } = await authedAgent();
    await agent.post("/api/meals").send({ type: "Desayuno", description: "a", calories: 400, consumedAt: "2026-08-24" });
    await agent.post("/api/meals").send({ type: "Almuerzo", description: "b", calories: 700, consumedAt: "2026-08-26" });

    const summary = await getWeeklySummary(3, new Date("2026-08-26T12:00:00Z"));
    expect(summary.weekStart).toBe("2026-08-24");
    expect(summary.weekTotal).toBe(1100);
    expect(summary.weekAvg).toBe(Math.round(1100 / 3)); // Wednesday = day 3 of its week
  });
});
