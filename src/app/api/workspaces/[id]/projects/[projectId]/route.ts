import { audit } from "@/lib/audit";
import { clientIp, handle, json, parseBody } from "@/lib/http";
import { notFound } from "@/lib/http-error";
import { projectUpdateSchema } from "@/lib/schemas";
import { requireWorkspaceAccess } from "@/server/access";

type P = { id: string; projectId: string };

/** Rename, archive or restore a project, or change which agent answers when nobody is @mentioned. */
export const PATCH = handle<P>(async (req, { params }) => {
  const { id, projectId } = await params;
  const access = await requireWorkspaceAccess(id, "content:write");
  const body = await parseBody(req, projectUpdateSchema);

  const project = await access.db.project.findFirst({ where: { id: projectId }, select: { id: true } });
  if (!project) throw notFound("Project not found.");

  const data: { name?: string; archivedAt?: Date | null; defaultAgentId?: string } = {};
  if (body.name) data.name = body.name;
  if (body.archived !== undefined) data.archivedAt = body.archived ? new Date() : null;
  if (body.defaultAgentKey) {
    const agent = await access.db.agent.findFirst({ where: { key: body.defaultAgentKey }, select: { id: true } });
    if (!agent) throw notFound("Agent not found.");
    data.defaultAgentId = agent.id;
  }
  await access.db.project.update({ where: { id: projectId }, data });
  await audit(id, "project.update", { actorUserId: access.user.id, targetType: "Project", targetId: projectId, metadata: body, ip: clientIp(req) });
  return json({ ok: true });
});
