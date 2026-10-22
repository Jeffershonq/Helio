import { describe, expect, it } from "vitest";
import { hashPassword, verifyAgainstDummy, verifyPassword } from "@/lib/password";

describe("password hashing", () => {
  it("verifies the right password and rejects the wrong one", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(hash.startsWith("scrypt$15$8$3$")).toBe(true);
    expect(await verifyPassword("correct horse battery", hash)).toBe(true);
    expect(await verifyPassword("correct horse batterz", hash)).toBe(false);
  });

  it("salts every hash", async () => {
    expect(await hashPassword("same-password")).not.toBe(await hashPassword("same-password"));
  });

  it("treats equivalent unicode as the same password (NFKC)", async () => {
    const hash = await hashPassword("caf\u00e9-password");
    expect(await verifyPassword("cafe\u0301-password", hash)).toBe(true);
  });

  it("refuses malformed or absurd stored hashes", async () => {
    expect(await verifyPassword("x", "not-a-hash")).toBe(false);
    expect(await verifyPassword("x", "scrypt$30$8$3$c2FsdA$aGFzaA")).toBe(false);
    expect(await verifyPassword("x", "bcrypt$15$8$3$c2FsdA$aGFzaA")).toBe(false);
  });

  it("dummy verification always fails", async () => {
    expect(await verifyAgainstDummy("anything")).toBe(false);
  });
});
