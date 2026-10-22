import { describe, expect, it } from "vitest";
import { activeRuns, mergeMessages, reduceFrame, type ChatState } from "@/lib/chat-state";
import type { WireMessage } from "@/lib/chat-types";
import { applyMention, activeMentionQuery, emphasizeMentions, filterCandidates } from "@/lib/mention-input";

const msg = (id: string, body = "", extra: Partial<WireMessage> = {}): WireMessage => ({
  id, threadId: "t", authorKind: "AGENT", userId: null, agentId: "a1", body, replyToId: null, metadata: null, createdAt: `2026-01-01T00:00:0${id.length}Z`, ...extra,
});
const empty: ChatState = { messages: [], runs: {} };

describe("live chat state", () => {
  it("adds a message once, keeps order", () => {
    let s = reduceFrame(empty, { type: "message.created", message: msg("b") }).state;
    s = reduceFrame(s, { type: "message.created", message: msg("b") }).state;
    s = reduceFrame(s, { type: "message.created", message: msg("aa") }).state;
    expect(s.messages.map((m) => m.id)).toEqual(["b", "aa"]);
  });

  it("appends deltas, ignores duplicates, and asks for a reload when it missed a piece", () => {
    let s = reduceFrame(empty, { type: "message.created", message: msg("m") }).state;
    s = reduceFrame(s, { type: "message.delta", messageId: "m", offset: 0, text: "Hel" }).state;
    s = reduceFrame(s, { type: "message.delta", messageId: "m", offset: 3, text: "lo" }).state;
    expect(s.messages[0]!.body).toBe("Hello");
    const dup = reduceFrame(s, { type: "message.delta", messageId: "m", offset: 3, text: "lo" });
    expect(dup.state.messages[0]!.body).toBe("Hello");
    expect(dup.resync).toBe(false);
    const overlap = reduceFrame(s, { type: "message.delta", messageId: "m", offset: 4, text: "o!" });
    expect(overlap.state.messages[0]!.body).toBe("Hello!");
    expect(reduceFrame(s, { type: "message.delta", messageId: "m", offset: 9, text: "x" }).resync).toBe(true);
    expect(reduceFrame(s, { type: "message.delta", messageId: "unknown", offset: 0, text: "x" }).resync).toBe(true);
  });

  it("replaces with the final message, and removes empty ones", () => {
    let s = reduceFrame(empty, { type: "message.created", message: msg("m") }).state;
    s = reduceFrame(s, { type: "message.done", message: msg("m", "final") }).state;
    expect(s.messages[0]!.body).toBe("final");
    s = reduceFrame(s, { type: "message.removed", messageId: "m" }).state;
    expect(s.messages).toEqual([]);
  });

  it("tracks agent status and clears an old error when the agent starts again", () => {
    let s = reduceFrame(empty, { type: "run.status", runId: "r1", agentId: "a1", state: "thinking" }).state;
    expect(activeRuns(s)).toHaveLength(1);
    s = reduceFrame(s, { type: "run.status", runId: "r1", agentId: "a1", state: "error", error: "boom" }).state;
    expect(activeRuns(s)).toHaveLength(0);
    expect(s.runs.r1!.error).toBe("boom");
    s = reduceFrame(s, { type: "run.status", runId: "r2", agentId: "a1", state: "thinking" }).state;
    expect(Object.keys(s.runs)).toEqual(["r2"]);
    s = reduceFrame(s, { type: "run.status", runId: "r2", agentId: "a1", state: "idle" }).state;
    expect(s.runs).toEqual({});
  });

  it("asks for a reload on the ready handshake", () => {
    expect(reduceFrame(empty, { type: "ready" }).resync).toBe(true);
  });

  it("merge keeps the longer live text of a streaming answer and adds missing messages", () => {
    const live = msg("m", "Hello wor", { metadata: { streaming: true } });
    const saved = msg("m", "Hello", { metadata: { streaming: true } });
    const merged = mergeMessages([live], [saved, msg("zz", "new")]);
    expect(merged.find((m) => m.id === "m")!.body).toBe("Hello wor");
    expect(merged.map((m) => m.id)).toContain("zz");
    const final = mergeMessages([live], [msg("m", "Hello world", { metadata: { streaming: false } })]);
    expect(final[0]!.body).toBe("Hello world");
  });
});

describe("mention input helpers", () => {
  it("detects an @ being typed, including names with spaces", () => {
    expect(activeMentionQuery("hi @Ly", 6)).toEqual({ start: 3, query: "Ly" });
    expect(activeMentionQuery("@", 1)).toEqual({ start: 0, query: "" });
    expect(activeMentionQuery("ask @Ada Lo", 11)).toEqual({ start: 4, query: "Ada Lo" });
    expect(activeMentionQuery("mail bob@Ly", 11)).toBeNull();
    expect(activeMentionQuery("no mention", 10)).toBeNull();
  });

  it("filters by prefix first, then by contains", () => {
    const c = [
      { kind: "agent" as const, id: "1", label: "Lyra" },
      { kind: "user" as const, id: "2", label: "Ada Lovelace" },
      { kind: "agent" as const, id: "3", label: "Carina" },
    ];
    expect(filterCandidates(c, "").map((x) => x.label)).toEqual(["Lyra", "Ada Lovelace", "Carina"]);
    expect(filterCandidates(c, "ca").map((x) => x.label)).toEqual(["Carina"]);
    expect(filterCandidates(c, "a").map((x) => x.label)).toEqual(["Ada Lovelace", "Lyra", "Carina"]);
    expect(filterCandidates(c, "ra").map((x) => x.label)).toEqual(["Lyra"]);
    expect(filterCandidates(c, "zzz")).toEqual([]);
  });

  it("inserts the chosen name and moves the caret", () => {
    expect(applyMention("hi @Ly there", 6, 3, "Lyra")).toEqual({ text: "hi @Lyra  there", caret: 9 });
  });

  it("bolds mention ranges without shifting later ones", () => {
    expect(emphasizeMentions("@A and @B", [{ start: 0, end: 2 }, { start: 7, end: 9 }])).toBe("**@A** and **@B**");
  });
});
