import { Router } from "express";
import { z } from "zod";
import { getWeeklySummary, getExportRows } from "./summary.service.js";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const exportSchema = z
  .object({ from: isoDate, to: isoDate })
  .refine((v) => v.from <= v.to, { message: "from_after_to" });

export const summaryRouter = Router();

summaryRouter.get("/weekly", async (req, res) => {
  const weeks = Number(req.query.weeks ?? 8);
  const offset = Number(req.query.offset ?? 0);
  const summary = await getWeeklySummary(
    Number.isFinite(weeks) ? weeks : 8,
    new Date(),
    Number.isFinite(offset) ? offset : 0,
  );
  res.json(summary);
});

summaryRouter.get("/export", async (req, res) => {
  const parsed = exportSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_range" });
    return;
  }
  res.json({ rows: await getExportRows(parsed.data.from, parsed.data.to) });
});
