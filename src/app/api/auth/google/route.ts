import { NextResponse } from "next/server";
import { env, googleEnabled } from "@/lib/env";
import { authorizationUrl, newOAuthRequest, oauthCookie } from "@/lib/google";
import { handle } from "@/lib/http";
import { safeNext } from "@/lib/schemas";

export const GET = handle(async (req) => {
  const login = new URL("/login", env().APP_URL);
  if (!googleEnabled()) {
    login.searchParams.set("error", "google_disabled");
    return NextResponse.redirect(login);
  }
  const { state, verifier, challenge } = newOAuthRequest();
  const next = safeNext(req.nextUrl.searchParams.get("next"));
  const res = NextResponse.redirect(authorizationUrl(state, challenge));
  // Short-lived and server-only. Lax is needed so the cookie comes back with Google's redirect.
  res.cookies.set(oauthCookie(), JSON.stringify({ state, verifier, next }), {
    httpOnly: true,
    secure: env().NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
});
