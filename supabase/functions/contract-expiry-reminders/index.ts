// supabase/functions/contract-expiry-reminders/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ONESIGNAL_APP_ID = Deno.env.get("ONESIGNAL_APP_ID")!;
const ONESIGNAL_API_KEY = Deno.env.get("ONESIGNAL_API_KEY")!;
const ONESIGNAL_UNIQUE_TEMPLATE_ID = Deno.env.get("ONESIGNAL_UNIQUE_TEMPLATE_ID")!;

interface EmailResult {
    contract_id: number;
    contract_number: string;
    customer_email: string;
    days_difference: number;
    success: boolean;
    error?: string;
    skipped?: string;
}

interface SendTemplateEmailParams {
    supabase: ReturnType<typeof createClient>;
    partnerUuid: string;
    templateType: string;
    recipientEmail: string;
    variables: Record<string, string>;
    partnerFromName: string;
}

interface SendTemplateEmailResult {
    success: boolean;
    response?: unknown;
    error?: string;
    templateFound: boolean;
}

async function sendTemplateEmail({
    supabase,
    partnerUuid,
    templateType,
    recipientEmail,
    variables,
    partnerFromName,
}: SendTemplateEmailParams): Promise<SendTemplateEmailResult> {
    // Fetch email template
    const { data: templateData, error: templateError } = await supabase
        .from("email_templates")
        .select("body_html, subject_line")
        .eq("partner_uuid", partnerUuid)
        .eq("template_type", templateType)
        .single();

    let bodyHtml = "<p>Your contract is expiring soon.</p>";
    let emailSubject = "Contract Expiry Reminder";
    const templateFound = !!(templateData && !templateError);

    if (templateFound) {
        bodyHtml = templateData.body_html;
        emailSubject = templateData.subject_line || emailSubject;
    }

    // Substitute all {{key}} placeholders in subject and body
    for (const [key, value] of Object.entries(variables)) {
        const pattern = new RegExp(`\\{\\{${key}\\}\\}`, "g");
        emailSubject = emailSubject.replace(pattern, value);
        bodyHtml = bodyHtml.replace(pattern, value);
    }

    // Fetch banner URL from storage
    const { data: bannerFiles } = await supabase.storage
        .from("partners")
        .list(`${partnerUuid}`, { search: "email_banner" });

    const bannerFile = bannerFiles?.find(file => file.name.startsWith("email_banner."));
    let bannerUrl = "";

    if (bannerFile) {
        const { data: urlData } = supabase.storage
            .from("partners")
            .getPublicUrl(`${partnerUuid}/${bannerFile.name}`);
        bannerUrl = urlData.publicUrl;
    }

    // POST to OneSignal
    const emailPayload = {
        app_id: ONESIGNAL_APP_ID,
        email_from_name: partnerFromName,
        email_subject: emailSubject,
        email_from_address: "app@powercowo.com",
        email_reply_to_address: "app@powercowo.com",
        template_id: ONESIGNAL_UNIQUE_TEMPLATE_ID,
        target_channel: "email",
        include_email_tokens: [recipientEmail],
        include_aliases: {
            external_id: [partnerUuid]
        },
        custom_data: {
            banner_url: bannerUrl,
            body_html: bodyHtml
        }
    };

    const emailResponse = await fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Basic ${ONESIGNAL_API_KEY}`
        },
        body: JSON.stringify(emailPayload)
    });

    const emailResult = await emailResponse.json();
    const success = emailResponse.ok && !!emailResult.id;

    return {
        success,
        response: emailResult,
        error: success ? undefined : JSON.stringify(emailResult),
        templateFound,
    };
}

serve(async (req) => {
    try {
        console.log("🚀 Contract Expiry Reminders - Starting...");

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const threeDaysBefore = new Date(today);
        threeDaysBefore.setDate(today.getDate() + 3);

        const twoDaysBefore = new Date(today);
        twoDaysBefore.setDate(today.getDate() + 2);

        const oneDayBefore = new Date(today);
        oneDayBefore.setDate(today.getDate() + 1);

        const oneDayAfter = new Date(today);
        oneDayAfter.setDate(today.getDate() - 1);

        console.log("📅 Target dates:", {
            threeDaysBefore: threeDaysBefore.toISOString().split('T')[0],
            twoDaysBefore: twoDaysBefore.toISOString().split('T')[0],
            oneDayBefore: oneDayBefore.toISOString().split('T')[0],
            oneDayAfter: oneDayAfter.toISOString().split('T')[0]
        });

        // **IMPROVEMENT: Add contract_status and auto_renew filters**
        const { data: contracts, error: contractsError } = await supabase
            .from("contracts")
            .select(`
                id,
                contract_number,
                end_date,
                service_name,
                service_type,
                service_cost,
                service_currency,
                partner_uuid,
                auto_renew,
                customers (
                    first_name,
                    second_name,
                    email,
                    company_name
                )
            `)
            .or(`end_date.eq.${threeDaysBefore.toISOString().split('T')[0]},end_date.eq.${twoDaysBefore.toISOString().split('T')[0]},end_date.eq.${oneDayBefore.toISOString().split('T')[0]},end_date.eq.${oneDayAfter.toISOString().split('T')[0]}`)
            .eq("contract_status", "active")
            .eq("is_archived", false);

        if (contractsError) {
            throw contractsError;
        }

        console.log(`📋 Found ${contracts?.length || 0} contracts to process`);

        const results: EmailResult[] = [];

        for (const contract of contracts || []) {
            try {
                const endDate = new Date(contract.end_date);
                endDate.setHours(0, 0, 0, 0);

                const daysDifference = Math.floor((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

                console.log(`\n📧 Processing contract ${contract.contract_number}, days diff: ${daysDifference}`);

                // **IMPROVEMENT 1: Skip auto-renewing contracts**
                if (contract.auto_renew) {
                    console.log(`⏭️ Skipping auto-renewing contract ${contract.contract_number}`);
                    results.push({
                        contract_id: contract.id,
                        contract_number: contract.contract_number,
                        customer_email: contract.customers?.email || "unknown",
                        days_difference: daysDifference,
                        success: true,
                        skipped: "auto_renew_enabled"
                    });
                    continue;
                }

                // **IMPROVEMENT 2: Check if reminder already sent today**
                const { data: existingReminder } = await supabase
                    .from("activity_log")
                    .select("id")
                    .eq("entity_id", contract.id)
                    .eq("action_type", "expiry_reminder_sent")
                    .gte("created_at", today.toISOString())
                    .maybeSingle();

                if (existingReminder) {
                    console.log(`⏭️ Reminder already sent today for ${contract.contract_number}`);
                    results.push({
                        contract_id: contract.id,
                        contract_number: contract.contract_number,
                        customer_email: contract.customers?.email || "unknown",
                        days_difference: daysDifference,
                        success: true,
                        skipped: "already_sent_today"
                    });
                    continue;
                }

                // Fetch partner data
                const { data: partnerData, error: partnerError } = await supabase
                    .from("partners")
                    .select("company_name, structure_name, first_name, second_name")
                    .eq("partner_uuid", contract.partner_uuid)
                    .single();

                if (partnerError || !partnerData) {
                    console.error("❌ Partner data error:", partnerError);
                    results.push({
                        contract_id: contract.id,
                        contract_number: contract.contract_number,
                        customer_email: contract.customers?.email || "unknown",
                        days_difference: daysDifference,
                        success: false,
                        error: "Partner data not found"
                    });
                    continue;
                }

                // Prepare template variables
                const customerName = contract.customers?.company_name ||
                    `${contract.customers?.first_name || ""} ${contract.customers?.second_name || ""}`.trim();
                const partnerName = partnerData.structure_name || partnerData.company_name || "PowerCowo";
                const formattedEndDate = new Date(contract.end_date).toLocaleDateString("it-IT", {
                    year: "numeric",
                    month: "long",
                    day: "numeric"
                });

                let expiryStatus = "";
                if (daysDifference > 0) {
                    expiryStatus = `scade tra ${daysDifference} ${daysDifference === 1 ? 'giorno' : 'giorni'}`;
                } else if (daysDifference === 0) {
                    expiryStatus = "scade oggi";
                } else {
                    expiryStatus = `scaduto da ${Math.abs(daysDifference)} ${Math.abs(daysDifference) === 1 ? 'giorno' : 'giorni'}`;
                }

                const formattedAmount = new Intl.NumberFormat('it-IT', {
                    style: 'currency',
                    currency: contract.service_currency || 'EUR'
                }).format(contract.service_cost || 0);

                const variables: Record<string, string> = {
                    customer_name: customerName,
                    contract_number: contract.contract_number,
                    service_name: contract.service_name,
                    contract_type: contract.service_type,
                    expiry_type: contract.service_type,
                    end_date: formattedEndDate,
                    expiry_date: formattedEndDate,
                    days_until_expiry: daysDifference.toString(),
                    expiry_status: expiryStatus,
                    partner_name: partnerName,
                    structure_name: partnerData.structure_name || "",
                    partner_firstname: partnerData.first_name || "",
                    partner_lastname: partnerData.second_name || "",
                    amount: formattedAmount,
                };

                console.log("📤 Sending email to:", contract.customers?.email);

                const { success: emailSuccess, response: emailResult, error: emailError } = await sendTemplateEmail({
                    supabase,
                    partnerUuid: contract.partner_uuid,
                    templateType: "expiry_reminder",
                    recipientEmail: contract.customers?.email,
                    variables,
                    partnerFromName: partnerName,
                });

                if (emailSuccess) {
                    console.log("✅ Email sent successfully");
                } else {
                    console.error("❌ Email failed:", emailResult);
                }

                // Log activity
                await supabase.from("activity_log").insert({
                    partner_uuid: contract.partner_uuid,
                    action_category: "system",
                    action_type: emailSuccess ? "expiry_reminder_sent" : "expiry_reminder_failed",
                    entity_type: "contracts",
                    entity_id: contract.id,
                    description: emailSuccess
                        ? `Expiry reminder sent for contract ${contract.contract_number} (${expiryStatus})`
                        : `Failed to send expiry reminder for contract ${contract.contract_number}`,
                    metadata: {
                        contract_number: contract.contract_number,
                        customer_email: contract.customers?.email,
                        days_until_expiry: daysDifference,
                        expiry_status: expiryStatus,
                        email_success: emailSuccess,
                        error: emailSuccess ? null : emailResult
                    }
                });

                results.push({
                    contract_id: contract.id,
                    contract_number: contract.contract_number,
                    customer_email: contract.customers?.email || "unknown",
                    days_difference: daysDifference,
                    success: emailSuccess,
                    error: emailSuccess ? undefined : emailError
                });

            } catch (error) {
                console.error(`❌ Error processing contract ${contract.contract_number}:`, error);
                results.push({
                    contract_id: contract.id,
                    contract_number: contract.contract_number,
                    customer_email: contract.customers?.email || "unknown",
                    days_difference: 0,
                    success: false,
                    error: error.message
                });
            }
        }

        // ── Auto-renew preflight window ──────────────────────────────────────────
        // Any auto-renew abbonamento contract renewing within 14 days.
        // Per-partner lead is applied inside the loop from partners.renewal_alert_lead_days.
        // 14 is a safety ceiling above any realistic partner-configured lead time.
        const { data: autoRenewContracts, error: autoRenewErr } = await supabase
            .from("contracts")
            .select("id, contract_number, end_date, service_id, partner_uuid, renewal_alert_sent_at, customers ( first_name, second_name, company_name )")
            .eq("auto_renew", true)
            .eq("is_renewable", true)
            .eq("contract_status", "active")
            .eq("service_type", "abbonamento")
            .eq("is_archived", false)
            .gte("end_date", today.toISOString().split("T")[0])
            .lte("end_date", new Date(today.getTime() + 14 * 86400000).toISOString().split("T")[0])
            .order("end_date", { ascending: true });

        if (autoRenewErr) {
            console.error("❌ Auto-renew preflight query error:", autoRenewErr);
        }

        console.log(`\n🔍 Auto-renew preflight: ${autoRenewContracts?.length || 0} contracts in 14-day window`);

        interface PreflightResult {
            contract_id: number;
            contract_number: string;
            days_until_renewal: number;
            success: boolean;
            error?: string;
            skipped?: string;
        }

        const preflightResults: PreflightResult[] = [];

        for (const arContract of autoRenewContracts || []) {
            try {
                // 1. Skip if already alerted this cycle
                if (arContract.renewal_alert_sent_at !== null) {
                    console.log(`⏭️ Preflight: alert already sent for ${arContract.contract_number}`);
                    preflightResults.push({
                        contract_id: arContract.id,
                        contract_number: arContract.contract_number,
                        days_until_renewal: 0,
                        success: true,
                        skipped: "alert_already_sent"
                    });
                    continue;
                }

                // 2. Fetch partner: email, company_name, structure_name, renewal_alert_lead_days
                const { data: arPartner, error: arPartnerErr } = await supabase
                    .from("partners")
                    .select("email, company_name, structure_name, renewal_alert_lead_days")
                    .eq("partner_uuid", arContract.partner_uuid)
                    .single();

                if (arPartnerErr || !arPartner) {
                    console.error(`❌ Preflight: partner not found for ${arContract.contract_number}`);
                    preflightResults.push({
                        contract_id: arContract.id,
                        contract_number: arContract.contract_number,
                        days_until_renewal: 0,
                        success: false,
                        error: "Partner not found"
                    });
                    continue;
                }

                // 3. Compute days until renewal and apply per-partner lead filter
                const arEndDate = new Date(arContract.end_date);
                arEndDate.setHours(0, 0, 0, 0);
                const daysUntilRenewal = Math.ceil((arEndDate.getTime() - today.getTime()) / 86400000);
                const leadDays = arPartner.renewal_alert_lead_days ?? 7;

                if (daysUntilRenewal > leadDays || daysUntilRenewal < 0) {
                    console.log(`⏭️ Preflight: ${arContract.contract_number} is ${daysUntilRenewal} days away (lead=${leadDays}), skipping`);
                    preflightResults.push({
                        contract_id: arContract.id,
                        contract_number: arContract.contract_number,
                        days_until_renewal: daysUntilRenewal,
                        success: true,
                        skipped: "outside_lead_window"
                    });
                    continue;
                }

                // 4. Fetch service + resource
                const { data: serviceData, error: serviceErr } = await supabase
                    .from("services")
                    .select("location_resource_id, duration_days, location_resources ( resource_name )")
                    .eq("id", arContract.service_id)
                    .single();

                if (serviceErr || !serviceData) {
                    console.error(`❌ Preflight: service not found for ${arContract.contract_number}`);
                    preflightResults.push({
                        contract_id: arContract.id,
                        contract_number: arContract.contract_number,
                        days_until_renewal: daysUntilRenewal,
                        success: false,
                        error: "Service not found"
                    });
                    continue;
                }

                if (!serviceData.location_resource_id) {
                    console.log(`⏭️ Preflight: ${arContract.contract_number} has no resource_id, skipping`);
                    preflightResults.push({
                        contract_id: arContract.id,
                        contract_number: arContract.contract_number,
                        days_until_renewal: daysUntilRenewal,
                        success: true,
                        skipped: "no_resource"
                    });
                    continue;
                }

                // 5. Fetch the contract's active booking id (may be null)
                const { data: bookingData } = await supabase
                    .from("bookings")
                    .select("id")
                    .eq("contract_id", arContract.id)
                    .eq("booking_status", "active")
                    .eq("is_archived", false)
                    .limit(1)
                    .maybeSingle();

                // 6. Compute renewal date range and call availability check
                const renewalStart = new Date(arEndDate.getTime() + 86400000); // end_date + 1 day
                const renewalEnd = new Date(arEndDate.getTime() + (serviceData.duration_days ?? 0) * 86400000);

                const { data: availabilityData, error: availabilityErr } = await supabase.rpc(
                    "check_resource_availability",
                    {
                        p_resource_id: serviceData.location_resource_id,
                        p_start_date: renewalStart.toISOString().split("T")[0],
                        p_end_date: renewalEnd.toISOString().split("T")[0],
                        p_exclude_booking_id: bookingData?.id ?? null,
                    }
                );

                if (availabilityErr) {
                    console.error(`❌ Preflight: availability check failed for ${arContract.contract_number}:`, availabilityErr);
                    preflightResults.push({
                        contract_id: arContract.id,
                        contract_number: arContract.contract_number,
                        days_until_renewal: daysUntilRenewal,
                        success: false,
                        error: "Availability check failed: " + availabilityErr.message
                    });
                    continue;
                }

                // If available, nothing to warn about
                if (availabilityData?.available === true) {
                    console.log(`✅ Preflight: resource available for ${arContract.contract_number}, no alert needed`);
                    preflightResults.push({
                        contract_id: arContract.id,
                        contract_number: arContract.contract_number,
                        days_until_renewal: daysUntilRenewal,
                        success: true,
                        skipped: "resource_available"
                    });
                    continue;
                }

                // 7. Resource unavailable — send renewal_at_risk email to partner admin
                const customerName = arContract.customers?.company_name ||
                    `${arContract.customers?.first_name || ""} ${arContract.customers?.second_name || ""}`.trim();
                const arPartnerName = arPartner.structure_name || arPartner.company_name || "PowerCowo";
                const resourceName = serviceData.location_resources?.resource_name || "";
                const formattedArEndDate = arEndDate.toLocaleDateString("it-IT", {
                    year: "numeric",
                    month: "long",
                    day: "numeric"
                });

                const preflightVariables: Record<string, string> = {
                    customer_name: customerName,
                    contract_number: arContract.contract_number,
                    resource_name: resourceName,
                    end_date: formattedArEndDate,
                    days_until_renewal: daysUntilRenewal.toString(),
                    partner_name: arPartnerName,
                };

                console.log(`⚠️ Preflight: resource unavailable for ${arContract.contract_number}, alerting partner admin ${arPartner.email}`);

                const { success: preflightSent, error: preflightEmailError } = await sendTemplateEmail({
                    supabase,
                    partnerUuid: arContract.partner_uuid,
                    templateType: "renewal_at_risk",
                    recipientEmail: arPartner.email,
                    variables: preflightVariables,
                    partnerFromName: arPartnerName,
                });

                // 8. On success, stamp renewal_alert_sent_at
                if (preflightSent) {
                    console.log(`✅ Preflight: alert sent for ${arContract.contract_number}`);
                    await supabase
                        .from("contracts")
                        .update({ renewal_alert_sent_at: new Date().toISOString() })
                        .eq("id", arContract.id);
                } else {
                    console.error(`❌ Preflight: alert failed for ${arContract.contract_number}:`, preflightEmailError);
                }

                // 9. Record outcome
                preflightResults.push({
                    contract_id: arContract.id,
                    contract_number: arContract.contract_number,
                    days_until_renewal: daysUntilRenewal,
                    success: preflightSent,
                    error: preflightSent ? undefined : preflightEmailError
                });

            } catch (error) {
                console.error(`❌ Preflight error for contract ${arContract.contract_number}:`, error);
                preflightResults.push({
                    contract_id: arContract.id,
                    contract_number: arContract.contract_number,
                    days_until_renewal: 0,
                    success: false,
                    error: error.message
                });
            }
        }

        const successCount = results.filter(r => r.success).length;
        const failureCount = results.filter(r => !r.success).length;
        const skippedCount = results.filter(r => r.skipped).length;
        const preflightSentCount = preflightResults.filter(r => r.success && !r.skipped).length;
        const preflightSkippedCount = preflightResults.filter(r => r.skipped).length;
        const preflightFailedCount = preflightResults.filter(r => !r.success).length;

        console.log(`\n✅ Completed: ${successCount} succeeded, ${failureCount} failed, ${skippedCount} skipped`);
        console.log(`\n🔍 Preflight: ${preflightSentCount} alerts sent, ${preflightFailedCount} failed, ${preflightSkippedCount} skipped`);

        return new Response(
            JSON.stringify({
                success: true,
                processed: results.length,
                succeeded: successCount,
                failed: failureCount,
                skipped: skippedCount,
                results: results,
                preflight: {
                    processed: preflightResults.length,
                    alerts_sent: preflightSentCount,
                    failed: preflightFailedCount,
                    skipped: preflightSkippedCount,
                    results: preflightResults
                }
            }),
            { headers: { "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("❌ Fatal error:", error);
        return new Response(
            JSON.stringify({
                success: false,
                error: error.message
            }),
            {
                status: 500,
                headers: { "Content-Type": "application/json" }
            }
        );
    }
});
