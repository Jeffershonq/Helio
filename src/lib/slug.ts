import { randomBytes } from "node:crypto";

export function slugify(input: string): string {
  const slug = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return slug || "workspace";
}

/** Slugs always get a short random suffix, so names never collide and slugs are hard to guess. */
export function slugWithSuffix(name: string): string {
  return `${slugify(name)}-${randomBytes(3).toString("hex")}`;
}
