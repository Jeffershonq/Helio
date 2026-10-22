import { describe, expect, it } from "vitest";
import { parseMentions, uniqueIds, type MentionCandidate } from "@/lib/mentions";

const people: MentionCandidate[] = [
  { kind: "agent", id: "a1", label: "Lyra" },
  { kind: "agent", id: "a2", label: "Carina" },
  { kind: "agent", id: "a3", label: "Lyra Two" },
  { kind: "user", id: "u1", label: "Ada Lovelace" },
  { kind: "user", id: "u2", label: "Ada" },
];

const ids = (t: string) => parseMentions(t, people).map((m) => m.id);

describe("parseMentions", () => {
  it("finds agents and people, case-insensitively", () => {
    expect(ids("@lyra remind me, and @CARINA plan it")).toEqual(["a1", "a2"]);
  });

  it("supports names with spaces and picks the longest name", () => {
    expect(ids("@Lyra Two please")).toEqual(["a3"]);
    expect(ids("@Ada Lovelace hi")).toEqual(["u1"]);
    expect(ids("@Ada hi")).toEqual(["u2"]);
  });

  it("reports exact positions", () => {
    const [m] = parseMentions("hey @Carina!", people);
    expect(m).toMatchObject({ id: "a2", start: 4, end: 11 });
  });

  it("ignores emails, partial names and unknown names", () => {
    expect(ids("mail me at bob@Lyra.com")).toEqual([]);
    expect(ids("@Lyrax is not Lyra")).toEqual([]);
    expect(ids("@Nobody")).toEqual([]);
  });

  it("ignores mentions inside code", () => {
    expect(ids("run `@Lyra` now")).toEqual([]);
    expect(ids("```\n@Carina\n```\nthen @Lyra")).toEqual(["a1"]);
    expect(ids("```\n@Carina (never closed)")).toEqual([]);
  });

  it("de-duplicates by kind", () => {
    const m = parseMentions("@Lyra @lyra @Ada", people);
    expect(uniqueIds(m, "agent")).toEqual(["a1"]);
    expect(uniqueIds(m, "user")).toEqual(["u2"]);
  });

  it("handles unicode names and punctuation after the name", () => {
    const c: MentionCandidate[] = [{ kind: "user", id: "u9", label: "José" }];
    expect(parseMentions("hola @josé, qué tal", c).map((m) => m.id)).toEqual(["u9"]);
  });
});
