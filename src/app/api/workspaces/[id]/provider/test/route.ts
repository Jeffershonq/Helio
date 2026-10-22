import { handle, json, parseBody } from "@/lib/http";
import { testProviderConnection } from "@/lib/provider";
import { enforceRateLimit } from "@/lib/rate-limit";
import { providerTestSchema } from "@/lib/schemas";
import { requireWorkspaceAccess } from "@/server/access";

type P = { id: string };

export const POST = handle<P>(async (req, { params }) => {
  const { id } = await params;
  const access = await requireWorkspaceAccess(id, "provider:manage");
  await enforceRateLimit(`provider:test:${access.user.id}`, 10, 600);
  const body = await parseBody(req, providerTestSchema);
  return json(await testProviderConnection(body.baseUrl, body.apiKey));
});
