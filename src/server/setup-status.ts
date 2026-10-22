import { db, scoped } from "@/lib/db";
import { parseTierModels } from "@/lib/gateway/tiers";
import { TIERS, type Tier } from "@/lib/gateway/types";
import { platformConfig } from "@/lib/platform";

/** What still stops agents from answering, in terms people can act on. */
export async function getSetupStatus(workspaceId: string) {
  const [ws, keys] = await Promise.all([
    db.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { providerMode: true, fallbackToPlatform: true, tierModels: true } }),
    scoped(workspaceId).providerKey.count(),
  ]);
  const platform = platformConfig();
  const ownTiers = parseTierModels(ws.tierModels);
  const usingOwn = ws.providerMode === "OWN" && keys > 0;
  const missingTiers: Tier[] = TIERS.filter((t) => !(usingOwn && ownTiers[t]) && !platform?.tiers[t]);
  return {
    mode: ws.providerMode,
    fallbackToPlatform: ws.fallbackToPlatform,
    platformEnabled: Boolean(platform),
    platformTiers: platform ? TIERS.filter((t) => platform.tiers[t]) : [],
    hasOwnKey: keys > 0,
    ownTiers,
    missingTiers,
  };
}
