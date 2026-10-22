import { describe, expect, it } from "vitest";
import { agentRenameSchema, inviteCreateSchema, loginSchema, registerSchema, safeNext } from "@/lib/schemas";
import { slugify } from "@/lib/slug";
import { escapeHtml } from "@/lib/mail";

describe("validation", () => {
  it("normalises email and enforces the password rules", () => {
    const ok = registerSchema.parse({ name: " Ada ", email: " ADA@Example.COM ", password: "1234567890", acceptTerms: true });
    expect(ok.email).toBe("ada@example.com");
    expect(ok.name).toBe("Ada");
    expect(registerSchema.safeParse({ name: "A", email: "a@b.co", password: "short", acceptTerms: true }).success).toBe(false);
    expect(registerSchema.safeParse({ name: "A", email: "a@b.co", password: "1234567890", acceptTerms: false }).success).toBe(false);
  });

  it("login only needs a non-empty password", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "x" }).success).toBe(true);
  });

  it("owners can never be invited", () => {
    expect(inviteCreateSchema.safeParse({ email: "a@b.co", role: "OWNER" }).success).toBe(false);
    expect(inviteCreateSchema.safeParse({ email: "a@b.co", role: "VIEWER" }).success).toBe(true);
  });

  it("agent names are plain text", () => {
    expect(agentRenameSchema.safeParse({ name: "Lyra 2" }).success).toBe(true);
    expect(agentRenameSchema.safeParse({ name: "<script>" }).success).toBe(false);
  });
});

describe("safeNext (open redirect guard)", () => {
  it("allows same-site paths only", () => {
    expect(safeNext("/w/acme")).toBe("/w/acme");
    expect(safeNext("https://evil.com")).toBe("/app");
    expect(safeNext("//evil.com")).toBe("/app");
    expect(safeNext("/\\evil.com")).toBe("/app");
    expect(safeNext(undefined)).toBe("/app");
    expect(safeNext("javascript:alert(1)", "")).toBe("");
  });
});

describe("helpers", () => {
  it("slugifies names", () => {
    expect(slugify("Café Ünïcode & Co!")).toBe("cafe-unicode-co");
    expect(slugify("!!!")).toBe("workspace");
  });
  it("escapes html in emails", () => {
    expect(escapeHtml(`<b onclick="x">&'`)).toBe("&lt;b onclick=&quot;x&quot;&gt;&amp;&#39;");
  });
});
