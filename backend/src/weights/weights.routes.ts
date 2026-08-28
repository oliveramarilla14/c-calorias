import { Router } from "express";
import { z } from "zod";
import { listWeights, createWeight, updateWeight, deleteWeight } from "./weights.service.js";

const weightBodySchema = z.object({
  weightKg: z.number().positive(),
  recordedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const weightsRouter = Router();

weightsRouter.get("/", async (_req, res) => {
  const weights = await listWeights();
  res.json(weights);
});

weightsRouter.post("/", async (req, res) => {
  const parsed = weightBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", details: parsed.error.flatten() });
    return;
  }
  const weight = await createWeight(parsed.data);
  res.status(201).json(weight);
});

weightsRouter.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const parsed = weightBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", details: parsed.error.flatten() });
    return;
  }
  const weight = await updateWeight(id, parsed.data);
  res.json(weight);
});

weightsRouter.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  await deleteWeight(id);
  res.status(204).send();
});
