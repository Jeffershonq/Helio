import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { HttpError } from "@/lib/http-error";

/**
 * SSRF guard for user-supplied model provider URLs.
 * Known limit: DNS is resolved here and again by fetch(), so a hostile DNS server could still rebind
 * between the two. The sandbox egress allow-list in Phase 3 closes that gap for agent traffic.
 */

export class UnsafeUrlError extends HttpError {
  constructor(message: string) {
    super(400, message, "unsafe_url", { baseUrl: [message] });
  }
}

function privateV4(ip: string): boolean {
  const [a = 0, b = 0, c = 0] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) || // link-local, cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224 // multicast and reserved
  );
}

function privateV6(ip: string): boolean {
  const lower = ip.toLowerCase().split("%")[0] ?? "";
  const dotted = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
  if (dotted) return privateV4(dotted[1]!);
  const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(lower);
  if (hex) {
    const hi = parseInt(hex[1]!, 16);
    const lo = parseInt(hex[2]!, 16);
    return privateV4(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
  }
  if (lower.startsWith("::")) return true; // ::, ::1 and other special-purpose forms
  const first = lower.split(":")[0] ?? "";
  return (
    /^f[cd]/.test(first) || // fc00::/7 unique local
    /^fe[89ab]/.test(first) || // fe80::/10 link-local
    first.startsWith("ff") || // multicast
    lower.startsWith("64:ff9b:") // NAT64
  );
}

export function isPrivateIp(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return privateV4(ip);
  if (kind === 6) return privateV6(ip);
  return true; // not an IP: treat as unsafe
}

const defaultResolve = async (host: string) => (await lookup(host, { all: true })).map((r) => r.address);

export interface UrlCheckOptions {
  allowPrivate?: boolean;
  resolve?: (host: string) => Promise<string[]>;
}

export async function assertSafeProviderUrl(raw: string, opts: UrlCheckOptions = {}): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError("That is not a valid URL.");
  }
  if (url.username || url.password) throw new UnsafeUrlError("Remove the username and password from the URL.");
  if (url.protocol !== "https:" && !(url.protocol === "http:" && opts.allowPrivate)) {
    throw new UnsafeUrlError("Use an https:// URL.");
  }
  if (opts.allowPrivate) return url; // self-hosted setup: the admin opted in via ALLOW_PRIVATE_PROVIDER_URLS

  const host = url.hostname.replace(/^\[|\]$/g, "");
  let addresses: string[];
  try {
    addresses = isIP(host) ? [host] : await (opts.resolve ?? defaultResolve)(host);
  } catch {
    throw new UnsafeUrlError("Could not find that host.");
  }
  if (addresses.length === 0 || addresses.some(isPrivateIp)) {
    throw new UnsafeUrlError("That address points to a private network, which is not allowed.");
  }
  return url;
}
