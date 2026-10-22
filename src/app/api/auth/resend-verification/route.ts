import { z } from "zod";
import { db } from "@/lib/db";
import { clientIp, handle, json, parseBody } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { emailSchema } from "@/lib/schemas";
import { getSession } from "@/lib/session";
import { sendVerificationEmail } from "@/server/auth-service";

const schema = z.object({ email: emailSchema.optional() });

export const POST = handle(async (req) => {
  await enforceRateLimit(`resend:ip:${clientIp(req)}`, 10, 3600);
  const body = await parseBody(req, schema);
  const auth = await getSession();
  const email = auth?.user.email ?? body.email;

  if (email) {
    await enforceRateLimit(`resend:email:${email}`, 3, 3600);
    const user = await db.user.findUnique({ where: { email }, select: { id: true, email: true, name: true, emailVerifiedAt: true } });
    if (user && !user.emailVerifiedAt) await sendVerificationEmail(user);
  }
  return json({ ok: true }); // never says whether the address exists
});
