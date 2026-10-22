import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChatRoom } from "@/components/chat/chat-room";
import { SetupNotice } from "@/components/setup-notice";
import { can } from "@/lib/rbac";
import { loadRoom } from "@/server/room-data";
import { getSetupStatus } from "@/server/setup-status";
import { getOrCreateAgentThread } from "@/server/threads";
import { getWorkspaceForPage } from "@/server/workspace-page";

export const metadata: Metadata = { title: "Private chat" };

export default async function AgentChatPage({ params }: { params: Promise<{ slug: string; agentKey: string }> }) {
  const { slug, agentKey } = await params;
  const ctx = await getWorkspaceForPage(slug);
  const agent = await ctx.db.agent.findFirst({ where: { key: agentKey } });
  if (!agent) notFound();

  const thread = await getOrCreateAgentThread(ctx, agent.id);
  const [room, status] = await Promise.all([loadRoom(ctx, thread.id), getSetupStatus(ctx.workspaceId)]);

  return (
    <ChatRoom
      key={thread.id}
      workspaceId={ctx.workspaceId}
      threadId={thread.id}
      title={`Chat with ${agent.name}`}
      kind="Private chat"
      initialMessages={room.messages}
      agents={room.agents.filter((a) => a.id === agent.id)}
      people={room.people}
      currentUserId={ctx.user.id}
      canWrite={can(ctx.role, "content:write") && agent.enabled}
      placeholder={`Message ${agent.name}`}
      notice={<SetupNotice status={status} canManage={can(ctx.role, "provider:manage")} slug={slug} />}
    />
  );
}
