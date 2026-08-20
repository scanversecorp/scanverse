/** Dependent vendor / payment provider toggles (platform_settings). */

import { isPlatformFlagOn, type PlatformSb } from "./platform-settings.ts";

export type VendorProviderDef = {
  key: string;
  label: string;
  functions: string;
  description: string;
  defaultOn: boolean;
  production_recommendation: "on" | "off";
};

export const VENDOR_PROVIDER_DEFS: VendorProviderDef[] = [
  { key: "vendor_enable_2factor", label: "2Factor.in", functions: "send-otp · vendor-onboard", description: "Primary India SMS OTP via 2Factor.in API", defaultOn: true, production_recommendation: "on" },
  { key: "vendor_enable_msg91", label: "MSG91", functions: "send-otp · whatsapp-verify", description: "SMS and WhatsApp fallback (MSG91)", defaultOn: true, production_recommendation: "on" },
  { key: "vendor_enable_fast2sms", label: "Fast2SMS", functions: "send-otp · dispatch", description: "DLT SMS fallback after MSG91 (Fast2SMS)", defaultOn: true, production_recommendation: "on" },
  { key: "vendor_enable_twilio", label: "Twilio", functions: "send-otp · dispatch", description: "International SMS / voice fallback (last resort)", defaultOn: true, production_recommendation: "on" },
  { key: "vendor_enable_whatsapp", label: "WhatsApp", functions: "whatsapp-verify", description: "WhatsApp OTP backup (+91-9270194842)", defaultOn: true, production_recommendation: "on" },
  { key: "vendor_enable_razorpay", label: "Razorpay", functions: "razorpay-payment", description: "Payment links — card / UPI via Razorpay checkout", defaultOn: true, production_recommendation: "on" },
  { key: "vendor_enable_vyapar_upi", label: "HDFC Vyapar UPI", functions: "UPI QR · collect", description: "vyapar.172928067841@hdfcbank — static QR + dynamic amount QR", defaultOn: false, production_recommendation: "off" },
  { key: "vendor_enable_upi_gpay", label: "Google Pay", functions: "UPI deep link", description: "GPay button — Android intent / gpay:// on iOS", defaultOn: false, production_recommendation: "off" },
  { key: "vendor_enable_upi_phonepe", label: "PhonePe", functions: "UPI deep link", description: "PhonePe button — phonepe:// payment", defaultOn: false, production_recommendation: "off" },
  { key: "vendor_enable_upi_paytm", label: "Paytm", functions: "UPI deep link", description: "Paytm button — paytmmp:// payment", defaultOn: false, production_recommendation: "off" },
  { key: "vendor_enable_upi_navi", label: "Navi", functions: "UPI deep link", description: "Navi UPI payment button", defaultOn: false, production_recommendation: "off" },
  { key: "vendor_enable_upi_bhim", label: "BHIM", functions: "UPI deep link", description: "BHIM UPI payment button", defaultOn: false, production_recommendation: "off" },
  { key: "vendor_enable_upi_any", label: "Any UPI", functions: "UPI deep link", description: "Generic “Pay via UPI” button (upi://)", defaultOn: false, production_recommendation: "off" },
];

export const VENDOR_PROVIDER_KEYS = VENDOR_PROVIDER_DEFS.map((d) => d.key);

export const EXEC_ONLY_SWITCH_KEYS = new Set([
  "otp_dev_mode",
  "dispatch_open",
]);

export async function loadVendorProviderFlags(
  sb: PlatformSb,
): Promise<Record<string, boolean>> {
  const out: Record<string, boolean> = {};
  for (const d of VENDOR_PROVIDER_DEFS) {
    out[d.key] = await isPlatformFlagOn(sb, d.key, { defaultValue: d.defaultOn });
  }
  return out;
}

/** Payload for customer PWA (payment + OTP UI). */
export function clientVendorPayload(flags: Record<string, boolean>) {
  const on = (k: string, def = true) => flags[k] !== false && (flags[k] === true || def);
  return {
    twofactor: on("vendor_enable_2factor"),
    msg91: on("vendor_enable_msg91"),
    fast2sms: on("vendor_enable_fast2sms"),
    twilio: on("vendor_enable_twilio"),
    whatsapp: on("vendor_enable_whatsapp"),
    razorpay: on("vendor_enable_razorpay"),
    vyapar_upi: on("vendor_enable_vyapar_upi"),
    upi: {
      gpay: on("vendor_enable_upi_gpay"),
      phonepe: on("vendor_enable_upi_phonepe"),
      paytm: on("vendor_enable_upi_paytm"),
      navi: on("vendor_enable_upi_navi"),
      bhim: on("vendor_enable_upi_bhim"),
      any: on("vendor_enable_upi_any"),
    },
  };
}

export async function loadClientVendorPayload(sb: PlatformSb) {
  const flags = await loadVendorProviderFlags(sb);
  return clientVendorPayload(flags);
}

export async function otpDeliveryVendorOpts(
  sb: PlatformSb,
  allowVoiceFallback: boolean,
) {
  const flags = await loadVendorProviderFlags(sb);
  return {
    allowVoiceFallback,
    skip2Factor: !flags.vendor_enable_2factor,
    skipMsg91: !flags.vendor_enable_msg91,
    skipFast2Sms: !flags.vendor_enable_fast2sms,
    skipTwilio: !flags.vendor_enable_twilio,
  };
}

export async function isVendorEnabled(sb: PlatformSb, key: string): Promise<boolean> {
  const def = VENDOR_PROVIDER_DEFS.find((d) => d.key === key);
  return isPlatformFlagOn(sb, key, { defaultValue: def?.defaultOn ?? true });
}
