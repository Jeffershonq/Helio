import type { AgentState, StreamFrame, WireMessage } from "@/lib/chat-types";

export interface RunInfo {
  agentId: string;
  state: AgentState;
  error?: string;
}
export interface ChatState {
  messages: WireMessage[];
  runs: Record<string, RunInfo>;
}

const byTime = (a: WireMessage, b: WireMessage) => (a.createdAt === b.createdAt ? (a.id < b.id ? -1 : 1) : a.createdAt < b.createdAt ? -1 : 1);

/** Combines what the browser has with a fresh copy from the server (used after a reconnect). */
export function mergeMessages(local: WireMessage[], fresh: WireMessage[]): WireMessage[] {
  const map = new Map(local.map((m) => [m.id, m]));
  for (const m of fresh) {
    const mine = map.get(m.id);
    // The saved copy of a streaming answer lags behind the live one, so keep the longer text.
    const keepLocal = mine && mine.metadata?.streaming === true && m.metadata?.streaming === true && mine.body.length > m.body.length;
    map.set(m.id, keepLocal ? mine : m);
  }
  return [...map.values()].sort(byTime);
}

/** Applies one live event. `resync` is true when the browser missed something and should reload. */
export function reduceFrame(state: ChatState, frame: StreamFrame): { state: ChatState; resync: boolean } {
  switch (frame.type) {
    case "ready":
      return { state, resync: true };

    case "message.created":
      if (state.messages.some((m) => m.id === frame.message.id)) return { state, resync: false };
      return { state: { ...state, messages: [...state.messages, frame.message].sort(byTime) }, resync: false };

    case "message.delta": {
      const current = state.messages.find((m) => m.id === frame.messageId);
      if (!current || frame.offset > current.body.length) return { state, resync: true }; // missed an earlier piece
      if (frame.offset + frame.text.length <= current.body.length) return { state, resync: false }; // already have it
      const body = current.body + frame.text.slice(current.body.length - frame.offset);
      return { state: { ...state, messages: state.messages.map((m) => (m.id === current.id ? { ...m, body } : m)) }, resync: false };
    }

    case "message.done": {
      const exists = state.messages.some((m) => m.id === frame.message.id);
      const messages = exists ? state.messages.map((m) => (m.id === frame.message.id ? frame.message : m)) : [...state.messages, frame.message].sort(byTime);
      return { state: { ...state, messages }, resync: false };
    }

    case "message.removed":
      return { state: { ...state, messages: state.messages.filter((m) => m.id !== frame.messageId) }, resync: false };

    case "run.status": {
      const runs = { ...state.runs };
      if (frame.state === "idle") {
        delete runs[frame.runId];
      } else {
        if (frame.state !== "error") {
          for (const [id, r] of Object.entries(runs)) if (r.agentId === frame.agentId && r.state === "error") delete runs[id]; // a new run clears the old error
        }
        runs[frame.runId] = { agentId: frame.agentId, state: frame.state, error: frame.error };
      }
      return { state: { ...state, runs }, resync: false };
    }
  }
}

export const activeRuns = (state: ChatState) =>
  Object.entries(state.runs)
    .filter(([, r]) => r.state === "thinking" || r.state === "working")
    .map(([runId, r]) => ({ runId, ...r }));
