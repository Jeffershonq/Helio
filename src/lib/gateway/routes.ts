import { streamChat, type StreamOptions } from "@/lib/gateway/client";
import { GatewayError, type ChatMessage, type GatewayConfig, type StreamEvent, type Tier, type TierModels } from "@/lib/gateway/types";

export type Source = "OWN" | "PLATFORM";
export interface Route {
  source: Source;
  cfg: GatewayConfig;
}
export type RoutedEvent = StreamEvent | { type: "route"; source: Source };

export interface RouteInputs {
  mode: "PLATFORM" | "OWN";
  fallbackToPlatform: boolean;
  tier: Tier;
  /** The workspace's own provider, or null when it has no usable key. */
  own: GatewayConfig | null;
  /** The shared provider, or null when this install has none. */
  platform: GatewayConfig | null;
}

/**
 * Decides which providers a run may use, in order.
 *  - PLATFORM mode: the shared provider.
 *  - OWN mode: the workspace's own key first, for the tiers it has a model for. Tiers it does not cover go to
 *    the shared provider. If the own key fails, the shared provider is tried next when fallback is on.
 */
export function buildRoutes(i: RouteInputs): Route[] {
  const shared: Route | null = i.platform?.tiers[i.tier] ? { source: "PLATFORM", cfg: i.platform } : null;
  const routes: Route[] = [];
  if (i.mode === "OWN") {
    if (i.own?.tiers[i.tier]) routes.push({ source: "OWN", cfg: i.own });
    if (shared && (routes.length === 0 || i.fallbackToPlatform)) routes.push(shared);
  } else if (shared) {
    routes.push(shared);
  }
  if (routes.length) return routes;

  if (i.mode === "OWN" && i.own) {
    throw new GatewayError("not_configured", `No model is set for the ${i.tier.toLowerCase()} tier. An admin can choose one in Settings.`);
  }
  throw new GatewayError(
    "not_configured",
    i.platform
      ? `The shared provider has no model for the ${i.tier.toLowerCase()} tier. Ask whoever runs this Helio install to set one.`
      : "No model provider is set up. An admin can add an API key in Settings.",
  );
}

/** Errors where trying the next provider can help. A bad request or a stop would fail the same way again. */
const FAILOVER = new Set(["auth", "rate_limit", "unavailable", "timeout", "model_not_found"]);

export interface RoutedOptions extends StreamOptions {
  /** Called before each route. Return a reason to refuse the route (for example a daily limit on the shared provider). */
  beforeRoute?: (route: Route) => Promise<string | undefined>;
}

/**
 * Streams from the first route that works. Moves to the next route only if nothing has been sent yet,
 * so the reader never sees text from two providers mixed together.
 */
export async function* streamWithRoutes(
  routes: Route[],
  tier: Tier,
  messages: ChatMessage[],
  opts: RoutedOptions = {},
  stream: typeof streamChat = streamChat,
): AsyncGenerator<RoutedEvent> {
  let last: unknown = new GatewayError("not_configured", "No model provider is set up. An admin can add an API key in Settings.");
  for (const [i, route] of routes.entries()) {
    const isLast = i === routes.length - 1;
    const refusal = await opts.beforeRoute?.(route);
    if (refusal) {
      last = new GatewayError("limited", refusal);
      if (isLast) throw last;
      continue;
    }
    yield { type: "route", source: route.source };
    let started = false;
    try {
      for await (const ev of stream(route.cfg, tier, messages, opts)) {
        if (ev.type === "delta") started = true;
        yield ev;
      }
      return;
    } catch (err) {
      last = err;
      const canMoveOn = !started && err instanceof GatewayError && FAILOVER.has(err.code) && !isLast;
      if (!canMoveOn) throw err;
    }
  }
  throw last;
}

export const tiersOf = (cfg: GatewayConfig | null): TierModels => cfg?.tiers ?? {};
