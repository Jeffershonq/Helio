"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Field, FormMessage } from "@/components/field";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client-api";

export function ResetForm({ token }: { token: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [fields, setFields] = useState<Record<string, string[]>>({});

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(undefined);
    const res = await api("/api/auth/reset-password", { token, password: new FormData(e.currentTarget).get("password") });
    if (res.ok) {
      router.replace("/login?reset=1");
      return;
    }
    setError(res.message);
    setFields(res.fields);
    setPending(false);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field label="New password" id="password" type="password" autoComplete="new-password" required hint="At least 10 characters." error={fields.password?.[0]} />
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      <Button type="submit" block disabled={pending}>
        {pending ? "Saving" : "Save new password"}
      </Button>
    </form>
  );
}
