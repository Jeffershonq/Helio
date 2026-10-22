import type { ChatMessage } from "@/lib/gateway/types";

export interface ContextMessage {
  authorKind: "HUMAN" | "AGENT" | "SYSTEM";
  userId: string | null;
  agentId: string | null;
  body: string;
}

export interface ContextInput {
  soul: string;
  self: { id: string; name: string; role: string };
  teammates: { id: string; name: string; role: string }[]; // other agents
  people: Map<string, string>; // userId -> display name
  project: { name: string; description?: string | null } | null;
  privateChatWith?: string; // set for a private agent chat
  messages: ContextMessage[]; // oldest first
  maxChars?: number;
}

const DEFAULT_MAX_CHARS = 24_000;

/**
 * Builds the model prompt for one agent turn.
 * The model has a single "assistant" voice, so other speakers are labelled with their names.
 */
export function buildContext(input: ContextInput): ChatMessage[] {
  const team = input.teammates.map((t) => `${t.name} (${t.role})`).join(", ");
  const system = [
    input.soul.trim(),
    "",
    `You are ${input.self.name}, ${input.self.role}.`,
    team ? `Your teammates are: ${team}. To pass work to one of them, write @Name in your reply.` : "",
    input.project ? `Project: ${input.project.name}${input.project.description ? `. ${input.project.description}` : ""}` : "",
    input.privateChatWith
      ? `This is a private chat with ${input.privateChatWith}.`
      : "This is the shared team room. Messages start with the speaker's name. Do not start your own reply with your name.",
    "Reply in markdown. Keep answers short and simple unless asked for detail.",
  ]
    .filter(Boolean)
    .join("\n");

  const names = new Map(input.teammates.map((t) => [t.id, t.name]));
  const turns: ChatMessage[] = [];
  for (const m of input.messages) {
    if (m.authorKind === "SYSTEM" || !m.body.trim()) continue;
    let role: "user" | "assistant";
    let content: string;
    if (m.authorKind === "AGENT" && m.agentId === input.self.id) {
      role = "assistant";
      content = m.body;
    } else if (m.authorKind === "AGENT") {
      role = "user";
      content = `${names.get(m.agentId ?? "") ?? "An agent"} (agent): ${m.body}`;
    } else {
      role = "user";
      content = input.privateChatWith ? m.body : `${input.people.get(m.userId ?? "") ?? "A teammate"}: ${m.body}`;
    }
    const last = turns[turns.length - 1];
    if (last && last.role === role) last.content += `\n\n${content}`; // some providers reject two same-role turns in a row
    else turns.push({ role, content });
  }

  // Drop the oldest turns first, but always keep the latest one.
  const budget = (input.maxChars ?? DEFAULT_MAX_CHARS) - system.length;
  let total = turns.reduce((n, t) => n + t.content.length, 0);
  while (turns.length > 1 && total > budget) total -= turns.shift()!.content.length;
  // The conversation must open with a user turn.
  while (turns.length > 1 && turns[0]!.role === "assistant") turns.shift();

  return [{ role: "system", content: system }, ...turns];
}
