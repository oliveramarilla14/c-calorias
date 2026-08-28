import { prisma } from "../db.js";
import { getWeekRange, weeksAgoRange, toISODate, daysElapsedInWeek } from "../week.js";
import { MEAL_TYPES } from "../meals/meals.service.js";

export async function getWeeklySummary(weeksCount: number, now: Date = new Date()) {
  const clamped = Math.max(1, Math.min(12, weeksCount));
  const currentWeek = getWeekRange(now);

  const weeks: { weekStart: string; total: number }[] = [];
  for (let i = clamped - 1; i >= 0; i--) {
    const { start, end } = weeksAgoRange(now, i);
    const agg = await prisma.meal.aggregate({
      _sum: { calories: true },
      where: { consumedAt: { gte: start, lte: end } },
    });
    weeks.push({ weekStart: toISODate(start), total: agg._sum.calories ?? 0 });
  }
  const weekTotal = weeks[weeks.length - 1].total;
  const weekAvg = Math.round(weekTotal / daysElapsedInWeek(now));

  const byTypeRaw = await prisma.meal.groupBy({
    by: ["type"],
    where: { consumedAt: { gte: currentWeek.start, lte: currentWeek.end } },
    _sum: { calories: true },
    _count: { _all: true },
  });
  const byTypeMap = new Map(byTypeRaw.map((r) => [r.type, r]));
  const byType = MEAL_TYPES.map((type) => {
    const row = byTypeMap.get(type);
    const count = row?._count._all ?? 0;
    const total = row?._sum.calories ?? 0;
    return { type, count, avg: count > 0 ? Math.round(total / count) : 0 };
  });

  const weightThisWeek = await prisma.weight.findFirst({
    where: { recordedAt: { gte: currentWeek.start, lte: currentWeek.end } },
  });

  return {
    weekStart: toISODate(currentWeek.start),
    weekEnd: toISODate(currentWeek.end),
    weekTotal,
    weekAvg,
    weeks,
    byType,
    hasWeighedThisWeek: weightThisWeek !== null,
  };
}
