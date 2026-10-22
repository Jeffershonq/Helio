import { audit } from "@/lib/audit";
import { encryptSecret, last4 } from "@/lib/crypto";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { clientIp, handle, json, parseBody } from "@/lib/http";
import { assertSafeProviderUrl } from "@/lib/provider-url";
import { providerSchema } from "@/lib/schemas";
import { requireWorkspaceAccess } from "@/server/access";

type P = { id: string };

/** Saves (or rotates) the workspace's own API key. The key is encrypted and is never sent back to the browser. */
export const PUT = handle<P>(async (req, { params }) => {
  const { id } = await params;
  const access = await requireWorkspaceAccess(id, "provider:manage");
  const body = await parseBody(req, providerSchema);
  const url = await assertSafeProviderUrl(body.baseUrl, { allowPrivate: env().ALLOW_PRIVATE_PROVIDER_URLS });
  const baseUrl = `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
  const encryptedKey = encryptSecret(body.apiKey, id); // bound to this workspace through the AAD

  const existing = await access.db.providerKey.findFirst({ where: { label: body.label } });
  if (existing) {
    await access.db.providerKey.update({
      where: { id: existing.id },
      data: { baseUrl, encryptedKey, last4: last4(body.apiKey), rotatedAt: new Date() },
    });
  } else {
    await access.db.providerKey.create({
      data: { workspaceId: id, label: body.label, baseUrl, encryptedKey, last4: last4(body.apiKey), createdById: access.user.id },
    });
  }
  await db.workspace.update({ where: { id }, data: { providerMode: "OWN" } }); // saving a key turns it on
  await audit(id, existing ? "provider.rotate" : "provider.set", {
    actorUserId: access.user.id,
    targetType: "ProviderKey",
    metadata: { label: body.label, baseUrl }, // never the key
    ip: clientIp(req),
  });
  return json({ label: body.label, baseUrl, last4: last4(body.apiKey) });
});

/** Removes the workspace's own key. Agents go back to the shared provider. */
export const DELETE = handle<P>(async (req, { params }) => {
  const { id } = await params;
  const access = await requireWorkspaceAccess(id, "provider:manage");
  await access.db.providerKey.deleteMany({});
  await db.workspace.update({ where: { id }, data: { providerMode: "PLATFORM" } });
  await audit(id, "provider.remove", { actorUserId: access.user.id, targetType: "ProviderKey", ip: clientIp(req) });
  return json({ ok: true });
});
