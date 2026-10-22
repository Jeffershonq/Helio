import { describe, expect, it } from "vitest";
import { buildRoutes, streamWithRoutes, type Route } from "@/lib/gateway/routes";
import { GatewayError, type GatewayConfig, type StreamEvent, type Tier } from "@/lib/gateway/types";
import { platformConfig, platformTiers } from "@/lib/platform";
import { effectiveLimit } from "@/lib/limits";
import { parseEnv } from "@/lib/env";

const cfg = (name: string, tiers: GatewayConfig["tiers"]): GatewayConfig => ({ baseUrl: `https://${name}.test/v1`, apiKey: "k", tiers });
const all = { LIGHT: { model: "l" }, MEDIUM: { model: "m" }, HEAVY: { model: "h" } };
const platform = cfg("platform", all);
const own = cfg("own", { HEAVY: { model: "mine" } });
const sources = (r: Route[]) => r.map((x) => x.source);

describe("buildRoutes", () => {
  it("default mode uses only the shared provider", () => {
    expect(sources(buildRoutes({ mode: "PLATFORM", fallbackToPlatform: true, tier: "LIGHT", own: null, platform }))).toEqual(["PLATFORM"]);
    // even if an own key exists, platform mode ignores it
    expect(sources(buildRoutes({ mode: "PLATFORM", fallbackToPlatform: true, tier: "HEAVY", own, platform }))).toEqual(["PLATFORM"]);
  });

  it("own mode: own key first for covered tiers, shared provider as backup when allowed", () => {
    expect(sources(buildRoutes({ mode: "OWN", fallbackToPlatform: true, tier: "HEAVY", own, platform }))).toEqual(["OWN", "PLATFORM"]);
    expect(sources(buildRoutes({ mode: "OWN", fallbackToPlatform: false, tier: "HEAVY", own, platform }))).toEqual(["OWN"]);
  });

  it("own mode: a tier the own key does not cover goes to the shared provider (partial offload)", () => {
    expect(sources(buildRoutes({ mode: "OWN", fallbackToPlatform: false, tier: "LIGHT", own, platform }))).toEqual(["PLATFORM"]);
  });

  it("works with only an own key when the install has no shared provider", () => {
    expect(sources(buildRoutes({ mode: "OWN", fallbackToPlatform: true, tier: "HEAVY", own, platform: null }))).toEqual(["OWN"]);
  });

  it("explains what is missing in plain words", () => {
    const tryIt = (i: Parameters<typeof buildRoutes>[0]) => { try { buildRoutes(i); } catch (e) { return (e as GatewayError).message; } };
    expect(tryIt({ mode: "PLATFORM", fallbackToPlatform: true, tier: "LIGHT", own: null, platform: null })).toMatch(/No model provider is set up/);
    expect(tryIt({ mode: "PLATFORM", fallbackToPlatform: true, tier: "LIGHT", own: null, platform: cfg("p", { HEAVY: { model: "h" } }) })).toMatch(/shared provider has no model for the light tier/);
    expect(tryIt({ mode: "OWN", fallbackToPlatform: true, tier: "LIGHT", own, platform: null })).toMatch(/No model is set for the light tier/);
  });
});

