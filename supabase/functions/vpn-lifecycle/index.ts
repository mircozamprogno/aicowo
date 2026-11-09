// supabase/functions/vpn-lifecycle/index.ts
//
// Provisions or revokes a MikroTik WiFi user (User Manager) when a customer's
// contract lifecycle changes.
//
// Provision  — called on first active contract for a customer+partner pair
// Deprovision — called when the customer's last active contract ends or is archived:
//               clears the door code (partner emailed) and deletes the WiFi user
// retry_revocations — nightly (03:00): retries WiFi deletions that failed

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SUPABASE_URL               = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ONESIGNAL_APP_ID           = Deno.env.get("ONESIGNAL_APP_ID")!;
const ONESIGNAL_API_KEY          = Deno.env.get("ONESIGNAL_API_KEY")!;
const ONESIGNAL_UNIQUE_TEMPLATE_ID = Deno.env.get("ONESIGNAL_UNIQUE_TEMPLATE_ID")!;

// auth.users row used for automated activity_logs entries
const SYSTEM_USER_ID = "11111111-1111-1111-1111-111111111111";

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

// ── door position ────────────────────────────────────────────────────────────
// The door code itself is set manually by the partner (6 digits); only the
// position slot is assigned automatically.

async function assignDoorPosition(
  supabase: ReturnType<typeof createClient>,
  customerId: number,
  partnerUuid: string,
): Promise<void> {
  // Skip if already assigned
  const { data: existing } = await supabase
    .from("customers")
    .select("door_position")
    .eq("id", customerId)
    .single();

  if (existing?.door_position) return;

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
    .update({ door_position: doorPosition })
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

  // 1. Assign door position unconditionally (independent of MikroTik)
  await assignDoorPosition(supabase, customerId, partnerUuid);

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
    .select("first_name, second_name, company_name, email, door_position")
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
      door_position: customer.door_position?.toString() ?? "",
    });
  }

  // 10. Activity log
  await supabase.from("activity_logs").insert({
    partner_uuid:     partnerUuid,
    user_id:          SYSTEM_USER_ID,
    action_category:  "system",
    action_type:      "activated",
    entity_type:      "contracts",
    entity_id:        String(contractId),
    description:      `VPN '${vpnName}' provisioned for customer ${customerId} on contract ${contractNumber}`,
    metadata:         { vpn_name: vpnName, customer_id: customerId, mikrotik_id: mikrotikId },
  });

  return { success: true };
}

// ── deprovision ───────────────────────────────────────────────────────────────
// Runs when a contract expires, is closed (cancelled) or archived while active.
// Only acts when it was the customer's LAST active contract with this partner:
//   1. clears the door code and the door position (lock slot) and emails the
//      partner (the code must be disabled on the lock by hand — the app is not
//      connected to it); a new contract assigns a new position automatically
//   2. deletes the WiFi user from the MikroTik router and revokes the credential;
//      if the router call fails the credential is marked for the nightly retry

type Supabase = ReturnType<typeof createClient>;

interface PartnerRow {
  mikrotik_enabled: boolean | null;
  mikrotik_agent_url: string | null;
  mikrotik_agent_secret: string | null;
  email: string | null;
  company_name: string | null;
  structure_name: string | null;
}

const MAX_REVOKE_ATTEMPTS_BEFORE_ALERT = 3;

async function loadPartner(supabase: Supabase, partnerUuid: string): Promise<PartnerRow | null> {
  const { data } = await supabase
    .from("partners")
    .select("mikrotik_enabled, mikrotik_agent_url, mikrotik_agent_secret, email, company_name, structure_name")
    .eq("partner_uuid", partnerUuid)
    .single();
  return data as PartnerRow | null;
}

const partnerDisplayName = (p: PartnerRow | null) => p?.structure_name || p?.company_name || "PowerCowo";

