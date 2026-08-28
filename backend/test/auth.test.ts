import { describe, it, expect, beforeAll } from "vitest";
import bcrypt from "bcryptjs";
import request from "supertest";

process.env.SESSION_SECRET = "test-secret";
process.env.PIN_HASH = bcrypt.hashSync("1234", 10);

const { createApp } = await import("../src/app.js");

describe("POST /api/auth/login", () => {
  it("rejects a wrong PIN with 401", async () => {
    const app = createApp();
    const res = await request(app).post("/api/auth/login").send({ pin: "0000" });
    expect(res.status).toBe(401);
  });

  it("accepts the correct PIN and sets a session cookie", async () => {
    const app = createApp();
    const res = await request(app).post("/api/auth/login").send({ pin: "1234" });
    expect(res.status).toBe(200);
    expect(res.headers["set-cookie"]?.[0]).toMatch(/^session=/);
  });
});

describe("requireAuth", () => {
  it("blocks unauthenticated requests to a protected route with 401", async () => {
    const app = createApp();
    app.get("/api/_protected_probe", (await import("../src/auth/auth.middleware.js")).requireAuth, (_req: any, res: any) =>
      res.json({ ok: true })
    );
    const res = await request(app).get("/api/_protected_probe");
    expect(res.status).toBe(401);
  });

  it("allows requests carrying a valid session cookie", async () => {
    const app = createApp();
    app.get("/api/_protected_probe", (await import("../src/auth/auth.middleware.js")).requireAuth, (_req: any, res: any) =>
      res.json({ ok: true })
    );
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ pin: "1234" });
    const res = await agent.get("/api/_protected_probe");
    expect(res.status).toBe(200);
  });
});

describe("GET /api/auth/me", () => {
  it("returns 401 without a session cookie", async () => {
    const app = createApp();
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("returns 200 with a valid session cookie", async () => {
    const app = createApp();
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ pin: "1234" });
    const res = await agent.get("/api/auth/me");
    expect(res.status).toBe(200);
  });
});

describe("rate limiting", () => {
  it("rate-limits after 5 failed attempts", async () => {
    const app = createApp();
    for (let i = 0; i < 5; i++) {
      await request(app).post("/api/auth/login").send({ pin: "0000" });
    }
    const res = await request(app).post("/api/auth/login").send({ pin: "0000" });
    expect(res.status).toBe(429);
  });
});
