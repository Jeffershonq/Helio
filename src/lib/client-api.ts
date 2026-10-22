export interface ApiFailure {
  ok: false;
  status: number;
  message: string;
  fields: Record<string, string[]>;
}
export type ApiResult<T> = { ok: true; data: T } | ApiFailure;

/** Small fetch wrapper for the browser. Every Helio API error has the same shape, so forms can share this. */
export async function api<T = unknown>(url: string, body?: unknown, method = "POST"): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, data: data as T };
    return {
      ok: false,
      status: res.status,
      message: data?.error?.message ?? "Something went wrong. Try again.",
      fields: data?.error?.fields ?? {},
    };
  } catch {
    return { ok: false, status: 0, message: "Could not reach the server. Check your connection.", fields: {} };
  }
}
