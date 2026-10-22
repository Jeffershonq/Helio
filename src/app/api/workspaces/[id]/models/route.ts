import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { parseTierModels } from "@/lib/gateway/tiers";
import { clientIp, handle, json, parseBody } from "@/lib/http";
import { tierModelsInputSchema } from "@/lib/schemas";
import { requireWorkspaceAccess } from "@/server/access";

type P = { id: string };

/** Sets which model each tier (light, medium, heavy) uses, with an optional fallback and prices. */
export const PUT = handle<P>(async (req, { params }) => {
  const { id } = await params;
  const access = await requireWorkspaceAccess(id, "provider:manage");
  const body = await parseBody(req, tierModelsInputSchema);

  const cleaned: Record<string, unknown> = {};
  for (const tier of ["LIGHT", "MEDIUM", "HEAVY"] as const) {
    const t = body[tier];
    if (!t.model) continue; // blank means "not set"
    cleaned[tier] = {
      model: t.model,
      ...(t.fallback ? { fallback: t.fallback } : {}),
      ...(t.inputPerMTok != null ? { inputPerMTok: t.inputPerMTok } : {}),
      ...(t.outputPerMTok != null ? { outputPerMTok: t.outputPerMTok } : {}),
    };
  }
  const tierModels = parseTierModels(cleaned);
  await db.workspace.update({ where: { id }, data: { tierModels: tierModels as object } });
  await audit(id, "models.set", { actorUserId: access.user.id, metadata: { tiers: Object.keys(tierModels) }, ip: clientIp(req) });
  return json({ tierModels });
});
