import express from "express";
import cookieParser from "cookie-parser";
import { authRouter } from "./auth/auth.routes.js";
import { requireAuth } from "./auth/auth.middleware.js";
import { mealsRouter } from "./meals/meals.routes.js";
import { weightsRouter } from "./weights/weights.routes.js";
import { summaryRouter } from "./summary/summary.routes.js";
import { uploadsRouter } from "./uploads/uploads.routes.js";

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/meals", requireAuth, mealsRouter);
  app.use("/api/weights", requireAuth, weightsRouter);
  app.use("/api/summary", requireAuth, summaryRouter);
  app.use("/api/uploads", requireAuth, uploadsRouter);

  return app;
}
