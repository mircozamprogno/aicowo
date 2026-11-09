// supabase/functions/contract-renewal-confirmation/index.ts
//
// Called at 04:00 (Europe/Zurich) right after auto_renew_contracts(), and again
// at 05:00 as a catch-up. For every successful renewal not yet notified, emails:
//   - the customer → contract_renewed          (stamps contract_renewal_log.email_sent_at)
//   - the partner  → contract_renewed_partner  (stamps contract_renewal_log.partner_email_sent_at)
// A failed email is not stamped and is retried on the next run.
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
    log_id: number;
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

        const { data: pending, error } = await supabase
            .from("contract_renewal_log")
            .select("id, original_contract_id, original_contract_number, partner_uuid, email_sent_at, partner_email_sent_at")
            .in("renewal_status", ["success", "success_no_booking"])
            .or("email_sent_at.is.null,partner_email_sent_at.is.null")
            .order("renewal_attempt_date", { ascending: true })
            .limit(200);

        if (error) throw error;

        const results: Result[] = [];

        for (const row of pending ?? []) {
            try {
                const { data: contract, error: cErr } = await supabase
                    .from("contracts")
                    .select(`
                        id, contract_number, service_name, end_date, service_currency, service_cost, renewal_count,
                        customers ( first_name, second_name, email, company_name )
                    `)
                    .eq("id", row.original_contract_id)
                    .single();
                if (cErr || !contract) throw cErr ?? new Error("contract not found");

                const { data: partner } = await supabase
                    .from("partners")
                    .select("email, company_name, structure_name")
                    .eq("partner_uuid", row.partner_uuid)
                    .single();

                // Amount of the payment created for this renewal, if any
                const { data: latestPayment } = await supabase
                    .from("payments")
                    .select("amount, currency")
                    .eq("contract_id", contract.id)
                    .order("created_at", { ascending: false })
                    .limit(1)
                    .maybeSingle();

                // deno-lint-ignore no-explicit-any
                const customer = (contract as any).customers;
                const partnerName = partnerDisplayName(partner);
                const variables: Record<string, string> = {
                    customer_name: customerDisplayName(customer),
                    contract_number: contract.contract_number,
                    service_name: contract.service_name ?? "",
                    new_end_date: formatDateIt(contract.end_date),
                    amount: new Intl.NumberFormat("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        .format(Number(latestPayment?.amount ?? contract.service_cost ?? 0)),
                    currency: String(latestPayment?.currency ?? contract.service_currency ?? "EUR"),
                    renewal_count: String(contract.renewal_count ?? 1),
                    partner_name: partnerName,
                };

                const notify = async (
                    recipient: "customer" | "partner",
                    email: string | null,
                    templateType: string,
                    column: "email_sent_at" | "partner_email_sent_at",
                    fallbackSubject: string,
                ) => {
                    if (row[column]) return;

                    if (!email) {
                        // Nothing to send to: mark as handled so it isn't retried forever
                        if (!dryRun) {
                            await supabase.from("contract_renewal_log").update({ [column]: new Date().toISOString() }).eq("id", row.id);
                        }
                        results.push({ log_id: row.id, contract_number: contract.contract_number, recipient, email, success: true, skipped: "no_email" });
                        return;
                    }

                    const sent = await sendTemplateEmail({
                        supabase,
                        partnerUuid: row.partner_uuid,
                        templateType,
                        recipientEmail: email,
                        variables,
                        partnerFromName: partnerName,
                        fallbackSubject,
                        fallbackBody: "<p>{{contract_number}} rinnovato fino al {{new_end_date}}.</p>",
                        dryRun,
                    });

                    if (!dryRun) {
                        if (sent.success) {
                            await supabase.from("contract_renewal_log").update({ [column]: new Date().toISOString() }).eq("id", row.id);
                        }
                        await logEmail(supabase, {
                            partnerUuid: row.partner_uuid,
                            contractId: contract.id,
                            kind: templateType,
                            success: sent.success,
                            description: sent.success
                                ? `Renewal confirmation sent to ${recipient} for ${contract.contract_number}`
                                : `Failed to send renewal confirmation to ${recipient} for ${contract.contract_number}`,
                            metadata: { contract_number: contract.contract_number, renewal_log_id: row.id, recipient_email: email, error: sent.error ?? null },
                        });
                    }

                    results.push({
                        log_id: row.id,
                        contract_number: contract.contract_number,
                        recipient,
                        email,
                        success: sent.success,
                        subject: sent.subject,
                        error: sent.error,
                    });
                };

                await notify("customer", customer?.email ?? null, "contract_renewed", "email_sent_at", "Contratto rinnovato");
                await notify("partner", partner?.email ?? null, "contract_renewed_partner", "partner_email_sent_at",
                    "Contratto rinnovato: {{customer_name}}");
            } catch (err) {
                // Nothing stamped — the row is retried on the next run
                results.push({
                    log_id: row.id,
                    contract_number: row.original_contract_number,
                    recipient: "customer",
                    email: null,
                    success: false,
                    error: err instanceof Error ? err.message : String(err),
                });
            }
        }

        return new Response(
            JSON.stringify({
                success: true,
                dry_run: dryRun,
                processed: pending?.length ?? 0,
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
