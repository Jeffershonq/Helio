import Link from "next/link";
import type { ReactNode } from "react";
import { HelioMark, Wordmark } from "@/components/logo";

/** Split layout for every public auth screen. The orbit mark is the one decorative moment. */
export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="starfield relative hidden flex-col justify-between p-10 text-white lg:flex">
        <Link href="/" aria-label="Helio home">
          <Wordmark onDark />
        </Link>
        <div className="flex flex-col items-start gap-8">
          <HelioMark size={220} animated onDark className="text-white" />
          <p className="max-w-xs text-2xl font-semibold leading-snug">One team room. You and three agents.</p>
        </div>
        <p className="font-mono text-xs text-white/60">Lyra · Carina · Hydra</p>
      </aside>
      <section className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm space-y-6">
          <Link href="/" className="lg:hidden" aria-label="Helio home">
            <Wordmark />
          </Link>
          <div className="space-y-1.5">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {subtitle ? <p className="text-sm text-muted">{subtitle}</p> : null}
          </div>
          {children}
          {footer ? <div className="text-sm text-muted">{footer}</div> : null}
        </div>
      </section>
    </main>
  );
}
