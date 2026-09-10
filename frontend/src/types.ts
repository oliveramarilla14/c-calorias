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

export interface AiKeyStatus {
  configured: boolean;
  preview: string | null;
  source: "db" | "env" | null;
}

export interface Goals {
  dailyGoal: number;
  maintenanceCalories: number;
}

export interface Settings {
  ai: AiKeyStatus;
  goals: Goals;
}

export interface ExportRow {
  date: string;
  calories: number;
  weightKg: string | null;
}

export interface Weight {
  id: number;
  weightKg: string; // Prisma Decimal serializes as string
  recordedAt: string;
}

export interface WeeklySummary {
  weekStart: string;
  weekEnd: string;
  weekOffset: number;
  isCurrentWeek: boolean;
  daysCounted: number;
  weekTotal: number;
  weekAvg: number;
  dailyGoal: number;
  maintenanceCalories: number;
  maintenanceTarget: number;
  /** Positive = ate under maintenance over the counted days. */
  deficit: number;
  deficitKg: number;
  weeks: { weekStart: string; avg: number }[];
  byType: { type: MealType; avg: number; count: number }[];
  days: { date: string; total: number; weightKg: string | null }[];
  topMeals: { id: number; type: MealType; description: string; calories: number; consumedAt: string }[];
  hasWeighedThisWeek: boolean;
}
