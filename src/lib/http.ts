import { NextRequest, NextResponse } from "next/server";
import { ZodError, type ZodTypeAny, type z } from "zod";
import { env } from "@/lib/env";
import { badRequest, forbidden, HttpError } from "@/lib/http-error";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const MAX_BODY_BYTES = 64 * 1024;

/** CSRF defence on top of SameSite=Lax cookies: state-changing requests must come from our own origin. */
export function assertSameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) {
    if (req.headers.get("sec-fetch-site") === "cross-site") throw forbidden("Cross-site request blocked.");
    return;
  }
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw forbidden("Cross-site request blocked.");
  }
  const allowed = new Set([new URL(env().APP_URL).host, req.headers.get("host") ?? ""]);
  if (!allowed.has(originHost)) throw forbidden("Cross-site request blocked.");
}

export function clientIp(req: NextRequest): string {
  if (env().TRUST_PROXY) {
    const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (forwarded) return forwarded;
  }
  return req.headers.get("x-real-ip") ?? "unknown";
}

export async function parseBody<T extends ZodTypeAny>(req: NextRequest, schema: T): Promise<z.infer<T>> {
  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) throw new HttpError(413, "Request is too large.", "too_large");
  const raw = await req.json().catch(() => {
    throw badRequest("Send a JSON body.");
  });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw badRequest("Check the highlighted fields.", parsed.error.flatten().fieldErrors as Record<string, string[]>);
  return parsed.data;
}

export const json = (data: unknown, init?: ResponseInit) => NextResponse.json(data, init);

function errorResponse(err: unknown) {
  if (err instanceof HttpError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message, fields: err.fields } },
      { status: err.status, headers: err.headers },
    );
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: { code: "bad_request", message: "Check the highlighted fields.", fields: err.flatten().fieldErrors } },
      { status: 400 },
    );
  }
  console.error("unhandled route error", err);
  return NextResponse.json({ error: { code: "internal", message: "Something went wrong on our side." } }, { status: 500 });
}

type Ctx<P> = { params: Promise<P> };

/** Wraps a route handler: same-origin check for writes, one consistent error format. */
export function handle<P = Record<string, never>>(fn: (req: NextRequest, ctx: Ctx<P>) => Promise<Response>) {
  return async (req: NextRequest, ctx: Ctx<P>): Promise<Response> => {
    try {
      if (!SAFE_METHODS.has(req.method)) assertSameOrigin(req);
      return await fn(req, ctx);
    } catch (err) {
      return errorResponse(err);
    }
  };
}
