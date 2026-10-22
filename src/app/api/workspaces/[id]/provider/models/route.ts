import { handle, json } from "@/lib/http";
import { testProviderConnection } from "@/lib/provider";
import { enforceRateLimit } from "@/lib/rate-limit";
import { requireWorkspaceAccess } from "@/server/access";
import { loadOwnProvider } from "@/server/gateway-config";

type P = { id: string };

/** Lists the models offered by the workspace's own provider, to help fill in the tier mapping. */
export const GET = handle<P>(async (_req, { params }) => {
  const { id } = await params;
  const access = await requireWorkspaceAccess(id, "provider:manage");
  await enforceRateLimit(`provider:models:${access.user.id}`, 20, 600);
  const own = await loadOwnProvider(id);
  if (!own) return json({ ok: false, message: "Add your own API key first.", models: [] });
  const result = await testProviderConnection(own.baseUrl, own.apiKey);
  return json({ ok: result.ok, message: result.message, models: result.models ?? [] });
});
