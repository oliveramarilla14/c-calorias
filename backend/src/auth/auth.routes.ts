import { Router } from "express";
import rateLimit from "express-rate-limit";
import { verifyPin, signSession } from "./auth.service.js";
import { requireAuth } from "./auth.middleware.js";

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "too_many_attempts" },
});

export const authRouter = Router();

authRouter.post("/login", loginLimiter, (req, res) => {
  const pin = String(req.body?.pin ?? "");
  if (!/^\d{4}$/.test(pin) || !verifyPin(pin)) {
    res.status(401).json({ error: "invalid_pin" });
    return;
  }
  const token = signSession();
  res.cookie("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 24 * 60 * 60 * 1000,
  });
  res.status(200).json({ ok: true });
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie("session");
  res.status(200).json({ ok: true });
});

authRouter.get("/me", requireAuth, (_req, res) => {
  res.status(200).json({ ok: true });
});
