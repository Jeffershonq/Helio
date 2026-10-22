// Types shared by the server and the browser. No server-only imports here.

export type AuthorKind = "HUMAN" | "AGENT" | "SYSTEM";
export type AgentState = "thinking" | "working" | "idle" | "error";

export interface WireMessage {
  id: string;
  threadId: string;
  authorKind: AuthorKind;
  userId: string | null;
  agentId: string | null;
  body: string;
  replyToId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string; // ISO
}

/** Events sent to the browser over Server-Sent Events. */
export type ChatEvent =
  | { type: "message.created"; message: WireMessage }
  | { type: "message.delta"; messageId: string; offset: number; text: string }
  | { type: "message.done"; message: WireMessage }
  | { type: "message.removed"; messageId: string }
  | { type: "run.status"; runId: string; agentId: string; state: AgentState; error?: string };

export const MAX_MESSAGE_CHARS = 8000;

/** Everything that can arrive on the event stream, including the "ready" handshake. */
export type StreamFrame = ChatEvent | { type: "ready" };
