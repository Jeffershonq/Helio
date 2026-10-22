import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUserForPage } from "@/lib/session";

/** Front door after sign-in: sends people to their workspace, or to setup if they have none yet. */
export default async function AppEntry() {
  const user = await requireUserForPage("/app");
  const ready = await db.membership.findFirst({
    where: { userId: user.id, workspace: { onboardedAt: { not: null } } },
    include: { workspace: { select: { slug: true } } },
    orderBy: { createdAt: "asc" },
  });
  redirect(ready ? `/w/${ready.workspace.slug}` : "/onboarding");
}
