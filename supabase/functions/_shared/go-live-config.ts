/** Go-live checklist definitions + builder for Admin Hub */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  envConfigured,
  isPlatformFlagOn,
  getPlatformSettingValue,
} from "./platform-settings.ts";
import { VENDOR_PROVIDER_DEFS } from "./vendor-providers.ts";

export type PlatformSb = ReturnType<typeof createClient>;

export const GO_LIVE_CHECK_KEYS = new Set([
  "go_live_check_2factor_wallet",
  "go_live_check_dlt_sender",
  "go_live_check_dlt_template",
  "go_live_check_2factor_callback_url",
  "go_live_check_otp_sms_test",
  "go_live_check_otp_delivery_report",
  "go_live_check_vyapar_kyc",
  "go_live_check_upi_vpa_live",
  "go_live_check_vyapar_qr_standee",
  "go_live_check_vyapar_webhook_url",
  "go_live_check_upi_payment_test",
  "go_live_check_vyapar_dashboard",
  "go_live_check_razorpay_live_mode",
  "go_live_check_razorpay_webhook_events",
  "go_live_check_razorpay_test_payment",
  "go_live_check_razorpay_route_enabled",
  "go_live_check_razorpay_route_transfer_test",
  "go_live_check_2factor_key_rotated",
  "go_live_check_msg91_dlt",
  "go_live_check_whatsapp_template",
  "go_live_check_whatsapp_verify_deployed",
  "go_live_check_vercel_deployed",
  "go_live_check_qr_flow",
  "go_live_check_privacy_terms",
  "go_live_check_mobile_devices",
  "go_live_check_vendors_live",
  "go_live_check_vendor_onboard_test",
  "go_live_check_dispatch_mode_set",
  "go_live_check_support_desk_test",
  "go_live_check_support_phone_staffed",
  "go_live_check_e2e_browse",
  "go_live_check_e2e_otp",
  "go_live_check_e2e_payment",
  "go_live_check_e2e_track",
  "go_live_check_supabase_pro_backups",
  "go_live_check_db_restore_drill",
]);

type ManualCheckDef = {
  key: string;
  category: string;
  functions: string;
  description: string;
  required: boolean;
};

