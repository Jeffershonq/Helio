import { clientIp, handle, json } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { requireUser } from "@/lib/session";
import { acceptInvite } from "@/server/invite-service";

type P = { token: string };

export const POST = handle<P>(async (req, { params }) => {
  const { token } = await params;
  const user = await requireUser();
  await enforceRateLimit(`invite:accept:${user.id}`, 10, 600);
  const dbUser = { id: user.id, email: user.email, emailVerifiedAt: user.emailVerifiedAt };
  return json(await acceptInvite(dbUser, token, clientIp(req)));
});
