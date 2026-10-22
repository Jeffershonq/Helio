import { describe, expect, it } from "vitest";
import { assertSafeProviderUrl, isPrivateIp } from "@/lib/provider-url";

describe("isPrivateIp", () => {
  it.each([
    "127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254",
    "0.0.0.0", "100.64.0.1", "224.0.0.1", "::1", "::", "fc00::1", "fd12:3456::1", "fe80::1",
    "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:a00:1", "ff02::1",
  ])("%s is private", (ip) => expect(isPrivateIp(ip)).toBe(true));

  it.each(["8.8.8.8", "1.1.1.1", "172.15.0.1", "172.32.0.1", "104.18.0.1", "2606:4700:4700::1111", "::ffff:8.8.8.8"])(
    "%s is public",
    (ip) => expect(isPrivateIp(ip)).toBe(false),
  );

  it("treats garbage as unsafe", () => expect(isPrivateIp("not-an-ip")).toBe(true));
});

describe("assertSafeProviderUrl", () => {
  const publicHost = async () => ["104.18.1.1"];

  it("accepts a public https URL", async () => {
    const url = await assertSafeProviderUrl("https://api.example.com/v1", { resolve: publicHost });
    expect(url.hostname).toBe("api.example.com");
  });

  it("rejects http, credentials and junk", async () => {
    await expect(assertSafeProviderUrl("http://api.example.com/v1", { resolve: publicHost })).rejects.toThrow(/https/);
    await expect(assertSafeProviderUrl("https://user:pw@api.example.com", { resolve: publicHost })).rejects.toThrow(/password/);
    await expect(assertSafeProviderUrl("nope", { resolve: publicHost })).rejects.toThrow(/valid URL/);
  });

  it("rejects hosts that resolve to private addresses, including mixed answers", async () => {
    await expect(assertSafeProviderUrl("https://evil.example.com", { resolve: async () => ["10.0.0.5"] })).rejects.toThrow(/private/);
    await expect(assertSafeProviderUrl("https://evil.example.com", { resolve: async () => ["8.8.8.8", "127.0.0.1"] })).rejects.toThrow(/private/);
  });

  it("rejects IP literals and cloud metadata", async () => {
    await expect(assertSafeProviderUrl("https://169.254.169.254/latest")).rejects.toThrow(/private/);
    await expect(assertSafeProviderUrl("https://[::1]/v1")).rejects.toThrow(/private/);
  });

  it("lets self-hosters opt in to private addresses", async () => {
    const url = await assertSafeProviderUrl("http://localhost:20128/v1", { allowPrivate: true });
    expect(url.port).toBe("20128");
  });
});
