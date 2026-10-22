import { z } from "zod";

const bool = z.enum(["true", "false"]).default("false").transform((v) => v === "true");

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: z.string().min(1).default("redis://localhost:6379"),
  // 32 random bytes as 64 hex characters. Generate one with: openssl rand -hex 32
  MASTER_KEY: z.string().regex(/^[0-9a-fA-F]{64}$/, "MASTER_KEY must be 64 hex characters (32 bytes)"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().default(1025),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default("Helio <no-reply@helio.local>"),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  // Self-hosters who run LiteLLM or 9Router on a private address can switch this on.
  ALLOW_PRIVATE_PROVIDER_URLS: bool,
  // Set to true only when a reverse proxy in front of the app overwrites X-Forwarded-For.
  TRUST_PROXY: z.enum(["true", "false"]).default("true").transform((v) => v === "true"),
  // The shared provider every workspace uses by default (for example your 9Router).
  // The key is optional: leave it empty if the endpoint needs none.
  PLATFORM_LLM_BASE_URL: z.string().url().optional(),
  PLATFORM_LLM_API_KEY: z.string().optional(),
  // The model each tier uses on the shared provider, with an optional fallback. Operators choose these,
  // so people cannot point the shared provider at expensive models by themselves.
  PLATFORM_MODEL_LIGHT: z.string().optional(),
  PLATFORM_MODEL_LIGHT_FALLBACK: z.string().optional(),
  PLATFORM_MODEL_MEDIUM: z.string().optional(),
  PLATFORM_MODEL_MEDIUM_FALLBACK: z.string().optional(),
  PLATFORM_MODEL_HEAVY: z.string().optional(),
  PLATFORM_MODEL_HEAVY_FALLBACK: z.string().optional(),
  // Daily token limits on the shared provider, per workspace and per person. 0 means unlimited.
  // Usage through a workspace's own API key never counts here.
  PLATFORM_DAILY_TOKENS_WORKSPACE: z.coerce.number().int().min(0).default(1_000_000),
  PLATFORM_DAILY_TOKENS_USER: z.coerce.number().int().min(0).default(300_000),
});

export type Env = z.infer<typeof schema>;

/** Parses an environment. Empty values (`KEY=` in a .env file) count as "not set". */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const cleaned = Object.fromEntries(Object.entries(source).map(([k, v]) => [k, v === "" ? undefined : v]));
  const parsed = schema.safeParse(cleaned);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid environment:\n${lines.join("\n")}`);
  }
  return parsed.data;
}

let cached: Env | undefined;

/** Validated environment. Read lazily so `next build` works without secrets. */
export function env(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}

export const googleEnabled = () => Boolean(env().GOOGLE_CLIENT_ID && env().GOOGLE_CLIENT_SECRET);
export const platformDefaultEnabled = () => Boolean(env().PLATFORM_LLM_BASE_URL);
