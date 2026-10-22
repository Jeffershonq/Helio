import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { handle } from "@/lib/http";
import { safeNext } from "@/lib/schemas";
import { consumeEmailToken } from "@/server/auth-service";

// The link in the email lands here. A link in an email has to work as a GET, and it only
// flips "verified" for the token owner, so it is safe as a GET.
export const GET = handle(async (req) => {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const next = safeNext(req.nextUrl.searchParams.get("next"), "");
  const userId = token ? await consumeEmailToken(token, "VERIFY_EMAIL") : null;
  const to = new URL(env().APP_URL);

  if (!userId) {
    to.pathname = "/verify-email";
    to.search = "?status=invalid";
    return NextResponse.redirect(to);
  }
  await db.user.updateMany({ where: { id: userId, emailVerifiedAt: null }, data: { emailVerifiedAt: new Date() } });
  to.pathname = "/login";
  to.search = `?verified=1${next ? `&next=${encodeURIComponent(next)}` : ""}`;
  return NextResponse.redirect(to);
});
