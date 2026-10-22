import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

const VERSION = "v1";

function masterKey(): Buffer {
  return Buffer.from(env().MASTER_KEY, "hex");
}

/**
 * Encrypts a secret with AES-256-GCM.
 * `aad` (additional authenticated data) binds the ciphertext to its owner, for example a
 * workspace id, so a ciphertext copied into another workspace fails to decrypt.
 * Output format: v1.<iv>.<tag>.<ciphertext>, all base64url.
 */
export function encryptSecret(plain: string, aad: string, key: Buffer = masterKey()): string {
  if (key.length !== 32) throw new Error("Encryption key must be 32 bytes");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ct.toString("base64url")].join(".");
}

export function decryptSecret(payload: string, aad: string, key: Buffer = masterKey()): string {
  const [version, iv, tag, ct] = payload.split(".");
  if (version !== VERSION || !iv || !tag || !ct) throw new Error("Unsupported secret format");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]).toString("utf8");
}

/** URL-safe random token, 256 bits by default. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Masks a secret for display: only the last four characters survive. */
export function last4(secret: string): string {
  return secret.slice(-4);
}
