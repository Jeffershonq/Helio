import { handle, json, parseBody } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { messageSchema } from "@/lib/schemas";
import { requireWorkspaceAccess } from "@/server/access";
import { postHumanMessage } from "@/server/chat-service";
import { toWire } from "@/server/serialize";
import { requireThread } from "@/server/threads";

type P = { id: string; threadId: string };

/** Latest messages of a conversation, oldest first. The browser uses this to catch up after a reconnect. */
export const GET = handle<P>(async (_req, { params }) => {
  const { id, threadId } = await params;
  const access = await requireWorkspaceAccess(id, "workspace:read");
  const thread = await requireThread(access, threadId);
  const rows = await access.db.message.findMany({ where: { threadId: thread.id }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 100 });
  return json({ messages: rows.reverse().map(toWire) });
});

export const POST = handle<P>(async (req, { params }) => {
  const { id, threadId } = await params;
  const access = await requireWorkspaceAccess(id, "content:write"); // viewers are read-only
  const thread = await requireThread(access, threadId);
  await enforceRateLimit(`chat:user:${access.user.id}`, 30, 60);
  await enforceRateLimit(`chat:workspace:${id}`, 120, 60);
  const body = await parseBody(req, messageSchema);
  return json(await postHumanMessage(access, thread, body), { status: 201 });
});
