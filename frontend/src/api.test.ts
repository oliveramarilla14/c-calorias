import { describe, it, expect, vi, beforeEach } from "vitest";
import { api, AuthError } from "./api";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

describe("api client", () => {
  it("sends credentials and JSON content-type on POST", async () => {
    (fetch as any).mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    await api.login("1234");
    const [url, init] = (fetch as any).mock.calls[0];
    expect(url).toBe("/api/auth/login");
    expect(init.credentials).toBe("include");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({ pin: "1234" });
  });

  it("throws AuthError on 401", async () => {
    (fetch as any).mockResolvedValue(new Response(null, { status: 401 }));
    await expect(api.getWeights()).rejects.toBeInstanceOf(AuthError);
  });
});
