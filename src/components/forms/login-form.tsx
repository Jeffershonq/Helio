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
            <a 
              href={`/api/auth/google?next=${encodeURIComponent(next)}`}
              className="flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.19v3.15C3.17 21.32 7.23 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.19C.43 8.13 0 9.89 0 12s.43 3.87 1.19 5.42l4.09-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.23 0 3.17 2.68 1.19 6.58l4.09 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              <span>Continue with Google</span>
            </a>
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
