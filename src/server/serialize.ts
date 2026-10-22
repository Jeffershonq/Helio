import type { WireMessage } from "@/lib/chat-types";

export function toWire(m: {
  id: string;
  threadId: string;
  authorKind: "HUMAN" | "AGENT" | "SYSTEM";
  userId: string | null;
  agentId: string | null;
  body: string;
  replyToId: string | null;
  metadata: unknown;
  createdAt: Date;
}): WireMessage {
  const meta = m.metadata && typeof m.metadata === "object" && !Array.isArray(m.metadata) ? (m.metadata as Record<string, unknown>) : null;
  return {
    id: m.id,
    threadId: m.threadId,
    authorKind: m.authorKind,
    userId: m.userId,
    agentId: m.agentId,
    body: m.body,
    replyToId: m.replyToId,
    metadata: meta,
    createdAt: m.createdAt.toISOString(),
  };
}
