"use client";

import { useState, type FormEvent } from "react";
import { Field, FormMessage } from "@/components/field";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client-api";

export function ForgotForm() {
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string>();

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(undefined);
    const res = await api("/api/auth/forgot-password", { email: new FormData(e.currentTarget).get("email") });
    setPending(false);
    if (res.ok) setDone(true);
    else setError(res.fields.email?.[0] ?? res.message);
  }

  if (done) {
    return <FormMessage tone="success">If an account exists for that email, a reset link is on its way. It works for one hour.</FormMessage>;
  }
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field label="Email" id="email" type="email" autoComplete="email" required />
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      <Button type="submit" block disabled={pending}>
        {pending ? "Sending" : "Send reset link"}
      </Button>
    </form>
  );
}
