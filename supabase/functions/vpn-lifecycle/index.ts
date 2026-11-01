// supabase/functions/vpn-lifecycle/index.ts
//
// Provisions or revokes a MikroTik WiFi user (User Manager) when a customer's
// contract lifecycle changes.
//
// Provision  — called on first active contract for a customer+partner pair
// Deprovision — called when the customer's last active contract ends or is archived

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SUPABASE_URL               = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ONESIGNAL_APP_ID           = Deno.env.get("ONESIGNAL_APP_ID")!;
const ONESIGNAL_API_KEY          = Deno.env.get("ONESIGNAL_API_KEY")!;
const ONESIGNAL_UNIQUE_TEMPLATE_ID = Deno.env.get("ONESIGNAL_UNIQUE_TEMPLATE_ID")!;

// ── helpers ──────────────────────────────────────────────────────────────────

function generatePassword(length = 16): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => alphabet[b % alphabet.length]).join("");
}

function generateVpnName(firstName: string, secondName: string | null, companyName: string | null): string {
  const base = companyName
    ? companyName
    : `${firstName} ${secondName ?? ""}`.trim();

  const sanitized = base
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 20);

  const suffix = Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map((b) => "abcdefghjkmnpqrstuvwxyz23456789"[b % 31])
    .join("");

  return `${sanitized}-${suffix}`;
}

async function callMikrotik(
  agentUrl: string,
  agentSecret: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const init: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-agent-secret": agentSecret,
    },
  };
  if (body !== undefined) init.body = JSON.stringify(body);

  const res = await fetch(`${agentUrl}${path}`, init);
  let data: unknown;
  try { data = await res.json(); } catch { data = null; }
  return { ok: res.ok, status: res.status, data };
}

