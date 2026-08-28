import { describe, it, expect, vi } from "vitest";

vi.mock("../src/uploads/r2.js", () => ({
  uploadToR2: vi.fn(async (_buf: Buffer, key: string) => `https://photos.example.com/${key}`),
}));

const { authedAgent } = await import("./helpers/testApp.js");

describe("POST /api/uploads", () => {
  it("uploads an image and returns its public URL", async () => {
    const { agent } = await authedAgent();
    const res = await agent
      .post("/api/uploads")
      .attach("photo", Buffer.from("fake-image-bytes"), { filename: "plate.jpg", contentType: "image/jpeg" });
    expect(res.status).toBe(201);
    expect(res.body.photo_url).toMatch(/^https:\/\/photos\.example\.com\/meals\//);
  });

  it("rejects a non-image file with 400", async () => {
    const { agent } = await authedAgent();
    const res = await agent
      .post("/api/uploads")
      .attach("photo", Buffer.from("not an image"), { filename: "notes.txt", contentType: "text/plain" });
    expect(res.status).toBe(400);
  });

  it("rejects a request with no file with 400", async () => {
    const { agent } = await authedAgent();
    const res = await agent.post("/api/uploads");
    expect(res.status).toBe(400);
  });
});
