// supabase/functions/contract-expiry-reminders/index.ts
//
// Runs at 02:00 (Europe/Zurich). Sends:
//   1. expiry_reminder          → customer, auto-renew OFF, 3/2/1 days before end_date
//   2. renewal_reminder         → customer, auto-renew ON, once within the partner lead window
//   3. expiry_reminder_partner  → partner, daily list of contracts ending within the lead window
//   4. renewal_at_risk          → partner, auto-renew contract whose resource won't be free
//
// The lead window is partners.renewal_alert_lead_days (default 7).
// POST {"dry_run": true} renders everything without sending or writing.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import {
    alreadySent,
    customerDisplayName,
    escapeHtml,
    formatAmount,
    formatDateIt,
    logEmail,
    partnerDisplayName,
    readDryRun,
    sendTemplateEmail,
    type Supabase,
} from "../_shared/contractEmails.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const DAY_MS = 86400000;
const MAX_LEAD_DAYS = 14; // safety ceiling above any realistic partner lead time

interface Result {
    kind: string;
    contract_number?: string;
    recipient: string | null;
    success: boolean;
    skipped?: string;
    subject?: string;
    error?: string;
}

interface Partner {
    email: string | null;
    name: string;
    leadDays: number;
    first_name: string;
    second_name: string;
    structure_name: string;
}

const isoDate = (d: Date) => d.toISOString().split("T")[0];

function daysBetween(from: Date, endDate: string): number {
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);
    return Math.round((end.getTime() - from.getTime()) / DAY_MS);
}

async function loadPartner(supabase: Supabase, cache: Map<string, Partner>, partnerUuid: string): Promise<Partner> {
    if (!cache.has(partnerUuid)) {
        const { data: p } = await supabase
            .from("partners")
            .select("email, company_name, structure_name, first_name, second_name, renewal_alert_lead_days")
            .eq("partner_uuid", partnerUuid)
            .single();
        cache.set(partnerUuid, {
            email: p?.email ?? null,
            name: partnerDisplayName(p),
            leadDays: p?.renewal_alert_lead_days ?? 7,
            first_name: p?.first_name ?? "",
            second_name: p?.second_name ?? "",
            structure_name: p?.structure_name ?? "",
        });
    }
    return cache.get(partnerUuid)!;
}

