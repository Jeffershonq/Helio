import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { FormMessage } from "@/components/field";
import { ResetForm } from "@/components/forms/reset-form";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <AuthShell
      title="Choose a new password"
      subtitle="You will be signed out everywhere else."
      footer={
        <Link href="/login" className="font-medium text-ink underline underline-offset-4">
          Back to sign in
        </Link>
      }
    >
      {token ? (
        <ResetForm token={token} />
      ) : (
        <FormMessage tone="error">This reset link is incomplete. Ask for a new one from the forgot password page.</FormMessage>
      )}
    </AuthShell>
  );
}
