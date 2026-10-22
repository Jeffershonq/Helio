import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { FormMessage } from "@/components/field";
import { ResendVerification } from "@/components/forms/resend-verification";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Confirm your email" };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ status?: string; sent?: string }> }) {
  const sp = await searchParams;
  const auth = await getSession();
  if (auth?.user.emailVerifiedAt) redirect("/app");

  const invalid = sp.status === "invalid";
  return (
    <AuthShell
      title={invalid ? "That link did not work" : "Check your inbox"}
      subtitle={
        invalid
          ? "It may have expired or already been used. Send yourself a new one."
          : auth
            ? `We sent a confirmation link to ${auth.user.email}. Open it to continue.`
            : "We sent you a confirmation link. Open it to finish creating your account."
      }
      footer={
        <Link href="/login" className="font-medium text-ink underline underline-offset-4">
          Back to sign in
        </Link>
      }
    >
      {invalid ? <FormMessage tone="error">Confirmation links work once and expire after 24 hours.</FormMessage> : null}
      <ResendVerification signedIn={Boolean(auth)} />
    </AuthShell>
  );
}
