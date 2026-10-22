"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Field, FormMessage } from "@/components/field";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client-api";

export function RegisterForm({ next }: { next?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [fields, setFields] = useState<Record<string, string[]>>({});

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setPending(true);
    setError(undefined);
    setFields({});
    const res = await api("/api/auth/register", {
      name: form.get("name"),
      email: form.get("email"),
      password: form.get("password"),
      acceptTerms: form.get("acceptTerms") === "on",
      next,
    });
    if (res.ok) {
      router.push("/verify-email?sent=1");
      return;
    }
    setError(res.message);
    setFields(res.fields);
    setPending(false);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field label="Name" id="name" autoComplete="name" required error={fields.name?.[0]} />
      <Field label="Email" id="email" type="email" autoComplete="email" required error={fields.email?.[0]} />
      <Field label="Password" id="password" type="password" autoComplete="new-password" required hint="At least 10 characters." error={fields.password?.[0]} />
      <div className="space-y-1.5">
        <label className="flex min-h-[44px] items-center gap-3 text-sm">
          <input type="checkbox" name="acceptTerms" className="h-5 w-5 accent-[#E8A33D]" aria-describedby={fields.acceptTerms ? "terms-error" : undefined} />
          <span>I accept the terms of use and privacy policy.</span>
        </label>
        {fields.acceptTerms ? (
          <p id="terms-error" className="text-xs font-medium text-hydra">
            {fields.acceptTerms[0]}
          </p>
        ) : null}
      </div>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      <Button type="submit" block disabled={pending}>
        {pending ? "Creating account" : "Create account"}
      </Button>
    </form>
  );
}
