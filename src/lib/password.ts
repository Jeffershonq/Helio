import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// scrypt with N=2^15, r=8, p=3 is one of the OWASP-recommended equivalent settings.
// Stored as: scrypt$<log2 N>$<r>$<p>$<salt>$<hash>, so the cost can be raised later.
const LOG2_N = 15;
const R = 8;
const P = 3;
const KEYLEN = 32;
const MAXMEM = 128 * 1024 * 1024;

function derive(password: string, salt: Buffer, log2n: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, KEYLEN, { N: 2 ** log2n, r, p, maxmem: MAXMEM }, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, LOG2_N, R, P);
  return ["scrypt", LOG2_N, R, P, salt.toString("base64url"), key.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !n || !r || !p || !salt || !hash) return false;
  const log2n = Number(n);
  if (!(log2n >= 10 && log2n <= 20)) return false; // refuse absurd costs from corrupted rows
  const expected = Buffer.from(hash, "base64url");
  const actual = await derive(password, Buffer.from(salt, "base64url"), log2n, Number(r), Number(p));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

let dummy: Promise<string> | undefined;

/** Burns the same CPU as a real check, so unknown emails cannot be told apart by timing. */
export async function verifyAgainstDummy(password: string): Promise<false> {
  dummy ??= hashPassword("helio-dummy-password");
  await verifyPassword(password, await dummy);
  return false;
}
