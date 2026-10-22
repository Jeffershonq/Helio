import { clientIp, handle, json, parseBody } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { workspaceCreateSchema } from "@/lib/schemas";
import { forbidden } from "@/lib/http-error";
import { requireUser } from "@/lib/session";
import { createWorkspace } from "@/server/workspace-service";

export const POST = handle(async (req) => {
  const user = await requireUser();
  if (!user.emailVerifiedAt) throw forbidden("Confirm your email first.");
  await enforceRateLimit(`workspace:create:${user.id}`, 5, 3600);
  const input = await parseBody(req, workspaceCreateSchema);
  const workspace = await createWorkspace(user.id, input, clientIp(req));
  return json(workspace, { status: 201 });
});
