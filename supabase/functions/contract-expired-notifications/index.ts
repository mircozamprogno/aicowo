// supabase/functions/contract-expired-notifications/index.ts
//
// Runs at 01:00 (Europe/Zurich) right after handle_contract_expiry().
// For every expired contract not yet notified, emails:
//   - the customer  → contract_expired
//   - the partner   → contract_expired_partner
// Each side is stamped separately (expired_customer_notified_at /
// expired_partner_notified_at) so a failed email is retried the next night
// without resending the one that succeeded.
//
// POST {"dry_run": true} renders everything without sending or writing.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import {
    customerDisplayName,
    formatDateIt,
    logEmail,
    partnerDisplayName,
    readDryRun,
    sendTemplateEmail,
} from "../_shared/contractEmails.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface Result {
    contract_number: string;
    recipient: "customer" | "partner";
    email: string | null;
    success: boolean;
    skipped?: string;
    subject?: string;
    error?: string;
}

serve(async (req) => {
    try {
        const dryRun = await readDryRun(req);
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        const { data: contracts, error } = await supabase
            .from("contracts")
            .select(`
                id, contract_number, partner_uuid, service_name, end_date, auto_renew,
                expired_customer_notified_at, expired_partner_notified_at,
                customers ( first_name, second_name, company_name, email )
            `)
            .eq("contract_status", "expired")
            .eq("is_archived", false)
            .or("expired_customer_notified_at.is.null,expired_partner_notified_at.is.null")
            .order("end_date", { ascending: true })
            .limit(200);

        if (error) throw error;

        const partnerCache = new Map<string, { email: string | null; name: string }>();
        const results: Result[] = [];

        for (const contract of contracts ?? []) {
            // deno-lint-ignore no-explicit-any
            const customer = (contract as any).customers;
            const customerName = customerDisplayName(customer);

            if (!partnerCache.has(contract.partner_uuid)) {
                const { data: p } = await supabase
                    .from("partners")
                    .select("email, company_name, structure_name")
                    .eq("partner_uuid", contract.partner_uuid)
                    .single();
                partnerCache.set(contract.partner_uuid, { email: p?.email ?? null, name: partnerDisplayName(p) });
            }
            const partner = partnerCache.get(contract.partner_uuid)!;

            const variables: Record<string, string> = {
                customer_name: customerName,
                customer_email: customer?.email ?? "",
                contract_number: contract.contract_number,
                service_name: contract.service_name ?? "",
                end_date: formatDateIt(contract.end_date),
                auto_renew: contract.auto_renew ? "Sì" : "No",
                partner_name: partner.name,
            };

            const notify = async (
                recipient: "customer" | "partner",
                email: string | null,
                templateType: string,
                column: "expired_customer_notified_at" | "expired_partner_notified_at",
                fallbackSubject: string,
            ) => {
                if (contract[column]) return;

                if (!email) {
                    // Nothing to send to: mark as handled so it isn't retried forever
                    if (!dryRun) await supabase.from("contracts").update({ [column]: new Date().toISOString() }).eq("id", contract.id);
                    results.push({ contract_number: contract.contract_number, recipient, email, success: true, skipped: "no_email" });
                    return;
                }

                const sent = await sendTemplateEmail({
                    supabase,
                    partnerUuid: contract.partner_uuid,
                    templateType,
                    recipientEmail: email,
                    variables,
                    partnerFromName: partner.name,
                    fallbackSubject,
                    fallbackBody: "<p>{{contract_number}} — {{service_name}}: scaduto il {{end_date}}.</p>",
                    dryRun,
                });

                if (!dryRun) {
                    if (sent.success) {
                        await supabase.from("contracts").update({ [column]: new Date().toISOString() }).eq("id", contract.id);
                    }
                    await logEmail(supabase, {
                        partnerUuid: contract.partner_uuid,
                        contractId: contract.id,
                        kind: templateType,
                        success: sent.success,
                        description: sent.success
                            ? `Contract expired email sent to ${recipient} for ${contract.contract_number}`
                            : `Failed to send contract expired email to ${recipient} for ${contract.contract_number}`,
                        metadata: { contract_number: contract.contract_number, recipient_email: email, error: sent.error ?? null },
                    });
                }

                results.push({
                    contract_number: contract.contract_number,
                    recipient,
                    email,
                    success: sent.success,
                    subject: sent.subject,
                    error: sent.error,
                });
            };

            await notify("customer", customer?.email ?? null, "contract_expired",
                "expired_customer_notified_at", "Il tuo contratto è scaduto");
            await notify("partner", partner.email, "contract_expired_partner",
                "expired_partner_notified_at", "Contratto scaduto: {{customer_name}}");
        }

        return new Response(
            JSON.stringify({
                success: true,
                dry_run: dryRun,
                contracts: contracts?.length ?? 0,
                sent: results.filter((r) => r.success && !r.skipped).length,
                failed: results.filter((r) => !r.success).length,
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
