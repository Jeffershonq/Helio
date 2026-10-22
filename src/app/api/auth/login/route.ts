import { db } from "@/lib/db";
import { HttpError } from "@/lib/http-error";
import { clientIp, handle, json, parseBody } from "@/lib/http";
import { verifyAgainstDummy, verifyPassword } from "@/lib/password";
import { enforceRateLimit } from "@/lib/rate-limit";
import { loginSchema, safeNext } from "@/lib/schemas";
import { createSession } from "@/lib/session";

export const POST = handle(async (req) => {
  const ip = clientIp(req);
  const body = await parseBody(req, loginSchema);
  await enforceRateLimit(`login:ip:${ip}`, 30, 600);
  await enforceRateLimit(`login:email:${body.email}`, 8, 600);

  const user = await db.user.findUnique({ where: { email: body.email } });
  const ok = user?.passwordHash ? await verifyPassword(body.password, user.passwordHash) : await verifyAgainstDummy(body.password);
  if (!user || !ok) throw new HttpError(401, "Wrong email or password.", "invalid_credentials");

  await createSession(user.id, { ip, userAgent: req.headers.get("user-agent") });
  return json({ ok: true, next: safeNext(body.next) });
});
