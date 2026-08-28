import type { Request, Response, NextFunction } from "express";
import { verifySession } from "./auth.service.js";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.session;
  if (!token || !verifySession(token)) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  next();
}
