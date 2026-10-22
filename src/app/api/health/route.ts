import { NextResponse } from "next/server";

// Used by the Docker healthcheck. It does not touch the database on purpose.
export const dynamic = "force-dynamic";
export const GET = () => NextResponse.json({ ok: true });
