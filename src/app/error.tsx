"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-start justify-center gap-4 px-6">
      <p className="font-mono text-xs text-muted">500</p>
      <h1 className="text-2xl font-semibold tracking-tight">Something went wrong on our side</h1>
      <p className="text-sm text-muted">Nothing you did caused this. Try again in a moment.</p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