// deno-lint-ignore no-explicit-any
const customerDisplayName = (c: any) =>
  c?.company_name || `${c?.first_name ?? ""} ${c?.second_name ?? ""}`.replace(/\s+/g, " ").trim();

async function hasOtherActiveContracts(
  supabase: Supabase, partnerUuid: string, customerId: number, excludeContractId?: number,
): Promise<boolean> {
  let query = supabase
    .from("contracts")
    .select("id", { count: "exact", head: true })
    .eq("partner_uuid", partnerUuid)
    .eq("customer_id", customerId)
    .eq("contract_status", "active")
    .eq("is_archived", false);
  if (excludeContractId) query = query.neq("id", excludeContractId);
  const { count } = await query;
  return (count ?? 0) > 0;
}

async function clearDoorCode(
  supabase: Supabase, partner: PartnerRow | null, partnerUuid: string,
  customerId: number, contractId: number, contractNumber: string, dryRun: boolean,
): Promise<{ cleared: boolean; door_code?: string; door_position?: number; partner_emailed?: boolean; skipped?: string }> {
  const { data: customer } = await supabase
    .from("customers")
    .select("door_code, door_position, first_name, second_name, company_name, email")
    .eq("id", customerId)
    .single();

  const doorCode = customer?.door_code ?? null;
  const doorPosition = customer?.door_position ?? null;
  if (!doorCode && !doorPosition) return { cleared: false, skipped: "no_door_code" };
  if (dryRun) {
    return { cleared: true, door_code: doorCode ?? undefined, door_position: doorPosition ?? undefined, partner_emailed: !!(doorCode && partner?.email) };
  }

  // Only clear what we read (a partner editing the code meanwhile wins)
  let update = supabase
    .from("customers")
    .update({ door_code: null, door_position: null })
    .eq("id", customerId);
  update = doorCode ? update.eq("door_code", doorCode) : update.is("door_code", null);
  const { error } = await update;
  if (error) return { cleared: false, skipped: `update_failed: ${error.message}` };

  const customerName = customerDisplayName(customer);
  await supabase.from("activity_logs").insert({
    partner_uuid:    partnerUuid,
    user_id:         SYSTEM_USER_ID,
    action_category: "customer",
    action_type:     "deactivated",
    entity_type:     "customers",
    entity_id:       String(customerId),
    description:     `Door code ${doorCode ?? "-"} / position ${doorPosition ?? "-"} removed from ${customerName}: last contract ${contractNumber} ended`,
    metadata:        { kind: "door_code_cleared", door_code: doorCode, door_position: doorPosition, contract_id: contractId, contract_number: contractNumber },
  });

  // The partner only needs to act on the lock when there was a code
  let emailed = false;
  if (doorCode && partner?.email) {
    emailed = await sendEmail(supabase, partnerUuid, partnerDisplayName(partner), "door_code_cleared_partner", partner.email, {
      customer_name:   customerName,
      customer_email:  customer?.email ?? "",
      door_code:       doorCode,
      door_position:   doorPosition ? String(doorPosition) : "—",
      contract_number: contractNumber,
      partner_name:    partnerDisplayName(partner),
    }).catch(() => false);
    await supabase.from("activity_logs").insert({
      partner_uuid:    partnerUuid,
      user_id:         SYSTEM_USER_ID,
      action_category: "email",
      action_type:     emailed ? "sent" : "failed",
      entity_type:     "customers",
      entity_id:       String(customerId),
      description:     emailed
        ? `Door code removal email sent to partner for ${customerName}`
        : `Failed to send door code removal email to partner for ${customerName}`,
      metadata:        { kind: "door_code_cleared_partner", recipient_email: partner.email, door_code: doorCode },
    });
  }

  return { cleared: true, door_code: doorCode ?? undefined, door_position: doorPosition ?? undefined, partner_emailed: emailed };
}

