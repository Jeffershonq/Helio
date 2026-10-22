import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChatRoom } from "@/components/chat/chat-room";
import { SetupNotice } from "@/components/setup-notice";
import { can } from "@/lib/rbac";
import { loadRoom } from "@/server/room-data";
import { getSetupStatus } from "@/server/setup-status";
import { getOrCreateTeamThread } from "@/server/threads";
import { getWorkspaceForPage } from "@/server/workspace-page";

export const metadata: Metadata = { title: "Team room" };

export default async function TeamRoomPage({ params }: { params: Promise<{ slug: string; projectId: string }> }) {
  const { slug, projectId } = await params;
  const ctx = await getWorkspaceForPage(slug);

  let found: Awaited<ReturnType<typeof getOrCreateTeamThread>> | undefined;
  try {
    found = await getOrCreateTeamThread(ctx, projectId);
  } catch {
    /* not found */
  }
  if (!found) notFound();

  const [room, status] = await Promise.all([loadRoom(ctx, found.thread.id), getSetupStatus(ctx.workspaceId)]);
  const archived = Boolean(found.project.archivedAt);

  return (
    <ChatRoom
      key={found.thread.id}
      workspaceId={ctx.workspaceId}
      threadId={found.thread.id}
      title={found.project.name}
      kind={archived ? "Team room (archived)" : "Team room"}
      initialMessages={room.messages}
      agents={room.agents}
      people={room.people}
      currentUserId={ctx.user.id}
      canWrite={can(ctx.role, "content:write") && !archived}
      placeholder="Message the team. Type @ to call an agent."
      notice={<SetupNotice status={status} canManage={can(ctx.role, "provider:manage")} slug={slug} />}
    />
  );
}
