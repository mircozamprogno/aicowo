// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ONESIGNAL_APP_ID = Deno.env.get("ONESIGNAL_APP_ID")!;
const ONESIGNAL_API_KEY = Deno.env.get("ONESIGNAL_API_KEY")!;
const ONESIGNAL_UNIQUE_TEMPLATE_ID = Deno.env.get("ONESIGNAL_UNIQUE_TEMPLATE_ID")!;

interface Result {
  log_id: number;
  contract_number: string;
  customer_email: string;
  success: boolean;
  error?: string;
}

serve(async (_req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: pending, error } = await supabase
      .from("contract_renewal_log")
      .select(`
        id,
        original_contract_id,
        original_contract_number,
        partner_uuid
      `)
      .in("renewal_status", ["success", "success_no_booking"])
      .is("email_sent_at", null)
      .order("renewal_attempt_date", { ascending: true })
      .limit(200);

    if (error) throw error;

    const results: Result[] = [];

    for (const row of pending ?? []) {
      try {
        // Fetch contract with customer embed
        const { data: contract, error: cErr } = await supabase
          .from("contracts")
          .select(`
            id, contract_number, end_date, service_currency, service_cost,
            customers ( first_name, second_name, email, company_name )
          `)
          .eq("id", row.original_contract_id)
          .single();
        if (cErr || !contract) throw cErr ?? new Error("contract not found");

        // Fetch partner
        const { data: partner } = await supabase
          .from("partners")
          .select("company_name, structure_name")
          .eq("partner_uuid", row.partner_uuid)
          .single();

        // Fetch latest payment for amount/currency
        const { data: latestPayment } = await supabase
          .from("payments")
          .select("amount, currency")
          .eq("contract_id", contract.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        // Fetch the contract_renewed email template
        const { data: tpl } = await supabase
          .from("email_templates")
          .select("subject_line, body_html")
          .eq("partner_uuid", row.partner_uuid)
          .eq("template_type", "contract_renewed")
          .single();

        const customer = (contract as any).customers as any;
        const customerEmail = customer?.email;
        if (!customerEmail) throw new Error("customer email missing");

        const customerName =
          customer?.company_name ||
          `${customer?.first_name ?? ""} ${customer?.second_name ?? ""}`.trim();
        const partnerName =
          partner?.structure_name || partner?.company_name || "PowerCowo";
        const newEndDate = new Date(contract.end_date).toLocaleDateString("it-IT", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
        const rawAmount = latestPayment?.amount ?? contract.service_cost ?? 0;
        const currency = latestPayment?.currency ?? contract.service_currency ?? "EUR";
        const amount = new Intl.NumberFormat("it-IT", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(Number(rawAmount));

        const substitute = (s: string) =>
          s
            .replaceAll("{{customer_name}}", customerName)
            .replaceAll("{{contract_number}}", contract.contract_number)
            .replaceAll("{{new_end_date}}", newEndDate)
            .replaceAll("{{amount}}", String(amount))
            .replaceAll("{{currency}}", String(currency))
            .replaceAll("{{partner_name}}", partnerName);

        const renderedSubject = substitute(tpl?.subject_line ?? "Contratto rinnovato");
        const renderedBodyHtml = substitute(tpl?.body_html ?? "<p>Il tuo contratto è stato rinnovato.</p>");

        // Fetch banner URL from storage (same pattern as contract-expiry-reminders)
        const { data: bannerFiles } = await supabase.storage
          .from("partners")
          .list(`${row.partner_uuid}`, { search: "email_banner" });

        const bannerFile = bannerFiles?.find((file: any) => file.name.startsWith("email_banner."));
        let bannerUrl = "";

        if (bannerFile) {
          const { data: urlData } = supabase.storage
            .from("partners")
            .getPublicUrl(`${row.partner_uuid}/${bannerFile.name}`);
          bannerUrl = urlData.publicUrl;
        }

        // Build OneSignal payload (same shape as contract-expiry-reminders)
        const emailPayload = {
          app_id: ONESIGNAL_APP_ID,
          email_from_name: partnerName,
          email_subject: renderedSubject,
          email_from_address: "app@powercowo.com",
          email_reply_to_address: "app@powercowo.com",
          template_id: ONESIGNAL_UNIQUE_TEMPLATE_ID,
          target_channel: "email",
          include_email_tokens: [customerEmail],
          include_aliases: {
            external_id: [row.partner_uuid],
          },
          custom_data: {
            banner_url: bannerUrl,
            body_html: renderedBodyHtml,
          },
        };

        const emailResponse = await fetch("https://onesignal.com/api/v1/notifications", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Basic ${ONESIGNAL_API_KEY}`,
          },
          body: JSON.stringify(emailPayload),
        });

        if (!emailResponse.ok) {
          throw new Error(`OneSignal ${emailResponse.status}: ${await emailResponse.text()}`);
        }

        // Stamp email_sent_at only on success
        await supabase
          .from("contract_renewal_log")
          .update({ email_sent_at: new Date().toISOString() })
          .eq("id", row.id);

        results.push({
          log_id: row.id,
          contract_number: contract.contract_number,
          customer_email: customerEmail,
          success: true,
        });
      } catch (err) {
        // Do NOT stamp email_sent_at — row will retry next day
        results.push({
          log_id: row.id,
          contract_number: row.original_contract_number,
          customer_email: "",
          success: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: results.length, results }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
