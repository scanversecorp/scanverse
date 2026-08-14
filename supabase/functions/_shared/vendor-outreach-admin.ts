/** PIN-gated vendor outreach — sends via ScanV MSG91/Twilio WhatsApp (not personal phone). */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { sendWhatsAppText } from "./notify.ts";
import { vendorOutreachMessage, getBusinessCommand } from "./business-command-admin.ts";
import { updateVendorLead } from "./vendor-leads-admin.ts";
import catalog from "./vendor-leads-data.json" with { type: "json" };
import {
  isOutreachWindowOpen,
  outsideHoursError,
  outreachHoursLabel,
} from "./business-hours.ts";

function whatsAppConfigured(): boolean {
  const msg91 = Deno.env.get("MSG91_WHATSAPP_INTEGRATED_NUMBER") &&
    (Deno.env.get("MSG91_AUTH_KEY") || Deno.env.get("MSG91_WHATSAPP_AUTH_KEY"));
  const twilio = Deno.env.get("TWILIO_WHATSAPP_FROM") &&
    Deno.env.get("TWILIO_ACCOUNT_SID") &&
    Deno.env.get("TWILIO_AUTH_TOKEN");
  return !!(msg91 || twilio);
}

export async function sendVendorOutreach(
  sb: SupabaseClient,
  body: Record<string, unknown>,
  updatedBy: string,
) {
  if (!body.force && !isOutreachWindowOpen()) {
    return { error: outsideHoursError(), outside_hours: true, outreach_hours: outreachHoursLabel() };
  }

  if (!whatsAppConfigured()) {
    return {
      error: "ScanV WhatsApp not configured — set MSG91_WHATSAPP_INTEGRATED_NUMBER + MSG91_AUTH_KEY (see docs/DEPLOY-WHATSAPP-VERIFY.md). Use wa.me links on phone until then.",
      configured: false,
    };
  }

  const leadId = String(body.lead_id || "").trim();
  const phone = String(body.phone || "").trim();
  const message = String(body.message || "").trim();

  if (!leadId && !phone) return { error: "lead_id or phone required" };

  let targetPhone = phone;
  let businessName = "";
  let resolvedLeadId = leadId;

  if (leadId) {
    const cmd = await getBusinessCommand(sb);
    const hit = (cmd.strike_list?.vendors || []).find((v) => v.lead_id === leadId);
    if (hit) {
      targetPhone = hit.phone;
      businessName = hit.business_name;
      resolvedLeadId = hit.lead_id;
    } else {
      const v = (catalog.vendors as Array<{ id: string; business_name: string; phones: string[] }>)
        .find((x) => x.id === leadId);
      if (v?.phones?.[0]) {
        targetPhone = v.phones[0];
        businessName = v.business_name;
        resolvedLeadId = v.id;
      }
    }
  }

  if (!targetPhone) return { error: "No phone for this lead" };

  const text = message || vendorOutreachMessage(businessName || "partner");
  const sent = await sendWhatsAppText(targetPhone, text);
  if (!sent.ok) {
    return {
      error: sent.error || "WhatsApp send failed",
      configured: true,
      hint: "Cold outbound may need an approved Meta template — register scanv_vendor_outreach in MSG91",
    };
  }

  if (resolvedLeadId) {
    await updateVendorLead(sb, {
      lead_id: resolvedLeadId,
      onboard_status: "contacted",
      validation_notes: `WhatsApp outreach sent ${new Date().toISOString()} via ${sent.provider}`,
    }, updatedBy);
  }

  return {
    success: true,
    provider: sent.provider,
    lead_id: resolvedLeadId || null,
    phone: targetPhone,
    message: text,
  };
}

export async function sendStrikeListOutreach(
  sb: SupabaseClient,
  body: Record<string, unknown>,
  updatedBy: string,
) {
  if (!body.force && !isOutreachWindowOpen()) {
    return { error: outsideHoursError(), outside_hours: true, outreach_hours: outreachHoursLabel() };
  }

  if (!whatsAppConfigured()) {
    return {
      error: "ScanV WhatsApp not configured",
      configured: false,
    };
  }

  const limit = Math.min(10, Math.max(1, Number(body.limit) || 5));
  const cmd = await getBusinessCommand(sb);
  const targets = (cmd.strike_list?.vendors || []).slice(0, limit);
  const results: Array<Record<string, unknown>> = [];

  for (const v of targets) {
    const r = await sendVendorOutreach(sb, {
      lead_id: v.lead_id,
      phone: v.phone,
      message: v.outreach_message,
    }, updatedBy);
    results.push({
      lead_id: v.lead_id,
      business_name: v.business_name,
      phone: v.phone,
      ok: !!r.success,
      error: r.error || null,
      provider: r.provider || null,
    });
    // Small gap to avoid provider rate limits
    await new Promise((r) => setTimeout(r, 800));
  }

  const sent = results.filter((x) => x.ok).length;
  return {
    success: sent > 0,
    sent,
    failed: results.length - sent,
    results,
    configured: true,
  };
}

export function outreachAgentStatus() {
  const open = isOutreachWindowOpen();
  return {
    whatsapp_configured: whatsAppConfigured(),
    business_number: Deno.env.get("MSG91_WHATSAPP_INTEGRATED_NUMBER") || null,
    template_name: Deno.env.get("MSG91_WHATSAPP_TEMPLATE_NAME") || null,
    outreach_hours: outreachHoursLabel(),
    outreach_window_open: open,
    note: open
      ? (whatsAppConfigured()
        ? "Agent can send from ScanV business WhatsApp via admin or scripts/send_vendor_outreach.mjs"
        : "Configure MSG91 WhatsApp secrets to enable autonomous outreach")
      : outsideHoursError(),
  };
}
