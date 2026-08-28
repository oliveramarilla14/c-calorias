import bcrypt from "bcryptjs";
import request from "supertest";

process.env.SESSION_SECRET = process.env.SESSION_SECRET || "test-secret";
process.env.PIN_HASH = process.env.PIN_HASH || bcrypt.hashSync("1234", 10);

export async function authedAgent() {
  const { createApp } = await import("../../src/app.js");
  const app = createApp();
  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({ pin: "1234" });
  return { app, agent };
}
