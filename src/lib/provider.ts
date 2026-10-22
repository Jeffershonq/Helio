import { env } from "@/lib/env";
import { assertSafeProviderUrl } from "@/lib/provider-url";

export interface ConnectionResult {
  ok: boolean;
  message: string;
  modelCount?: number;
  models?: string[];
}

/** Calls GET {baseUrl}/models on any OpenAI-compatible endpoint. Messages are generic on purpose. */
export async function testProviderConnection(baseUrl: string, apiKey: string): Promise<ConnectionResult> {
  const url = await assertSafeProviderUrl(baseUrl, { allowPrivate: env().ALLOW_PRIVATE_PROVIDER_URLS });
  const endpoint = `${url.origin}${url.pathname.replace(/\/+$/, "")}/models`;
  try {
    const res = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
      redirect: "error", // never follow redirects into other hosts
      signal: AbortSignal.timeout(8_000),
    });
    if (res.status === 401 || res.status === 403) return { ok: false, message: "The provider rejected this key." };
    if (res.status === 404) return { ok: false, message: "Endpoint not found. Check that the base URL ends with /v1." };
    if (!res.ok) return { ok: false, message: `The provider answered with status ${res.status}.` };
    const body = (await res.json().catch(() => null)) as { data?: { id?: unknown }[] } | null;
    const models = Array.isArray(body?.data)
      ? body.data.map((m) => m?.id).filter((id): id is string => typeof id === "string").slice(0, 500)
      : undefined;
    return { ok: true, message: "Connected.", modelCount: Array.isArray(body?.data) ? body.data.length : undefined, models };
  } catch {
    return { ok: false, message: "Could not reach the endpoint. Check the URL and your network." };
  }
}