describe("streamWithRoutes", () => {
  const msgs = [{ role: "user" as const, content: "hi" }];
  const ownRoute: Route = { source: "OWN", cfg: own };
  const sharedRoute: Route = { source: "PLATFORM", cfg: platform };
  const done = (model: string): StreamEvent => ({ type: "done", model, inputTokens: 1, outputTokens: 1, estimated: false });
  const fake = (plan: Record<string, "ok" | GatewayError | "partial-then-fail">) =>
    (async function* (c: GatewayConfig): AsyncGenerator<StreamEvent> {
      const what = plan[c.baseUrl]!;
      if (what instanceof GatewayError) throw what;
      yield { type: "delta", text: "hi" };
      if (what === "partial-then-fail") throw new GatewayError("unavailable", "reset");
      yield done("m");
    }) as never;
  const run = async (routes: Route[], plan: Parameters<typeof fake>[0], beforeRoute?: (r: Route) => Promise<string | undefined>) => {
    const out: string[] = [];
    try {
      for await (const e of streamWithRoutes(routes, "HEAVY" as Tier, msgs, { beforeRoute }, fake(plan))) out.push(e.type === "route" ? `route:${e.source}` : e.type);
    } catch (e) { out.push(`throw:${(e as GatewayError).code}`); }
    return out;
  };

  it("uses the first route when it works", async () => {
    expect(await run([ownRoute, sharedRoute], { [own.baseUrl]: "ok", [platform.baseUrl]: "ok" })).toEqual(["route:OWN", "delta", "done"]);
  });

  it("moves to the shared provider when the own key is broken or limited", async () => {
    for (const code of ["auth", "rate_limit", "unavailable", "timeout", "model_not_found"] as const) {
      expect(await run([ownRoute, sharedRoute], { [own.baseUrl]: new GatewayError(code, "x"), [platform.baseUrl]: "ok" })).toEqual(["route:OWN", "route:PLATFORM", "delta", "done"]);
    }
  });

  it("does not switch after text was already sent", async () => {
    expect(await run([ownRoute, sharedRoute], { [own.baseUrl]: "partial-then-fail", [platform.baseUrl]: "ok" })).toEqual(["route:OWN", "delta", "throw:unavailable"]);
  });

  it("does not switch for errors another provider cannot fix", async () => {
    expect(await run([ownRoute, sharedRoute], { [own.baseUrl]: new GatewayError("bad_request", "x"), [platform.baseUrl]: "ok" })).toEqual(["route:OWN", "throw:bad_request"]);
    expect(await run([ownRoute, sharedRoute], { [own.baseUrl]: new GatewayError("aborted", "x"), [platform.baseUrl]: "ok" })).toEqual(["route:OWN", "throw:aborted"]);
  });

  it("raises the last error when every route fails", async () => {
    expect(await run([ownRoute, sharedRoute], { [own.baseUrl]: new GatewayError("auth", "x"), [platform.baseUrl]: new GatewayError("unavailable", "y") })).toEqual(["route:OWN", "route:PLATFORM", "throw:unavailable"]);
  });

  it("a daily limit on the shared provider skips only that route", async () => {
    const limitShared = async (r: Route) => (r.source === "PLATFORM" ? "limit reached" : undefined);
    // own key available: runs on it, the limit is never consulted for it
    expect(await run([ownRoute, sharedRoute], { [own.baseUrl]: "ok", [platform.baseUrl]: "ok" }, limitShared)).toEqual(["route:OWN", "delta", "done"]);
    // only the shared provider: the run is refused with a "limited" error
    expect(await run([sharedRoute], { [platform.baseUrl]: "ok" }, limitShared)).toEqual(["throw:limited"]);
    // own key fails, shared backup is over its limit: refused, not silently ignored
    expect(await run([ownRoute, sharedRoute], { [own.baseUrl]: new GatewayError("auth", "x"), [platform.baseUrl]: "ok" }, limitShared)).toEqual(["route:OWN", "throw:limited"]);
    // shared provider first and over its limit, own key behind it: the own key is used
    expect(await run([sharedRoute, ownRoute], { [own.baseUrl]: "ok", [platform.baseUrl]: "ok" }, limitShared)).toEqual(["route:OWN", "delta", "done"]);
  });
});

describe("platform config", () => {
  const base = { DATABASE_URL: "x", MASTER_KEY: "a".repeat(64) };
  it("is off without a base URL, and the key is optional", () => {
    expect(platformConfig(parseEnv(base))).toBeNull();
    const c = platformConfig(parseEnv({ ...base, PLATFORM_LLM_BASE_URL: "http://127.0.0.1:20128/v1" }))!;
    expect(c.apiKey).toBe("");
    expect(c.tiers).toEqual({});
  });
  it("reads the tier models and fallbacks", () => {
    const e = parseEnv({ ...base, PLATFORM_LLM_BASE_URL: "http://r/v1", PLATFORM_MODEL_LIGHT: "kiro", PLATFORM_MODEL_LIGHT_FALLBACK: "gpt", PLATFORM_MODEL_HEAVY: "opus", PLATFORM_MODEL_MEDIUM: "" });
    expect(platformTiers(e)).toEqual({ LIGHT: { model: "kiro", fallback: "gpt" }, HEAVY: { model: "opus" } });
  });
  it("has sensible daily limits by default, and 0 means unlimited", () => {
    const e = parseEnv(base);
    expect(e.PLATFORM_DAILY_TOKENS_WORKSPACE).toBe(1_000_000);
    expect(e.PLATFORM_DAILY_TOKENS_USER).toBe(300_000);
    expect(parseEnv({ ...base, PLATFORM_DAILY_TOKENS_USER: "0" }).PLATFORM_DAILY_TOKENS_USER).toBe(0);
  });
});

describe("effectiveLimit", () => {
  it("workspace value wins, 0 means unlimited, null falls back to the install default", () => {
    expect(effectiveLimit(5000, 1000)).toBe(5000);
    expect(effectiveLimit(0, 1000)).toBeNull();
    expect(effectiveLimit(null, 1000)).toBe(1000);
    expect(effectiveLimit(undefined, 0)).toBeNull();
  });
});