export const GO_LIVE_MANUAL_CHECKS: ManualCheckDef[] = [
  { key: "go_live_check_2factor_wallet", category: "A. SMS OTP · 2Factor.in", functions: "2factor.in", description: "Account active with sufficient wallet / credits", required: true },
  { key: "go_live_check_dlt_sender", category: "A. SMS OTP · 2Factor.in", functions: "TRAI DLT", description: "DLT sender ID registered (e.g. SCANV)", required: true },
  { key: "go_live_check_dlt_template", category: "A. SMS OTP · 2Factor.in", functions: "TRAI DLT", description: "DLT OTP template approved — matches: ScanV OTP: {code}", required: true },
  { key: "go_live_check_2factor_callback_url", category: "A. SMS OTP · 2Factor.in", functions: "otp-delivery-report", description: "2Factor delivery callback URL pasted in 2Factor panel", required: true },
  { key: "go_live_check_otp_sms_test", category: "A. SMS OTP · 2Factor.in", functions: "send-otp", description: "Real +91 mobile received OTP SMS within ~30 seconds", required: true },
  { key: "go_live_check_otp_delivery_report", category: "A. SMS OTP · 2Factor.in", functions: "otp-delivery-report", description: "Admin OTP report shows delivered (not failed)", required: true },
  { key: "go_live_check_vyapar_kyc", category: "B. UPI · HDFC Vyapar", functions: "HDFC SmartHub", description: "Merchant KYC fully approved for live collections", required: true },
  { key: "go_live_check_upi_vpa_live", category: "B. UPI · HDFC Vyapar", functions: "UPI VPA", description: "dcoreglobalcorporati.82037575@hdfcbank activated for incoming payments", required: true },
  { key: "go_live_check_vyapar_qr_standee", category: "B. UPI · HDFC Vyapar", functions: "Static QR", description: "Physical standee QR matches /hdfc-vyapar-qr.png", required: true },
  { key: "go_live_check_vyapar_webhook_url", category: "B. UPI · HDFC Vyapar", functions: "razorpay-payment", description: "Vyapar webhook URL configured → razorpay-payment (vyapar_notify)", required: true },
  { key: "go_live_check_upi_payment_test", category: "B. UPI · HDFC Vyapar", functions: "UPI pay flow", description: "Test UPI payment auto-confirms booking (no manual I’ve paid)", required: true },
  { key: "go_live_check_vyapar_dashboard", category: "B. UPI · HDFC Vyapar", functions: "Vyapar app", description: "Test payment visible in Vyapar / HDFC merchant dashboard", required: true },
  { key: "go_live_check_razorpay_live_mode", category: "C. Razorpay backup", functions: "razorpay-payment", description: "Razorpay account in Live mode (not Test)", required: true },
  { key: "go_live_check_razorpay_webhook_events", category: "C. Razorpay backup", functions: "razorpay-payment", description: "Webhook events: payment.captured, payment_link.paid, transfer.processed, transfer.failed", required: true },
  { key: "go_live_check_razorpay_test_payment", category: "C. Razorpay backup", functions: "razorpay-payment", description: "Razorpay payment link tested end-to-end on phone", required: true },
  { key: "go_live_check_razorpay_route_enabled", category: "C. Razorpay Route", functions: "razorpay-payment · booking-dispatch", description: "Route enabled on Razorpay dashboard + at least one linked account activated", required: false },
  { key: "go_live_check_razorpay_route_transfer_test", category: "C. Razorpay Route", functions: "razorpay-payment", description: "Test transfer.processed webhook + vendor 85% transfer on dispatch assign", required: false },
  { key: "go_live_check_2factor_key_rotated", category: "D. Security", functions: "Security audit", description: "2Factor API key rotated if ever exposed in old client bundle", required: true },
  { key: "go_live_check_msg91_dlt", category: "E. Messaging fallbacks", functions: "MSG91", description: "MSG91 DLT template registered (if using MSG91 fallback)", required: false },
  { key: "go_live_check_whatsapp_template", category: "E. Messaging fallbacks", functions: "whatsapp-verify", description: "MSG91 WhatsApp template approved for +91-9270194842", required: false },
  { key: "go_live_check_whatsapp_verify_deployed", category: "E. Messaging fallbacks", functions: "whatsapp-verify", description: "whatsapp-verify edge function deployed", required: false },
  { key: "go_live_check_vercel_deployed", category: "F. App & deploy", functions: "Vercel", description: "Latest main deployed — bundle hash changed after push", required: true },
  { key: "go_live_check_qr_flow", category: "F. App & deploy", functions: "QR landing", description: "QR scan opens services home — no Add to Home Screen prompt", required: true },
  { key: "go_live_check_privacy_terms", category: "F. App & deploy", functions: "/privacy · /terms", description: "Privacy policy and terms pages final and loading", required: true },
  { key: "go_live_check_mobile_devices", category: "F. App & deploy", functions: "PWA mobile", description: "Layout tested on real iPhone + Android devices", required: true },
  { key: "go_live_check_vendors_live", category: "G. Operations", functions: "vendor_partners", description: "At least one live vendor per priority category", required: true },
  { key: "go_live_check_vendor_onboard_test", category: "G. Operations", functions: "vendor-onboard", description: "Vendor onboarding flow tested (#vendor-onboard)", required: true },
  { key: "go_live_check_dispatch_mode_set", category: "G. Operations", functions: "booking-dispatch", description: "Dispatch mode set in Admin → Vendors tab", required: true },
  { key: "go_live_check_support_desk_test", category: "G. Operations", functions: "customer-support", description: "Support desk tested with agent PIN", required: true },
  { key: "go_live_check_support_phone_staffed", category: "G. Operations", functions: "+91-9270194842", description: "Support phone staffed or forwarded", required: true },
  { key: "go_live_check_e2e_browse", category: "H. End-to-end smoke", functions: "Customer PWA", description: "Open app/QR → browse → service detail", required: true },
  { key: "go_live_check_e2e_otp", category: "H. End-to-end smoke", functions: "send-otp", description: "Booking → Send OTP → SMS → verify", required: true },
  { key: "go_live_check_e2e_payment", category: "H. End-to-end smoke", functions: "UPI · Razorpay", description: "Pay via UPI or Razorpay — auto-confirmed", required: true },
  { key: "go_live_check_e2e_track", category: "H. End-to-end smoke", functions: "LiveTrack", description: "Track screen shows booking; visible in admin/dispatch", required: true },
  { key: "go_live_check_supabase_pro_backups", category: "I. Backup & DR", functions: "Supabase", description: "Supabase Pro plan with daily backups enabled (Settings → Database → Backups)", required: true },
  { key: "go_live_check_db_restore_drill", category: "I. Backup & DR", functions: "Postgres", description: "Restore drill completed — dump restored and bookings/payments verified (docs/BACKUP-AND-SCALE.md)", required: true },
];

