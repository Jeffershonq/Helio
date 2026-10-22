import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { randomToken, sha256Hex } from "@/lib/crypto";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { unauthorized } from "@/lib/http-error";

const SESSION_DAYS = 30;
const prod = () => env().NODE_ENV === "production";
// The __Host- prefix makes browsers insist on Secure, path=/ and no Domain attribute.
const cookieName = () => (prod() ? "__Host-helio_session" : "helio_session");

export async function createSession(userId: string, meta: { ip?: string; userAgent?: string | null } = {}) {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.session.create({
    data: { userId, tokenHash: sha256Hex(token), expiresAt, ip: meta.ip, userAgent: meta.userAgent?.slice(0, 300) },
  });
  (await cookies()).set(cookieName(), token, {
    httpOnly: true,
    secure: prod(),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export const getSession = cache(async () => {
  const token = (await cookies()).get(cookieName())?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: sha256Hex(token) },
    include: { user: { select: { id: true, email: true, name: true, emailVerifiedAt: true } } },
  });
  if (!session || session.expiresAt < new Date()) return null;
  if (Date.now() - session.lastSeenAt.getTime() > 3_600_000) {
    await db.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
  }
  return { sessionId: session.id, user: session.user };
});

export async function destroySession() {
  const store = await cookies();
  const token = store.get(cookieName())?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: sha256Hex(token) } });
  store.delete(cookieName());
}

/** Signs the user out everywhere, for example after a password reset. */
export async function destroyAllSessions(userId: string) {
  await db.session.deleteMany({ where: { userId } });
}

/** For API routes: throws a 401 JSON error when nobody is signed in. */
export async function requireUser() {
  const auth = await getSession();
  if (!auth) throw unauthorized();
  return auth.user;
}

/** For pages: sends visitors to login, or to the verify screen, before anything else renders. */
export async function requireUserForPage(returnTo: string, opts: { allowUnverified?: boolean } = {}) {
  const auth = await getSession();
  if (!auth) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  if (!auth.user.emailVerifiedAt && !opts.allowUnverified) redirect("/verify-email");
  return auth.user;
}
