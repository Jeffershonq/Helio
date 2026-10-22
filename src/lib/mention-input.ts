import type { MentionCandidate } from "@/lib/mentions";

/** If the caret is right after "@something", returns where the @ is and what was typed. */
export function activeMentionQuery(text: string, caret: number): { start: number; query: string } | null {
  const before = text.slice(0, caret);
  const m = /(^|[^\p{L}\p{N}_])@([\p{L}\p{N}_ -]{0,30})$/u.exec(before);
  if (!m) return null;
  const query = m[2] ?? "";
  return { start: before.length - query.length - 1, query };
}

/** Names that start with the query come first, then names that contain it. */
export function filterCandidates<T extends MentionCandidate>(candidates: T[], query: string, limit = 6): T[] {
  const q = query.toLowerCase();
  const starts = candidates.filter((c) => c.label.toLowerCase().startsWith(q));
  const contains = q ? candidates.filter((c) => !c.label.toLowerCase().startsWith(q) && c.label.toLowerCase().includes(q)) : [];
  return [...starts, ...contains].slice(0, limit);
}

/** Replaces "@que" with "@Full Name " and returns the new text and caret. */
export function applyMention(text: string, caret: number, start: number, label: string) {
  const inserted = `@${label} `;
  return { text: text.slice(0, start) + inserted + text.slice(caret), caret: start + inserted.length };
}

/** Wraps known mentions in bold so they stand out when the message is rendered. */
export function emphasizeMentions(body: string, ranges: { start: number; end: number }[]): string {
  let out = body;
  for (const r of [...ranges].sort((a, b) => b.start - a.start)) out = `${out.slice(0, r.start)}**${out.slice(r.start, r.end)}**${out.slice(r.end)}`;
  return out;
}
