// supabase/functions/_shared/contractEmails.ts
//
// Shared helpers for the contract lifecycle email functions
// (contract-expired-notifications, contract-expiry-reminders,
// contract-renewal-confirmation).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const ONESIGNAL_APP_ID = Deno.env.get("ONESIGNAL_APP_ID")!;
const ONESIGNAL_API_KEY = Deno.env.get("ONESIGNAL_API_KEY")!;
const ONESIGNAL_UNIQUE_TEMPLATE_ID = Deno.env.get("ONESIGNAL_UNIQUE_TEMPLATE_ID")!;

// auth.users row used for automated activity_logs entries
export const SYSTEM_USER_ID = "11111111-1111-1111-1111-111111111111";

export type Supabase = ReturnType<typeof createClient>;

export interface SendResult {
    success: boolean;
    dryRun?: boolean;
    templateFound: boolean;
    subject?: string;
    error?: string;
}

// Body of the request: {"dry_run": true} renders every email but sends nothing
// and writes nothing, so the flow can be checked against live data.
export async function readDryRun(req: Request): Promise<boolean> {
    try {
        const body = await req.json();
        return body?.dry_run === true;
    } catch {
        return false;
    }
}

export function fillTemplate(text: string, variables: Record<string, string>): string {
    let out = text;
    for (const [key, value] of Object.entries(variables)) {
        out = out.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value ?? "");
    }
    return out;
}

export function formatDateIt(date: string): string {
    return new Date(date).toLocaleDateString("it-IT", { year: "numeric", month: "long", day: "numeric" });
}

export function formatAmount(amount: number | null | undefined, currency: string | null | undefined): string {
    return new Intl.NumberFormat("it-IT", { style: "currency", currency: currency || "EUR" }).format(Number(amount ?? 0));
}

export function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

// deno-lint-ignore no-explicit-any
export function customerDisplayName(customer: any): string {
    return customer?.company_name ||
        `${customer?.first_name ?? ""} ${customer?.second_name ?? ""}`.replace(/\s+/g, " ").trim();
}

// deno-lint-ignore no-explicit-any
export function partnerDisplayName(partner: any): string {
    return partner?.structure_name || partner?.company_name || "PowerCowo";
}

async function bannerUrlFor(supabase: Supabase, partnerUuid: string): Promise<string> {
    const { data: files } = await supabase.storage
        .from("partners")
        .list(`${partnerUuid}`, { search: "email_banner" });
    const file = files?.find((f: { name: string }) => f.name.startsWith("email_banner."));
    if (!file) return "";
    const { data } = supabase.storage.from("partners").getPublicUrl(`${partnerUuid}/${file.name}`);
    return data.publicUrl;
}

export async function sendTemplateEmail(params: {
    supabase: Supabase;
    partnerUuid: string;
    templateType: string;
    recipientEmail: string;
    variables: Record<string, string>;
    partnerFromName: string;
    fallbackSubject: string;
    fallbackBody: string;
    dryRun?: boolean;
}): Promise<SendResult> {
    const { supabase, partnerUuid, templateType, recipientEmail, variables, partnerFromName, dryRun } = params;

    const { data: tpl } = await supabase
        .from("email_templates")
        .select("subject_line, body_html")
        .eq("partner_uuid", partnerUuid)
        .eq("template_type", templateType)
        .maybeSingle();

    const templateFound = !!tpl;
    const subject = fillTemplate(tpl?.subject_line || params.fallbackSubject, variables);
    const bodyHtml = fillTemplate(tpl?.body_html || params.fallbackBody, variables);

    if (dryRun) return { success: true, dryRun: true, templateFound, subject };

    const payload = {
        app_id: ONESIGNAL_APP_ID,
        email_from_name: partnerFromName,
        email_subject: subject,
        email_from_address: "app@powercowo.com",
        email_reply_to_address: "app@powercowo.com",
        template_id: ONESIGNAL_UNIQUE_TEMPLATE_ID,
        target_channel: "email",
        include_email_tokens: [recipientEmail],
        include_aliases: { external_id: [partnerUuid] },
        custom_data: { banner_url: await bannerUrlFor(supabase, partnerUuid), body_html: bodyHtml },
    };

    try {
        const res = await fetch("https://onesignal.com/api/v1/notifications", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Basic ${ONESIGNAL_API_KEY}` },
            body: JSON.stringify(payload),
        });
        const result = await res.json().catch(() => null);
        const success = res.ok && !!result?.id;
        return { success, templateFound, subject, error: success ? undefined : JSON.stringify(result) };
    } catch (err) {
        return { success: false, templateFound, subject, error: err instanceof Error ? err.message : String(err) };
    }
}

// Writes an email entry to activity_logs (category "email", action "sent"/"failed").
// metadata.kind identifies the email (e.g. "expiry_reminder") for deduplication.
export async function logEmail(supabase: Supabase, entry: {
    partnerUuid: string;
    contractId: number | string;
    entityType?: string;
    kind: string;
    success: boolean;
    description: string;
    metadata?: Record<string, unknown>;
}): Promise<void> {
    const { error } = await supabase.from("activity_logs").insert({
        partner_uuid: entry.partnerUuid,
        user_id: SYSTEM_USER_ID,
        action_category: "email",
        action_type: entry.success ? "sent" : "failed",
        entity_type: entry.entityType ?? "contracts",
        entity_id: String(entry.contractId),
        description: entry.description,
        metadata: { kind: entry.kind, ...entry.metadata },
    });
    if (error) console.error("activity_logs insert failed:", error.message);
}

// True if an email of this kind was already sent for the entity since `since`.
export async function alreadySent(
    supabase: Supabase, contractId: number | string, kind: string, since: Date, entityType = "contracts",
): Promise<boolean> {
    const { data } = await supabase
        .from("activity_logs")
        .select("id")
        .eq("entity_type", entityType)
        .eq("entity_id", String(contractId))
        .eq("action_type", "sent")
        .eq("metadata->>kind", kind)
        .gte("created_at", since.toISOString())
        .limit(1);
    return (data?.length ?? 0) > 0;
}
