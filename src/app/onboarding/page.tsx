import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { OnboardingWizard, type OnboardingState } from "@/components/forms/onboarding-wizard";
import { Wordmark } from "@/components/logo";
import { db, scoped } from "@/lib/db";
import { requireUserForPage } from "@/lib/session";

export const metadata: Metadata = { title: "Set up your workspace" };

export default async function OnboardingPage() {
  const user = await requireUserForPage("/onboarding");

  // Resume a half-finished setup if there is one.
  const pending = await db.membership.findFirst({
    where: { userId: user.id, role: "OWNER", workspace: { onboardedAt: null } },
    include: { workspace: { select: { id: true, name: true, slug: true } } },
    orderBy: { createdAt: "desc" },
  });

  let initial: OnboardingState = { workspace: null, agents: [] };
  if (pending) {
    const ws = scoped(pending.workspace.id);
    const agents = await ws.agent.findMany({ orderBy: { createdAt: "asc" }, select: { key: true, name: true, role: true, color: true } });
    initial = { workspace: { id: pending.workspace.id, slug: pending.workspace.slug, name: pending.workspace.name }, agents };
  } else {
    const done = await db.membership.findFirst({ where: { userId: user.id, workspace: { onboardedAt: { not: null } } }, select: { id: true } });
    if (done) redirect("/app");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col gap-10 px-5 py-10">
      <Link href="/" aria-label="Helio home">
        <Wordmark />
      </Link>
      <OnboardingWizard key={pending?.workspace.id ?? "new"} initial={initial} />
    </main>
  );
}
