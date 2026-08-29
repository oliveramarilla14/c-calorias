import { describe, it, expect } from "vitest";

process.env.SESSION_SECRET = process.env.SESSION_SECRET || "test-secret";

const { encryptSecret, decryptSecret } = await import("../src/settings/crypto.js");

describe("settings crypto", () => {
  it("round-trips a secret", () => {
    const plain = "sk-proj-abc123def456ghi789";
    expect(decryptSecret(encryptSecret(plain))).toBe(plain);
  });

  it("produces a different ciphertext each time", () => {
    expect(encryptSecret("same")).not.toBe(encryptSecret("same"));
  });

  it("rejects a tampered payload", () => {
    const enc = encryptSecret("secret");
    const [iv, tag] = enc.split(":");
    const tampered = `${iv}:${tag}:${Buffer.from("evil").toString("base64")}`;
    expect(() => decryptSecret(tampered)).toThrow();
    expect(() => decryptSecret("garbage")).toThrow();
  });
});
