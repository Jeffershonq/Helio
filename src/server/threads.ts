import { conflict, notFound } from "@/lib/http-error";
import type { WorkspaceAccess } from "@/server/access";

const isUniqueViolation = (err: unknown) => (err as { code?: string })?.code === "P2002";

/** Loads a thread the signed-in person may see. Someone else's private agent chat is a 404. */
export async function requireThread(access: WorkspaceAccess, threadId: string) {
  const thread = await access.db.thread.findFirst({
    where: { id: threadId },
    include: { project: { select: { id: true, name: true, archivedAt: true, defaultAgentId: true } } },
  });
  if (!thread) throw notFound("Conversation not found.");
  if (thread.kind === "AGENT" && thread.userId !== access.user.id) throw notFound("Conversation not found.");
  return thread;
}
export type ThreadWithProject = Awaited<ReturnType<typeof requireThread>>;

/** The shared Team room of a project. Created on first use if it is missing. */
export async function getOrCreateTeamThread(access: WorkspaceAccess, projectId: string) {
  const project = await access.db.project.findFirst({ where: { id: projectId } });
  if (!project) throw notFound("Project not found.");
  const existing = await access.db.thread.findFirst({ where: { projectId, kind: "TEAM" } });
  if (existing) return { project, thread: existing };
  const thread = await access.db.thread.create({ data: { workspaceId: access.workspaceId, projectId, kind: "TEAM" } });
  return { project, thread };
}

/** One private chat per person per agent. */
export async function getOrCreateAgentThread(access: WorkspaceAccess, agentId: string) {
  const where = { kind: "AGENT" as const, agentId, userId: access.user.id };
  const existing = await access.db.thread.findFirst({ where });
  if (existing) return existing;
  try {
    return await access.db.thread.create({ data: { workspaceId: access.workspaceId, ...where } });
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    const raced = await access.db.thread.findFirst({ where }); // two tabs opened it at once
    if (!raced) throw conflict("Could not open this chat. Try again.");
    return raced;
  }
}
