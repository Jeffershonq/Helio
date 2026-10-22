import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, last4, randomToken, safeEqual, sha256Hex } from "@/lib/crypto";

const key = randomBytes(32);

describe("AES-256-GCM secrets", () => {
  it("round-trips a secret", () => {
    const sealed = encryptSecret("sk-live-abcdef123456", "ws_1", key);
    expect(sealed.startsWith("v1.")).toBe(true);
    expect(sealed).not.toContain("sk-live");
    expect(decryptSecret(sealed, "ws_1", key)).toBe("sk-live-abcdef123456");
  });

  it("uses a fresh nonce every time", () => {
    expect(encryptSecret("same", "ws_1", key)).not.toBe(encryptSecret("same", "ws_1", key));
  });

  it("refuses to decrypt in another workspace (AAD binding)", () => {
    const sealed = encryptSecret("secret", "ws_1", key);
    expect(() => decryptSecret(sealed, "ws_2", key)).toThrow();
  });

  it("detects tampering", () => {
    const [v, iv, tag, ct] = encryptSecret("secret", "ws_1", key).split(".");
    const flipped = Buffer.from(ct!, "base64url");
    flipped[0]! ^= 1;
    expect(() => decryptSecret([v, iv, tag, flipped.toString("base64url")].join("."), "ws_1", key)).toThrow();
  });

  it("rejects the wrong key and bad key sizes", () => {
    const sealed = encryptSecret("secret", "ws_1", key);
    expect(() => decryptSecret(sealed, "ws_1", randomBytes(32))).toThrow();
    expect(() => encryptSecret("x", "ws_1", randomBytes(16))).toThrow();
  });
});

describe("token helpers", () => {
  it("makes unique url-safe tokens", () => {
    const a = randomToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(randomToken()).not.toBe(a);
  });
  it("hashes and compares", () => {
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(safeEqual("a", "a")).toBe(true);
    expect(safeEqual("a", "b")).toBe(false);
    expect(safeEqual("a", "ab")).toBe(false);
  });
  it("keeps only the last four characters", () => {
    expect(last4("sk-1234567890wxyz")).toBe("wxyz");
  });
});
