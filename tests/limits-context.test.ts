import { describe, expect, it } from "vitest";
import { buildContext } from "@/lib/context";
import { evaluateLimits, startOfUtcDay } from "@/lib/limits";

describe("evaluateLimits", () => {
  const base = { userTokensToday: 0, workspaceTokensToday: 0, otherActiveRuns: 0, limits: { maxConcurrent: 3 } };
  it("allows a run under all limits", () => expect(evaluateLimits(base).ok).toBe(true));
  it("blocks on the workspace daily limit with a clear reason", () => {
    const v = evaluateLimits({ ...base, workspaceTokensToday: 1000, limits: { ...base.limits, workspace: 1000 } });
    expect(v).toMatchObject({ ok: false });
    expect((v as { reason: string }).reason).toMatch(/workspace has used its daily limit of 1,000 tokens/);
  });
  it("blocks on the personal daily limit", () => {
    const v = evaluateLimits({ ...base, userTokensToday: 50, limits: { ...base.limits, user: 50 } });
    expect((v as { reason: string }).reason).toMatch(/You have used your daily limit/);
  });
  it("blocks when too many runs are active", () => {
    expect(evaluateLimits({ ...base, otherActiveRuns: 3 }).ok).toBe(false);
    expect(evaluateLimits({ ...base, otherActiveRuns: 2 }).ok).toBe(true);
  });
  it("null limits mean unlimited", () => {
    expect(evaluateLimits({ ...base, userTokensToday: 9e9, workspaceTokensToday: 9e9, limits: { user: null, workspace: null, maxConcurrent: 3 } }).ok).toBe(true);
  });
  it("day starts at 00:00 UTC", () => {
    expect(startOfUtcDay(new Date("2026-10-15T23:59:59Z")).toISOString()).toBe("2026-10-15T00:00:00.000Z");
  });
});

describe("buildContext", () => {
  const self = { id: "a1", name: "Lyra", role: "Personal assistant" };
  const teammates = [{ id: "a2", name: "Carina", role: "PM" }];
  const people = new Map([["u1", "Ada"]]);
  const human = (body: string) => ({ authorKind: "HUMAN" as const, userId: "u1", agentId: null, body });

  it("labels speakers in the team room and merges same-role turns", () => {
    const ctx = buildContext({
      soul: "You are Lyra.", self, teammates, people, project: { name: "Invoices" },
      messages: [human("hi"), human("again"), { authorKind: "AGENT", userId: null, agentId: "a1", body: "hello" }, { authorKind: "AGENT", userId: null, agentId: "a2", body: "plan ready" }],
    });
    expect(ctx[0]!.role).toBe("system");
    expect(ctx[0]!.content).toContain("Project: Invoices");
    expect(ctx[0]!.content).toContain("Carina (PM)");
    expect(ctx.slice(1)).toEqual([
      { role: "user", content: "Ada: hi\n\nAda: again" },
      { role: "assistant", content: "hello" },
      { role: "user", content: "Carina (agent): plan ready" },
    ]);
  });

  it("uses plain text in a private chat and skips system notices", () => {
    const ctx = buildContext({
      soul: "x", self, teammates, people, project: null, privateChatWith: "Ada",
      messages: [{ authorKind: "SYSTEM", userId: null, agentId: null, body: "limit hit" }, human("hello")],
    });
    expect(ctx[0]!.content).toContain("private chat with Ada");
    expect(ctx.slice(1)).toEqual([{ role: "user", content: "hello" }]);
  });

  it("drops the oldest turns to fit, always keeping the latest, and opens with a user turn", () => {
    const messages = [
      human("a".repeat(500)),
      { authorKind: "AGENT" as const, userId: null, agentId: "a1", body: "b".repeat(500) },
      human("latest question"),
    ];
    const ctx = buildContext({ soul: "s", self, teammates, people, project: null, messages, maxChars: 900 });
    expect(ctx[ctx.length - 1]!.content).toContain("latest question");
    expect(ctx[1]!.role).toBe("user");
    expect(ctx.length).toBeLessThan(4);
  });
});
