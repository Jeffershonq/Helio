import { audit } from "@/lib/audit";
import { clientIp, handle, json, parseBody } from "@/lib/http";
import { conflict, notFound } from "@/lib/http-error";
import { agentRenameSchema } from "@/lib/schemas";
import { requireWorkspaceAccess } from "@/server/access";

type P = { id: string; key: string };

export const PATCH = handle<P>(async (req, { params }) => {
  const { id, key } = await params;
  const access = await requireWorkspaceAccess(id, "agent:edit");
  const { name } = await parseBody(req, agentRenameSchema);

  const agents = await access.db.agent.findMany({ select: { id: true, key: true, name: true } });
  const agent = agents.find((a) => a.key === key);
  if (!agent) throw notFound("Agent not found.");
  if (agents.some((a) => a.id !== agent.id && a.name.toLowerCase() === name.toLowerCase())) {
    throw conflict("Another agent already uses that name.", { name: ["Already taken"] });
  }

  await access.db.agent.update({ where: { id: agent.id }, data: { name } });
  await audit(id, "agent.rename", {
    actorUserId: access.user.id,
    targetType: "Agent",
    targetId: agent.id,
    metadata: { from: agent.name, to: name },
    ip: clientIp(req),
  });
  return json({ key, name });
});
