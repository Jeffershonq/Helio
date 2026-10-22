import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-start justify-center gap-4 px-6">
      <p className="font-mono text-xs text-muted">404</p>
      <h1 className="text-2xl font-semibold tracking-tight">That page is not in this system</h1>
      <p className="text-sm text-muted">The link may be wrong, or you may not have access to it.</p>
      <Button asChild>
        <Link href="/app">Go to your workspace</Link>
      </Button>
    </main>
  );
}
