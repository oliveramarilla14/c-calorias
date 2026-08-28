import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "../src/db.js";
import { authedAgent } from "./helpers/testApp.js";

beforeEach(async () => {
  await prisma.meal.deleteMany();
});

describe("Meals CRUD", () => {
  it("requires auth", async () => {
    const { app } = await authedAgent();
    const request = (await import("supertest")).default;
    const res = await request(app).get("/api/meals");
    expect(res.status).toBe(401);
  });

  it("creates, lists by date, updates and deletes a meal", async () => {
    const { agent } = await authedAgent();

    const create = await agent.post("/api/meals").send({
      type: "Almuerzo",
      description: "Pollo grillé con ensalada",
      calories: 450,
      consumedAt: "2026-08-28",
    });
    expect(create.status).toBe(201);
    const id = create.body.id;

    const listByDate = await agent.get("/api/meals?date=2026-08-28");
    expect(listByDate.status).toBe(200);
    expect(listByDate.body).toHaveLength(1);
    expect(listByDate.body[0].description).toBe("Pollo grillé con ensalada");

    const update = await agent.put(`/api/meals/${id}`).send({
      type: "Cena",
      description: "Pollo grillé con ensalada y papas",
      calories: 600,
      consumedAt: "2026-08-28",
    });
    expect(update.status).toBe(200);
    expect(update.body.calories).toBe(600);

    const del = await agent.delete(`/api/meals/${id}`);
    expect(del.status).toBe(204);

    const listAfterDelete = await agent.get("/api/meals?date=2026-08-28");
    expect(listAfterDelete.body).toHaveLength(0);
  });

  it("rejects invalid calories with 400", async () => {
    const { agent } = await authedAgent();
    const res = await agent.post("/api/meals").send({
      type: "Almuerzo",
      description: "Test",
      calories: -5,
      consumedAt: "2026-08-28",
    });
    expect(res.status).toBe(400);
  });

  it("lists meals within a week range via ?week=", async () => {
    const { agent } = await authedAgent();
    await agent.post("/api/meals").send({
      type: "Desayuno",
      description: "Lunes",
      calories: 300,
      consumedAt: "2026-08-24",
    });
    await agent.post("/api/meals").send({
      type: "Desayuno",
      description: "Fuera de semana",
      calories: 300,
      consumedAt: "2026-08-17",
    });
    const res = await agent.get("/api/meals?week=2026-08-26");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].description).toBe("Lunes");
  });
});
