import { db, scoped } from "@/lib/db";
import { forbidden, notFound, unauthorized } from "@/lib/http-error";
import { can, type Permission } from "@/lib/rbac";
import { getSession } from "@/lib/session";

/**
 * The single gate for every workspace API route.
 * Checks: signed in, email verified, member of this workspace, and role allows the permission.
 * Non-members get a 404 so workspace ids cannot be probed.
 */
export async function requireWorkspaceAccess(workspaceId: string, permission: Permission) {
  const auth = await getSession();
  if (!auth) throw unauthorized();
  if (!auth.user.emailVerifiedAt) throw forbidden("Confirm your email first.");
  const membership = await db.membership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: auth.user.id } },
  });
  if (!membership) throw notFound("Workspace not found.");
  if (!can(membership.role, permission)) throw forbidden("Your role cannot do this.");
  return { user: auth.user, role: membership.role, workspaceId, db: scoped(workspaceId) };
}

export type WorkspaceAccess = Awaited<ReturnType<typeof requireWorkspaceAccess>>;
