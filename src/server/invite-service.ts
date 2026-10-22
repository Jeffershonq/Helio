import { randomToken, sha256Hex } from "@/lib/crypto";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { conflict, forbidden, notFound } from "@/lib/http-error";
import { emails, sendMail } from "@/lib/mail";
import { canAssignRole, type Role } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import type { WorkspaceAccess } from "@/server/access";

const INVITE_TTL_MS = 7 * 86_400_000;

export async function createInvite(access: WorkspaceAccess, input: { email: string; role: Exclude<Role, "OWNER"> }, ip?: string) {
  if (!canAssignRole(access.role, input.role)) throw forbidden("Your role cannot invite people with that role.");

  const existingUser = await db.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (existingUser) {
    const already = await access.db.membership.findFirst({ where: { userId: existingUser.id } });
    if (already) throw conflict("That person is already in this workspace.", { email: ["Already a member"] });
  }

  // A new invite replaces any pending one for the same address.
  await access.db.invite.updateMany({
    where: { email: input.email, acceptedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  const token = randomToken(32);
  const invite = await access.db.invite.create({
    data: {
      workspaceId: access.workspaceId,
      email: input.email,
      role: input.role,
      tokenHash: sha256Hex(token),
      invitedById: access.user.id,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    },
  });
  const workspace = await db.workspace.findUniqueOrThrow({ where: { id: access.workspaceId }, select: { name: true } });
  await sendMail({
    to: input.email,
    ...emails.invite(access.user.name, workspace.name, input.role, `${env().APP_URL}/invite/${token}`),
  });
  await audit(access.workspaceId, "invite.create", {
    actorUserId: access.user.id,
    targetType: "Invite",
    targetId: invite.id,
    metadata: { role: input.role },
    ip,
  });
  return { id: invite.id, email: invite.email, role: invite.role, expiresAt: invite.expiresAt };
}

export type InviteState = "valid" | "expired" | "used" | "revoked" | "invalid";

/** Looks an invite up by its raw token. Invite rows are workspace-owned, so this is a deliberate unscoped read. */
export async function lookupInvite(token: string) {
  const invite = await db.invite.findUnique({
    where: { tokenHash: sha256Hex(token) },
    include: { workspace: { select: { id: true, name: true, slug: true } } },
  });
  if (!invite) return { state: "invalid" as InviteState };
  const inviter = await db.user.findUnique({ where: { id: invite.invitedById }, select: { name: true } });
  let state: InviteState = "valid";
  if (invite.revokedAt) state = "revoked";
  else if (invite.acceptedAt) state = "used";
  else if (invite.expiresAt < new Date()) state = "expired";
  return { state, invite, inviterName: inviter?.name ?? "A teammate" };
}

export async function acceptInvite(user: { id: string; email: string; emailVerifiedAt: Date | null }, token: string, ip?: string) {
  if (!user.emailVerifiedAt) throw forbidden("Confirm your email first.");
  const found = await lookupInvite(token);
  if (found.state === "invalid" || !found.invite) throw notFound("This invite link is not valid.");
  if (found.state !== "valid") throw conflict("This invite is no longer active.");
  const { invite } = found;
  if (invite.email !== user.email.toLowerCase()) {
    throw forbidden(`This invite was sent to a different email address. Sign in with ${maskEmail(invite.email)}.`);
  }

  // Claim the invite atomically so two tabs cannot both use it.
  const claimed = await db.invite.updateMany({ where: { id: invite.id, acceptedAt: null, revokedAt: null }, data: { acceptedAt: new Date() } });
  if (claimed.count !== 1) throw conflict("This invite is no longer active.");

  await db.membership.upsert({
    where: { workspaceId_userId: { workspaceId: invite.workspaceId, userId: user.id } },
    update: {}, // already a member: keep the current role
    create: { workspaceId: invite.workspaceId, userId: user.id, role: invite.role },
  });
  await audit(invite.workspaceId, "invite.accept", { actorUserId: user.id, targetType: "Invite", targetId: invite.id, ip });
  return { slug: invite.workspace.slug };
}

export function maskEmail(email: string): string {
  const [name = "", domain = ""] = email.split("@");
  return `${name.slice(0, 1)}***@${domain}`;
}