const SECRET_CHECKS: Array<{
  key: string;
  functions: string;
  description: string;
  required: boolean;
  check: () => boolean;
}> = [
  { key: "TWOFACTOR_API_KEY", functions: "send-otp · vendor-onboard", description: "2Factor.in SMS OTP API key", required: true, check: () => envConfigured("TWOFACTOR_API_KEY") },
  { key: "OTP_REPORT_SECRET", functions: "otp-delivery-report", description: "2Factor delivery callback ?key= (set in 2Factor panel + Supabase)", required: true, check: () => envConfigured("OTP_REPORT_SECRET") },
  { key: "RAZORPAY_KEY_ID", functions: "razorpay-payment", description: "Razorpay live API key ID", required: true, check: () => envConfigured("RAZORPAY_KEY_ID") },
  { key: "RAZORPAY_KEY_SECRET", functions: "razorpay-payment", description: "Razorpay live API secret", required: true, check: () => envConfigured("RAZORPAY_KEY_SECRET") },
  { key: "RAZORPAY_WEBHOOK_SECRET", functions: "razorpay-payment", description: "Razorpay webhook HMAC secret", required: true, check: () => envConfigured("RAZORPAY_WEBHOOK_SECRET") },
  { key: "RAZORPAY_ROUTE_ENABLED", functions: "razorpay-payment · booking-dispatch", description: "Set true after Route is live — enables 85% vendor transfers on dispatch assign", required: false, check: () => envConfigured("RAZORPAY_ROUTE_ENABLED") },
  { key: "VYAPAR_WEBHOOK_SECRET", functions: "razorpay-payment", description: "Vyapar UPI notify webhook secret", required: true, check: () => envConfigured("VYAPAR_WEBHOOK_SECRET") },
  { key: "DISPATCH_SECRET", functions: "booking-dispatch", description: "Protects dispatch tick/cron endpoints", required: true, check: () => envConfigured("DISPATCH_SECRET") },
  { key: "APP_URL", functions: "razorpay-payment", description: "Payment return URL (https://scanv-tau.vercel.app)", required: true, check: () => envConfigured("APP_URL") },
  { key: "ADMIN_HUB_PIN", functions: "admin-hub", description: "Admin Control Center PIN", required: true, check: () => envConfigured("ADMIN_HUB_PIN") },
  { key: "SUPPORT_ADMIN_PIN", functions: "admin-hub · customer-support", description: "Support admin PIN (full desk + hub)", required: true, check: () => envConfigured("SUPPORT_ADMIN_PIN") },
  { key: "SUPPORT_AGENT_PIN", functions: "customer-support", description: "Support agent PIN (read-only desk)", required: true, check: () => envConfigured("SUPPORT_AGENT_PIN") },
  { key: "PRICING_ADMIN_PIN", functions: "pricing-admin · admin-hub", description: "Pricing admin PIN", required: true, check: () => envConfigured("PRICING_ADMIN_PIN") },
  { key: "VENDOR_ADMIN_PIN", functions: "vendor-admin · admin-hub", description: "Vendor admin PIN", required: true, check: () => envConfigured("VENDOR_ADMIN_PIN") },
  { key: "PRICING_2FA_RESET_MOBILE", functions: "admin-hub", description: "Owner mobile for pricing 2FA reset OTP", required: true, check: () => envConfigured("PRICING_2FA_RESET_MOBILE") || envConfigured("ADMIN_OWNER_MOBILE") },
  { key: "MSG91_AUTH_KEY", functions: "send-otp · whatsapp-verify", description: "MSG91 SMS / WhatsApp fallback", required: false, check: () => envConfigured("MSG91_AUTH_KEY") },
  { key: "MSG91_WHATSAPP_INTEGRATED_NUMBER", functions: "whatsapp-verify", description: "WhatsApp business number (919270194842)", required: false, check: () => envConfigured("MSG91_WHATSAPP_INTEGRATED_NUMBER") },
  { key: "WHATSAPP_WEBHOOK_SECRET", functions: "whatsapp-verify", description: "Inbound WhatsApp webhook auth", required: false, check: () => envConfigured("WHATSAPP_WEBHOOK_SECRET") },
  { key: "RESEND_API_KEY", functions: "support-tickets", description: "Ticket closure emails via Resend", required: false, check: () => envConfigured("RESEND_API_KEY") },
  { key: "SUPPORT_EMAIL_FROM", functions: "support-tickets", description: "From address for support emails", required: false, check: () => envConfigured("SUPPORT_EMAIL_FROM") },
  { key: "DIGIO_API_KEY", functions: "vendor-onboard", description: "Digio eKYC (strict vendor verification)", required: false, check: () => envConfigured("DIGIO_API_KEY") },
];

