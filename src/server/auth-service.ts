import { randomToken, sha256Hex } from "@/lib/crypto";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { emails, sendMail } from "@/lib/mail";
import { safeNext } from "@/lib/schemas";
import type { EmailTokenKind } from "@/generated/prisma/enums";

const HOUR = 3_600_000;

export async function issueEmailToken(userId: string, kind: EmailTokenKind, ttlMs: number): Promise<string> {
  const token = randomToken(32);
  // Only the newest link works: retire older unused ones first.
  await db.emailToken.updateMany({ where: { userId, kind, usedAt: null }, data: { usedAt: new Date() } });
  await db.emailToken.create({
    data: { userId, kind, tokenHash: sha256Hex(token), expiresAt: new Date(Date.now() + ttlMs) },
  });
  return token;
}

/** Returns the user id when the token is valid, and burns it so it works only once. */
export async function consumeEmailToken(token: string, kind: EmailTokenKind): Promise<string | null> {
  const row = await db.emailToken.findUnique({ where: { tokenHash: sha256Hex(token) } });
  if (!row || row.kind !== kind || row.usedAt || row.expiresAt < new Date()) return null;
  const claimed = await db.emailToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
  return claimed.count === 1 ? row.userId : null;
}

export async function sendVerificationEmail(user: { id: string; email: string; name: string }, next?: string) {
  const token = await issueEmailToken(user.id, "VERIFY_EMAIL", 24 * HOUR);
  const params = new URLSearchParams({ token });
  const safe = safeNext(next, "");
  if (safe) params.set("next", safe);
  const mail = emails.verify(user.name, `${env().APP_URL}/api/auth/verify-email?${params}`);
  await sendMail({ to: user.email, ...mail });
}

export async function sendPasswordResetEmail(user: { id: string; email: string }) {
  const token = await issueEmailToken(user.id, "RESET_PASSWORD", HOUR);
  await sendMail({ to: user.email, ...emails.reset(`${env().APP_URL}/reset-password?token=${token}`) });
}

export async function sendAccountExistsEmail(email: string) {
  await sendMail({ to: email, ...emails.accountExists(`${env().APP_URL}/login`) });
}
