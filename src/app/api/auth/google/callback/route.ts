import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/crypto";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { fetchGoogleProfile, oauthCookie } from "@/lib/google";
import { clientIp, handle } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { safeNext } from "@/lib/schemas";
import { createSession, destroyAllSessions } from "@/lib/session";

function fail(code: string) {
  const url = new URL("/login", env().APP_URL);
  url.searchParams.set("error", code);
  const res = NextResponse.redirect(url);
  res.cookies.delete(oauthCookie());
  return res;
}

export const GET = handle(async (req) => {
  const ip = clientIp(req);
  await enforceRateLimit(`google:ip:${ip}`, 30, 600);

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const raw = req.cookies.get(oauthCookie())?.value;
  if (!code || !state || !raw) return fail("google_failed");

  let saved: { state: string; verifier: string; next: string };
  try {
    saved = JSON.parse(raw);
  } catch {
    return fail("google_failed");
  }
  if (!safeEqual(saved.state, state)) return fail("google_failed");

  let profile;
  try {
    profile = await fetchGoogleProfile(code, saved.verifier);
  } catch (err) {
    console.error("google sign-in failed", (err as Error).message);
    return fail("google_failed");
  }
  if (!profile.emailVerified) return fail("google_unverified");

  const linked = await db.oAuthAccount.findUnique({
    where: { provider_providerUserId: { provider: "google", providerUserId: profile.sub } },
  });

  let userId: string;
  if (linked) {
    userId = linked.userId;
  } else {
    const existing = await db.user.findUnique({ where: { email: profile.email } });
    if (existing) {
      // Pre-hijack defence: if that account was never email-verified, someone else may have created it
      // with a password they know. Drop the password and every session before linking Google.
      if (!existing.emailVerifiedAt) {
        await db.user.update({ where: { id: existing.id }, data: { passwordHash: null, emailVerifiedAt: new Date() } });
        await destroyAllSessions(existing.id);
      }
      userId = existing.id;
    } else {
      userId = (await db.user.create({ data: { email: profile.email, name: profile.name, emailVerifiedAt: new Date() } })).id;
    }
    await db.oAuthAccount.create({ data: { userId, provider: "google", providerUserId: profile.sub } });
  }

  await createSession(userId, { ip, userAgent: req.headers.get("user-agent") });
  const res = NextResponse.redirect(new URL(safeNext(saved.next), env().APP_URL));
  res.cookies.delete(oauthCookie());
  return res;
});
