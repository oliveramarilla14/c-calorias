import { prisma } from "../db.js";
import { getWeekRange, weeksAgoRange, toISODate, daysElapsedInWeek } from "../week.js";
import { MEAL_TYPES } from "../meals/meals.service.js";

export async function getWeeklySummary(weeksCount: number, now: Date = new Date()) {
  const clamped = Math.max(1, Math.min(12, weeksCount));
  const currentWeek = getWeekRange(now);

  const weeks: { weekStart: string; avg: number }[] = [];
  for (let i = clamped - 1; i >= 0; i--) {
    const { start, end } = weeksAgoRange(now, i);
    const agg = await prisma.meal.aggregate({
      _sum: { calories: true },
      where: { consumedAt: { gte: start, lte: end } },
    });
    const total = agg._sum.calories ?? 0;
    const days = i === 0 ? daysElapsedInWeek(now) : 7;
    weeks.push({ weekStart: toISODate(start), avg: Math.round(total / days) });
  }

  const currentWeekMeals = await prisma.meal.findMany({
    where: { consumedAt: { gte: currentWeek.start, lte: currentWeek.end } },
    orderBy: { consumedAt: "asc" },
  });
  const weekTotal = currentWeekMeals.reduce((sum, m) => sum + m.calories, 0);
  const weekAvg = Math.round(weekTotal / daysElapsedInWeek(now));

  const byTypeMap = new Map<string, { total: number; count: number }>();
  for (const meal of currentWeekMeals) {
    const entry = byTypeMap.get(meal.type) ?? { total: 0, count: 0 };
    entry.total += meal.calories;
    entry.count += 1;
    byTypeMap.set(meal.type, entry);
  }
  const byType = MEAL_TYPES.map((type) => {
    const entry = byTypeMap.get(type);
    const count = entry?.count ?? 0;
    const total = entry?.total ?? 0;
    return { type, count, avg: count > 0 ? Math.round(total / count) : 0 };
  });

  const currentWeekWeights = await prisma.weight.findMany({
    where: { recordedAt: { gte: currentWeek.start, lte: currentWeek.end } },
  });
  const weightByDate = new Map(currentWeekWeights.map((w) => [toISODate(w.recordedAt), w.weightKg.toString()]));

  const days: { date: string; total: number; weightKg: string | null }[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(currentWeek.start);
    date.setUTCDate(date.getUTCDate() + i);
    const isoDate = toISODate(date);
    const total = currentWeekMeals
      .filter((m) => toISODate(m.consumedAt) === isoDate)
      .reduce((sum, m) => sum + m.calories, 0);
    days.push({ date: isoDate, total, weightKg: weightByDate.get(isoDate) ?? null });
  }

  const topMeals = [...currentWeekMeals]
    .sort((a, b) => b.calories - a.calories)
    .slice(0, 5)
    .map((m) => ({ id: m.id, type: m.type, description: m.description, calories: m.calories, consumedAt: toISODate(m.consumedAt) }));

  return {
    weekStart: toISODate(currentWeek.start),
    weekEnd: toISODate(currentWeek.end),
    weekTotal,
    weekAvg,
    weeks,
    byType,
    days,
    topMeals,
    hasWeighedThisWeek: currentWeekWeights.length > 0,
  };
}
