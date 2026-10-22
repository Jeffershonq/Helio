import { createHash } from "node:crypto";
import { randomToken } from "@/lib/crypto";
import { env } from "@/lib/env";

// Google sign-in with the authorization-code flow and PKCE. No third-party OAuth library is needed.
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

export const redirectUri = () => `${env().APP_URL}/api/auth/google/callback`;

export function newOAuthRequest() {
  const state = randomToken(24);
  const verifier = randomToken(48);
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { state, verifier, challenge };
}

export function authorizationUrl(state: string, challenge: string): string {
  const params = new URLSearchParams({
    client_id: env().GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  return `${AUTH_URL}?${params}`;
}

export interface GoogleProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
}

export async function fetchGoogleProfile(code: string, verifier: string): Promise<GoogleProfile> {
  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env().GOOGLE_CLIENT_ID!,
      client_secret: env().GOOGLE_CLIENT_SECRET!,
      code,
      code_verifier: verifier,
      grant_type: "authorization_code",
      redirect_uri: redirectUri(),
    }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!tokenRes.ok) throw new Error(`Google token exchange failed (${tokenRes.status})`);
  const { access_token } = (await tokenRes.json()) as { access_token?: string };
  if (!access_token) throw new Error("Google returned no access token");

  const infoRes = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${access_token}` },
    signal: AbortSignal.timeout(8_000),
  });
  if (!infoRes.ok) throw new Error(`Google userinfo failed (${infoRes.status})`);
  const info = (await infoRes.json()) as { sub?: string; email?: string; email_verified?: boolean; name?: string };
  if (!info.sub || !info.email) throw new Error("Google profile is missing sub or email");
  return { sub: info.sub, email: info.email.toLowerCase(), emailVerified: info.email_verified === true, name: info.name || info.email };
}

/** Name of the short-lived cookie that carries state + PKCE verifier across the Google redirect. */
export const oauthCookie = () => (env().NODE_ENV === "production" ? "__Host-helio_oauth" : "helio_oauth");
