import { describe, expect, it } from "vitest";
import { MemoryStore, rateLimit } from "@/lib/rate-limit";

describe("rate limiter", () => {
  it("allows up to the limit, then blocks", async () => {
    const store = new MemoryStore();
    const results = [];
    for (let i = 0; i < 4; i++) results.push((await rateLimit("k", 3, 60, store)).ok);
    expect(results).toEqual([true, true, true, false]);
  });

  it("counts keys separately", async () => {
    const store = new MemoryStore();
    await rateLimit("a", 1, 60, store);
    expect((await rateLimit("b", 1, 60, store)).ok).toBe(true);
  });

  it("starts a new window after it expires", async () => {
    let now = 0;
    const store = new MemoryStore(() => now);
    await rateLimit("k", 1, 10, store);
    expect((await rateLimit("k", 1, 10, store)).ok).toBe(false);
    now = 11_000;
    expect((await rateLimit("k", 1, 10, store)).ok).toBe(true);
  });
});
