import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "@/components/forms/login-form";
import { googleEnabled } from "@/lib/env";
import { safeNext } from "@/lib/schemas";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  google_disabled: "Google sign-in is not set up on this Helio install.",
  google_failed: "Google sign-in did not finish. Try again.",
  google_unverified: "Google says that email address is not verified.",
};

type SP = { next?: string; verified?: string; reset?: string; error?: string };

export default async function LoginPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  if (await getSession()) redirect(next);

  const notice = sp.verified
    ? { tone: "success" as const, text: "Email confirmed. Sign in to continue." }
    : sp.reset
      ? { tone: "success" as const, text: "Password changed. Sign in with your new password." }
      : sp.error && ERRORS[sp.error]
        ? { tone: "error" as const, text: ERRORS[sp.error]! }
        : undefined;

  const registerHref = `/register${next !== "/app" ? `?next=${encodeURIComponent(next)}` : ""}`;
  return (
    <AuthShell
      title="Sign in"
      subtitle="Welcome back to your team room."
      footer={
        <>
          New to Helio?{" "}
          <Link href={registerHref} className="font-medium text-ink underline underline-offset-4">
            Create an account
          </Link>
        </>
      }
    >
      <LoginForm next={next} notice={notice} googleEnabled={googleEnabled()} />
    </AuthShell>
  );
}
