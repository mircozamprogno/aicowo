// Guard for edge functions that only DB triggers and pg_cron may call.
// The public anon key is also a valid JWT, so the gateway's verify_jwt alone lets anyone in:
// require the service_role key (exact match, or a service_role JWT that the auth admin API accepts).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const decodeRole = (token: string): string | null => {
  try {
    const part = token.split(".")[1];
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=");
    return JSON.parse(atob(b64)).role ?? null;
  } catch {
    return null;
  }
};

export async function isServiceRoleRequest(req: Request): Promise<boolean> {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;
  if (token === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) return true;
  if (decodeRole(token) !== "service_role") return false;
  // Proves the signature: only a genuine service_role key can list users
  const { error } = await createClient(Deno.env.get("SUPABASE_URL")!, token).auth.admin.listUsers({ page: 1, perPage: 1 });
  return !error;
}

export const forbiddenResponse = () =>
  new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { "Content-Type": "application/json" } });
