"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AgentAvatar } from "@/components/chat/agent-avatar";
import { Composer, type ComposerCandidate } from "@/components/chat/composer";
import { MessageItem, type Author } from "@/components/chat/message-item";
import { Button } from "@/components/ui/button";
import { activeRuns, mergeMessages, reduceFrame, type ChatState } from "@/lib/chat-state";
import type { StreamFrame, WireMessage } from "@/lib/chat-types";
import { api } from "@/lib/client-api";
import { emphasizeMentions } from "@/lib/mention-input";
import { parseMentions } from "@/lib/mentions";

export interface RoomAgent {
  id: string;
  key: string;
  name: string;
  role: string;
  color: string;
  enabled: boolean;
}

export interface ChatRoomProps {
  workspaceId: string;
  threadId: string;
  title: string;
  kind: string; // small label above the title
  initialMessages: WireMessage[];
  agents: RoomAgent[];
  people: { id: string; name: string }[];
  currentUserId: string;
  canWrite: boolean;
  placeholder: string;
  notice?: ReactNode;
}

const snippet = (s: string) => (s.length > 90 ? `${s.slice(0, 90)}…` : s).replace(/\s+/g, " ");

export function ChatRoom(p: ChatRoomProps) {
  const base = `/api/workspaces/${p.workspaceId}/threads/${p.threadId}`;
  // The live state sits in a ref so rapid events never read stale data; `tick` just re-renders.
  const state = useRef<ChatState>({ messages: p.initialMessages, runs: {} });
  const [, setTick] = useState(0);
  const rerender = useCallback(() => setTick((n) => n + 1), []);
  const [replyTo, setReplyTo] = useState<string>();
  const loading = useRef(false);
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  const resync = useCallback(async () => {
    if (loading.current) return;
    loading.current = true;
    try {
      const res = await fetch(`${base}/messages`);
      if (res.ok) {
        const { messages } = (await res.json()) as { messages: WireMessage[] };
        state.current = { ...state.current, messages: mergeMessages(state.current.messages, messages) };
        rerender();
      }
    } finally {
      loading.current = false;
    }
  }, [base, rerender]);

  const apply = useCallback(
    (frame: StreamFrame) => {
      const next = reduceFrame(state.current, frame);
      state.current = next.state;
      rerender();
      if (next.resync) void resync();
    },
    [rerender, resync],
  );

  useEffect(() => {
    const source = new EventSource(`${base}/events`);
    source.onmessage = (e) => {
      try {
        apply(JSON.parse(e.data) as StreamFrame);
      } catch {
        /* ignore a malformed frame */
      }
    };
    return () => source.close(); // the browser reconnects by itself; "ready" then reloads anything missed
  }, [base, apply]);

  const agentById = useMemo(() => new Map(p.agents.map((a) => [a.id, a])), [p.agents]);
  const personById = useMemo(() => new Map(p.people.map((x) => [x.id, x])), [p.people]);
  const candidates: ComposerCandidate[] = useMemo(
    () => [
      ...p.agents.filter((a) => a.enabled).map((a) => ({ kind: "agent" as const, id: a.id, label: a.name, color: a.color, agentKey: a.key, detail: a.role })),
      ...p.people.map((x) => ({ kind: "user" as const, id: x.id, label: x.name, detail: "Member" })),
    ],
    [p.agents, p.people],
  );

  const authorOf = (m: WireMessage): Author => {
    if (m.authorKind === "AGENT") {
      const a = m.agentId ? agentById.get(m.agentId) : undefined;
      return { name: a?.name ?? "Agent", detail: a?.role, color: a?.color, agentKey: a?.key ?? "lyra" };
    }
    const person = m.userId ? personById.get(m.userId) : undefined;
    return { name: m.userId === p.currentUserId ? "You" : (person?.name ?? "Member") };
  };

  const messages = state.current.messages;
  const running = activeRuns(state.current);
  const errors = Object.values(state.current.runs).filter((r) => r.state === "error");
  const lastBody = messages.at(-1)?.body.length ?? 0;

  useEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages.length, lastBody]);

  async function send(body: string): Promise<string | undefined> {
    const res = await api<{ message: WireMessage }>(`${base}/messages`, { body, replyToId: replyTo });
    if (!res.ok) return res.fields.body?.[0] ?? res.message;
    apply({ type: "message.created", message: res.data.message });
    setReplyTo(undefined);
    stick.current = true;
    return undefined;
  }

  const stop = () => running.forEach((r) => void api(`/api/workspaces/${p.workspaceId}/runs/${r.runId}/stop`));
  const replyMessage = replyTo ? messages.find((m) => m.id === replyTo) : undefined;
  const stateOfAgent = (id: string) => (running.find((r) => r.agentId === id) ? running.find((r) => r.agentId === id)!.state : errors.find((r) => r.agentId === id) ? ("error" as const) : ("idle" as const));

  return (
    <section className="flex h-[calc(100dvh-6rem)] min-h-[28rem] flex-col md:h-dvh" aria-label={p.title}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 md:px-6">
        <div className="min-w-0">
          <p className="font-mono text-xs text-muted">{p.kind}</p>
          <h1 className="truncate text-lg font-semibold tracking-tight">{p.title}</h1>
        </div>
        <ul className="flex items-center gap-2" aria-label="Agents">
          {p.agents.filter((a) => a.enabled).map((a) => (
            <li key={a.id} title={`${a.name}: ${stateOfAgent(a.id)}`}>
              <AgentAvatar agentKey={a.key} color={a.color} state={stateOfAgent(a.id)} size={36} />
            </li>
          ))}
        </ul>
      </header>

      {p.notice ? <div className="border-b border-line px-4 py-3 text-sm md:px-6">{p.notice}</div> : null}

      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="flex-1 overflow-y-auto px-4 py-5 md:px-6"
      >
        {messages.length === 0 ? (
          <p className="mx-auto mt-10 max-w-sm text-center text-sm text-muted">All quiet in the system. Say hello, or type @ to call one of your agents.</p>
        ) : (
          <ol className="mx-auto max-w-3xl space-y-5" aria-label="Messages">
            {messages.map((m) => {
              const parent = m.replyToId ? messages.find((x) => x.id === m.replyToId) : undefined;
              return (
                <MessageItem
                  key={m.id}
                  message={m}
                  author={authorOf(m)}
                  markdown={emphasizeMentions(m.body, parseMentions(m.body, candidates))}
                  quoted={parent ? { author: authorOf(parent).name, snippet: snippet(parent.body) } : undefined}
                  canReply={p.canWrite && m.authorKind !== "SYSTEM"}
                  onReply={() => setReplyTo(m.id)}
                />
              );
            })}
          </ol>
        )}
      </div>

      <div className="flex min-h-[2.5rem] items-center justify-between gap-3 px-4 py-1 text-xs text-muted md:px-6" role="status" aria-live="polite">
        <span>
          {running.length
            ? running.map((r) => `${agentById.get(r.agentId)?.name ?? "An agent"} is ${r.state === "thinking" ? "thinking" : "working"}`).join(", ")
            : errors.length
              ? `${agentById.get(errors[0]!.agentId)?.name ?? "An agent"} ran into a problem.`
              : ""}
        </span>
        {running.length ? (
          <Button type="button" variant="secondary" className="min-h-[44px] px-4" onClick={stop}>
            Stop
          </Button>
        ) : null}
      </div>

      <Composer
        candidates={candidates}
        canWrite={p.canWrite}
        busy={false}
        placeholder={p.placeholder}
        replyTo={replyMessage ? { author: authorOf(replyMessage).name, snippet: snippet(replyMessage.body) } : undefined}
        onCancelReply={() => setReplyTo(undefined)}
        onSend={send}
      />
    </section>
  );
}
