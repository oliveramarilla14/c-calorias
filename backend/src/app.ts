import express from "express";
import cookieParser from "cookie-parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { authRouter } from "./auth/auth.routes.js";
import { requireAuth } from "./auth/auth.middleware.js";
import { mealsRouter } from "./meals/meals.routes.js";
import { weightsRouter } from "./weights/weights.routes.js";
import { summaryRouter } from "./summary/summary.routes.js";
import { uploadsRouter } from "./uploads/uploads.routes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

  if (process.env.NODE_ENV === "production") {
    const frontendDist = path.join(__dirname, "../../frontend/dist");
    app.use(express.static(frontendDist));
    app.use((req, res, next) => {
      if (req.method !== "GET" || req.path.startsWith("/api")) {
        next();
        return;
      }
      res.sendFile(path.join(frontendDist, "index.html"));
    });
  }

  return app;
}
