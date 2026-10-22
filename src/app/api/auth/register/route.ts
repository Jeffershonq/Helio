import { db } from "@/lib/db";
import { clientIp, handle, json, parseBody } from "@/lib/http";
import { hashPassword } from "@/lib/password";
import { enforceRateLimit } from "@/lib/rate-limit";
import { registerSchema } from "@/lib/schemas";
import { sendAccountExistsEmail, sendVerificationEmail } from "@/server/auth-service";

export const POST = handle(async (req) => {
  await enforceRateLimit(`register:ip:${clientIp(req)}`, 10, 3600);
  const body = await parseBody(req, registerSchema);

  // Hash in both branches so response time does not reveal whether the email is already registered.
  const passwordHash = await hashPassword(body.password);
  const existing = await db.user.findUnique({ where: { email: body.email }, select: { id: true } });

  if (existing) {
    await sendAccountExistsEmail(body.email);
  } else {
    const user = await db.user.create({
      data: { email: body.email, name: body.name, passwordHash },
      select: { id: true, email: true, name: true },
    });
    await sendVerificationEmail(user, body.next);
  }
  // Same answer either way: this endpoint never says whether an email is taken.
  return json({ ok: true });
});
