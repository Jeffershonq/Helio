import { describe, expect, it } from "vitest";
import { parseEnv } from "@/lib/env";

const KEY = "a".repeat(64);

describe("environment parsing", () => {
  it("accepts the shipped .env.example shape (empty optional values)", () => {
    const e = parseEnv({
      DATABASE_URL: "postgresql://helio:x@localhost:5432/helio",
      MASTER_KEY: KEY,
      APP_URL: "http://localhost:3000",
      SMTP_HOST: "",
      SMTP_PORT: "",
      SMTP_USER: "",
      GOOGLE_CLIENT_ID: "",
      PLATFORM_LLM_BASE_URL: "",
      PLATFORM_LLM_API_KEY: "",
      ALLOW_PRIVATE_PROVIDER_URLS: "false",
      TRUST_PROXY: "true",
    });
    expect(e.SMTP_HOST).toBeUndefined();
    expect(e.SMTP_PORT).toBe(1025);
    expect(e.PLATFORM_LLM_BASE_URL).toBeUndefined();
  });

  it("explains a missing or malformed master key", () => {
    expect(() => parseEnv({ DATABASE_URL: "x", MASTER_KEY: "" })).toThrow(/MASTER_KEY/);
    expect(() => parseEnv({ DATABASE_URL: "x", MASTER_KEY: "short" })).toThrow(/64 hex/);
  });

  it("reads booleans", () => {
    const e = parseEnv({ DATABASE_URL: "x", MASTER_KEY: KEY, ALLOW_PRIVATE_PROVIDER_URLS: "true" });
    expect(e.ALLOW_PRIVATE_PROVIDER_URLS).toBe(true);
  });
});
