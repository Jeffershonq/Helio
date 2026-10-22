import { db } from "@/lib/db";
import { HttpError } from "@/lib/http-error";
import { clientIp, handle, json, parseBody } from "@/lib/http";
import { hashPassword } from "@/lib/password";
import { enforceRateLimit } from "@/lib/rate-limit";
import { resetPasswordSchema } from "@/lib/schemas";
import { destroyAllSessions } from "@/lib/session";
import { consumeEmailToken } from "@/server/auth-service";

export const POST = handle(async (req) => {
  await enforceRateLimit(`reset:ip:${clientIp(req)}`, 10, 3600);
  const { token, password } = await parseBody(req, resetPasswordSchema);

  const userId = await consumeEmailToken(token, "RESET_PASSWORD");
  if (!userId) throw new HttpError(400, "This reset link has expired or was already used. Ask for a new one.", "invalid_token");

  const passwordHash = await hashPassword(password);
  // Owning the inbox also proves the email address, so mark it verified.
  await db.user.update({ where: { id: userId }, data: { passwordHash, emailVerifiedAt: new Date() } });
  await destroyAllSessions(userId); // sign out every device
  return json({ ok: true });
});
