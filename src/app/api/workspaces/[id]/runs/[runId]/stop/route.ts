import { getBus, threadChannel } from "@/lib/events";
import { handle, json } from "@/lib/http";
import { notFound } from "@/lib/http-error";
import { stopRun } from "@/lib/run-registry";
import { requireWorkspaceAccess } from "@/server/access";
import { requireThread } from "@/server/threads";

type P = { id: string; runId: string };

export const POST = handle<P>(async (_req, { params }) => {
  const { id, runId } = await params;
  const access = await requireWorkspaceAccess(id, "content:write");
  const run = await access.db.run.findFirst({ where: { id: runId } });
  if (!run?.threadId) throw notFound("Run not found.");
  await requireThread(access, run.threadId); // same visibility rules as the conversation

  if (!stopRun(runId) && (run.status === "QUEUED" || run.status === "RUNNING")) {
    // Nothing is running it any more (for example the server restarted): close it out.
    await access.db.run.updateMany({ where: { id: runId }, data: { status: "CANCELLED", error: "Stopped", finishedAt: new Date() } });
    await getBus().publish(threadChannel(id, run.threadId), { type: "run.status", runId, agentId: run.agentId, state: "idle" });
  }
  return json({ ok: true });
});
