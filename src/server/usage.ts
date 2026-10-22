import { db, scoped } from "@/lib/db";
import { env } from "@/lib/env";
import { effectiveLimit, evaluateLimits, startOfUtcDay, type LimitVerdict } from "@/lib/limits";

const STALE_RUN_MS = 15 * 60_000;

/** Tokens used on the shared provider today. Usage through a workspace's own key is not counted. */
async function sharedTokensSince(workspaceId: string, since: Date, userId?: string): Promise<number> {
  const sum = await scoped(workspaceId).usageRecord.aggregate({
    where: { createdAt: { gte: since }, source: "PLATFORM", ...(userId ? { userId } : {}) },
    _sum: { inputTokens: true, outputTokens: true },
  });
  return (sum._sum.inputTokens ?? 0) + (sum._sum.outputTokens ?? 0);
}

/** How many runs may work at once in a workspace. Applies to every run, whichever provider it uses. */
export async function checkConcurrency(workspaceId: string, selfRunId: string): Promise<LimitVerdict> {
  const ws = scoped(workspaceId);
  // A run that never finished (server restarted) must not block the workspace forever.
  await ws.run.updateMany({
    where: { status: { in: ["QUEUED", "RUNNING"] }, createdAt: { lt: new Date(Date.now() - STALE_RUN_MS) } },
    data: { status: "FAILED", error: "Timed out", finishedAt: new Date() },
  });
  const settings = await db.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { maxConcurrentRuns: true } });
  const otherActiveRuns = await ws.run.count({ where: { status: "RUNNING", NOT: { id: selfRunId } } });
  return evaluateLimits({ userTokensToday: 0, workspaceTokensToday: 0, otherActiveRuns, limits: { maxConcurrent: settings.maxConcurrentRuns } });
}

/** Daily token limits on the shared provider. Only checked for runs that are about to use it. */
export async function checkSharedQuota(workspaceId: string, userId: string): Promise<LimitVerdict> {
  const ws = await db.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    select: { dailyTokenLimitUser: true, dailyTokenLimitWorkspace: true },
  });
  const limits = {
    user: effectiveLimit(ws.dailyTokenLimitUser, env().PLATFORM_DAILY_TOKENS_USER),
    workspace: effectiveLimit(ws.dailyTokenLimitWorkspace, env().PLATFORM_DAILY_TOKENS_WORKSPACE),
    maxConcurrent: Number.MAX_SAFE_INTEGER,
  };
  if (limits.user === null && limits.workspace === null) return { ok: true };
  const day = startOfUtcDay();
  const [userTokensToday, workspaceTokensToday] = await Promise.all([sharedTokensSince(workspaceId, day, userId), sharedTokensSince(workspaceId, day)]);
  return evaluateLimits({ userTokensToday, workspaceTokensToday, otherActiveRuns: 0, limits });
}

export async function recordUsage(input: {
  workspaceId: string;
  userId: string;
  agentId: string;
  runId: string;
  model: string;
  source: "OWN" | "PLATFORM";
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}) {
  const { workspaceId, ...rest } = input;
  await scoped(workspaceId).usageRecord.create({ data: { workspaceId, ...rest } });
}
