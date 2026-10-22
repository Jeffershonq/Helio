import Link from "next/link";
import { HelioMark, Wordmark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/session";

// Placeholder landing page. The full landing page (demo of the team room, agent section) is Phase 6.
export default async function Home() {
  const auth = await getSession();
  return (
    <main className="starfield min-h-dvh text-white">
      <div className="mx-auto flex min-h-dvh max-w-5xl flex-col px-6 py-8">
        <header className="flex items-center justify-between">
          <Wordmark onDark />
          {auth ? null : (
            <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-white/80 hover:text-white">
              Sign in
            </Link>
          )}
        </header>
        <div className="grid flex-1 items-center gap-10 py-12 md:grid-cols-[1.2fr_1fr]">
          <div className="space-y-6">
            <h1 className="max-w-xl text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
              A team room for you and three AI agents.
            </h1>
            <p className="max-w-md text-base text-white/75">
              Lyra keeps you on track, Carina plans the work, and Hydra builds it. They hand work to each other and ask you only when they need you.
            </p>
            <div className="flex flex-wrap gap-3">
              {auth ? (
                <Button asChild>
                  <Link href="/app">Open Helio</Link>
                </Button>
              ) : (
                <>
                  <Button asChild>
                    <Link href="/register">Create your workspace</Link>
                  </Button>
                  <Button asChild variant="onDark">
                    <Link href="/login">Sign in</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
          <div className="flex justify-center">
            <HelioMark size={300} animated onDark className="text-white" />
          </div>
        </div>
      </div>
    </main>
  );
}
