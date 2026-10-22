import type { Metadata } from "next";
import { ProviderSettings } from "@/components/forms/provider-settings";
import { can } from "@/lib/rbac";
import { getSetupStatus } from "@/server/setup-status";
import { getWorkspaceForPage } from "@/server/workspace-page";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await getWorkspaceForPage(slug);

  if (!can(ctx.role, "provider:manage")) {
    return (
      <div className="max-w-md space-y-2 p-6 md:p-10">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted">Only owners and admins can change the model provider.</p>
      </div>
    );
  }

  const [status, key, agents] = await Promise.all([
    getSetupStatus(ctx.workspaceId),
    ctx.db.providerKey.findFirst({ orderBy: { createdAt: "asc" }, select: { baseUrl: true, last4: true } }),
    ctx.db.agent.findMany({ orderBy: { createdAt: "asc" }, select: { name: true, tier: true } }),
  ]);
  const usedBy = { LIGHT: [] as string[], MEDIUM: [] as string[], HEAVY: [] as string[] };
  for (const a of agents) usedBy[a.tier].push(a.name);

  return (
    <div className="space-y-6 p-6 md:p-10">
      <header className="space-y-1">
        <p className="font-mono text-xs text-muted">Workspace</p>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      </header>
      <ProviderSettings
        workspaceId={ctx.workspaceId}
        mode={status.mode}
        fallbackToPlatform={status.fallbackToPlatform}
        platformEnabled={status.platformEnabled}
        own={key}
        ownTiers={status.ownTiers}
        usedBy={usedBy}
      />
    </div>
  );
}
