import { Router } from "express";
import { z } from "zod";
import { getWeekRange, toISODate } from "../week.js";
import {
  MEAL_TYPES,
  listMealsByDate,
  listMealsByWeek,
  createMeal,
  updateMeal,
  deleteMeal,
} from "./meals.service.js";

const mealBodySchema = z.object({
  type: z.enum(MEAL_TYPES),
  description: z.string().trim().min(1),
  calories: z.number().int().positive(),
  photoUrl: z.string().url().nullable().optional(),
  consumedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const mealsRouter = Router();

mealsRouter.get("/", async (req, res) => {
  if (typeof req.query.week === "string") {
    const { start, end } = getWeekRange(new Date(req.query.week));
    const meals = await listMealsByWeek(start, end);
    res.json(meals);
    return;
  }
  const date = typeof req.query.date === "string" ? req.query.date : toISODate(new Date());
  const meals = await listMealsByDate(date);
  res.json(meals);
});

mealsRouter.post("/", async (req, res) => {
  const parsed = mealBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", details: parsed.error.flatten() });
    return;
  }
  const meal = await createMeal(parsed.data);
  res.status(201).json(meal);
});

mealsRouter.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const parsed = mealBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", details: parsed.error.flatten() });
    return;
  }
  const meal = await updateMeal(id, parsed.data);
  res.json(meal);
});

mealsRouter.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  await deleteMeal(id);
  res.status(204).send();
});
