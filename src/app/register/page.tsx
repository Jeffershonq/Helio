import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { RegisterForm } from "@/components/forms/register-form";
import { Button } from "@/components/ui/button";
import { googleEnabled } from "@/lib/env";
import { safeNext } from "@/lib/schemas";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next, "");
  if (await getSession()) redirect(next || "/app");

  return (
    <AuthShell
      title="Create your account"
      subtitle="Set up a workspace and meet your three agents."
      footer={
        <>
          Already have an account?{" "}
          <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="font-medium text-ink underline underline-offset-4">
            Sign in
          </Link>
        </>
      }
    >
      {googleEnabled() ? (
        <div className="space-y-5">
          <Button asChild variant="secondary" block>
            <a href={`/api/auth/google?next=${encodeURIComponent(next || "/app")}`}>Continue with Google</a>
          </Button>
          <p className="text-center text-xs text-muted">or use your email</p>
        </div>
      ) : null}
      <RegisterForm next={next || undefined} />
    </AuthShell>
  );
}
