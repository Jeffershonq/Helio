import { env, type Env } from "@/lib/env";
import { TIERS, type GatewayConfig, type TierModels } from "@/lib/gateway/types";

/** The model for each tier on the shared provider, as set by whoever runs this install. */
export function platformTiers(e: Env): TierModels {
  const wanted = {
    LIGHT: [e.PLATFORM_MODEL_LIGHT, e.PLATFORM_MODEL_LIGHT_FALLBACK],
    MEDIUM: [e.PLATFORM_MODEL_MEDIUM, e.PLATFORM_MODEL_MEDIUM_FALLBACK],
    HEAVY: [e.PLATFORM_MODEL_HEAVY, e.PLATFORM_MODEL_HEAVY_FALLBACK],
  } as const;
  const out: TierModels = {};
  for (const tier of TIERS) {
    const [model, fallback] = wanted[tier];
    if (model) out[tier] = { model, ...(fallback ? { fallback } : {}) };
  }
  return out;
}

/** The shared provider, or null when this install has none. */
export function platformConfig(e: Env = env()): GatewayConfig | null {
  if (!e.PLATFORM_LLM_BASE_URL) return null;
  return { baseUrl: e.PLATFORM_LLM_BASE_URL, apiKey: e.PLATFORM_LLM_API_KEY ?? "", tiers: platformTiers(e) };
}
