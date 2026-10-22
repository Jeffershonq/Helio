import type { Metadata } from "next";
import { ProjectsManager } from "@/components/forms/projects-manager";
import { can } from "@/lib/rbac";
import { getWorkspaceForPage } from "@/server/workspace-page";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await getWorkspaceForPage(slug);
  const [projects, agents] = await Promise.all([
    ctx.db.project.findMany({ orderBy: { createdAt: "asc" } }),
    ctx.db.agent.findMany({ where: { enabled: true }, orderBy: { createdAt: "asc" }, select: { id: true, key: true, name: true } }),
  ]);
  const keyById = new Map(agents.map((a) => [a.id, a.key]));

  return (
    <div className="max-w-3xl space-y-6 p-6 md:p-10">
      <header className="space-y-1">
        <p className="font-mono text-xs text-muted">Workspace</p>
        <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
        <p className="text-sm text-muted">Each project has its own team room.</p>
      </header>
      <ProjectsManager
        workspaceId={ctx.workspaceId}
        slug={slug}
        canWrite={can(ctx.role, "content:write")}
        agents={agents.map((a) => ({ key: a.key, name: a.name }))}
        projects={projects.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          archived: Boolean(p.archivedAt),
          defaultAgentKey: p.defaultAgentId ? (keyById.get(p.defaultAgentId) ?? null) : null,
        }))}
      />
    </div>
  );
}
