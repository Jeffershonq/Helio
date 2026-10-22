import { describe, expect, it } from "vitest";
import { streamChat } from "@/lib/gateway/client";
import { parseSse } from "@/lib/gateway/sse";
import { estimateCostUsd, parseTierModels } from "@/lib/gateway/tiers";
import { GatewayError, type GatewayConfig, type StreamEvent } from "@/lib/gateway/types";

const enc = new TextEncoder();
const bodyOf = (chunks: string[]) =>
  new ReadableStream<Uint8Array>({ start(c) { chunks.forEach((x) => c.enqueue(enc.encode(x))); c.close(); } });
const sse = (...events: unknown[]) => events.map((e) => `data: ${typeof e === "string" ? e : JSON.stringify(e)}\n\n`).join("");
const delta = (t: string) => ({ choices: [{ delta: { content: t } }] });
const ok = (text: string[], usage = true) =>
  new Response(bodyOf([sse(...text.map(delta), ...(usage ? [{ choices: [], usage: { prompt_tokens: 11, completion_tokens: 7 } }] : []), "[DONE]")]), { status: 200 });

const cfg = (tiers: GatewayConfig["tiers"] = { LIGHT: { model: "main", fallback: "backup" } }): GatewayConfig => ({ baseUrl: "https://p.test/v1/", apiKey: "k", tiers });
const msgs = [{ role: "user" as const, content: "hi" }];
const noSleep = async () => {};
async function collect(gen: AsyncGenerator<StreamEvent>) {
  const out: StreamEvent[] = [];
  for await (const e of gen) out.push(e);
  return out;
}

describe("parseSse", () => {
  it("handles events split across chunks, CRLF and multi-line data", async () => {
    const out: string[] = [];
    for await (const d of parseSse(bodyOf(["data: one\r\n\r\nda", "ta: two\ndata: three\n\n", ": comment\n\ndata: last"]))) out.push(d);
    expect(out).toEqual(["one", "two\nthree", "last"]);
  });
});

