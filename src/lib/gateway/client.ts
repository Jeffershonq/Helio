import { parseSse } from "@/lib/gateway/sse";
import { GatewayError, type ChatMessage, type GatewayConfig, type StreamEvent, type Tier } from "@/lib/gateway/types";

const MAX_RETRIES = 2;
const TOTAL_TIMEOUT_MS = 5 * 60_000;

export interface StreamOptions {
  signal?: AbortSignal;
  maxTokens?: number;
  temperature?: number;
  fetchImpl?: typeof fetch; // tests
  sleep?: (ms: number) => Promise<void>; // tests
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function classify(status: number, retryAfter: string | null, body: string): GatewayError {
  const retryAfterMs = retryAfter && /^\d+$/.test(retryAfter) ? Math.min(Number(retryAfter) * 1000, 5000) : undefined;
  if (status === 401 || status === 403) return new GatewayError("auth", "The provider rejected the API key. An admin can update it in Settings.");
  if (status === 408 || status === 429) return new GatewayError("rate_limit", "The provider is limiting requests right now.", true, retryAfterMs);
  if (status >= 500) return new GatewayError("unavailable", `The provider had a problem (status ${status}).`, true, retryAfterMs);
  if (status === 404 || (status === 400 && /model/i.test(body) && /(not found|does not exist|unknown|invalid)/i.test(body))) {
    return new GatewayError("model_not_found", "The provider could not find the chosen model.");
  }
  if (/context|too long|maximum/i.test(body)) return new GatewayError("bad_request", "The conversation is too long for this model.");
  return new GatewayError("bad_request", `The provider could not process this request (status ${status}).`);
}

function toGatewayError(err: unknown, userSignal?: AbortSignal): GatewayError {
  if (err instanceof GatewayError) return err;
  if (userSignal?.aborted) return new GatewayError("aborted", "Stopped.");
  if ((err as Error)?.name === "TimeoutError") return new GatewayError("timeout", "The provider took too long to answer.");
  return new GatewayError("unavailable", "Could not reach the provider.", true);
}

async function* attempt(cfg: GatewayConfig, model: string, messages: ChatMessage[], opts: StreamOptions): AsyncGenerator<StreamEvent> {
  const timeout = AbortSignal.timeout(TOTAL_TIMEOUT_MS);
  const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;
  const send = (includeUsage: boolean) =>
    (opts.fetchImpl ?? fetch)(`${cfg.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: { ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}), "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        ...(includeUsage ? { stream_options: { include_usage: true } } : {}),
        ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
        ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
      }),
      redirect: "error",
      signal,
    });

  let res = await send(true);
  if (res.status === 400) {
    // Some gateways reject `stream_options`. Ask again without it; token counts are then estimated.
    const body = (await res.text().catch(() => "")).slice(0, 500);
    if (!/stream_options|include_usage/i.test(body)) throw classify(400, res.headers.get("retry-after"), body);
    res = await send(false);
  }
  if (!res.ok) throw classify(res.status, res.headers.get("retry-after"), (await res.text().catch(() => "")).slice(0, 500));
  if (!res.body) throw new GatewayError("unavailable", "The provider sent an empty response.", true);

  let outChars = 0;
  let usage: { prompt_tokens?: number; completion_tokens?: number } | undefined;
  for await (const data of parseSse(res.body)) {
    if (data === "[DONE]") break;
    let chunk: { choices?: { delta?: { content?: unknown } }[]; usage?: typeof usage };
    try {
      chunk = JSON.parse(data);
    } catch {
      continue; // ignore keep-alive or malformed lines
    }
    if (chunk.usage) usage = chunk.usage;
    const text = chunk.choices?.[0]?.delta?.content;
    if (typeof text === "string" && text) {
      outChars += text.length;
      yield { type: "delta", text };
    }
  }
  const inChars = messages.reduce((n, m) => n + m.content.length, 0);
  yield {
    type: "done",
    model,
    inputTokens: usage?.prompt_tokens ?? Math.ceil(inChars / 4),
    outputTokens: usage?.completion_tokens ?? Math.ceil(outChars / 4),
    estimated: usage?.prompt_tokens === undefined,
  };
}

/**
 * Streams a chat completion from any OpenAI-compatible endpoint.
 * - Retries rate limits and server errors with backoff (only before any text has been sent).
 * - Switches to the tier's fallback model when the main model keeps failing or does not exist.
 * - Never retries after partial output, so the reader never sees duplicated text.
 */
export async function* streamChat(cfg: GatewayConfig, tier: Tier, messages: ChatMessage[], opts: StreamOptions = {}): AsyncGenerator<StreamEvent> {
  const tm = cfg.tiers[tier];
  if (!tm?.model) {
    throw new GatewayError("not_configured", `No model is set for the ${tier.toLowerCase()} tier. An admin can choose one in Settings.`);
  }
  const models = tm.fallback && tm.fallback !== tm.model ? [tm.model, tm.fallback] : [tm.model];
  const sleep = opts.sleep ?? defaultSleep;
  let last: GatewayError | undefined;

  for (const model of models) {
    for (let n = 0; n <= MAX_RETRIES; n++) {
      let started = false;
      try {
        for await (const ev of attempt(cfg, model, messages, opts)) {
          if (ev.type === "delta") started = true;
          yield ev;
        }
        return;
      } catch (err) {
        const e = toGatewayError(err, opts.signal);
        if (e.code === "aborted" || started) throw e;
        last = e;
        if (!e.retryable) break;
        if (n < MAX_RETRIES) await sleep(e.retryAfterMs ?? 400 * 3 ** n);
      }
    }
    if (last && (last.code === "auth" || last.code === "bad_request")) throw last; // another model will not fix this
  }
  throw last ?? new GatewayError("unavailable", "Could not reach the provider.");
}
