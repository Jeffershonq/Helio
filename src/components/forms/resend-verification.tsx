"use client";

import { useState, type FormEvent } from "react";
import { Field, FormMessage } from "@/components/field";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client-api";

/** Signed-in users get a single button. Signed-out visitors type their email. */
export function ResendVerification({ signedIn }: { signedIn: boolean }) {
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string>();

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(undefined);
    const email = signedIn ? undefined : new FormData(e.currentTarget).get("email");
    const res = await api("/api/auth/resend-verification", { email });
    setPending(false);
    if (res.ok) setSent(true);
    else setError(res.fields.email?.[0] ?? res.message);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {signedIn ? null : <Field label="Email" id="email" type="email" autoComplete="email" required />}
      {sent ? <FormMessage tone="success">If that address needs confirming, a new link is on its way.</FormMessage> : null}
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      <Button type="submit" variant="secondary" block disabled={pending}>
        {pending ? "Sending" : "Send a new link"}
      </Button>
    </form>
  );
}
