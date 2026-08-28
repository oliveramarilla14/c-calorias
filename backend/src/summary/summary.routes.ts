import { Router } from "express";
import { getWeeklySummary } from "./summary.service.js";

export const summaryRouter = Router();

summaryRouter.get("/weekly", async (req, res) => {
  const weeks = Number(req.query.weeks ?? 8);
  const summary = await getWeeklySummary(Number.isFinite(weeks) ? weeks : 8);
  res.json(summary);
});
