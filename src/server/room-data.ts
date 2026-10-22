import { toWire } from "@/server/serialize";
import { loadMentionCandidates } from "@/server/chat-service";
import type { WorkspaceAccess } from "@/server/access";

/** Everything a chat page needs: the latest messages, the agents and the people who can be mentioned. */
export async function loadRoom(ctx: WorkspaceAccess, threadId: string) {
  const [rows, { agents, people }] = await Promise.all([
    ctx.db.message.findMany({ where: { threadId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 100 }),
    loadMentionCandidates(ctx),
  ]);
  return {
    messages: rows.reverse().map(toWire),
    agents: agents.map((a) => ({ id: a.id, key: a.key, name: a.name, role: a.role, color: a.color, enabled: a.enabled })),
    people,
  };
}
