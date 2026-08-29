export const MEAL_TYPES = ["Desayuno", "Almuerzo", "Merienda", "Cena", "Snack"] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export interface Meal {
  id: number;
  type: MealType;
  description: string;
  calories: number;
  photoUrl: string | null;
  consumedAt: string;
}

export interface AiMealDraft {
  type: MealType;
  description: string;
  calories: number;
  transcript?: string;
}

export interface Weight {
  id: number;
  weightKg: string; // Prisma Decimal serializes as string
  recordedAt: string;
}

export interface WeeklySummary {
  weekStart: string;
  weekEnd: string;
  weekTotal: number;
  weekAvg: number;
  weeks: { weekStart: string; total: number }[];
  byType: { type: MealType; avg: number; count: number }[];
  hasWeighedThisWeek: boolean;
}
