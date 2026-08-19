/** ScanV ops todo board — mirrors docs/SCANV-TODO.md for Admin Hub reminders */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { envConfigured } from "./platform-settings.ts";

export type PlatformSb = ReturnType<typeof createClient>;

export type ScanvTodoStatus = "done" | "pending" | "blocked" | "watch" | "active";

export type ScanvTodoItemDef = {
  key: string;
  title: string;
  notes?: string;
  status: ScanvTodoStatus;
  /** When set, overrides static status if secret is configured */
  secretKey?: string;
  /** Manual dismiss / mark done in Admin → Todo */
  manual?: boolean;
  link?: string;
  adminTab?: string;
};

export type ScanvTodoSectionDef = {
  id: string;
  title: string;
  subtitle?: string;
  items: ScanvTodoItemDef[];
};

export const SCANV_TODO_CHECK_PREFIX = "scanv_todo_done_";

export const SCANV_TODO_CHECK_KEYS = new Set<string>();

export const SCANV_TODO_SECTIONS: ScanvTodoSectionDef[] = [
  {
    id: "fast2sms",
    title: "Fast2SMS (SMS fallback #3)",
    subtitle: "Live chain: 2Factor → MSG91 → Fast2SMS → Twilio",
    items: [
      { key: "fast2sms_code", title: "Fast2SMS wired in notify.ts", status: "done", notes: "Edge functions deployed" },
      { key: "fast2sms_switch", title: "vendor_enable_fast2sms Go-Live switch", status: "done", notes: "Migration applied" },
      { key: "fast2sms_account", title: "Fast2SMS account + Dev API key", status: "pending", manual: true, secretKey: "FAST2SMS_API_KEY", link: "https://www.fast2sms.com" },
      { key: "fast2sms_dlt", title: "DLT sender + OTP template in Fast2SMS", status: "pending", manual: true, notes: "Separate from 2Factor/MSG91 DLT" },
      { key: "fast2sms_secrets", title: "Supabase FAST2SMS_* secrets", status: "pending", secretKey: "FAST2SMS_API_KEY", notes: "FAST2SMS_SENDER_ID, FAST2SMS_DLT_MESSAGE_ID" },
      { key: "fast2sms_test", title: "Test OTP via Fast2SMS fallback", status: "pending", manual: true, adminTab: "otp" },
    ],
  },
  {
    id: "twilio",
    title: "Twilio (SMS fallback #4)",
    items: [
      { key: "twilio_account", title: "Twilio trial account", status: "done", manual: true },
      { key: "twilio_sms_trial", title: "SMS trial + test SMS sent", status: "done", manual: true },
      { key: "twilio_secrets", title: "Supabase TWILIO_* secrets", status: "pending", secretKey: "TWILIO_ACCOUNT_SID", adminTab: "go-live" },
      { key: "twilio_webhooks", title: "Webhooks on trial number", status: "pending", manual: true, notes: "booking-dispatch + whatsapp-verify" },
    ],
  },
  {
    id: "sms_otp",
    title: "SMS OTP · 2Factor primary",
    items: [
      { key: "twofactor_key", title: "TWOFACTOR_API_KEY in Supabase", status: "pending", secretKey: "TWOFACTOR_API_KEY", adminTab: "go-live" },
      { key: "twofactor_dlt", title: "DLT sender + OTP template (2Factor)", status: "pending", manual: true, adminTab: "go-live" },
      { key: "otp_callback", title: "2Factor delivery callback URL", status: "pending", secretKey: "OTP_REPORT_SECRET", adminTab: "otp" },
      { key: "msg91_key", title: "MSG91_AUTH_KEY (fallback #2)", status: "pending", secretKey: "MSG91_AUTH_KEY", adminTab: "go-live" },
      { key: "msg91_dlt", title: "MSG91 DLT template", status: "pending", manual: true },
    ],
  },
  {
    id: "payments",
    title: "Go-live · payments",
    items: [
      { key: "vyapar_bank", title: "HDFC Vyapar / UPI live collections", status: "blocked", manual: true, notes: "Waiting on bank KYC / VPA activation" },
      { key: "vyapar_webhook", title: "Vyapar webhook + ₹1 UPI test", status: "pending", manual: true, secretKey: "VYAPAR_WEBHOOK_SECRET" },
      { key: "razorpay_live", title: "Razorpay live backup path", status: "pending", manual: true, secretKey: "RAZORPAY_KEY_ID", adminTab: "go-live" },
    ],
  },
  {
    id: "social",
    title: "Social (@scanvapp)",
    items: [
      { key: "ig_cron", title: "Daily Instagram cron (Vercel)", status: "done", notes: "10:00 AM IST" },
      { key: "meta_vercel", title: "META_PAGE_ACCESS_TOKEN on Vercel", status: "pending", manual: true, notes: "Live cron blocked until set in Vercel env" },
      { key: "ig_bio", title: "Remove “Coming soon” from IG/FB bio", status: "pending", manual: true },
      { key: "ig_post", title: "Post today @scanvapp", status: "pending", manual: true, adminTab: "social" },
    ],
  },
  {
    id: "seo",
    title: "SEO & India entity",
    items: [
      { key: "gsc", title: "Google Search Console verified", status: "done" },
      { key: "gbp", title: "Google Business Profile public listing", status: "pending", manual: true, notes: "Finish verification at business.google.com" },
      { key: "virtual_office", title: "Virtual office / MCA registered address", status: "pending", manual: true },
      { key: "ig_snippet", title: "Fix “ScanV coming to?” brand snippet", status: "done", notes: "Remove Coming soon from social bios" },
    ],
  },
  {
    id: "email",
    title: "Email & Cloudflare",
    items: [
      { key: "resend", title: "Resend transactional email", status: "done", secretKey: "RESEND_API_KEY" },
      { key: "cf_email", title: "Cloudflare Email Sending (optional)", status: "pending", manual: true, notes: "Resend is live today" },
      { key: "gmail_alias", title: "Gmail Send mail as support@ / reports@", status: "pending", manual: true },
    ],
  },
  {
    id: "health",
    title: "Health & monitoring",
    items: [
      { key: "health_70", title: "Daily health report 70/70 checks", status: "done", adminTab: "health" },
      { key: "cron_email", title: "Cron emails to sam@ + jas@", status: "watch", manual: true, notes: "6 AM & 5 PM IST" },
      { key: "ops_monitor", title: "Agent ops monitor runbook", status: "active", notes: "scripts/ops-health-review.mjs" },
    ],
  },
];

