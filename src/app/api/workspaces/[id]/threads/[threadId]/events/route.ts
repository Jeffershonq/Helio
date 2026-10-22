import { getBus, threadChannel } from "@/lib/events";
import { handle } from "@/lib/http";
import { requireWorkspaceAccess } from "@/server/access";
import { requireThread } from "@/server/threads";

export const dynamic = "force-dynamic";

type P = { id: string; threadId: string };

/**
 * Live events for one conversation (Server-Sent Events).
 * Access is checked first, and the channel name is built from the verified workspace and thread ids,
 * so a person can never listen to a conversation they cannot open.
 */
export const GET = handle<P>(async (req, { params }) => {
  const { id, threadId } = await params;
  const access = await requireWorkspaceAccess(id, "workspace:read");
  const thread = await requireThread(access, threadId);
  const encoder = new TextEncoder();

  let close = async () => {};
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (chunk: string) => {
        if (!closed) controller.enqueue(encoder.encode(chunk));
      };
      const unsubscribe = await getBus().subscribe(threadChannel(access.workspaceId, thread.id), (e) => send(`data: ${JSON.stringify(e)}\n\n`));
      const heartbeat = setInterval(() => send(": ping\n\n"), 20_000);
      close = async () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        await unsubscribe();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      req.signal.addEventListener("abort", () => void close());
      // Tells the browser the subscription is live, so it can safely load the current messages.
      send(`retry: 3000\ndata: ${JSON.stringify({ type: "ready" })}\n\n`);
    },
    cancel: () => close(),
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" },
  });
});
