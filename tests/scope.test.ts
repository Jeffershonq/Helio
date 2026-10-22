import { describe, expect, it } from "vitest";
import { applyWorkspaceScope as scope } from "@/lib/scope";

const WS = "ws_a";

describe("workspace scoping", () => {
  it("forces the workspace filter on reads, even if the caller forgot it", () => {
    expect(scope("Task", "findMany", {}, WS)).toEqual({ where: { workspaceId: WS } });
    expect(scope("Task", "count", undefined, WS)).toEqual({ where: { workspaceId: WS } });
    expect(scope("Task", "findFirst", { where: { status: "DONE" } }, WS)).toEqual({ where: { status: "DONE", workspaceId: WS } });
  });

  it("a caller cannot override the filter to read another workspace", () => {
    const args = scope("Task", "findMany", { where: { workspaceId: "ws_b" } }, WS);
    expect(args).toEqual({ where: { workspaceId: WS } });
  });

  it("scopes updates and deletes", () => {
    expect(scope("Task", "update", { where: { id: "1" }, data: { title: "x" } }, WS)).toEqual({
      where: { id: "1", workspaceId: WS },
      data: { title: "x" },
    });
    expect(scope("Task", "deleteMany", { where: { done: true } }, WS)).toEqual({ where: { done: true, workspaceId: WS } });
  });

  it("stamps workspaceId on creates", () => {
    expect(scope("Task", "create", { data: { title: "x" } }, WS)).toEqual({ data: { title: "x", workspaceId: WS } });
    expect(scope("Task", "createMany", { data: [{ title: "a" }, { title: "b" }] }, WS)).toEqual({
      data: [{ title: "a", workspaceId: WS }, { title: "b", workspaceId: WS }],
    });
  });

  it("scopes upsert on all three parts", () => {
    const out = scope("Agent", "upsert", { where: { id: "1" }, create: { key: "x" }, update: { name: "y" } }, WS);
    expect(out).toEqual({ where: { id: "1", workspaceId: WS }, create: { key: "x", workspaceId: WS }, update: { name: "y" } });
  });

  it("refuses to write into or move a row to another workspace", () => {
    expect(() => scope("Task", "create", { data: { workspaceId: "ws_b" } }, WS)).toThrow(/different workspace/);
    expect(() => scope("Task", "update", { where: { id: "1" }, data: { workspaceId: "ws_b" } }, WS)).toThrow();
    expect(() => scope("Task", "createMany", { data: [{ workspaceId: "ws_b" }] }, WS)).toThrow();
    expect(() => scope("Task", "create", { data: { workspace: { connect: { id: "ws_b" } } } }, WS)).toThrow(/relation/);
  });

  it("blocks operations it does not understand", () => {
    expect(() => scope("Task", "findRaw", {}, WS)).toThrow(/not allowed/);
  });

  it("requires a workspace id and leaves identity models alone", () => {
    expect(() => scope("Task", "findMany", {}, "")).toThrow();
    const args = { where: { email: "a@b.c" } };
    expect(scope("User", "findUnique", args, WS)).toBe(args);
  });
});
