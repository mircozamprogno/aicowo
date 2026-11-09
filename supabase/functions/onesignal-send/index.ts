// Server-side OneSignal email sender for the web app: the REST API key never reaches the browser.
// Admins and superadmins can email anyone; customers only themselves and their own partner.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ONESIGNAL_APP_ID = Deno.env.get("ONESIGNAL_APP_ID")!;
const ONESIGNAL_API_KEY = Deno.env.get("ONESIGNAL_API_KEY")!;

const ALLOWED_FROM = ["app@powercowo.com", "info@tuttoapposto.info"];
const MAX_RECIPIENTS = 20;
// Fields the app actually sends; anything else (segments, filters, player ids…) is dropped
const ALLOWED_FIELDS = [
  "email_subject", "email_from_name", "email_from_address", "email_reply_to_address",
  "template_id", "include_email_tokens", "include_aliases", "custom_data", "email_body",
];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const norm = (email: unknown) => String(email ?? "").trim().toLowerCase();

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const { data: profile } = await admin.from("profiles").select("role, partner_uuid").eq("id", user.id).single();
  if (!profile) return json({ error: "Unauthorized" }, 401);
  const isStaff = profile.role === "admin" || profile.role === "superadmin";

  const body = await req.json().catch(() => ({}));

  if (body?.action === "test") {
    if (!isStaff) return json({ error: "Forbidden" }, 403);
    const res = await fetch(`https://onesignal.com/api/v1/apps/${ONESIGNAL_APP_ID}`, {
      headers: { Authorization: `Basic ${ONESIGNAL_API_KEY}` },
    });
    return json({ ok: res.ok }, res.ok ? 200 : 502);
  }

  const input = body?.payload ?? {};
  const payload: Record<string, unknown> = Object.fromEntries(
    Object.entries(input).filter(([key]) => ALLOWED_FIELDS.includes(key)),
  );
  const recipients = Array.isArray(payload.include_email_tokens) ? payload.include_email_tokens.map(norm).filter(Boolean) : [];
  if (recipients.length === 0 || recipients.length > MAX_RECIPIENTS) return json({ error: "Invalid recipients" }, 400);

  if (!isStaff) {
    // Customer: own addresses + their partner and its admins
    const allowed = new Set<string>([norm(user.email)]);
    const [{ data: customers }, { data: partner }, { data: admins }] = await Promise.all([
      admin.from("customers").select("email, billing_email").eq("user_id", user.id),
      admin.from("partners").select("email").eq("partner_uuid", profile.partner_uuid).maybeSingle(),
      admin.from("profiles").select("email").eq("partner_uuid", profile.partner_uuid).eq("role", "admin"),
    ]);
    (customers ?? []).forEach((c) => { allowed.add(norm(c.email)); allowed.add(norm(c.billing_email)); });
    allowed.add(norm(partner?.email));
    (admins ?? []).forEach((a) => allowed.add(norm(a.email)));
    if (recipients.some((r) => !allowed.has(r))) return json({ error: "Recipient not allowed" }, 403);
    delete payload.include_aliases;
  }

  payload.app_id = ONESIGNAL_APP_ID;
  payload.target_channel = "email";
  payload.include_email_tokens = recipients;
  if (!ALLOWED_FROM.includes(norm(payload.email_from_address))) payload.email_from_address = ALLOWED_FROM[0];

  const res = await fetch("https://onesignal.com/api/v1/notifications", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Basic ${ONESIGNAL_API_KEY}` },
    body: JSON.stringify(payload),
  });
  const result = await res.json().catch(() => ({}));
  return json(result, res.status);
});
