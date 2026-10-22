import Redis from "ioredis";
import { env } from "@/lib/env";
import { HttpError } from "@/lib/http-error";

export interface RateStore {
  /** Adds one hit to the key and returns the hit count inside the current window. */
  hit(key: string, windowSec: number): Promise<number>;
}

export class MemoryStore implements RateStore {
  private hits = new Map<string, { count: number; resetAt: number }>();
  constructor(private now: () => number = Date.now) {}

  async hit(key: string, windowSec: number) {
    const t = this.now();
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= t) {
      this.hits.set(key, { count: 1, resetAt: t + windowSec * 1000 });
      return 1;
    }
    entry.count += 1;
    return entry.count;
  }
}

// INCR and EXPIRE in one atomic step, so a crash can never leave a key without an expiry.
const LUA = `local n = redis.call('INCR', KEYS[1]) if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end return n`;

export class RedisStore implements RateStore {
  constructor(private redis: Redis) {}
  async hit(key: string, windowSec: number) {
    return Number(await this.redis.eval(LUA, 1, `rl:${key}`, windowSec));
  }
}

let defaultStore: RateStore | undefined;
function store(): RateStore {
  defaultStore ??= new RedisStore(new Redis(env().REDIS_URL, { maxRetriesPerRequest: 2 }));
  return defaultStore;
}

export async function rateLimit(key: string, limit: number, windowSec: number, s: RateStore = store()) {
  const count = await s.hit(key, windowSec);
  return { ok: count <= limit, remaining: Math.max(0, limit - count), retryAfterSec: windowSec };
}

/** Throws a 429 when the limit is hit. Fails closed: if Redis is down, auth endpoints stay shut. */
export async function enforceRateLimit(key: string, limit: number, windowSec: number, s?: RateStore) {
  let result;
  try {
    result = await rateLimit(key, limit, windowSec, s);
  } catch (err) {
    console.error("rate limiter unavailable", (err as Error).message);
    throw new HttpError(503, "Service is busy. Try again in a moment.", "unavailable");
  }
  if (!result.ok) {
    throw new HttpError(429, "Too many attempts. Wait a bit and try again.", "rate_limited", undefined, {
      "Retry-After": String(result.retryAfterSec),
    });
  }
}
