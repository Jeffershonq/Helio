export const TIERS = ["LIGHT", "MEDIUM", "HEAVY"] as const;
export type Tier = (typeof TIERS)[number];

export interface TierModel {
  model: string;
  fallback?: string;
  /** Optional prices in USD per million tokens, used only for cost estimates. */
  inputPerMTok?: number;
  outputPerMTok?: number;
}
export type TierModels = Partial<Record<Tier, TierModel>>;

export interface GatewayConfig {
  baseUrl: string;
  apiKey: string;
  tiers: TierModels;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export type StreamEvent =
  | { type: "delta"; text: string }
  | { type: "done"; model: string; inputTokens: number; outputTokens: number; estimated: boolean };

export type GatewayErrorCode = "not_configured" | "auth" | "rate_limit" | "model_not_found" | "unavailable" | "timeout" | "bad_request" | "aborted" | "limited";

export class GatewayError extends Error {
  constructor(
    public code: GatewayErrorCode,
    message: string,
    public retryable = false,
    public retryAfterMs?: number,
  ) {
    super(message);
  }
}
