"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Constellation } from "@/components/constellation";

export interface NavItem {
  href: string;
  label: string;
  agent?: { key: string; color: string };
}
export interface NavSection {
  title: string;
  items: NavItem[];
}

export function SidebarNav({ sections }: { sections: NavSection[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Workspace" className="space-y-5">
      {sections.map((s) => (
        <div key={s.title} className="space-y-1">
          <p className="px-2 pb-1 text-xs font-medium text-white/60">{s.title}</p>
          {s.items.map((i) => {
            const current = path === i.href || path.startsWith(`${i.href}/`);
            return (
              <Link
                key={i.href}
                href={i.href}
                aria-current={current ? "page" : undefined}
                className={`flex min-h-[44px] items-center gap-3 rounded-lg px-2 text-sm ${current ? "bg-white/10 font-semibold text-white" : "text-white/80 hover:bg-white/5 hover:text-white"}`}
              >
                {i.agent ? <Constellation agent={i.agent.key} color={i.agent.color} size={24} /> : <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-sun" />}
                <span className="truncate">{i.label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
