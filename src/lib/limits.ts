export interface LimitInputs {
  userTokensToday: number;
  workspaceTokensToday: number;
  /** Runs that are working right now, not counting the one being checked. */
  otherActiveRuns: number;
  limits: { user?: number | null; workspace?: number | null; maxConcurrent: number };
}

const TOKEN_NOTE = "An admin can add an own API key in Settings, or runs start again at 00:00 UTC.";

export type LimitVerdict = { ok: true } | { ok: false; reason: string };

/** A limit saved on the workspace wins (0 = unlimited). Otherwise the install default applies (0 = unlimited). */
export function effectiveLimit(workspaceValue: number | null | undefined, installDefault: number): number | null {
  const value = workspaceValue ?? installDefault;
  return value > 0 ? value : null;
}

export const startOfUtcDay = (now = new Date()) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

const fmt = (n: number) => n.toLocaleString("en-US");

/** Decides whether a run may start. The reason is written for the person who sees it in the chat. */
export function evaluateLimits(i: LimitInputs): LimitVerdict {
  const { limits } = i;
  if (limits.workspace != null && i.workspaceTokensToday >= limits.workspace) {
    return { ok: false, reason: `This workspace has used its daily limit of ${fmt(limits.workspace)} tokens on the shared provider. ${TOKEN_NOTE}` };
  }
  if (limits.user != null && i.userTokensToday >= limits.user) {
    return { ok: false, reason: `You have used your daily limit of ${fmt(limits.user)} tokens on the shared provider. ${TOKEN_NOTE}` };
  }
  if (i.otherActiveRuns >= limits.maxConcurrent) {
    return { ok: false, reason: `${limits.maxConcurrent} agent runs are already working. Try again when one finishes.` };
  }
  return { ok: true };
}
