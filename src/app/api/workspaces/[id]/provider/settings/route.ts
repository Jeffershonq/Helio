import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { badRequest } from "@/lib/http-error";
import { clientIp, handle, json, parseBody } from "@/lib/http";
import { platformConfig } from "@/lib/platform";
import { providerSettingsSchema } from "@/lib/schemas";
import { requireWorkspaceAccess } from "@/server/access";

type P = { id: string };

/** Switch between the shared provider and the workspace's own key, and choose whether the shared one is the backup. */
export const PATCH = handle<P>(async (req, { params }) => {
  const { id } = await params;
  const access = await requireWorkspaceAccess(id, "provider:manage");
  const body = await parseBody(req, providerSettingsSchema);

  if (body.mode === "OWN" && (await access.db.providerKey.count()) === 0) throw badRequest("Save your own API key first.");
  if (body.mode === "PLATFORM" && !platformConfig()) throw badRequest("This Helio install has no shared provider. Keep using your own key.");

  await db.workspace.update({ where: { id }, data: { ...(body.mode ? { providerMode: body.mode } : {}), ...(body.fallbackToPlatform !== undefined ? { fallbackToPlatform: body.fallbackToPlatform } : {}) } });
  await audit(id, "provider.settings", { actorUserId: access.user.id, metadata: body, ip: clientIp(req) });
  return json({ ok: true });
});
