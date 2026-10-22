import { notFound } from "next/navigation";
import { cache } from "react";
import { db, scoped } from "@/lib/db";
import { requireUserForPage } from "@/lib/session";

/** Loads the signed-in user's view of a workspace for pages. Non-members get a 404. */
export const getWorkspaceForPage = cache(async (slug: string) => {
  const user = await requireUserForPage(`/w/${slug}`);
  const membership = await db.membership.findFirst({
    where: { userId: user.id, workspace: { slug } },
    include: { workspace: { select: { id: true, name: true, slug: true, onboardedAt: true } } },
  });
  if (!membership) notFound();
  return { user, role: membership.role, workspace: membership.workspace, workspaceId: membership.workspace.id, db: scoped(membership.workspace.id) };
});
