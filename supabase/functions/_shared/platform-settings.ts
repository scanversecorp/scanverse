/** Admin-controlled platform flags (platform_settings table + env fallback). */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export type PlatformSb = ReturnType<typeof createClient>;

export const GO_LIVE_SWITCH_KEYS = new Set([
  "otp_dev_mode",
  "voice_otp_fallback",
  "dispatch_open",
  "vendor_enable_2factor",
  "vendor_enable_msg91",
  "vendor_enable_twilio",
  "vendor_enable_whatsapp",
  "vendor_enable_razorpay",
  "vendor_enable_vyapar_upi",
  "vendor_enable_upi_gpay",
  "vendor_enable_upi_phonepe",
  "vendor_enable_upi_paytm",
  "vendor_enable_upi_navi",
  "vendor_enable_upi_bhim",
  "vendor_enable_upi_any",
]);

const TRUTHY = new Set(["1", "true", "on", "yes"]);
const FALSY = new Set(["0", "false", "off", "no"]);

export async function getPlatformSettingValue(
  sb: PlatformSb,
  key: string,
): Promise<string | null> {
  const { data } = await sb
    .from("platform_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (data?.value == null) return null;
  return String(data.value).trim();
}

export async function isPlatformFlagOn(
  sb: PlatformSb,
  key: string,
  opts?: { envFallbackKey?: string; defaultValue?: boolean },
): Promise<boolean> {
  const dbVal = await getPlatformSettingValue(sb, key);
  if (dbVal !== null && dbVal !== "") {
    const l = dbVal.toLowerCase();
    if (TRUTHY.has(l)) return true;
    if (FALSY.has(l)) return false;
  }
  const envKey = opts?.envFallbackKey;
  if (envKey) {
    const env = Deno.env.get(envKey);
    if (env === "1" || env === "true") return true;
    if (env === "0" || env === "false") return false;
  }
  return opts?.defaultValue ?? false;
}

export function envConfigured(key: string): boolean {
  return !!String(Deno.env.get(key) || "").trim();
}

export function anyAdminPinConfigured(): boolean {
  return [
    "ADMIN_HUB_PIN",
    "SUPPORT_ADMIN_PIN",
    "PRICING_ADMIN_PIN",
    "VENDOR_ADMIN_PIN",
  ].some((k) => envConfigured(k));
}
