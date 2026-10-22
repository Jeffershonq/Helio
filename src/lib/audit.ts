import { scoped } from "@/lib/db";

/** Records a sensitive action. Never put secrets or key material in `metadata`. */
export async function audit(
  workspaceId: string,
  action: string,
  opts: { actorUserId?: string; targetType?: string; targetId?: string; metadata?: Record<string, unknown>; ip?: string } = {},
) {
  await scoped(workspaceId).auditLog.create({
    data: {
      workspaceId,
      action,
      actorUserId: opts.actorUserId,
      targetType: opts.targetType,
      targetId: opts.targetId,
      metadata: opts.metadata as object | undefined,
      ip: opts.ip,
    },
  });
}