describe("streamChat", () => {
  it("streams text and reports provider usage", async () => {
    let seen: { url: string; body: any; auth: string } | undefined;
    const fetchImpl = (async (url: string, init: RequestInit) => {
      seen = { url, body: JSON.parse(init.body as string), auth: (init.headers as Record<string, string>).Authorization! };
      return ok(["Hel", "lo"]);
    }) as unknown as typeof fetch;
    const events = await collect(streamChat(cfg(), "LIGHT", msgs, { fetchImpl, sleep: noSleep }));
    expect(events.filter((e) => e.type === "delta").map((e: any) => e.text).join("")).toBe("Hello");
    expect(events.at(-1)).toEqual({ type: "done", model: "main", inputTokens: 11, outputTokens: 7, estimated: false });
    expect(seen!.url).toBe("https://p.test/v1/chat/completions");
    expect(seen!.auth).toBe("Bearer k");
    expect(seen!.body).toMatchObject({ model: "main", stream: true, stream_options: { include_usage: true } });
  });

  it("sends no Authorization header when the endpoint needs no key", async () => {
    let headers: Record<string, string> = {};
    const fetchImpl = (async (_u: string, init: RequestInit) => { headers = init.headers as Record<string, string>; return ok(["x"]); }) as unknown as typeof fetch;
    await collect(streamChat({ ...cfg(), apiKey: "" }, "LIGHT", msgs, { fetchImpl }));
    expect(headers.Authorization).toBeUndefined();
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("asks again without stream_options when the gateway rejects it", async () => {
    const bodies: Record<string, unknown>[] = [];
    const fetchImpl = (async (_u: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      bodies.push(body);
      return body.stream_options ? new Response('{"error":{"message":"Unknown parameter: stream_options"}}', { status: 400 }) : ok(["fine"], false);
    }) as unknown as typeof fetch;
    const events = await collect(streamChat(cfg(), "LIGHT", msgs, { fetchImpl, sleep: noSleep }));
    expect(bodies).toHaveLength(2);
    expect(bodies[0]!.stream_options).toBeDefined();
    expect(bodies[1]!.stream_options).toBeUndefined();
    expect((events.at(-1) as { estimated: boolean }).estimated).toBe(true);
  });

  it("does not hide a real 400 behind the stream_options retry", async () => {
    let calls = 0;
    const fetchImpl = (async () => (calls++, new Response('{"error":"messages must not be empty"}', { status: 400 }))) as unknown as typeof fetch;
    await expect(collect(streamChat(cfg(), "LIGHT", msgs, { fetchImpl, sleep: noSleep }))).rejects.toMatchObject({ code: "bad_request" });
    expect(calls).toBe(1);
  });

  it("estimates tokens when the provider sends no usage", async () => {
    const fetchImpl = (async () => ok(["abcdefgh"], false)) as unknown as typeof fetch;
    const done = (await collect(streamChat(cfg(), "LIGHT", msgs, { fetchImpl }))).at(-1) as any;
    expect(done.estimated).toBe(true);
    expect(done.outputTokens).toBe(2);
  });

  it("retries a rate limit, then succeeds on the same model", async () => {
    let calls = 0;
    const waits: number[] = [];
    const fetchImpl = (async () => (++calls === 1 ? new Response("{}", { status: 429, headers: { "retry-after": "2" } }) : ok(["ok"]))) as unknown as typeof fetch;
    const events = await collect(streamChat(cfg(), "LIGHT", msgs, { fetchImpl, sleep: async (ms) => void waits.push(ms) }));
    expect(calls).toBe(2);
    expect(waits).toEqual([2000]);
    expect((events.at(-1) as any).model).toBe("main");
  });

  it("falls back to the backup model after the main one keeps failing", async () => {
    const used: string[] = [];
    const fetchImpl = (async (_u: string, init: RequestInit) => {
      const model = JSON.parse(init.body as string).model;
      used.push(model);
      return model === "main" ? new Response("boom", { status: 503 }) : ok(["from backup"]);
    }) as unknown as typeof fetch;
    const events = await collect(streamChat(cfg(), "LIGHT", msgs, { fetchImpl, sleep: noSleep }));
    expect(used).toEqual(["main", "main", "main", "backup"]);
    expect((events.at(-1) as any).model).toBe("backup");
  });

  it("falls back at once when the model does not exist", async () => {
    const used: string[] = [];
    const fetchImpl = (async (_u: string, init: RequestInit) => {
      const model = JSON.parse(init.body as string).model;
      used.push(model);
      return model === "main" ? new Response('{"error":{"message":"The model `main` does not exist"}}', { status: 400 }) : ok(["x"]);
    }) as unknown as typeof fetch;
    await collect(streamChat(cfg(), "LIGHT", msgs, { fetchImpl, sleep: noSleep }));
    expect(used).toEqual(["main", "backup"]);
  });

  it("does not retry or fall back on a bad key", async () => {
    let calls = 0;
    const fetchImpl = (async () => (calls++, new Response("{}", { status: 401 }))) as unknown as typeof fetch;
    await expect(collect(streamChat(cfg(), "LIGHT", msgs, { fetchImpl, sleep: noSleep }))).rejects.toMatchObject({ code: "auth" });
    expect(calls).toBe(1);
  });

  it("never retries after text was already sent", async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls++;
      let pulls = 0; // error() would drop queued chunks, so fail on the second read instead
      return new Response(new ReadableStream({ pull(c) { if (pulls++ === 0) c.enqueue(enc.encode(sse(delta("part")))); else c.error(new Error("reset")); } }), { status: 200 });
    }) as unknown as typeof fetch;
    const seen: string[] = [];
    await expect((async () => { for await (const e of streamChat(cfg(), "LIGHT", msgs, { fetchImpl, sleep: noSleep })) if (e.type === "delta") seen.push(e.text); })()).rejects.toMatchObject({ code: "unavailable" });
    expect(calls).toBe(1);
    expect(seen).toEqual(["part"]);
  });

  it("reports a stop as 'aborted'", async () => {
    const ctl = new AbortController();
    const fetchImpl = (async (_u: string, init: RequestInit) => {
      ctl.abort();
      throw Object.assign(new Error("aborted"), { name: "AbortError", signal: init.signal });
    }) as unknown as typeof fetch;
    await expect(collect(streamChat(cfg(), "LIGHT", msgs, { fetchImpl, signal: ctl.signal }))).rejects.toMatchObject({ code: "aborted" });
  });

  it("explains a tier with no model", async () => {
    await expect(collect(streamChat(cfg({}), "HEAVY", msgs))).rejects.toThrow(/No model is set for the heavy tier/);
    await expect(collect(streamChat(cfg({}), "HEAVY", msgs))).rejects.toBeInstanceOf(GatewayError);
  });
});

describe("tier models", () => {
  it("keeps valid entries and drops broken ones", () => {
    expect(parseTierModels({ LIGHT: { model: " m1 ", fallback: "" }, MEDIUM: { model: "" }, HEAVY: 5, junk: 1 })).toEqual({ LIGHT: { model: "m1", fallback: undefined } });
    expect(parseTierModels(null)).toEqual({});
  });
  it("estimates cost from per-million prices", () => {
    expect(estimateCostUsd({ model: "m", inputPerMTok: 3, outputPerMTok: 15 }, 1000, 500)).toBe(0.0105);
    expect(estimateCostUsd({ model: "m" }, 1000, 500)).toBe(0);
    expect(estimateCostUsd(undefined, 1, 1)).toBe(0);
  });
});
