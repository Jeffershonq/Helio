import type { ReactNode } from "react";
import { LogoutButton } from "@/components/forms/logout-button";
import { Wordmark } from "@/components/logo";
import { SidebarNav, type NavSection } from "@/components/sidebar-nav";
import { can } from "@/lib/rbac";
import { getWorkspaceForPage } from "@/server/workspace-page";

export default async function WorkspaceLayout({ children, params }: { children: ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { workspace, role, user, db } = await getWorkspaceForPage(slug);
  const [projects, agents] = await Promise.all([
    db.project.findMany({ where: { archivedAt: null }, orderBy: { createdAt: "asc" }, select: { id: true, name: true } }),
    db.agent.findMany({ where: { enabled: true }, orderBy: { createdAt: "asc" }, select: { key: true, name: true, color: true } }),
  ]);

  const base = `/w/${slug}`;
  const sections: NavSection[] = [
    { title: "Team rooms", items: [...projects.map((p) => ({ href: `${base}/p/${p.id}`, label: p.name })), { href: `${base}/projects`, label: "All projects" }] },
    { title: "Private chats", items: agents.map((a) => ({ href: `${base}/chat/${a.key}`, label: a.name, agent: { key: a.key, color: a.color } })) },
    ...(can(role, "provider:manage") ? [{ title: "Workspace", items: [{ href: `${base}/settings`, label: "Settings" }] }] : []),
  ];

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[272px_minmax(0,1fr)]">
      <aside className="flex flex-col gap-6 bg-space p-5 text-white md:h-dvh md:overflow-y-auto">
        <Wordmark onDark />
        <div className="space-y-1">
          <p className="truncate text-sm font-semibold">{workspace.name}</p>
          <p className="font-mono text-xs text-white/60">{role.toLowerCase()}</p>
        </div>
        <SidebarNav sections={sections} />
        <div className="mt-auto space-y-3">
          <p className="truncate text-xs text-white/60">{user.email}</p>
          <LogoutButton />
        </div>
      </aside>
      <main className="min-w-0 md:h-dvh md:overflow-y-auto">{children}</main>
    </div>
  );
}
