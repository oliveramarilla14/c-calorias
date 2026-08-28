import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "../src/db.js";
import { authedAgent } from "./helpers/testApp.js";

beforeEach(async () => {
  await prisma.weight.deleteMany();
});

describe("Weights CRUD", () => {
  it("creates, lists, updates and deletes a weight entry", async () => {
    const { agent } = await authedAgent();

    const create = await agent.post("/api/weights").send({ weightKg: 83.4, recordedAt: "2026-08-21" });
    expect(create.status).toBe(201);
    const id = create.body.id;

    const list = await agent.get("/api/weights");
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);

    const update = await agent.put(`/api/weights/${id}`).send({ weightKg: 83.1, recordedAt: "2026-08-21" });
    expect(update.status).toBe(200);
    expect(Number(update.body.weightKg)).toBe(83.1);

    const del = await agent.delete(`/api/weights/${id}`);
    expect(del.status).toBe(204);

    const listAfter = await agent.get("/api/weights");
    expect(listAfter.body).toHaveLength(0);
  });

  it("rejects a non-positive weight with 400", async () => {
    const { agent } = await authedAgent();
    const res = await agent.post("/api/weights").send({ weightKg: 0, recordedAt: "2026-08-21" });
    expect(res.status).toBe(400);
  });
});
