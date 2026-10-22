export const ROLES = ["OWNER", "ADMIN", "MEMBER", "VIEWER"] as const;
export type Role = (typeof ROLES)[number];

export type Permission =
  | "workspace:read"
  | "workspace:edit"
  | "workspace:delete"
  | "content:write" // projects, tasks, messages, answering requests
  | "agent:edit"
  | "provider:manage"
  | "limits:edit"
  | "member:invite"
  | "member:manage"
  | "audit:read";

const MEMBER: Permission[] = ["workspace:read", "content:write"];
const ADMIN: Permission[] = [
  ...MEMBER,
  "workspace:edit",
  "agent:edit",
  "provider:manage",
  "limits:edit",
  "member:invite",
  "member:manage",
  "audit:read",
];

const GRANTS: Record<Role, ReadonlySet<Permission>> = {
  OWNER: new Set<Permission>([...ADMIN, "workspace:delete"]),
  ADMIN: new Set<Permission>(ADMIN),
  MEMBER: new Set<Permission>(MEMBER),
  VIEWER: new Set<Permission>(["workspace:read"]), // read-only
};

export function can(role: Role, permission: Permission): boolean {
  return GRANTS[role].has(permission);
}

/** Owners can hand out any role. Admins can only create Members and Viewers. */
export function canAssignRole(actor: Role, target: Role): boolean {
  if (actor === "OWNER") return true;
  if (actor === "ADMIN") return target === "MEMBER" || target === "VIEWER";
  return false;
}
