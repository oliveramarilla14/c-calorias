import { Router } from "express";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { verifyPin } from "../auth/auth.service.js";
import {
  getAiKeyStatus,
  setPinHash,
  setOpenAiApiKey,
  clearOpenAiApiKey,
} from "./settings.service.js";

const pinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "too_many_attempts" },
});

const pinSchema = z.object({
  currentPin: z.string(),
  newPin: z.string().regex(/^\d{4}$/),
});

const aiKeySchema = z.object({ apiKey: z.string().trim().min(20) });

export const settingsRouter = Router();

settingsRouter.get("/", async (_req, res) => {
  res.json({ ai: await getAiKeyStatus() });
});

settingsRouter.put("/pin", pinLimiter, async (req, res) => {
  const parsed = pinSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_pin" });
    return;
  }
  if (!(await verifyPin(parsed.data.currentPin))) {
    res.status(400).json({ error: "invalid_current_pin" });
    return;
  }
  await setPinHash(bcrypt.hashSync(parsed.data.newPin, 10));
  res.json({ ok: true });
});

settingsRouter.put("/ai-key", async (req, res) => {
  const parsed = aiKeySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_key" });
    return;
  }
  await setOpenAiApiKey(parsed.data.apiKey);
  res.json({ ai: await getAiKeyStatus() });
});

settingsRouter.delete("/ai-key", async (_req, res) => {
  await clearOpenAiApiKey();
  res.json({ ai: await getAiKeyStatus() });
});
