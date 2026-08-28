import type { Meal, MealType, Weight, WeeklySummary } from "./types";

export class AuthError extends Error {}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    headers: init?.body instanceof FormData ? undefined : { "Content-Type": "application/json" },
    ...init,
  });
  if (res.status === 401) throw new AuthError("unauthorized");
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export interface MealInput {
  type: MealType;
  description: string;
  calories: number;
  photoUrl?: string | null;
  consumedAt: string;
}

export interface WeightInput {
  weightKg: number;
  recordedAt: string;
}

export const api = {
  login: (pin: string) => request<{ ok: true }>("/auth/login", { method: "POST", body: JSON.stringify({ pin }) }),
  logout: () => request<{ ok: true }>("/auth/logout", { method: "POST" }),
  me: () => request<{ ok: true }>("/auth/me"),

  getMealsByDate: (date: string) => request<Meal[]>(`/meals?date=${date}`),
  getMealsByWeek: (weekDate: string) => request<Meal[]>(`/meals?week=${weekDate}`),
  createMeal: (input: MealInput) => request<Meal>("/meals", { method: "POST", body: JSON.stringify(input) }),
  updateMeal: (id: number, input: MealInput) =>
    request<Meal>(`/meals/${id}`, { method: "PUT", body: JSON.stringify(input) }),
  deleteMeal: (id: number) => request<void>(`/meals/${id}`, { method: "DELETE" }),

  getWeights: () => request<Weight[]>("/weights"),
  createWeight: (input: WeightInput) => request<Weight>("/weights", { method: "POST", body: JSON.stringify(input) }),
  updateWeight: (id: number, input: WeightInput) =>
    request<Weight>(`/weights/${id}`, { method: "PUT", body: JSON.stringify(input) }),
  deleteWeight: (id: number) => request<void>(`/weights/${id}`, { method: "DELETE" }),

  getWeeklySummary: (weeks: number) => request<WeeklySummary>(`/summary/weekly?weeks=${weeks}`),

  uploadPhoto: async (file: File): Promise<string> => {
    const form = new FormData();
    form.append("photo", file);
    const { photo_url } = await request<{ photo_url: string }>("/uploads", { method: "POST", body: form });
    return photo_url;
  },
};