serve(async (req) => {
    try {
        const dryRun = await readDryRun(req);
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const partners = new Map<string, Partner>();
        const results: Result[] = [];

        // Contracts ending between today and the safety ceiling. Every section
        // below filters this list further.
        const { data: upcoming, error: upcomingErr } = await supabase
            .from("contracts")
            .select(`
                id, contract_number, end_date, service_id, service_name, service_type,
                service_cost, service_currency, partner_uuid, auto_renew, is_renewable,
                renewal_alert_sent_at, renewal_reminder_sent_at,
                customers ( first_name, second_name, company_name, email )
            `)
            .eq("contract_status", "active")
            .eq("is_archived", false)
            .gte("end_date", isoDate(today))
            .lte("end_date", isoDate(new Date(today.getTime() + MAX_LEAD_DAYS * DAY_MS)))
            .order("end_date", { ascending: true });

        if (upcomingErr) throw upcomingErr;

        const willAutoRenew = (c: { auto_renew: boolean; is_renewable: boolean; service_type: string }) =>
            c.auto_renew && c.is_renewable && c.service_type === "abbonamento";

        // ── 1 + 2. Customer reminders ───────────────────────────────────────
        for (const contract of upcoming ?? []) {
            try {
                // deno-lint-ignore no-explicit-any
                const customer = (contract as any).customers;
                const customerEmail: string | null = customer?.email ?? null;
                const partner = await loadPartner(supabase, partners, contract.partner_uuid);
                const days = daysBetween(today, contract.end_date);
                const autoRenews = willAutoRenew(contract);

                // Auto-renew ON → one renewal notice inside the lead window
                // Auto-renew OFF → expiry reminder 3, 2 and 1 days before
                const kind = autoRenews ? "renewal_reminder" : "expiry_reminder";
                if (autoRenews && (contract.renewal_reminder_sent_at || days > partner.leadDays)) continue;
                if (!autoRenews && ![1, 2, 3].includes(days)) continue;

                if (!customerEmail) {
                    results.push({ kind, contract_number: contract.contract_number, recipient: null, success: true, skipped: "no_email" });
                    continue;
                }
                if (!autoRenews && await alreadySent(supabase, contract.id, kind, today)) {
                    results.push({ kind, contract_number: contract.contract_number, recipient: customerEmail, success: true, skipped: "already_sent_today" });
                    continue;
                }

                const expiryStatus = days === 1 ? "scade tra 1 giorno" : `scade tra ${days} giorni`;
                const endDate = formatDateIt(contract.end_date);
                const variables: Record<string, string> = {
                    customer_name: customerDisplayName(customer),
                    contract_number: contract.contract_number,
                    service_name: contract.service_name ?? "",
                    contract_type: contract.service_type,
                    expiry_type: contract.service_type,
                    end_date: endDate,
                    expiry_date: endDate,
                    days_until_expiry: String(days),
                    days_until_renewal: String(days),
                    expiry_status: expiryStatus,
                    partner_name: partner.name,
                    structure_name: partner.structure_name,
                    partner_firstname: partner.first_name,
                    partner_lastname: partner.second_name,
                    amount: formatAmount(contract.service_cost, contract.service_currency),
                };

                const sent = await sendTemplateEmail({
                    supabase,
                    partnerUuid: contract.partner_uuid,
                    templateType: kind,
                    recipientEmail: customerEmail,
                    variables,
                    partnerFromName: partner.name,
                    fallbackSubject: autoRenews ? "Il tuo abbonamento si rinnoverà il {{end_date}}" : "Il tuo contratto {{expiry_status}}",
                    fallbackBody: "<p>{{contract_number}} — {{service_name}}: {{end_date}}</p>",
                    dryRun,
                });

                if (!dryRun) {
                    if (sent.success && autoRenews) {
                        await supabase.from("contracts")
                            .update({ renewal_reminder_sent_at: new Date().toISOString() })
                            .eq("id", contract.id);
                    }
                    await logEmail(supabase, {
                        partnerUuid: contract.partner_uuid,
                        contractId: contract.id,
                        kind,
                        success: sent.success,
                        description: sent.success
                            ? `${kind} sent to customer for ${contract.contract_number} (${days} days before end)`
                            : `Failed to send ${kind} to customer for ${contract.contract_number}`,
                        metadata: { contract_number: contract.contract_number, recipient_email: customerEmail, days, error: sent.error ?? null },
                    });
                }

                results.push({ kind, contract_number: contract.contract_number, recipient: customerEmail, success: sent.success, subject: sent.subject, error: sent.error });
            } catch (err) {
                results.push({ kind: "customer_reminder", contract_number: contract.contract_number, recipient: null, success: false, error: err instanceof Error ? err.message : String(err) });
            }
        }

        // ── 3. Partner daily list ───────────────────────────────────────────
        const byPartner = new Map<string, typeof upcoming>();
        for (const contract of upcoming ?? []) {
            const partner = await loadPartner(supabase, partners, contract.partner_uuid);
            if (daysBetween(today, contract.end_date) > partner.leadDays) continue;
            if (!byPartner.has(contract.partner_uuid)) byPartner.set(contract.partner_uuid, []);
            byPartner.get(contract.partner_uuid)!.push(contract);
        }

        for (const [partnerUuid, list] of byPartner) {
            const partner = partners.get(partnerUuid)!;
            const kind = "expiry_reminder_partner";
            const digestId = `digest-${isoDate(today)}`;
            try {
                if (!partner.email) {
                    results.push({ kind, recipient: null, success: true, skipped: "no_email" });
                    continue;
                }
                if (await alreadySent(supabase, digestId, kind, today, "partners")) {
                    results.push({ kind, recipient: partner.email, success: true, skipped: "already_sent_today" });
                    continue;
                }

                const cell = 'style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:left;"';
                const head = 'style="padding:8px 10px;border-bottom:2px solid #d1d5db;text-align:left;background:#f3f4f6;"';
                const rows = list!.map((c) => {
                    // deno-lint-ignore no-explicit-any
                    const customer = (c as any).customers;
                    const renew = willAutoRenew(c)
                        ? '<span style="color:#15803d;font-weight:600;">Sì</span>'
                        : '<span style="color:#b91c1c;font-weight:600;">No</span>';
                    return `<tr><td ${cell}>${escapeHtml(formatDateIt(c.end_date))}</td>` +
                        `<td ${cell}>${escapeHtml(customerDisplayName(customer))}</td>` +
                        `<td ${cell}>${escapeHtml(c.service_name ?? "")}</td>` +
                        `<td ${cell}>${escapeHtml(c.contract_number)}</td>` +
                        `<td ${cell}>${renew}</td></tr>`;
                }).join("");
                const table = '<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">' +
                    `<tr><th ${head}>Scadenza</th><th ${head}>Cliente</th><th ${head}>Servizio</th><th ${head}>Contratto</th><th ${head}>Rinnovo automatico</th></tr>` +
                    rows + "</table>";

                const sent = await sendTemplateEmail({
                    supabase,
                    partnerUuid,
                    templateType: kind,
                    recipientEmail: partner.email,
                    variables: {
                        partner_name: partner.name,
                        lead_days: String(partner.leadDays),
                        contracts_count: String(list!.length),
                        contracts_table: table,
                    },
                    partnerFromName: partner.name,
                    fallbackSubject: "Contratti in scadenza nei prossimi {{lead_days}} giorni ({{contracts_count}})",
                    fallbackBody: "{{contracts_table}}",
                    dryRun,
                });

                if (!dryRun) {
                    await logEmail(supabase, {
                        partnerUuid,
                        contractId: digestId,
                        entityType: "partners",
                        kind,
                        success: sent.success,
                        description: sent.success
                            ? `Daily list of ${list!.length} expiring contracts sent to partner`
                            : "Failed to send daily list of expiring contracts to partner",
                        metadata: { recipient_email: partner.email, contracts: list!.map((c) => c.contract_number), error: sent.error ?? null },
                    });
                }

                results.push({ kind, recipient: partner.email, success: sent.success, subject: sent.subject, error: sent.error });
            } catch (err) {
                results.push({ kind, recipient: partner.email, success: false, error: err instanceof Error ? err.message : String(err) });
            }
        }

        // ── 4. Renewal at risk (resource not available for the next period) ─
        for (const contract of upcoming ?? []) {
            const kind = "renewal_at_risk";
            try {
                if (!willAutoRenew(contract) || contract.renewal_alert_sent_at) continue;
                const partner = await loadPartner(supabase, partners, contract.partner_uuid);
                const days = daysBetween(today, contract.end_date);
                if (days > partner.leadDays) continue;

                const { data: service } = await supabase
                    .from("services")
                    .select("location_resource_id, duration_days, location_resources!fk_services_location_resource ( resource_name )")
                    .eq("id", contract.service_id)
                    .single();
                if (!service?.location_resource_id || service.duration_days == null) continue;

                const { data: booking } = await supabase
                    .from("bookings")
                    .select("id")
                    .eq("contract_id", contract.id)
                    .eq("booking_status", "active")
                    .eq("is_archived", false)
                    .limit(1)
                    .maybeSingle();

                const endDate = new Date(contract.end_date);
                const { data: availability, error: availabilityErr } = await supabase.rpc("check_resource_availability", {
                    p_resource_id: service.location_resource_id,
                    p_start_date: isoDate(new Date(endDate.getTime() + DAY_MS)),
                    p_end_date: isoDate(new Date(endDate.getTime() + Number(service.duration_days) * DAY_MS)),
                    p_exclude_booking_id: booking?.id ?? null,
                });
                if (availabilityErr) throw availabilityErr;
                if (availability?.available === true) continue;

                if (!partner.email) {
                    results.push({ kind, contract_number: contract.contract_number, recipient: null, success: true, skipped: "no_email" });
                    continue;
                }

                // deno-lint-ignore no-explicit-any
                const resourceName = (service as any).location_resources?.resource_name || "";
                const sent = await sendTemplateEmail({
                    supabase,
                    partnerUuid: contract.partner_uuid,
                    templateType: kind,
                    recipientEmail: partner.email,
                    variables: {
                        // deno-lint-ignore no-explicit-any
                        customer_name: customerDisplayName((contract as any).customers),
                        contract_number: contract.contract_number,
                        resource_name: resourceName,
                        end_date: formatDateIt(contract.end_date),
                        days_until_renewal: String(days),
                        partner_name: partner.name,
                    },
                    partnerFromName: partner.name,
                    fallbackSubject: "Rinnovo a rischio: {{contract_number}}",
                    fallbackBody: "<p>{{resource_name}} non disponibile per il rinnovo di {{contract_number}}.</p>",
                    dryRun,
                });

                if (!dryRun) {
                    if (sent.success) {
                        await supabase.from("contracts")
                            .update({ renewal_alert_sent_at: new Date().toISOString() })
                            .eq("id", contract.id);
                    }
                    await logEmail(supabase, {
                        partnerUuid: contract.partner_uuid,
                        contractId: contract.id,
                        kind,
                        success: sent.success,
                        description: sent.success
                            ? `Renewal-at-risk alert sent to partner for ${contract.contract_number} (${resourceName} unavailable)`
                            : `Failed to send renewal-at-risk alert for ${contract.contract_number}`,
                        metadata: { contract_number: contract.contract_number, recipient_email: partner.email, resource_name: resourceName, error: sent.error ?? null },
                    });
                }

                results.push({ kind, contract_number: contract.contract_number, recipient: partner.email, success: sent.success, subject: sent.subject, error: sent.error });
            } catch (err) {
                results.push({ kind, contract_number: contract.contract_number, recipient: null, success: false, error: err instanceof Error ? err.message : String(err) });
            }
        }

        return new Response(
            JSON.stringify({
                success: true,
                dry_run: dryRun,
                sent: results.filter((r) => r.success && !r.skipped).length,
                failed: results.filter((r) => !r.success).length,
                skipped: results.filter((r) => r.skipped).length,
                results,
            }),
            { headers: { "Content-Type": "application/json" } },
        );
    } catch (err) {
        return new Response(
            JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }),
            { status: 500, headers: { "Content-Type": "application/json" } },
        );
    }
});
