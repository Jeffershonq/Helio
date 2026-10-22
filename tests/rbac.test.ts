import { describe, expect, it } from "vitest";
import { can, canAssignRole, type Permission, type Role } from "@/lib/rbac";

const ALL: Permission[] = [
  "workspace:read", "workspace:edit", "workspace:delete", "content:write", "agent:edit",
  "provider:manage", "limits:edit", "member:invite", "member:manage", "audit:read",
];

describe("permissions", () => {
  it("viewers are read-only", () => {
    expect(ALL.filter((p) => can("VIEWER", p))).toEqual(["workspace:read"]);
  });

  it("members can work but cannot touch agents, keys or limits", () => {
    expect(can("MEMBER", "content:write")).toBe(true);
    for (const p of ["agent:edit", "provider:manage", "limits:edit", "member:invite", "workspace:delete"] as Permission[]) {
      expect(can("MEMBER", p)).toBe(false);
    }
  });

  it("admins manage agents, keys and limits, but cannot delete the workspace", () => {
    for (const p of ["agent:edit", "provider:manage", "limits:edit", "member:invite"] as Permission[]) {
      expect(can("ADMIN", p)).toBe(true);
    }
    expect(can("ADMIN", "workspace:delete")).toBe(false);
  });

  it("owners can do everything", () => {
    expect(ALL.every((p) => can("OWNER", p))).toBe(true);
  });
});

describe("role assignment", () => {
  it("owners assign anything; admins only member and viewer; others nothing", () => {
    const roles: Role[] = ["OWNER", "ADMIN", "MEMBER", "VIEWER"];
    expect(roles.every((r) => canAssignRole("OWNER", r))).toBe(true);
    expect(roles.filter((r) => canAssignRole("ADMIN", r))).toEqual(["MEMBER", "VIEWER"]);
    expect(roles.some((r) => canAssignRole("MEMBER", r))).toBe(false);
    expect(roles.some((r) => canAssignRole("VIEWER", r))).toBe(false);
  });
});
