import { z } from "zod";

// Shared by the browser forms and the API routes, so both sides validate the same way.

export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address").max(254);

export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(128, "Use at most 128 characters");

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(80),
  email: emailSchema,
  password: passwordSchema,
  acceptTerms: z.boolean().refine((v) => v === true, "Accept the terms to continue"),
  next: z.string().optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password").max(128),
  next: z.string().optional(),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  password: passwordSchema,
});

export const workspaceCreateSchema = z.object({
  name: z.string().trim().min(2, "Use at least 2 characters").max(60),
  description: z.string().trim().max(280).optional(),
});

export const providerSchema = z.object({
  label: z.string().trim().min(1).max(60).default("Default"),
  baseUrl: z.string().trim().url("Enter a full URL, for example https://api.openai.com/v1").max(300),
  apiKey: z.string().trim().min(8, "That key looks too short").max(500),
});

export const providerTestSchema = providerSchema.pick({ baseUrl: true, apiKey: true });

export const usePlatformDefaultSchema = z.object({ usePlatformDefault: z.literal(true) });

export const agentRenameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Use at least 2 characters")
    .max(24, "Use at most 24 characters")
    .regex(/^[\p{L}\p{N} _-]+$/u, "Use letters, numbers, spaces, - or _"),
});

export const projectCreateSchema = z.object({
  name: z.string().trim().min(2, "Use at least 2 characters").max(80),
  description: z.string().trim().max(500).optional(),
});

export const inviteCreateSchema = z.object({
  email: emailSchema,
  role: z.enum(["ADMIN", "MEMBER", "VIEWER"]), // owners are never invited
});

/** Only same-site relative paths are allowed as a post-login destination (prevents open redirects). */
export function safeNext(next: string | null | undefined, fallback = "/app"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}

export const messageSchema = z.object({
  body: z.string().trim().min(1, "Write a message first").max(8000, "Messages can be up to 8,000 characters"),
  replyToId: z.string().min(1).max(64).optional(),
});

const tierInput = z.object({
  model: z.string().trim().max(200), // empty string clears the tier
  fallback: z.string().trim().max(200).optional(),
  inputPerMTok: z.number().min(0).max(100_000).nullish(),
  outputPerMTok: z.number().min(0).max(100_000).nullish(),
});
export const tierModelsInputSchema = z.object({ LIGHT: tierInput, MEDIUM: tierInput, HEAVY: tierInput });

export const projectUpdateSchema = z
  .object({
    archived: z.boolean().optional(),
    defaultAgentKey: z.string().trim().min(1).max(40).optional(),
    name: z.string().trim().min(2).max(80).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Nothing to change");

export const providerSettingsSchema = z
  .object({
    mode: z.enum(["PLATFORM", "OWN"]).optional(),
    fallbackToPlatform: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Nothing to change");
