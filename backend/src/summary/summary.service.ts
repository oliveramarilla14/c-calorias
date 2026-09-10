import { prisma } from "../db.js";
import { weeksAgoRange, toISODate, daysElapsedInWeek } from "../week.js";
import { MEAL_TYPES } from "../meals/meals.service.js";
import { getGoals, KCAL_PER_KG } from "../settings/settings.service.js";

export async function getWeeklySummary(weeksCount: number, now: Date = new Date(), weekOffset = 0) {
  const clamped = Math.max(1, Math.min(12, weeksCount));
  const offset = Math.max(0, Math.min(520, Math.round(weekOffset)));
  const viewedWeek = weeksAgoRange(now, offset);

  // A past week is always 7 days; the ongoing one only counts the days elapsed
  // so far, so its average and deficit aren't diluted by days that haven't happened.
  const daysCounted = offset === 0 ? daysElapsedInWeek(now) : 7;

  const weeks: { weekStart: string; avg: number }[] = [];
  for (let i = clamped - 1; i >= 0; i--) {
    const { start, end } = weeksAgoRange(now, offset + i);
    const agg = await prisma.meal.aggregate({
      _sum: { calories: true },
      where: { consumedAt: { gte: start, lte: end } },
    });
    const total = agg._sum.calories ?? 0;
    const days = offset + i === 0 ? daysElapsedInWeek(now) : 7;
    weeks.push({ weekStart: toISODate(start), avg: Math.round(total / days) });
  }

  const weekMeals = await prisma.meal.findMany({
    where: { consumedAt: { gte: viewedWeek.start, lte: viewedWeek.end } },
    orderBy: { consumedAt: "asc" },
  });
  const weekTotal = weekMeals.reduce((sum, m) => sum + m.calories, 0);
  const weekAvg = Math.round(weekTotal / daysCounted);

  const goals = await getGoals();
  const maintenanceTarget = goals.maintenanceCalories * daysCounted;
  const deficit = maintenanceTarget - weekTotal;

  const byTypeMap = new Map<string, { total: number; count: number }>();
  for (const meal of weekMeals) {
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

  const weekWeights = await prisma.weight.findMany({
    where: { recordedAt: { gte: viewedWeek.start, lte: viewedWeek.end } },
  });
  const weightByDate = new Map(weekWeights.map((w) => [toISODate(w.recordedAt), w.weightKg.toString()]));

  const days: { date: string; total: number; weightKg: string | null }[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(viewedWeek.start);
    date.setUTCDate(date.getUTCDate() + i);
    const isoDate = toISODate(date);
    const total = weekMeals
      .filter((m) => toISODate(m.consumedAt) === isoDate)
      .reduce((sum, m) => sum + m.calories, 0);
    days.push({ date: isoDate, total, weightKg: weightByDate.get(isoDate) ?? null });
  }

  const topMeals = [...weekMeals]
    .sort((a, b) => b.calories - a.calories)
    .slice(0, 5)
    .map((m) => ({ id: m.id, type: m.type, description: m.description, calories: m.calories, consumedAt: toISODate(m.consumedAt) }));

  return {
    weekStart: toISODate(viewedWeek.start),
    weekEnd: toISODate(viewedWeek.end),
    weekOffset: offset,
    isCurrentWeek: offset === 0,
    daysCounted,
    weekTotal,
    weekAvg,
    dailyGoal: goals.dailyGoal,
    maintenanceCalories: goals.maintenanceCalories,
    maintenanceTarget,
    deficit,
    deficitKg: Math.round((deficit / KCAL_PER_KG) * 100) / 100,
    weeks,
    byType,
    days,
    topMeals,
    hasWeighedThisWeek: weekWeights.length > 0,
  };
}

export async function getExportRows(from: string, to: string) {
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);

  const [meals, weights] = await Promise.all([
    prisma.meal.findMany({ where: { consumedAt: { gte: start, lte: end } }, orderBy: { consumedAt: "asc" } }),
    prisma.weight.findMany({ where: { recordedAt: { gte: start, lte: end } }, orderBy: { recordedAt: "asc" } }),
  ]);

  const caloriesByDate = new Map<string, number>();
  for (const meal of meals) {
    const date = toISODate(meal.consumedAt);
    caloriesByDate.set(date, (caloriesByDate.get(date) ?? 0) + meal.calories);
  }
  const weightByDate = new Map(weights.map((w) => [toISODate(w.recordedAt), w.weightKg.toString()]));

  const dates = [...new Set([...caloriesByDate.keys(), ...weightByDate.keys()])].sort();
  return dates.map((date) => ({
    date,
    calories: caloriesByDate.get(date) ?? 0,
    weightKg: weightByDate.get(date) ?? null,
  }));
}
