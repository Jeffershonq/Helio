import { db } from "@/lib/db";
import { conflict } from "@/lib/http-error";
import { DEFAULT_AGENTS } from "@/lib/agents";
import { slugWithSuffix } from "@/lib/slug";
import { audit } from "@/lib/audit";

const MAX_OWNED_WORKSPACES = 10;

const isUniqueViolation = (err: unknown) => (err as { code?: string })?.code === "P2002";

/** Creates a workspace, makes the user its Owner, and seeds Lyra, Carina and Hydra. */
export async function createWorkspace(userId: string, input: { name: string; description?: string }, ip?: string) {
  const owned = await db.membership.count({ where: { userId, role: "OWNER" } });
  if (owned >= MAX_OWNED_WORKSPACES) throw conflict(`You can own up to ${MAX_OWNED_WORKSPACES} workspaces.`);

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const workspace = await db.workspace.create({
        data: {
          name: input.name,
          description: input.description || null,
          slug: slugWithSuffix(input.name),
          memberships: { create: { userId, role: "OWNER" } },
          agents: {
            create: DEFAULT_AGENTS.map((a) => ({
              key: a.key,
              name: a.name,
              role: a.role,
              color: a.color,
              tier: a.tier,
              soul: a.soul,
              allowedTools: a.tools,
            })),
          },
        },
        select: { id: true, slug: true, name: true },
      });
      await audit(workspace.id, "workspace.create", { actorUserId: userId, targetType: "Workspace", targetId: workspace.id, ip });
      return workspace;
    } catch (err) {
      if (!isUniqueViolation(err)) throw err; // slug collision: try again with a new suffix
    }
  }
  throw conflict("Could not pick a unique workspace address. Try again.");
}
