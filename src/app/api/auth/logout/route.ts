import { handle, json } from "@/lib/http";
import { destroySession } from "@/lib/session";

export const POST = handle(async () => {
  await destroySession();
  return json({ ok: true });
});
