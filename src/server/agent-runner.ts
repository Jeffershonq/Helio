import type { AgentState, ChatEvent } from "@/lib/chat-types";
import { buildContext } from "@/lib/context";
import { scoped } from "@/lib/db";
import { getBus, threadChannel, type EventBus } from "@/lib/events";
import { estimateCostUsd } from "@/lib/gateway/tiers";
import { streamWithRoutes, type Route, type Source } from "@/lib/gateway/routes";
import { GatewayError, type ChatMessage } from "@/lib/gateway/types";
import { parseMentions, uniqueIds } from "@/lib/mentions";
import { rateLimit } from "@/lib/rate-limit";
import { registerRun, unregisterRun } from "@/lib/run-registry";
import { resolveRoutes } from "@/server/gateway-config";
import { toWire } from "@/server/serialize";
import { checkConcurrency, checkSharedQuota, recordUsage } from "@/server/usage";

// Loop guard: an agent can pass work to another agent, but only this many times in a row,
// and only this many runs per human message. (Phase 4 turns the stop into a "Needs you" request.)
export const MAX_HOPS = 6;
const MAX_RUNS_PER_ROOT = 12;
const FLUSH_MS = 1000; // how often the growing answer is saved while it streams
const MAX_OUTPUT_TOKENS = 4096;

export interface RunJob {
  workspaceId: string;
  threadId: string;
  agentId: string;
  runId: string;
  userId: string; // the person whose message started this chain (their limits apply)
  hop: number; // 1 = started by a human, 2+ = passed on by another agent
  rootMessageId: string; // the human message that started the chain
  triggerMessageId: string;
}

interface Deps {
  bus?: EventBus;
  stream?: typeof streamWithRoutes;
}

/**
 * Creates the Run row and starts it. Phase 3 replaces the body of this function with a queue job
 * and a worker process; `runAgentTurn` stays the same.
 */
export async function enqueueRun(input: Omit<RunJob, "runId">): Promise<string> {
  const run = await scoped(input.workspaceId).run.create({
    data: {
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      threadId: input.threadId,
      trigger: input.hop === 1 ? "mention" : "handoff",
      status: "QUEUED",
      state: { hop: input.hop, rootMessageId: input.rootMessageId, triggerMessageId: input.triggerMessageId, userId: input.userId },
    },
  });
  void runAgentTurn({ ...input, runId: run.id }).catch((err) => console.error("agent run crashed", run.id, err));
  return run.id;
}

