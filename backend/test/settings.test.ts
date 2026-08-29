import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import { prisma } from "../src/db.js";
import { authedAgent } from "./helpers/testApp.js";

let agent: any;
let app: any;

async function resetCache() {
  const { _resetCacheForTests } = await import("../src/settings/settings.service.js");
  _resetCacheForTests();
}

async function seedPin(pin: string) {
  await prisma.setting.upsert({
    where: { key: "pin_hash" },
    create: { key: "pin_hash", value: bcrypt.hashSync(pin, 10) },
    update: { value: bcrypt.hashSync(pin, 10) },
  });
  await resetCache();
}

beforeAll(async () => {
  ({ app, agent } = await authedAgent());
});

beforeEach(async () => {
  await prisma.setting.deleteMany();
  await resetCache();
});

afterAll(async () => {
  await prisma.setting.deleteMany();
  await resetCache();
});

describe("settings routes", () => {
  it("requires auth", async () => {
    const request = (await import("supertest")).default;
    await request(app).get("/api/settings").expect(401);
  });

  it("reports AI not configured by default", async () => {
    const res = await agent.get("/api/settings").expect(200);
    expect(res.body.ai).toEqual({ configured: false, preview: null, source: null });
  });

  it("stores an AI key and returns only a masked preview", async () => {
    const res = await agent
      .put("/api/settings/ai-key")
      .send({ apiKey: "sk-test-1234567890abcdefghij" })
      .expect(200);
    expect(res.body.ai.configured).toBe(true);
    expect(res.body.ai.source).toBe("db");
    expect(res.body.ai.preview).toBe("sk-…ghij");
    expect(JSON.stringify(res.body)).not.toContain("1234567890");

    const row = await prisma.setting.findUnique({ where: { key: "openai_api_key" } });
    expect(row?.value).not.toContain("sk-test");
  });

  it("clears the AI key override", async () => {
    await agent.put("/api/settings/ai-key").send({ apiKey: "sk-test-1234567890abcdefghij" });
    await agent.delete("/api/settings/ai-key").expect(200);
    expect(await prisma.setting.findUnique({ where: { key: "openai_api_key" } })).toBeNull();
  });

  it("rejects a PIN change with the wrong current PIN", async () => {
    await seedPin("1234");
    const res = await agent.put("/api/settings/pin").send({ currentPin: "9999", newPin: "2222" }).expect(400);
    expect(res.body.error).toBe("invalid_current_pin");
  });

  it("rejects a non-4-digit new PIN", async () => {
    await seedPin("1234");
    await agent.put("/api/settings/pin").send({ currentPin: "1234", newPin: "abc" }).expect(400);
  });

  it("changes the PIN with the correct current PIN", async () => {
    await seedPin("1234");
    await agent.put("/api/settings/pin").send({ currentPin: "1234", newPin: "2222" }).expect(200);
    const row = await prisma.setting.findUnique({ where: { key: "pin_hash" } });
    expect(bcrypt.compareSync("2222", row!.value)).toBe(true);
  });
});
