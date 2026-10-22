import { getBus, threadChannel } from "@/lib/events";
import { badRequest, conflict } from "@/lib/http-error";
import { parseMentions, uniqueIds, type MentionCandidate } from "@/lib/mentions";
import type { WorkspaceAccess } from "@/server/access";
import { enqueueRun } from "@/server/agent-runner";
import { toWire } from "@/server/serialize";
import type { ThreadWithProject } from "@/server/threads";

const MAX_AGENTS_PER_MESSAGE = 3;

/** The names people can @mention in this workspace: agents (current names) and members. */
export async function loadMentionCandidates(access: WorkspaceAccess) {
  const [agents, members] = await Promise.all([
    access.db.agent.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, key: true, name: true, role: true, color: true, enabled: true } }),
    access.db.membership.findMany({ orderBy: { createdAt: "asc" }, include: { user: { select: { id: true, name: true } } } }),
  ]);
  const people = members.map((m) => ({ id: m.user.id, name: m.user.name }));
  const candidates: MentionCandidate[] = [
    ...agents.filter((a) => a.enabled).map((a) => ({ kind: "agent" as const, id: a.id, label: a.name })),
    ...people.map((p) => ({ kind: "user" as const, id: p.id, label: p.name })),
  ];
  return { agents, people, candidates };
}

/**
 * Saves a human message, records its mentions, and starts the agents that should answer:
 *  - private agent chat: that agent always answers
 *  - team room: every @mentioned agent; with no mention at all, the project's default agent
 *  - a message that only mentions people goes to those people, and no agent answers
 */
export async function postHumanMessage(access: WorkspaceAccess, thread: ThreadWithProject, input: { body: string; replyToId?: string }) {
  if (thread.project?.archivedAt) throw conflict("This project is archived. Restore it to keep chatting.");
  if (input.replyToId) {
    const parent = await access.db.message.findFirst({ where: { id: input.replyToId, threadId: thread.id }, select: { id: true } });
    if (!parent) throw badRequest("The message you are replying to was not found.");
  }

  const { agents, candidates } = await loadMentionCandidates(access);
  const matches = parseMentions(input.body, candidates);
  const mentionedAgents = uniqueIds(matches, "agent");
  const mentionedPeople = uniqueIds(matches, "user");

  let wanted: string[];
  if (thread.kind === "AGENT") wanted = thread.agentId ? [thread.agentId] : [];
  else if (mentionedAgents.length) wanted = mentionedAgents;
  else if (mentionedPeople.length) wanted = [];
  else wanted = thread.project?.defaultAgentId ? [thread.project.defaultAgentId] : [];

  const active = new Set(agents.filter((a) => a.enabled).map((a) => a.id));
  const targets = wanted.filter((id) => active.has(id)).slice(0, MAX_AGENTS_PER_MESSAGE);
  const switchedOff = agents.filter((a) => wanted.includes(a.id) && !a.enabled);

  const message = await access.db.message.create({
    data: { workspaceId: access.workspaceId, threadId: thread.id, authorKind: "HUMAN", userId: access.user.id, body: input.body, replyToId: input.replyToId ?? null },
  });
  const seen = new Set<string>();
  const mentionRows = matches
    .filter((m) => !seen.has(`${m.kind}:${m.id}`) && seen.add(`${m.kind}:${m.id}`))
    .map((m) => ({ workspaceId: access.workspaceId, messageId: message.id, agentId: m.kind === "agent" ? m.id : null, userId: m.kind === "user" ? m.id : null }));
  if (mentionRows.length) await access.db.mention.createMany({ data: mentionRows });

  const bus = getBus();
  const channel = threadChannel(access.workspaceId, thread.id);
  await bus.publish(channel, { type: "message.created", message: toWire(message) });

  for (const a of switchedOff) {
    const note = await access.db.message.create({
      data: { workspaceId: access.workspaceId, threadId: thread.id, authorKind: "SYSTEM", body: `${a.name} is switched off, so ${a.name} did not answer.` },
    });
    await bus.publish(channel, { type: "message.created", message: toWire(note) });
  }

  const runs: { agentId: string; runId: string }[] = [];
  for (const agentId of targets) {
    const runId = await enqueueRun({
      workspaceId: access.workspaceId,
      threadId: thread.id,
      agentId,
      userId: access.user.id,
      hop: 1,
      rootMessageId: message.id,
      triggerMessageId: message.id,
    });
    runs.push({ agentId, runId });
  }
  return { message: toWire(message), runs };
}
