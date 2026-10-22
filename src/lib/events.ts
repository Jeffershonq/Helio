import Redis from "ioredis";
import type { StreamFrame } from "@/lib/chat-types";
import { env } from "@/lib/env";

export const threadChannel = (workspaceId: string, threadId: string) => `helio:ws:${workspaceId}:thread:${threadId}`;

export interface EventBus {
  publish(channel: string, event: StreamFrame): Promise<void>;
  /** Returns a function that stops listening. */
  subscribe(channel: string, onEvent: (e: StreamFrame) => void): Promise<() => Promise<void>>;
}

/** Redis pub/sub, so every viewer of a thread sees the same live events, on any server process. */
class RedisBus implements EventBus {
  private pub?: Redis;

  async publish(channel: string, event: StreamFrame) {
    this.pub ??= new Redis(env().REDIS_URL, { maxRetriesPerRequest: 2 });
    await this.pub.publish(channel, JSON.stringify(event));
  }

  async subscribe(channel: string, onEvent: (e: StreamFrame) => void) {
    const sub = new Redis(env().REDIS_URL);
    sub.on("error", (err) => console.error("redis subscriber error", err.message));
    sub.on("message", (_channel, raw) => {
      try {
        onEvent(JSON.parse(raw));
      } catch {
        /* ignore malformed frames */
      }
    });
    await sub.subscribe(channel);
    return async () => {
      await sub.quit().catch(() => sub.disconnect());
    };
  }
}

const g = globalThis as unknown as { __helioBus?: EventBus };
export const getBus = (): EventBus => (g.__helioBus ??= new RedisBus());
