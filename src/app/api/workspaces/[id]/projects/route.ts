import { audit } from "@/lib/audit";
import { kickoffQuestion } from "@/lib/agents";
import { db } from "@/lib/db";
import { clientIp, handle, json, parseBody } from "@/lib/http";
import { projectCreateSchema } from "@/lib/schemas";
import { requireWorkspaceAccess } from "@/server/access";

type P = { id: string };

/**
 * Creates a project with its Team room and, in this phase, a static kickoff question from Carina.
 * (In Phase 3 Carina writes this herself through the agent runtime.)
 */
export const POST = handle<P>(async (req, { params }) => {
  const { id } = await params;
  const access = await requireWorkspaceAccess(id, "content:write");
  const body = await parseBody(req, projectCreateSchema);

  const agents = await access.db.agent.findMany({ select: { id: true, key: true } });
  const lyra = agents.find((a) => a.key === "lyra");
  const carina = agents.find((a) => a.key === "carina");

  // One nested write = one transaction. Nested rows must carry workspaceId themselves.
  const project = await access.db.project.create({
    data: {
      workspaceId: id,
      name: body.name,
      description: body.description || null,
      defaultAgentId: lyra?.id,
      threads: {
        create: {
          workspaceId: id,
          kind: "TEAM",
          messages: carina
            ? { create: { workspaceId: id, authorKind: "AGENT", agentId: carina.id, body: kickoffQuestion(body.name) } }
            : undefined,
        },
      },
    },
    select: { id: true },
  });

  // First project finishes onboarding.
  await db.workspace.updateMany({ where: { id, onboardedAt: null }, data: { onboardedAt: new Date() } });
  const workspace = await db.workspace.findUniqueOrThrow({ where: { id }, select: { slug: true } });
  await audit(id, "project.create", { actorUserId: access.user.id, targetType: "Project", targetId: project.id, ip: clientIp(req) });
  return json({ id: project.id, slug: workspace.slug }, { status: 201 });
});
