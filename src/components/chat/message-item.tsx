import { AgentAvatar } from "@/components/chat/agent-avatar";
import { MarkdownBody } from "@/components/chat/markdown";
import type { WireMessage } from "@/lib/chat-types";

export interface Author {
  name: string;
  detail?: string;
  color?: string;
  agentKey?: string;
}

const initials = (name: string) => name.split(/\s+/).map((p) => p[0] ?? "").join("").slice(0, 2).toUpperCase();
const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export function MessageItem({
  message,
  author,
  markdown,
  quoted,
  onReply,
  canReply,
}: {
  message: WireMessage;
  author: Author;
  markdown: string; // body with mentions emphasised
  quoted?: { author: string; snippet: string };
  onReply: () => void;
  canReply: boolean;
}) {
  if (message.authorKind === "SYSTEM") {
    return (
      <li className="flex justify-center">
        <p className="max-w-lg rounded-lg border border-line px-3 py-1.5 text-center text-xs text-muted">{message.body}</p>
      </li>
    );
  }
  const meta = message.metadata ?? {};
  return (
    <li id={`m-${message.id}`} className="flex gap-3">
      {author.agentKey ? (
        <AgentAvatar agentKey={author.agentKey} color={author.color ?? "#888"} size={36} />
      ) : (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink/10 text-xs font-semibold" aria-hidden="true">
          {initials(author.name)}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-sm font-semibold" style={author.color ? { color: author.color } : undefined}>
            {author.name}
          </span>
          {author.detail ? <span className="text-xs text-muted">{author.detail}</span> : null}
          <time dateTime={message.createdAt} suppressHydrationWarning className="font-mono text-xs text-muted">
            {clock(message.createdAt)}
          </time>
        </div>
        {quoted ? (
          <p className="mt-1 truncate border-l-2 border-line pl-2 text-xs text-muted">
            {quoted.author}: {quoted.snippet}
          </p>
        ) : null}
        {message.body ? <MarkdownBody>{markdown}</MarkdownBody> : <p className="text-sm text-muted">Thinking</p>}
        {meta.stopped === true ? <p className="text-xs text-muted">Stopped before it finished.</p> : null}
        {typeof meta.error === "string" ? <p className="text-xs text-hydra">Cut short: {meta.error}</p> : null}
        {canReply ? (
          <button type="button" onClick={onReply} className="-ml-2 mt-0.5 min-h-[44px] rounded-md px-2 text-xs font-medium text-muted hover:text-ink" aria-label={`Reply to ${author.name}`}>
            Reply
          </button>
        ) : null}
      </div>
    </li>
  );
}