// Deletes the WiFi user from the router and revokes the credential.
// On a router error the credential is marked for the nightly retry.
async function revokeWifi(
  supabase: Supabase, partner: PartnerRow | null, partnerUuid: string,
  customerId: number, contractId: number | null, contractNumber: string | null, dryRun: boolean,
): Promise<{ success: boolean; skipped?: string; error?: string; vpn_name?: string }> {
  if (!partner?.mikrotik_enabled) return { success: true, skipped: "mikrotik_disabled" };
  if (!partner.mikrotik_agent_url || !partner.mikrotik_agent_secret)
    return { success: false, error: "MikroTik agent not configured" };

  const { data: cred } = await supabase
    .from("customer_vpn_credentials")
    .select("id, vpn_name, mikrotik_id, revoke_requested_at, revoke_attempts")
    .eq("partner_uuid", partnerUuid)
    .eq("customer_id", customerId)
    .is("revoked_at", null)
    .maybeSingle();

  if (!cred) return { success: true, skipped: "no_vpn_found" };
  if (dryRun) return { success: true, skipped: "dry_run", vpn_name: cred.vpn_name };

  if (cred.mikrotik_id) {
    let failure: string | null = null;
    try {
      const res = await callMikrotik(
        partner.mikrotik_agent_url,
        partner.mikrotik_agent_secret,
        "DELETE",
        `/user-manager/user/${encodeURIComponent(cred.mikrotik_id)}`,
      );
      if (!res.ok && res.status !== 404) failure = `MikroTik delete error ${res.status}: ${JSON.stringify(res.data)}`;
    } catch (err) {
      failure = `MikroTik unreachable: ${err instanceof Error ? err.message : String(err)}`;
    }

    if (failure) {
      await supabase
        .from("customer_vpn_credentials")
        .update({
          revoke_requested_at: cred.revoke_requested_at ?? new Date().toISOString(),
          revoke_attempts:     (cred.revoke_attempts ?? 0) + 1,
          revoke_last_error:   failure.slice(0, 500),
        })
        .eq("id", cred.id);
      return { success: false, error: failure, vpn_name: cred.vpn_name };
    }
  }

  await supabase
    .from("customer_vpn_credentials")
    .update({ revoked_at: new Date().toISOString(), revoke_last_error: null })
    .eq("id", cred.id);

  await supabase.from("activity_logs").insert({
    partner_uuid:    partnerUuid,
    user_id:         SYSTEM_USER_ID,
    action_category: "system",
    action_type:     "deactivated",
    entity_type:     contractId ? "contracts" : "customers",
    entity_id:       String(contractId ?? customerId),
    description:     `VPN '${cred.vpn_name}' revoked for customer ${customerId}` +
      (contractNumber ? ` on contract ${contractNumber}` : " (nightly retry)"),
    metadata:        { vpn_name: cred.vpn_name, customer_id: customerId, mikrotik_id: cred.mikrotik_id, attempts: (cred.revoke_attempts ?? 0) + 1 },
  });

  return { success: true, vpn_name: cred.vpn_name };
}

async function deprovision(
  supabase: Supabase,
  customerId: number,
  partnerUuid: string,
  contractId: number,
  contractNumber: string,
  dryRun: boolean,
) {
  if (await hasOtherActiveContracts(supabase, partnerUuid, customerId, contractId)) {
    return { success: true, skipped: "other_active_contracts" };
  }

  const partner = await loadPartner(supabase, partnerUuid);
  const doorCode = await clearDoorCode(supabase, partner, partnerUuid, customerId, contractId, contractNumber, dryRun);
  const wifi = await revokeWifi(supabase, partner, partnerUuid, customerId, contractId, contractNumber, dryRun);

  return { success: wifi.success, dry_run: dryRun, door_code: doorCode, wifi };
}

// ── nightly retry of failed WiFi deletions ────────────────────────────────────

