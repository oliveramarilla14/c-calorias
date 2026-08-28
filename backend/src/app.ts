import express from "express";
import cookieParser from "cookie-parser";
import { authRouter } from "./auth/auth.routes.js";

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api/auth", authRouter);

  return app;
}
