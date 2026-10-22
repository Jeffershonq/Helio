export interface MentionCandidate {
  kind: "agent" | "user";
  id: string;
  label: string; // the name people type after the @, may contain spaces
}

export interface MentionMatch extends MentionCandidate {
  start: number; // index of the "@"
  end: number; // index just after the name
}

const WORD = /[\p{L}\p{N}_]/u;

/** Index ranges covered by ``` fences and `inline code`, where mentions must be ignored. */
function codeRanges(text: string): [number, number][] {
  const ranges: [number, number][] = [];
  const re = /```[\s\S]*?(?:```|$)|`[^`\n]*`/g;
  for (let m = re.exec(text); m; m = re.exec(text)) ranges.push([m.index, m.index + m[0].length]);
  return ranges;
}

/**
 * Finds @mentions of known agents and people.
 * Names may contain spaces ("@Ada Lovelace"). Matching is case-insensitive and the longest name wins.
 * An "@" glued to a word (an email address) is not a mention.
 */
export function parseMentions(text: string, candidates: MentionCandidate[]): MentionMatch[] {
  const sorted = candidates.filter((c) => c.label.trim()).sort((a, b) => b.label.length - a.label.length);
  const code = codeRanges(text);
  const out: MentionMatch[] = [];
  let i = 0;
  while (i < text.length) {
    const at = text.indexOf("@", i);
    if (at === -1) break;
    i = at + 1;
    if (at > 0 && WORD.test(text[at - 1]!)) continue;
    if (code.some(([s, e]) => at >= s && at < e)) continue;
    for (const c of sorted) {
      const end = at + 1 + c.label.length;
      if (text.slice(at + 1, end).toLowerCase() !== c.label.toLowerCase()) continue;
      if (end < text.length && WORD.test(text[end]!)) continue; // "@Lyrax" is not "@Lyra"
      out.push({ ...c, start: at, end });
      i = end;
      break;
    }
  }
  return out;
}

export function uniqueIds(matches: MentionMatch[], kind: "agent" | "user"): string[] {
  return [...new Set(matches.filter((m) => m.kind === kind).map((m) => m.id))];
}