export const RAZORPAY_ROUTE_TICKET_KEYS = [
  "razorpay_route_ticket_id",
  "razorpay_route_ticket_status",
  "razorpay_route_ticket_subject",
  "razorpay_route_ticket_opened_at",
  "razorpay_route_ticket_notes",
  "razorpay_route_ticket_last_checked_at",
] as const;

export type RazorpayRouteTicketStatus = "open" | "in_progress" | "resolved" | "closed";

const RAZORPAY_ROUTE_TICKET_STATUSES = new Set<RazorpayRouteTicketStatus>([
  "open",
  "in_progress",
  "resolved",
  "closed",
]);

async function loadRazorpayRouteTicket(sb: PlatformSb) {
  const { data } = await sb
    .from("platform_settings")
    .select("key, value, updated_at")
    .in("key", [...RAZORPAY_ROUTE_TICKET_KEYS]);
  const map: Record<string, { value: string; updated_at: string | null }> = {};
  for (const row of data || []) {
    const r = row as { key: string; value: string; updated_at: string | null };
    map[r.key] = { value: String(r.value || ""), updated_at: r.updated_at || null };
  }
  const statusRaw = (map.razorpay_route_ticket_status?.value || "open").toLowerCase();
  const status: RazorpayRouteTicketStatus = RAZORPAY_ROUTE_TICKET_STATUSES.has(statusRaw as RazorpayRouteTicketStatus)
    ? statusRaw as RazorpayRouteTicketStatus
    : "open";
  return {
    ticket_id: map.razorpay_route_ticket_id?.value || "20389531",
    status,
    subject: map.razorpay_route_ticket_subject?.value
      || "Enable Razorpay Route for DCore / ScanV marketplace",
    opened_at: map.razorpay_route_ticket_opened_at?.value || null,
    notes: map.razorpay_route_ticket_notes?.value || "",
    last_checked_at: map.razorpay_route_ticket_last_checked_at?.value || null,
    status_updated_at: map.razorpay_route_ticket_status?.updated_at || null,
    dashboard_url: "https://dashboard.razorpay.com/app/dashboard",
    support_tickets_url: "https://dashboard.razorpay.com/app/business-settings/ticket-support/tickets",
    route_url: "https://dashboard.razorpay.com/app/route",
    route_accounts_url: "https://dashboard.razorpay.com/app/route/accounts",
    blocked_items: [
      "Route menu and /app/route redirect until Razorpay resolves the ticket",
      "Vendor 85% auto-transfers (RAZORPAY_ROUTE_ENABLED stays off)",
      "transfer.* webhook events may be unavailable until Route is enabled",
    ],
    next_steps_when_resolved: [
      "Confirm /app/route loads in Razorpay dashboard",
      "Create vendor Linked Accounts (Route → Accounts)",
      "Paste acc_… IDs in Vendor Admin → Razorpay Route",
      "Add transfer.processed, transfer.failed, transfer.reversed to webhook",
      "npx supabase secrets set RAZORPAY_ROUTE_ENABLED=true",
      "Test Razorpay payment → dispatch assign → 85% transfer",
    ],
  };
}