async function retryRevocations(supabase: Supabase, dryRun: boolean) {
  const { data: pending, error } = await supabase
    .from("customer_vpn_credentials")
    .select("id, customer_id, partner_uuid, vpn_name, revoke_attempts, revoke_last_error, revoke_failure_notified_at")
    .is("revoked_at", null)
    .not("revoke_requested_at", "is", null)
    .limit(200);
  if (error) throw error;

  const results = [];
  for (const cred of pending ?? []) {
    // The customer got a new contract meanwhile: keep the WiFi
    if (await hasOtherActiveContracts(supabase, cred.partner_uuid, cred.customer_id)) {
      if (!dryRun) {
        await supabase
          .from("customer_vpn_credentials")
          .update({ revoke_requested_at: null, revoke_attempts: 0, revoke_last_error: null, revoke_failure_notified_at: null })
          .eq("id", cred.id);
      }
      results.push({ vpn_name: cred.vpn_name, kept: "customer_has_active_contract" });
      continue;
    }

    const partner = await loadPartner(supabase, cred.partner_uuid);
    const outcome = await revokeWifi(supabase, partner, cred.partner_uuid, cred.customer_id, null, null, dryRun);
    const attempts = (cred.revoke_attempts ?? 0) + (outcome.success || dryRun ? 0 : 1);

    let partnerAlerted = false;
    if (!outcome.success && !dryRun && attempts >= MAX_REVOKE_ATTEMPTS_BEFORE_ALERT && !cred.revoke_failure_notified_at && partner?.email) {
      const { data: customer } = await supabase
        .from("customers")
        .select("first_name, second_name, company_name")
        .eq("id", cred.customer_id)
        .single();
      partnerAlerted = await sendEmail(supabase, cred.partner_uuid, partnerDisplayName(partner), "wifi_revoke_failed_partner", partner.email, {
        customer_name: customerDisplayName(customer),
        vpn_name:      cred.vpn_name,
        attempts:      String(attempts),
        last_error:    (outcome.error ?? "").slice(0, 200),
        partner_name:  partnerDisplayName(partner),
      }).catch(() => false);
      if (partnerAlerted) {
        await supabase
          .from("customer_vpn_credentials")
          .update({ revoke_failure_notified_at: new Date().toISOString() })
          .eq("id", cred.id);
      }
      await supabase.from("activity_logs").insert({
        partner_uuid:    cred.partner_uuid,
        user_id:         SYSTEM_USER_ID,
        action_category: "email",
        action_type:     partnerAlerted ? "sent" : "failed",
        entity_type:     "customers",
        entity_id:       String(cred.customer_id),
        description:     `WiFi removal failure alert for '${cred.vpn_name}' after ${attempts} attempts`,
        metadata:        { kind: "wifi_revoke_failed_partner", recipient_email: partner.email, vpn_name: cred.vpn_name },
      });
    }

    results.push({ vpn_name: cred.vpn_name, ...outcome, attempts, partner_alerted: partnerAlerted });
  }

  return {
    success: true,
    dry_run: dryRun,
    pending: pending?.length ?? 0,
    revoked: results.filter((r) => "success" in r && r.success && !r.skipped).length,
    results,
  };
}

// ── main ──────────────────────────────────────────────────────────────────────

serve(async (req) => {
  try {
    const body = await req.json();
    const { action, contract_id, contract_number, customer_id, partner_uuid } = body;
    // {"dry_run": true} reports what deprovision / retry would do without writing or sending
    const dryRun = body?.dry_run === true;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (action === "retry_revocations") {
      const result = await retryRevocations(supabase, dryRun);
      return new Response(JSON.stringify({ action, ...result }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!action || !contract_id || !customer_id || !partner_uuid) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
    }

    let result;
    if (action === "provision") {
      result = await provision(supabase, customer_id, partner_uuid, contract_id, contract_number);
    } else if (action === "deprovision") {
      result = await deprovision(supabase, customer_id, partner_uuid, contract_id, contract_number, dryRun);
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
