import { db } from "@/lib/db";
import { clientIp, handle, json, parseBody } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { forgotPasswordSchema } from "@/lib/schemas";
import { sendPasswordResetEmail } from "@/server/auth-service";

export const POST = handle(async (req) => {
  await enforceRateLimit(`forgot:ip:${clientIp(req)}`, 10, 3600);
  const { email } = await parseBody(req, forgotPasswordSchema);
  await enforceRateLimit(`forgot:email:${email}`, 3, 3600);

  const user = await db.user.findUnique({ where: { email }, select: { id: true, email: true } });
  if (user) await sendPasswordResetEmail(user);
  return json({ ok: true }); // same answer whether or not the account exists
});