async function loadManualCheckMap(sb: PlatformSb): Promise<Record<string, boolean>> {
  const keys = [...GO_LIVE_CHECK_KEYS];
  const { data } = await sb.from("platform_settings").select("key, value").in("key", keys);
  const out: Record<string, boolean> = {};
  for (const k of keys) out[k] = false;
  for (const row of data || []) {
    const v = String((row as { value: string }).value || "").toLowerCase();
    out[String((row as { key: string }).key)] = v === "1" || v === "true" || v === "yes";
  }
  return out;
}

async function buildSwitchRow(
  sb: PlatformSb,
  key: string,
  functions: string,
  description: string,
  productionRecommendation: "on" | "off",
  dangerous: boolean,
) {
  const envFallbackKey = key === "otp_dev_mode"
    ? "OTP_DEV_MODE"
    : key === "dispatch_open"
    ? "DISPATCH_OPEN"
    : undefined;
  const defaultValue = key === "voice_otp_fallback";
  const enabled = await isPlatformFlagOn(sb, key, { envFallbackKey, defaultValue });
  const { data } = await sb
    .from("platform_settings")
    .select("updated_at, updated_by")
    .eq("key", key)
    .maybeSingle();
  return {
    type: "switch",
    setting: key,
    function: functions,
    description,
    enabled,
    production_recommendation: productionRecommendation,
    toggleable: true,
    dangerous,
    required: true,
    updated_at: data?.updated_at || null,
  };
}