for (const section of SCANV_TODO_SECTIONS) {
  for (const item of section.items) {
    if (item.manual) SCANV_TODO_CHECK_KEYS.add(`${SCANV_TODO_CHECK_PREFIX}${item.key}`);
  }
}

export const SCANV_TODO_COMMANDS = [
  {
    label: "Fast2SMS secrets",
    command: `npx supabase secrets set \\\n  FAST2SMS_API_KEY=your_dev_api_key \\\n  FAST2SMS_SENDER_ID=SCANV \\\n  FAST2SMS_DLT_MESSAGE_ID=your_dlt_message_id`,
  },
  {
    label: "Twilio secrets",
    command: `npx supabase secrets set \\\n  TWILIO_ACCOUNT_SID=ACxxxx \\\n  TWILIO_AUTH_TOKEN=xxxx \\\n  TWILIO_SMS_FROM=+1xxxxxxxxxx`,
  },
  {
    label: "Ops health review",
    command: "node scripts/ops-health-review.mjs",
  },
];

function resolveStatus(
  item: ScanvTodoItemDef,
  manualDone: boolean,
): ScanvTodoStatus {
  if (item.secretKey && envConfigured(item.secretKey)) return "done";
  if (item.manual && manualDone) return "done";
  if (item.status === "done" && !item.manual && !item.secretKey) return "done";
  return item.status;
}

async function loadManualDoneMap(sb: PlatformSb): Promise<Record<string, boolean>> {
  const keys = [...SCANV_TODO_CHECK_KEYS];
  if (!keys.length) return {};
  const { data } = await sb.from("platform_settings").select("key, value").in("key", keys);
  const out: Record<string, boolean> = {};
  for (const row of data || []) {
    const id = String(row.key).replace(SCANV_TODO_CHECK_PREFIX, "");
    out[id] = row.value === "1" || row.value === "true";
  }
  return out;
}

export async function buildScanvTodoConfig(sb: PlatformSb): Promise<Record<string, unknown>> {
  const manualMap = await loadManualDoneMap(sb);
  let done = 0;
  let pending = 0;
  let blocked = 0;
  let watch = 0;

  const sections = SCANV_TODO_SECTIONS.map((section) => {
    const items = section.items.map((item) => {
      const status = resolveStatus(item, !!manualMap[item.key]);
      if (status === "done") done += 1;
      else if (status === "blocked") blocked += 1;
      else if (status === "watch" || status === "active") watch += 1;
      else pending += 1;

      return {
        key: item.key,
        title: item.title,
        notes: item.notes || null,
        status,
        manual: !!item.manual,
        toggleable: !!item.manual,
        link: item.link || null,
        admin_tab: item.adminTab || null,
        secret_key: item.secretKey || null,
        secret_configured: item.secretKey ? envConfigured(item.secretKey) : null,
        checked: status === "done",
      };
    });
    return {
      id: section.id,
      title: section.title,
      subtitle: section.subtitle || null,
      items,
      open_count: items.filter((i) => i.status !== "done").length,
    };
  });

  const total = done + pending + blocked + watch;
  return {
    updated_at: new Date().toISOString(),
    doc: "docs/SCANV-TODO.md",
    owners: "Samir + Jasmeen",
    sms_chain: "2Factor → MSG91 → Fast2SMS → Twilio",
    progress: { done, pending, blocked, watch, total, open: total - done },
    sections,
    commands: SCANV_TODO_COMMANDS,
  };
}

export async function updateScanvTodoItem(
  sb: PlatformSb,
  key: string,
  done: boolean,
): Promise<{ error?: string }> {
  const settingKey = `${SCANV_TODO_CHECK_PREFIX}${key}`;
  if (!SCANV_TODO_CHECK_KEYS.has(settingKey)) {
    return { error: "Invalid todo key" };
  }
  const { error } = await sb.from("platform_settings").upsert({
    key: settingKey,
    value: done ? "1" : "0",
    description: `ScanV todo: ${key}`,
    updated_by: "admin-todo-ui",
    updated_at: new Date().toISOString(),
  }, { onConflict: "key" });
  if (error) return { error: error.message };
  return {};
}