export async function runAgentTurn(job: RunJob, deps: Deps = {}): Promise<void> {
  const bus = deps.bus ?? getBus();
  const stream = deps.stream ?? streamWithRoutes;
  const ws = scoped(job.workspaceId);
  const channel = threadChannel(job.workspaceId, job.threadId);
  const publish = (e: ChatEvent) => bus.publish(channel, e).catch((err) => console.error("publish failed", (err as Error).message));
  const status = (state: AgentState, error?: string) => publish({ type: "run.status", runId: job.runId, agentId: job.agentId, state, error });
  const postSystem = async (body: string) => {
    const m = await ws.message.create({ data: { workspaceId: job.workspaceId, threadId: job.threadId, authorKind: "SYSTEM", body } });
    await publish({ type: "message.created", message: toWire(m) });
  };

  const controller = new AbortController();
  registerRun(job.runId, controller);

  let agentName = "The agent";
  let messageId: string | undefined;
  let prompt: ChatMessage[] = [];
  let text = "";
  let usedSource: Source = "PLATFORM";
  let meta: Record<string, unknown> = { runId: job.runId, hop: job.hop, rootMessageId: job.rootMessageId };

  try {
    const agent = await ws.agent.findFirst({ where: { id: job.agentId } });
    if (!agent || !agent.enabled) {
      await ws.run.update({ where: { id: job.runId }, data: { status: "CANCELLED", error: "Agent is switched off", finishedAt: new Date() } });
      await status("idle");
      return;
    }
    agentName = agent.name;
    await status("thinking");

    const verdict = await checkConcurrency(job.workspaceId, job.runId);
    if (!verdict.ok) {
      await ws.run.update({ where: { id: job.runId }, data: { status: "LIMITED", error: verdict.reason, finishedAt: new Date() } });
      await postSystem(`${agent.name} did not start. ${verdict.reason}`);
      await status("idle");
      return;
    }

    await ws.run.update({ where: { id: job.runId }, data: { status: "RUNNING", startedAt: new Date() } });
    const routes = await resolveRoutes(job.workspaceId, agent.tier);
    prompt = await loadPrompt(job, agent);

    const created = await ws.message.create({
      data: { workspaceId: job.workspaceId, threadId: job.threadId, authorKind: "AGENT", agentId: agent.id, body: "", metadata: { ...meta, streaming: true } },
    });
    messageId = created.id;
    await publish({ type: "message.created", message: toWire(created) });

    let done: { model: string; inputTokens: number; outputTokens: number } | undefined;
    let flushedAt = Date.now();
    let first = true;
    // Daily token limits only protect the shared provider. A run on the workspace's own key skips them.
    const beforeRoute = async (route: Route) => {
      if (route.source !== "PLATFORM") return undefined;
      const quota = await checkSharedQuota(job.workspaceId, job.userId);
      return quota.ok ? undefined : quota.reason;
    };
    for await (const ev of stream(routes, agent.tier, prompt, { signal: controller.signal, maxTokens: MAX_OUTPUT_TOKENS, beforeRoute })) {
      if (ev.type === "route") {
        usedSource = ev.source;
        continue;
      }
      if (ev.type === "delta") {
        if (first) {
          first = false;
          await status("working");
        }
        await publish({ type: "message.delta", messageId, offset: text.length, text: ev.text });
        text += ev.text;
        if (Date.now() - flushedAt > FLUSH_MS) {
          flushedAt = Date.now();
          await ws.message.update({ where: { id: messageId }, data: { body: text } });
        }
      } else {
        done = ev;
      }
    }
    if (!text.trim() || !done) throw new GatewayError("unavailable", "The model sent an empty answer.", true);

    const finalMessage = await ws.message.update({ where: { id: messageId }, data: { body: text, metadata: { ...meta, streaming: false } } });
    const costUsd = estimateCostUsd(routes.find((r) => r.source === usedSource)?.cfg.tiers[agent.tier], done.inputTokens, done.outputTokens);
    await recordUsage({ workspaceId: job.workspaceId, userId: job.userId, agentId: agent.id, runId: job.runId, model: done.model, source: usedSource, inputTokens: done.inputTokens, outputTokens: done.outputTokens, costUsd });
    await ws.run.update({
      where: { id: job.runId },
      data: { status: "SUCCEEDED", inputTokens: done.inputTokens, outputTokens: done.outputTokens, costUsd, finishedAt: new Date() },
    });
    await publish({ type: "message.done", message: toWire(finalMessage) });
    await status("idle");
    await handOff(job, agent.id, messageId, text, postSystem);
  } catch (err) {
    const e = err instanceof GatewayError ? err : new GatewayError("unavailable", "Something went wrong while running this agent.");
    if (!(err instanceof GatewayError)) console.error("agent run failed", job.runId, err);
    const stopped = e.code === "aborted";
    const limited = e.code === "limited";

    if (messageId) {
      if (text.trim()) {
        const kept = await ws.message.update({
          where: { id: messageId },
          data: { body: text, metadata: { ...meta, streaming: false, ...(stopped ? { stopped: true } : { error: e.message }) } },
        });
        await publish({ type: "message.done", message: toWire(kept) });
        // Work that was streamed still cost money, so count an estimate against the limits.
        const inputTokens = Math.ceil(prompt.reduce((n, m) => n + m.content.length, 0) / 4);
        const outputTokens = Math.ceil(text.length / 4);
        await recordUsage({ workspaceId: job.workspaceId, userId: job.userId, agentId: job.agentId, runId: job.runId, model: "unknown (stopped)", source: usedSource, inputTokens, outputTokens, costUsd: 0 }).catch(() => {});
      } else {
        await ws.message.deleteMany({ where: { id: messageId } });
        await publish({ type: "message.removed", messageId });
      }
    }
    await ws.run
      .update({ where: { id: job.runId }, data: { status: stopped ? "CANCELLED" : limited ? "LIMITED" : "FAILED", error: e.message, finishedAt: new Date() } })
      .catch(() => {});
    if (limited) await postSystem(`${agentName} did not start. ${e.message}`).catch(() => {});
    else if (!stopped) await postSystem(`${agentName} could not answer. ${e.message}`).catch(() => {});
    await status(stopped || limited ? "idle" : "error", stopped || limited ? undefined : e.message);
  } finally {
    unregisterRun(job.runId);
  }
}

async function loadPrompt(job: RunJob, agent: { id: string; name: string; role: string; soul: string }): Promise<ChatMessage[]> {
  const ws = scoped(job.workspaceId);
  const [thread, agents, members, recent] = await Promise.all([
    ws.thread.findFirst({ where: { id: job.threadId }, include: { project: { select: { name: true, description: true } } } }),
    ws.agent.findMany({ select: { id: true, name: true, role: true } }),
    ws.membership.findMany({ include: { user: { select: { id: true, name: true } } } }),
    ws.message.findMany({ where: { threadId: job.threadId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 40 }),
  ]);
  const people = new Map(members.map((m) => [m.user.id, m.user.name]));
  return buildContext({
    soul: agent.soul,
    self: agent,
    teammates: agents.filter((a) => a.id !== agent.id),
    people,
    project: thread?.project ?? null,
    privateChatWith: thread?.kind === "AGENT" && thread.userId ? people.get(thread.userId) : undefined,
    messages: recent.reverse(),
  });
}

/** If the agent's answer @mentions another agent, start that agent too (within the loop guard). */
async function handOff(job: RunJob, selfId: string, messageId: string, text: string, postSystem: (body: string) => Promise<void>) {
  const others = await scoped(job.workspaceId).agent.findMany({ where: { enabled: true, NOT: { id: selfId } }, select: { id: true, name: true } });
  const targets = uniqueIds(parseMentions(text, others.map((a) => ({ kind: "agent" as const, id: a.id, label: a.name }))), "agent").slice(0, 2);
  if (!targets.length) return;

  const hop = job.hop + 1;
  if (hop > MAX_HOPS) {
    await postSystem(`I stopped after ${MAX_HOPS} hand-offs between agents so they cannot loop. Tell the team how you want to continue.`);
    return;
  }
  for (const agentId of targets) {
    const gate = await rateLimit(`root:${job.rootMessageId}`, MAX_RUNS_PER_ROOT, 3600);
    if (!gate.ok) {
      await postSystem("Too many agent runs came from one message, so I stopped. Tell the team how you want to continue.");
      return;
    }
    await enqueueRun({ ...job, agentId, hop, triggerMessageId: messageId });
  }
}