export async function buildGoLiveConfig(sb: PlatformSb): Promise<Record<string, unknown>> {
  const appUrl = Deno.env.get("APP_URL") || "https://scanv-tau.vercel.app";
  const sbProject = "rwlwrmmqtedugcreweut";
  const manualMap = await loadManualCheckMap(sb);
  const razorpayRouteTicket = await loadRazorpayRouteTicket(sb);

  const switches = await Promise.all([
    buildSwitchRow(sb, "otp_dev_mode", "send-otp · vendor-onboard · razorpay-payment", "Dev bypass: OTP without SMS; relaxes webhook checks when secrets missing. Same as legacy OTP_DEV_MODE env.", "off", true),
    buildSwitchRow(sb, "voice_otp_fallback", "send-otp · vendor-onboard · admin-hub", "When SMS fails, 2Factor voice call with OTP. Turn OFF for SMS-only.", "on", false),
    buildSwitchRow(sb, "dispatch_open", "booking-dispatch", "Allow dispatch without DISPATCH_SECRET header.", "off", true),
  ]);

  const vendorProviders = await Promise.all(
    VENDOR_PROVIDER_DEFS.map((d) =>
      buildSwitchRow(
        sb,
        d.key,
        d.functions,
        `${d.label} — ${d.description}`,
        d.production_recommendation,
        false,
      ),
    ),
  );

  const legacyOtpDevEnv = Deno.env.get("OTP_DEV_MODE") === "1";

  const secrets = SECRET_CHECKS.map((s) => ({
    type: "secret",
    setting: s.key,
    function: s.functions,
    description: s.description,
    configured: s.check(),
    required: s.required,
    production_recommendation: "set",
    toggleable: false,
  }));

  const manualChecks = GO_LIVE_MANUAL_CHECKS.map((c) => ({
    type: "check",
    setting: c.key,
    function: c.functions,
    category: c.category,
    description: c.description,
    checked: !!manualMap[c.key],
    required: c.required,
    production_recommendation: "done",
    toggleable: true,
  }));

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const [{ count: otpDeliveredToday }, { count: otpFailedToday }, { count: activeVendors }] = await Promise.all([
    sb.from("otp_delivery_reports").select("id", { count: "exact", head: true }).eq("status", "delivered").gte("created_at", todayStart.toISOString()),
    sb.from("otp_delivery_reports").select("id", { count: "exact", head: true }).eq("status", "failed").gte("created_at", todayStart.toISOString()),
    sb.from("vendor_partners").select("id", { count: "exact", head: true }).eq("status", "active"),
  ]);

  const { data: dispatchRow } = await sb
    .from("platform_settings")
    .select("value, updated_at")
    .eq("key", "dispatch_mode")
    .maybeSingle();

  const autoChecks = [
    {
      type: "auto",
      setting: "legacy_OTP_DEV_MODE_env",
      function: "Supabase secrets",
      description: "Legacy OTP_DEV_MODE env var should be unset or 0 (use otp_dev_mode switch instead)",
      passed: !legacyOtpDevEnv,
      required: true,
      production_recommendation: "unset",
      toggleable: false,
    },
    {
      type: "auto",
      setting: "active_vendors",
      function: "vendor_partners",
      description: `Active vendor partners in database (current: ${activeVendors ?? 0})`,
      passed: (activeVendors ?? 0) >= 1,
      required: true,
      production_recommendation: "≥1",
      toggleable: false,
    },
    {
      type: "auto",
      setting: "otp_delivered_today",
      function: "otp_delivery_reports",
      description: `OTP SMS delivered today (current: ${otpDeliveredToday ?? 0})`,
      passed: (otpDeliveredToday ?? 0) > 0,
      required: false,
      production_recommendation: ">0",
      toggleable: false,
    },
    {
      type: "auto",
      setting: "otp_failed_today",
      function: "otp_delivery_reports",
      description: `OTP SMS failed today (current: ${otpFailedToday ?? 0}) — aim for 0`,
      passed: (otpFailedToday ?? 0) === 0,
      required: false,
      production_recommendation: "0",
      toggleable: false,
    },
  ];

  const references = [
    {
      type: "reference",
      setting: "2factor_callback_url",
      function: "otp-delivery-report",
      description: "Paste in 2Factor.in → Delivery Report URL (replace YOUR_SECRET with OTP_REPORT_SECRET value)",
      value: `https://${sbProject}.supabase.co/functions/v1/otp-delivery-report?key=YOUR_OTP_REPORT_SECRET`,
      toggleable: false,
    },
    {
      type: "reference",
      setting: "razorpay_webhook_url",
      function: "razorpay-payment",
      description: "Razorpay Dashboard → Webhooks → URL",
      value: `https://${sbProject}.supabase.co/functions/v1/razorpay-payment`,
      toggleable: false,
    },
    {
      type: "reference",
      setting: "vyapar_webhook",
      function: "razorpay-payment",
      description: "Vyapar / HDFC webhook → vyapar_notify action on same function",
      value: `https://${sbProject}.supabase.co/functions/v1/razorpay-payment`,
      toggleable: false,
    },
    {
      type: "reference",
      setting: "upi_vpa",
      function: "UPI collect",
      description: "DCORE GLOBAL CORPORATION · Merchant 82037575",
      value: "dcoreglobalcorporati.82037575@hdfcbank",
      toggleable: false,
    },
    {
      type: "reference",
      setting: "scanv_qr_url",
      function: "QR print",
      description: "Customer QR — opens browse home without install step",
      value: `${appUrl}/?qr=1&utm_source=qr&utm_medium=print`,
      toggleable: false,
    },
    {
      type: "reference",
      setting: "scanv_qr_png",
      function: "QR print",
      description: "Printable PNG asset",
      value: `${appUrl}/scanv-qr.png`,
      toggleable: false,
    },
  ];

  const sections = [
    { id: "switches", title: "Runtime switches (dev / security)", subtitle: "Owner PIN required for otp_dev_mode and dispatch_open.", items: switches },
    { id: "vendors", title: "Dependent vendors & payment providers", subtitle: "ON = provider active in live app. OFF hides payment buttons or skips OTP route. Instant effect.", items: vendorProviders },
    { id: "secrets", title: "Supabase secrets", subtitle: "Set in Supabase Dashboard → Edge Functions → Secrets. Values never shown here.", items: secrets },
    { id: "auto", title: "Auto checks", subtitle: "Computed from database and environment on each refresh.", items: autoChecks },
    { id: "manual", title: "Manual verification checklist", subtitle: "Mark done as you complete each step (bank approval, DLT, tests, etc.).", items: manualChecks },
    { id: "references", title: "Reference URLs & IDs", subtitle: "Copy and paste into 2Factor, Razorpay, Vyapar, or print materials.", items: references },
  ];

  const requiredSecretsOk = secrets.filter((s) => s.required).every((s) => s.configured);
  const switchesOk = switches.filter((s) => s.dangerous).every((s) => !s.enabled)
    && switches.find((s) => s.setting === "voice_otp_fallback")?.enabled !== false;
  const autoOk = autoChecks.filter((s) => s.required).every((s) => s.passed);
  const manualRequired = manualChecks.filter((c) => c.required);
  const manualDone = manualRequired.filter((c) => c.checked).length;

  const productionReady = requiredSecretsOk && switchesOk && autoOk && manualDone === manualRequired.length;

  const switchDone = (s: Record<string, unknown>) => {
    const rec = String(s.production_recommendation || "");
    const enabled = !!s.enabled;
    if (s.dangerous) return !enabled;
    if (rec === "on") return enabled;
    if (rec === "off") return !enabled;
    return true;
  };

  const progress = {
    secrets: { done: secrets.filter((s) => s.required && s.configured).length, total: secrets.filter((s) => s.required).length },
    switches: { done: switches.filter(switchDone).length, total: switches.length },
    vendors: { done: vendorProviders.filter(switchDone).length, total: vendorProviders.length },
    auto: { done: autoChecks.filter((s) => s.required && s.passed).length, total: autoChecks.filter((s) => s.required).length },
    manual: { done: manualDone, total: manualRequired.length },
    overall: {
      done: secrets.filter((s) => s.required && s.configured).length + manualDone + autoChecks.filter((s) => s.required && s.passed).length,
      total: secrets.filter((s) => s.required).length + manualRequired.length + autoChecks.filter((s) => s.required).length,
    },
  };

  return {
    app_url: appUrl,
    app_version: "5.5.3",
    production_ready: productionReady,
    progress,
    sections,
    razorpay_route_ticket: razorpayRouteTicket,
    dispatch_mode: String(dispatchRow?.value || "both"),
    dispatch_mode_updated_at: dispatchRow?.updated_at || null,
    deploy_commands: [
      "git push origin main",
      "npx supabase db push",
      "npx supabase functions deploy admin-hub send-otp razorpay-payment booking-dispatch vendor-onboard otp-delivery-report whatsapp-verify platform-config --no-verify-jwt",
      "./scripts/backup-db.sh   # before major DB changes",
    ],
    docs: {
      go_live_checklist: "docs/GO-LIVE-CHECKLIST.md",
      otp_delivery: "docs/OTP-DELIVERY-REPORT.md",
      secrets: "docs/SECRETS-AND-PINS-INVENTORY.md",
      apis: "docs/ALL-APIS-AND-WEBHOOKS.md",
    },
    not_required: [
      { item: "AWS EC2 / own server", reason: "Vercel + Supabase host everything" },
      { item: "PWA Add to Home Screen", reason: "Removed — browser-first; store apps optional" },
    ],
  };
}

