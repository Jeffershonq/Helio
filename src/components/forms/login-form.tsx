"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Field, FormMessage } from "@/components/field";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client-api";

export function LoginForm({ next, notice, googleEnabled }: { next: string; notice?: { tone: "success" | "error"; text: string }; googleEnabled: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [fields, setFields] = useState<Record<string, string[]>>({});

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setPending(true);
    setError(undefined);
    const res = await api<{ next: string }>("/api/auth/login", {
      email: form.get("email"),
      password: form.get("password"),
      next,
    });
    if (res.ok) {
      router.replace(res.data.next);
      router.refresh();
      return;
    }
    setError(res.message);
    setFields(res.fields);
    setPending(false);
  }

  return (
    <div className="space-y-5">
      {notice ? <FormMessage tone={notice.tone}>{notice.text}</FormMessage> : null}
      {googleEnabled ? (
        <>
          <Button asChild variant="secondary" block>
            <a href={`/api/auth/google?next=${encodeURIComponent(next)}`}>Continue with Google</a>
          </Button>
          <p className="text-center text-xs text-muted">or use your email</p>
        </>
      ) : null}
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Email" id="email" type="email" autoComplete="email" required error={fields.email?.[0]} />
        <Field label="Password" id="password" type="password" autoComplete="current-password" required error={fields.password?.[0]} />
        {error ? <FormMessage tone="error">{error}</FormMessage> : null}
        <Button type="submit" block disabled={pending}>
          {pending ? "Signing in" : "Sign in"}
        </Button>
      </form>
      <p className="text-sm">
        <Link href="/forgot-password" className="font-medium underline underline-offset-4">
          Forgot your password?
        </Link>
      </p>
    </div>
  );
}
