import { describe, it, expect, vi } from "vitest";

vi.mock("../src/ai/ai.service.js", async () => {
  const actual = await vi.importActual<typeof import("../src/ai/ai.service.js")>("../src/ai/ai.service.js");
  return {
    ...actual,
    transcribeAudio: vi.fn(),
    interpretMealText: vi.fn(),
  };
});

const { transcribeAudio, interpretMealText } = await import("../src/ai/ai.service.js");
const { authedAgent } = await import("./helpers/testApp.js");

describe("POST /api/ai/parse-meal", () => {
  it("requires auth", async () => {
    const { app } = await authedAgent();
    const request = (await import("supertest")).default;
    const res = await request(app).post("/api/ai/parse-meal").send({ text: "comí algo" });
    expect(res.status).toBe(401);
  });

  it("interprets typed text directly, without transcribing", async () => {
    (interpretMealText as any).mockResolvedValue({ type: "Almuerzo", description: "Milanesa con papas", calories: 750 });
    const { agent } = await authedAgent();
    const res = await agent.post("/api/ai/parse-meal").send({ text: "comí una milanesa con papas" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ type: "Almuerzo", description: "Milanesa con papas", calories: 750 });
    expect(transcribeAudio).not.toHaveBeenCalled();
  });

  it("transcribes audio then interprets the transcript", async () => {
    (transcribeAudio as any).mockResolvedValue("comí una ensalada");
    (interpretMealText as any).mockResolvedValue({ type: "Cena", description: "Ensalada", calories: 300 });
    const { agent } = await authedAgent();
    const res = await agent
      .post("/api/ai/parse-meal")
      .attach("audio", Buffer.from("fake-audio-bytes"), { filename: "audio.webm", contentType: "audio/webm" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ type: "Cena", description: "Ensalada", calories: 300, transcript: "comí una ensalada" });
    expect(interpretMealText).toHaveBeenCalledWith("comí una ensalada");
  });

  it("returns 400 when neither audio nor text is provided", async () => {
    const { agent } = await authedAgent();
    const res = await agent.post("/api/ai/parse-meal");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("missing_input");
  });

  it("returns 502 when the AI call fails", async () => {
    const { AiParseError } = await import("../src/ai/ai.service.js");
    (interpretMealText as any).mockRejectedValue(new AiParseError("boom"));
    const { agent } = await authedAgent();
    const res = await agent.post("/api/ai/parse-meal").send({ text: "comí algo" });
    expect(res.status).toBe(502);
    expect(res.body.error).toBe("ai_failed");
  });
});