export async function updateGoLiveCheck(
  sb: PlatformSb,
  key: string,
  checked: boolean,
): Promise<{ error?: string }> {
  if (!GO_LIVE_CHECK_KEYS.has(key)) return { error: "Invalid checklist key" };
  const { error } = await sb.from("platform_settings").upsert({
    key,
    value: checked ? "1" : "0",
    updated_by: "admin-go-live-ui",
  }, { onConflict: "key" });
  if (error) return { error: error.message };
  return {};
}

export async function updateRazorpayRouteTicket(
  sb: PlatformSb,
  body: Record<string, unknown>,
): Promise<{ error?: string; ticket?: Record<string, unknown> }> {
  const now = new Date().toISOString();
  const upserts: Array<{ key: string; value: string }> = [];

  if (body.status !== undefined) {
    const status = String(body.status || "").trim().toLowerCase();
    if (!RAZORPAY_ROUTE_TICKET_STATUSES.has(status as RazorpayRouteTicketStatus)) {
      return { error: "Invalid ticket status" };
    }
    upserts.push({ key: "razorpay_route_ticket_status", value: status });
  }

  if (body.notes !== undefined) {
    upserts.push({ key: "razorpay_route_ticket_notes", value: String(body.notes || "").slice(0, 4000) });
  }

  if (body.mark_checked === true) {
    upserts.push({ key: "razorpay_route_ticket_last_checked_at", value: now });
  }

  if (!upserts.length) return { error: "Nothing to update" };

  for (const row of upserts) {
    const { error } = await sb.from("platform_settings").upsert({
      key: row.key,
      value: row.value,
      updated_by: "admin-go-live-ui",
    }, { onConflict: "key" });
    if (error) return { error: error.message };
  }

  const ticket = await loadRazorpayRouteTicket(sb);
  return { ticket };
}
