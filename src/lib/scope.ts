/**
 * Workspace scoping for database queries.
 *
 * `applyWorkspaceScope` is a pure function so it can be unit tested without a database.
 * src/lib/db.ts wires it into a Prisma client extension: every query made through
 * `scoped(workspaceId)` is forced to that workspace, even if the caller forgets the filter.
 *
 * Callers must use Prisma's "unchecked" input style (scalar ids such as `projectId`, never
 * `project: { connect }`) for workspace-owned models. Raw SQL ($queryRaw) is not covered
 * and must not be used for workspace data.
 */

export const WORKSPACE_MODELS: ReadonlySet<string> = new Set([
  "Membership",
  "Invite",
  "Project",
  "Agent",
  "Thread",
  "Message",
  "Mention",
  "Handoff",
  "Task",
  "TaskEvent",
  "Subtask",
  "Request",
  "Run",
  "ToolCall",
  "WorkspaceFile",
  "ProviderKey",
  "UsageRecord",
  "Notification",
  "AuditLog",
]);

const FILTERED = new Set([
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "findUnique",
  "findUniqueOrThrow",
  "count",
  "aggregate",
  "groupBy",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "delete",
  "deleteMany",
]);

type Args = Record<string, any> | undefined;

function assertNotMoved(data: Record<string, any> | undefined, workspaceId: string) {
  if (!data) return;
  if ("workspace" in data) throw new Error("Scoped queries must set workspaceId directly, not via the workspace relation");
  if ("workspaceId" in data && data.workspaceId !== workspaceId) {
    throw new Error("Refusing to write a row into a different workspace");
  }
}

function withWorkspace(data: Record<string, any> | undefined, workspaceId: string) {
  assertNotMoved(data, workspaceId);
  return { ...(data ?? {}), workspaceId };
}

export function applyWorkspaceScope(model: string, operation: string, args: Args, workspaceId: string): Args {
  if (!WORKSPACE_MODELS.has(model)) return args;
  if (!workspaceId) throw new Error("workspaceId is required for scoped queries");

  const next: Record<string, any> = { ...(args ?? {}) };

  if (FILTERED.has(operation)) {
    if (operation === "update" || operation === "updateMany" || operation === "updateManyAndReturn") {
      assertNotMoved(next.data, workspaceId);
    }
    // Our filter goes last so a caller cannot override it.
    next.where = { ...(next.where ?? {}), workspaceId };
    return next;
  }

  switch (operation) {
    case "create":
      next.data = withWorkspace(next.data, workspaceId);
      return next;
    case "createMany":
    case "createManyAndReturn":
      next.data = Array.isArray(next.data)
        ? next.data.map((row: Record<string, any>) => withWorkspace(row, workspaceId))
        : withWorkspace(next.data, workspaceId);
      return next;
    case "upsert":
      assertNotMoved(next.update, workspaceId);
      next.where = { ...(next.where ?? {}), workspaceId };
      next.create = withWorkspace(next.create, workspaceId);
      return next;
    default:
      throw new Error(`Operation "${operation}" is not allowed on workspace-scoped model ${model}`);
  }
}
