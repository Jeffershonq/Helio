import { decryptSecret } from "@/lib/crypto";
import { db, scoped } from "@/lib/db";
import { env } from "@/lib/env";
import { buildRoutes, type Route } from "@/lib/gateway/routes";
import { parseTierModels } from "@/lib/gateway/tiers";
import type { GatewayConfig, Tier } from "@/lib/gateway/types";
import { platformConfig } from "@/lib/platform";
import { assertSafeProviderUrl } from "@/lib/provider-url";

/** The workspace's own provider (its saved API key), or null when it has none. */
export async function loadOwnProvider(workspaceId: string): Promise<{ baseUrl: string; apiKey: string } | null> {
  const key = await scoped(workspaceId).providerKey.findFirst({ orderBy: { createdAt: "asc" } });
  if (!key) return null;
  try {
    // Checked again on every use, in case DNS changed since the key was saved.
    await assertSafeProviderUrl(key.baseUrl, { allowPrivate: env().ALLOW_PRIVATE_PROVIDER_URLS });
  } catch {
    console.warn(`workspace ${workspaceId}: saved provider address is not allowed, ignoring the own key`);
    return null;
  }
  return { baseUrl: key.baseUrl, apiKey: decryptSecret(key.encryptedKey, workspaceId) };
}

async function loadOwnConfig(workspaceId: string, tierModels: unknown): Promise<GatewayConfig | null> {
  const own = await loadOwnProvider(workspaceId);
  return own ? { ...own, tiers: parseTierModels(tierModels) } : null;
}

/** The providers an agent of this tier may use right now, in order. Throws a plain-language error if none. */
export async function resolveRoutes(workspaceId: string, tier: Tier): Promise<Route[]> {
  const ws = await db.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    select: { providerMode: true, fallbackToPlatform: true, tierModels: true },
  });
  const own = ws.providerMode === "OWN" ? await loadOwnConfig(workspaceId, ws.tierModels) : null;
  return buildRoutes({ mode: ws.providerMode, fallbackToPlatform: ws.fallbackToPlatform, tier, own, platform: platformConfig() });
}
