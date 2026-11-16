// Guard for edge functions that only DB triggers and pg_cron may call.
// These functions run with verify_jwt = false (the gateway only understands legacy JWT keys),
// so the caller must present the project's secret key on the apikey header.
import { SUPABASE_SECRET_KEY } from "./supabaseKeys.ts";

const sameKey = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

export function isSecretKeyRequest(req: Request): boolean {
  const key = (req.headers.get("apikey") ?? "").trim();
  return key !== "" && sameKey(key, SUPABASE_SECRET_KEY);
}

export const forbiddenResponse = () =>
  new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { "Content-Type": "application/json" } });
