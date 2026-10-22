import { clientIp, handle, json, parseBody } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { inviteCreateSchema } from "@/lib/schemas";
import { requireWorkspaceAccess } from "@/server/access";
import { createInvite } from "@/server/invite-service";

type P = { id: string };

export const POST = handle<P>(async (req, { params }) => {
  const { id } = await params;
  const access = await requireWorkspaceAccess(id, "member:invite");
  await enforceRateLimit(`invite:${id}`, 20, 3600);
  const body = await parseBody(req, inviteCreateSchema);
  return json(await createInvite(access, body, clientIp(req)), { status: 201 });
});
