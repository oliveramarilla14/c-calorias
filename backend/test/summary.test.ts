import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "../src/db.js";
import { authedAgent } from "./helpers/testApp.js";
import { getWeeklySummary } from "../src/summary/summary.service.js";
import { daysElapsedInWeek } from "../src/week.js";

beforeEach(async () => {
  await prisma.meal.deleteMany();
  await prisma.weight.deleteMany();
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
