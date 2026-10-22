"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import { Constellation } from "@/components/constellation";
import { Button } from "@/components/ui/button";
import { activeMentionQuery, applyMention, filterCandidates } from "@/lib/mention-input";
import type { MentionCandidate } from "@/lib/mentions";

export interface ComposerCandidate extends MentionCandidate {
  color?: string;
  agentKey?: string;
  detail?: string;
}

export function Composer({
  candidates,
  canWrite,
  busy,
  placeholder,
  replyTo,
  onCancelReply,
  onSend,
}: {
  candidates: ComposerCandidate[];
  canWrite: boolean;
  busy: boolean;
  placeholder: string;
  replyTo?: { author: string; snippet: string };
  onCancelReply: () => void;
  onSend: (body: string) => Promise<string | undefined>; // returns an error message, or nothing on success
}) {
  const [text, setText] = useState("");
  const [caret, setCaret] = useState(0);
  const [active, setActive] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();
  const ref = useRef<HTMLTextAreaElement>(null);
  const listId = useId();

  const query = dismissed ? null : activeMentionQuery(text, caret);
  const options = query ? filterCandidates(candidates, query.query) : [];
  const open = options.length > 0;

  function resize() {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }

  function choose(c: ComposerCandidate) {
    if (!query) return;
    const next = applyMention(text, caret, query.start, c.label);
    setText(next.text);
    setCaret(next.caret);
    requestAnimationFrame(() => {
      ref.current?.setSelectionRange(next.caret, next.caret);
      ref.current?.focus();
    });
  }

  async function submit() {
    const body = text.trim();
    if (!body || sending || !canWrite) return;
    setSending(true);
    setError(undefined);
    const problem = await onSend(body);
    setSending(false);
    if (problem) return setError(problem);
    setText("");
    setCaret(0);
    requestAnimationFrame(resize);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (open) {
      if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => (i + 1) % options.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => (i - 1 + options.length) % options.length); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); choose(options[Math.min(active, options.length - 1)]!); return; }
      if (e.key === "Escape") { e.preventDefault(); setDismissed(true); return; }
    }
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void submit();
    }
  }

  if (!canWrite) {
    return <p className="border-t border-line p-4 text-center text-sm text-muted">You have view-only access to this workspace.</p>;
  }

  return (
    <div className="border-t border-line bg-canvas p-3 md:p-4">
      {replyTo ? (
        <div className="mb-2 flex items-center justify-between gap-3 rounded-lg bg-ink/5 px-3 py-1.5 text-xs">
          <span className="min-w-0 truncate">
            Replying to <strong>{replyTo.author}</strong>: {replyTo.snippet}
          </span>
          <button type="button" onClick={onCancelReply} className="min-h-[44px] shrink-0 px-2 font-medium text-muted hover:text-ink" aria-label="Cancel reply">
            Cancel
          </button>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="mb-2 text-xs font-medium text-hydra">
          {error}
        </p>
      ) : null}
      <div className="relative flex items-end gap-2">
        {open ? (
          <ul id={listId} role="listbox" aria-label="Mention suggestions" className="absolute bottom-full left-0 z-10 mb-2 w-72 max-w-full overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
            {options.map((c, i) => (
              <li
                key={`${c.kind}:${c.id}`}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => { e.preventDefault(); choose(c); }}
                className={`flex min-h-[44px] cursor-pointer items-center gap-3 px-3 py-2 text-sm ${i === active ? "bg-ink/10" : ""}`}
              >
                {c.agentKey ? <Constellation agent={c.agentKey} color={c.color ?? "#888"} size={22} /> : <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-ink/10 text-[10px] font-semibold">{c.label.slice(0, 1).toUpperCase()}</span>}
                <span className="font-medium">{c.label}</span>
                <span className="ml-auto text-xs text-muted">{c.detail}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <textarea
          ref={ref}
          value={text}
          rows={1}
          placeholder={placeholder}
          aria-label="Message"
          role="combobox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-activedescendant={open ? `${listId}-${Math.min(active, options.length - 1)}` : undefined}
          aria-autocomplete="list"
          onChange={(e) => {
            setText(e.target.value);
            setCaret(e.target.selectionStart);
            setDismissed(false);
            setActive(0);
            resize();
          }}
          onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
          onKeyDown={onKeyDown}
          className="min-h-[44px] flex-1 resize-none rounded-lg border border-line bg-surface px-3.5 py-2.5 text-base leading-snug placeholder:text-muted/70 md:text-sm"
        />
        <Button type="button" onClick={() => void submit()} disabled={sending || busy || !text.trim()}>
          Send
        </Button>
      </div>
      <p className="mt-1.5 hidden text-xs text-muted md:block">Enter to send, Shift+Enter for a new line. Type @ to mention a teammate or an agent.</p>
    </div>
  );
}