async function sendEmail(
  supabase: ReturnType<typeof createClient>,
  partnerUuid: string,
  partnerName: string,
  templateType: string,
  recipientEmail: string,
  variables: Record<string, string>,
): Promise<boolean> {
  const { data: tpl } = await supabase
    .from("email_templates")
    .select("subject_line, body_html")
    .eq("partner_uuid", partnerUuid)
    .eq("template_type", templateType)
    .single();

  let subject = tpl?.subject_line ?? "Powercowo notification";
  let body    = tpl?.body_html    ?? "<p>Notification from Powercowo.</p>";

  for (const [k, v] of Object.entries(variables)) {
    const re = new RegExp(`\\{\\{${k}\\}\\}`, "g");
    subject  = subject.replace(re, v);
    body     = body.replace(re, v);
  }

  // Banner
  const { data: bannerFiles } = await supabase.storage
    .from("partners").list(partnerUuid, { search: "email_banner" });
  let bannerUrl = "";
  const bannerFile = bannerFiles?.find((f: { name: string }) => f.name.startsWith("email_banner."));
  if (bannerFile) {
    const { data: urlData } = supabase.storage
      .from("partners").getPublicUrl(`${partnerUuid}/${bannerFile.name}`);
    bannerUrl = urlData.publicUrl;
  }

  const payload = {
    app_id:                ONESIGNAL_APP_ID,
    email_from_name:       partnerName,
    email_subject:         subject,
    email_from_address:    "app@powercowo.com",
    email_reply_to_address:"app@powercowo.com",
    template_id:           ONESIGNAL_UNIQUE_TEMPLATE_ID,
    target_channel:        "email",
    include_email_tokens:  [recipientEmail],
    include_aliases:       { external_id: [partnerUuid] },
    custom_data:           { banner_url: bannerUrl, body_html: body },
  };

  const res = await fetch("https://onesignal.com/api/v1/notifications", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Basic ${ONESIGNAL_API_KEY}` },
    body: JSON.stringify(payload),
  });
  const result = await res.json();
  return res.ok && !!result.id;
}

// ── door code ────────────────────────────────────────────────────────────────

async function assignDoorCode(
  supabase: ReturnType<typeof createClient>,
  customerId: number,
  partnerUuid: string,
): Promise<void> {
  // Skip if already assigned
  const { data: existing } = await supabase
    .from("customers")
    .select("door_code, door_position")
    .eq("id", customerId)
    .single();

  if (existing?.door_code) return;

  // Generate 6 random uppercase letters
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const codeBytes = new Uint8Array(6);
  crypto.getRandomValues(codeBytes);
  const doorCode = Array.from(codeBytes).map((b) => alphabet[b % 26]).join("");

  // Find a free position 1-100 for this partner
  const { data: taken } = await supabase
    .from("customers")
    .select("door_position")
    .eq("partner_uuid", partnerUuid)
    .not("door_position", "is", null);

  const takenSet = new Set((taken ?? []).map((r: { door_position: number }) => r.door_position));
  const free = Array.from({ length: 100 }, (_, i) => i + 1).filter((p) => !takenSet.has(p));

  if (free.length === 0) {
    console.warn(`No free door positions for partner ${partnerUuid}`);
    return;
  }

  const idxByte = new Uint8Array(1);
  crypto.getRandomValues(idxByte);
  const doorPosition = free[idxByte[0] % free.length];

  await supabase
    .from("customers")
    .update({ door_code: doorCode, door_position: doorPosition })
    .eq("id", customerId);
}

// ── provision ────────────────────────────────────────────────────────────────

async function provision(
  supabase: ReturnType<typeof createClient>,
  customerId: number,
  partnerUuid: string,
  contractId: number,
  contractNumber: string,
): Promise<{ success: boolean; skipped?: string; error?: string }> {

  // 1. Assign door code unconditionally (independent of MikroTik)
  await assignDoorCode(supabase, customerId, partnerUuid);

  // 2. Check partner has MikroTik enabled
  const { data: partner, error: partnerErr } = await supabase
    .from("partners")
    .select("mikrotik_enabled, mikrotik_agent_url, mikrotik_agent_secret, mikrotik_group, mikrotik_shared_users, mikrotik_ssid, email, company_name, structure_name")
    .eq("partner_uuid", partnerUuid)
    .single();

  if (partnerErr || !partner) return { success: false, error: "Partner not found" };
  if (!partner.mikrotik_enabled) return { success: true, skipped: "mikrotik_disabled" };
  if (!partner.mikrotik_agent_url || !partner.mikrotik_agent_secret)
    return { success: false, error: "MikroTik agent not configured" };

  // 2. Skip if VPN already exists for this customer+partner
  const { data: existing } = await supabase
    .from("customer_vpn_credentials")
    .select("id, vpn_name")
    .eq("partner_uuid", partnerUuid)
    .eq("customer_id", customerId)
    .is("revoked_at", null)
    .maybeSingle();

  if (existing) return { success: true, skipped: "vpn_already_exists" };

  // 3. Check no OTHER active non-archived contracts exist (safety — only provision on first)
  const { count } = await supabase
    .from("contracts")
    .select("id", { count: "exact", head: true })
    .eq("partner_uuid", partnerUuid)
    .eq("customer_id", customerId)
    .eq("contract_status", "active")
    .eq("is_archived", false)
    .neq("id", contractId);

  if ((count ?? 0) > 0) return { success: true, skipped: "not_first_contract" };

  // 4. Fetch customer
  const { data: customer, error: custErr } = await supabase
    .from("customers")
    .select("first_name, second_name, company_name, email, door_code, door_position")
    .eq("id", customerId)
    .single();

  if (custErr || !customer) return { success: false, error: "Customer not found" };

  // 5. Generate unique VPN name (retry up to 5 times on collision)
  let vpnName = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateVpnName(customer.first_name, customer.second_name, customer.company_name);
    const { data: collision } = await supabase
      .from("customer_vpn_credentials")
      .select("id").eq("partner_uuid", partnerUuid).eq("vpn_name", candidate).maybeSingle();
    if (!collision) { vpnName = candidate; break; }
  }
  if (!vpnName) return { success: false, error: "Could not generate unique VPN name" };

  const vpnPassword = generatePassword(16);
  const partnerName = partner.structure_name ?? partner.company_name ?? "PowerCowo";

  // 6. Create user on MikroTik router
  const mikrotikRes = await callMikrotik(
    partner.mikrotik_agent_url,
    partner.mikrotik_agent_secret,
    "PUT",
    "/user-manager/user",
    {
      name:           vpnName,
      password:       vpnPassword,
      group:          partner.mikrotik_group ?? "IGY",
      "shared-users": partner.mikrotik_shared_users ?? "5",
      attributes:     `Mikrotik-Wireless-Comment:${vpnName}`,
    },
  );

  if (!mikrotikRes.ok) {
    return { success: false, error: `MikroTik error ${mikrotikRes.status}: ${JSON.stringify(mikrotikRes.data)}` };
  }

  const mikrotikId = (mikrotikRes.data as Record<string, string>)?.[".id"] ?? null;

  // 7. Persist credentials
  const { error: insertErr } = await supabase
    .from("customer_vpn_credentials")
    .insert({
      partner_uuid: partnerUuid,
      customer_id:  customerId,
      vpn_name:     vpnName,
      vpn_password: vpnPassword,
      mikrotik_id:  mikrotikId,
    });

  if (insertErr) return { success: false, error: `DB insert failed: ${insertErr.message}` };

  // 8. Email partner
  const variables: Record<string, string> = {
    customer_name:   customer.company_name ?? `${customer.first_name} ${customer.second_name ?? ""}`.trim(),
    vpn_name:        vpnName,
    contract_number: contractNumber,
    partner_name:    partnerName,
  };

  if (partner.email) {
    await sendEmail(supabase, partnerUuid, partnerName, "vpn_credentials_partner", partner.email, variables);
  }

  // 9. Email customer
  if (customer.email) {
    await sendEmail(supabase, partnerUuid, partnerName, "vpn_credentials_customer", customer.email, {
      ...variables,
      vpn_password:  vpnPassword,
      network_name:  partner.mikrotik_ssid ?? "",
      door_code:     customer.door_code ?? "",
      door_position: customer.door_position?.toString() ?? "",
    });
  }

  // 10. Activity log
  await supabase.from("activity_log").insert({
    partner_uuid:     partnerUuid,
    action_category:  "system",
    action_type:      "vpn_provisioned",
    entity_type:      "contracts",
    entity_id:        contractId,
    description:      `VPN '${vpnName}' provisioned for customer ${customerId} on contract ${contractNumber}`,
    metadata:         { vpn_name: vpnName, customer_id: customerId, mikrotik_id: mikrotikId },
  });

  return { success: true };
}

// ── deprovision ───────────────────────────────────────────────────────────────

async function deprovision(
  supabase: ReturnType<typeof createClient>,
  customerId: number,
  partnerUuid: string,
  contractId: number,
  contractNumber: string,
): Promise<{ success: boolean; skipped?: string; error?: string }> {

  // 1. Check partner has MikroTik enabled
  const { data: partner } = await supabase
    .from("partners")
    .select("mikrotik_enabled, mikrotik_agent_url, mikrotik_agent_secret")
    .eq("partner_uuid", partnerUuid)
    .single();

  if (!partner?.mikrotik_enabled) return { success: true, skipped: "mikrotik_disabled" };
  if (!partner.mikrotik_agent_url || !partner.mikrotik_agent_secret)
    return { success: false, error: "MikroTik agent not configured" };

  // 2. Skip if customer still has other active non-archived contracts with this partner
  const { count } = await supabase
    .from("contracts")
    .select("id", { count: "exact", head: true })
    .eq("partner_uuid", partnerUuid)
    .eq("customer_id", customerId)
    .eq("contract_status", "active")
    .eq("is_archived", false)
    .neq("id", contractId);

  if ((count ?? 0) > 0) return { success: true, skipped: "other_active_contracts" };

  // 3. Find active VPN credential
  const { data: cred } = await supabase
    .from("customer_vpn_credentials")
    .select("id, vpn_name, mikrotik_id")
    .eq("partner_uuid", partnerUuid)
    .eq("customer_id", customerId)
    .is("revoked_at", null)
    .maybeSingle();

  if (!cred) return { success: true, skipped: "no_vpn_found" };

  // 4. Delete from MikroTik router
  if (cred.mikrotik_id) {
    const encoded = encodeURIComponent(cred.mikrotik_id);
    const mikrotikRes = await callMikrotik(
      partner.mikrotik_agent_url,
      partner.mikrotik_agent_secret,
      "DELETE",
      `/user-manager/user/${encoded}`,
    );
    if (!mikrotikRes.ok && mikrotikRes.status !== 404) {
      return { success: false, error: `MikroTik delete error ${mikrotikRes.status}: ${JSON.stringify(mikrotikRes.data)}` };
    }
  }

  // 5. Stamp revoked_at
  await supabase
    .from("customer_vpn_credentials")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", cred.id);

  // 6. Activity log
  await supabase.from("activity_log").insert({
    partner_uuid:     partnerUuid,
    action_category:  "system",
    action_type:      "vpn_deprovisioned",
    entity_type:      "contracts",
    entity_id:        contractId,
    description:      `VPN '${cred.vpn_name}' revoked for customer ${customerId} on contract ${contractNumber}`,
    metadata:         { vpn_name: cred.vpn_name, customer_id: customerId, mikrotik_id: cred.mikrotik_id },
  });

  return { success: true };
}

// ── main ──────────────────────────────────────────────────────────────────────

serve(async (req) => {
  try {
    const body = await req.json();
    const { action, contract_id, contract_number, customer_id, partner_uuid } = body;

    if (!action || !contract_id || !customer_id || !partner_uuid) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let result;
    if (action === "provision") {
      result = await provision(supabase, customer_id, partner_uuid, contract_id, contract_number);
    } else if (action === "deprovision") {
      result = await deprovision(supabase, customer_id, partner_uuid, contract_id, contract_number);
    } else {
      return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { status: 400 });
    }

    return new Response(JSON.stringify({ action, ...result }), {
      status: result.success ? 200 : 500,
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
