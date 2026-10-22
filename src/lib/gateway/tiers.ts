import { z } from "zod";
import { TIERS, type TierModel, type TierModels } from "@/lib/gateway/types";

const optionalText = z
  .string()
  .trim()
  .max(200)
  .optional()
  .transform((v) => v || undefined);

export const tierModelSchema = z.object({
  model: z.string().trim().min(1).max(200),
  fallback: optionalText,
  inputPerMTok: z.number().min(0).max(100_000).optional(),
  outputPerMTok: z.number().min(0).max(100_000).optional(),
});

/** Reads the workspace's tier mapping from the database. A bad entry is dropped, never fatal. */
export function parseTierModels(raw: unknown): TierModels {
  const out: TierModels = {};
  for (const tier of TIERS) {
    const parsed = tierModelSchema.safeParse((raw as Record<string, unknown> | null)?.[tier]);
    if (parsed.success) out[tier] = parsed.data;
  }
  return out;
}

export function estimateCostUsd(tm: TierModel | undefined, inputTokens: number, outputTokens: number): number {
  if (!tm) return 0;
  const cost = ((tm.inputPerMTok ?? 0) * inputTokens + (tm.outputPerMTok ?? 0) * outputTokens) / 1_000_000;
  return Math.round(cost * 1e6) / 1e6;
}
