import { prisma } from "../db.js";

export const MEAL_TYPES = ["Desayuno", "Almuerzo", "Merienda", "Cena", "Snack"] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export interface MealInput {
  type: MealType;
  description: string;
  calories: number;
  photoUrl?: string | null;
  consumedAt: string; // YYYY-MM-DD
}

export function listMealsByDate(date: string) {
  return prisma.meal.findMany({
    where: { consumedAt: new Date(date) },
    orderBy: { id: "asc" },
  });
}

export function listMealsByWeek(start: Date, end: Date) {
  return prisma.meal.findMany({
    where: { consumedAt: { gte: start, lte: end } },
    orderBy: { consumedAt: "asc" },
  });
}

export function createMeal(input: MealInput) {
  return prisma.meal.create({
    data: {
      type: input.type,
      description: input.description,
      calories: input.calories,
      photoUrl: input.photoUrl ?? null,
      consumedAt: new Date(input.consumedAt),
    },
  });
}

export function updateMeal(id: number, input: MealInput) {
  return prisma.meal.update({
    where: { id },
    data: {
      type: input.type,
      description: input.description,
      calories: input.calories,
      photoUrl: input.photoUrl ?? null,
      consumedAt: new Date(input.consumedAt),
    },
  });
}

export function deleteMeal(id: number) {
  return prisma.meal.delete({ where: { id } });
}
