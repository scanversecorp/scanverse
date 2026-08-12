/** Shared SMS / Voice / WhatsApp helpers for ScanV edge functions */

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-vendor-admin-pin, x-dispatch-secret, x-support-pin",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function normalizeMobile(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (raw.startsWith("+") && digits.length >= 10 && digits.length <= 15) {
    return `+${digits}`;
  }
  return null;
}

export function mobileDigitsE164(mobile: string): string {
  return mobile.replace(/\D/g, "");
}

export function msg91AuthKey(): string | undefined {
  return Deno.env.get("MSG91_AUTH_KEY") || Deno.env.get("MSG91_WHATSAPP_AUTH_KEY");
}

export async function sendSms(
  mobile: string,
  message: string,
  otpCode?: string,
): Promise<{ ok: boolean; provider?: string; ref?: string; error?: string }> {
  const norm = normalizeMobile(mobile);
  if (!norm) return { ok: false, error: "Invalid mobile" };

  const msg91Key = msg91AuthKey();
  const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const twilioFrom = Deno.env.get("TWILIO_SMS_FROM") || Deno.env.get("TWILIO_PHONE_NUMBER");
  const twoFactorKey = Deno.env.get("TWOFACTOR_API_KEY");

  // MSG91 SMS
  if (msg91Key) {
    const sender = Deno.env.get("MSG91_SMS_SENDER") || "SCANV";
    const res = await fetch("https://control.msg91.com/api/v5/flow/", {
      method: "POST",
      headers: { authkey: msg91Key, "Content-Type": "application/json" },
      body: JSON.stringify({
        template_id: Deno.env.get("MSG91_SMS_TEMPLATE_ID") || undefined,
        short_url: "0",
        recipients: [{ mobiles: mobileDigitsE164(norm), var: message }],
        // Fallback text route when no template
        ...(Deno.env.get("MSG91_SMS_TEMPLATE_ID")
          ? {}
          : { message: message, sender: sender }),
      }),
    }).catch(() => null);

    if (res?.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: true, provider: "msg91", ref: JSON.stringify(data).slice(0, 120) };
    }

    // MSG91 legacy route
    const legacy = await fetch(
      `https://api.msg91.com/api/sendhttp.php?authkey=${msg91Key}&mobiles=${mobileDigitsE164(norm)}&sender=${sender}&route=4&country=91&message=${encodeURIComponent(message)}`,
    ).catch(() => null);
    if (legacy?.ok) return { ok: true, provider: "msg91-legacy" };
  }

  // Twilio SMS
  if (twilioSid && twilioToken && twilioFrom) {
    const params = new URLSearchParams({
      From: twilioFrom,
      To: norm,
      Body: message,
    });
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: "Basic " + btoa(`${twilioSid}:${twilioToken}`),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      },
    );
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      return {
        ok: true,
        provider: "twilio",
        ref: typeof data === "object" && data !== null && "sid" in data
          ? String((data as { sid: string }).sid)
          : undefined,
      };
    }
    // Fall through to 2Factor — Twilio often fails for unverified IN numbers
    console.warn(
      "[SMS] Twilio failed:",
      typeof data === "object" && data !== null && "message" in data
        ? String((data as { message: string }).message)
        : res.statusText,
    );
  }

  // 2Factor.in (India) — OTP route when otpCode set; transactional SMS for dispatch alerts
  if (twoFactorKey) {
    const phone10 = mobileDigitsE164(norm).slice(-10);
    const otp = otpCode || message.match(/\b(\d{6})\b/)?.[1];
    if (otp) {
      const url = `https://2factor.in/API/V1/${twoFactorKey}/SMS/${phone10}/${otp}/ScanV%20OTP`;
      const res = await fetch(url);
      const bodyText = await res.text().catch(() => "");
      if (res.ok) {
        let ref: string | undefined;
        try {
          const data = JSON.parse(bodyText);
          if (data?.Details) ref = String(data.Details);
          else if (data?.SessionId) ref = String(data.SessionId);
        } catch {
          if (bodyText && bodyText.length < 80) ref = bodyText.trim();
        }
        return { ok: true, provider: "2factor", ref };
      }
      return { ok: false, error: bodyText || "2Factor SMS failed" };
    }
    // Transactional SMS (booking alerts, not OTP)
    const sender = Deno.env.get("TWOFACTOR_SMS_SENDER") || "SCANV";
    const transUrl =
      `https://2factor.in/API/R1/?module=TRANS_SMS&apikey=${encodeURIComponent(twoFactorKey)}` +
      `&to=${encodeURIComponent(phone10)}&from=${encodeURIComponent(sender)}` +
      `&msg=${encodeURIComponent(message.slice(0, 480))}`;
    const transRes = await fetch(transUrl);
    const transBody = await transRes.text().catch(() => "");
    if (transRes.ok) {
      return { ok: true, provider: "2factor-trans", ref: transBody.slice(0, 120) };
    }
    return { ok: false, error: transBody || "2Factor transactional SMS failed" };
  }

  return { ok: false, error: "No SMS provider configured (MSG91/Twilio/2Factor)" };
}

export async function makeOutboundCall(
  mobile: string,
  twimlUrl: string,
): Promise<{ ok: boolean; provider?: string; ref?: string; error?: string }> {
  const norm = normalizeMobile(mobile);
  if (!norm) return { ok: false, error: "Invalid mobile" };

  const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const twilioFrom = Deno.env.get("TWILIO_VOICE_FROM") || Deno.env.get("TWILIO_PHONE_NUMBER");

  if (!twilioSid || !twilioToken || !twilioFrom) {
    return { ok: false, error: "Twilio Voice not configured" };
  }

  const params = new URLSearchParams({
    From: twilioFrom,
    To: norm,
    Url: twimlUrl,
    Method: "POST",
    StatusCallback: twimlUrl.replace(/\/twiml.*/, "/call-status"),
    StatusCallbackEvent: "initiated ringing answered completed",
    StatusCallbackMethod: "POST",
    Timeout: "30",
  });

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Calls.json`,
    {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(`${twilioSid}:${twilioToken}`),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    },
  );
  const data = await res.json().catch(() => ({}));
  if (res.ok) {
    return {
      ok: true,
      provider: "twilio-voice",
      ref: typeof data === "object" && data !== null && "sid" in data
        ? String((data as { sid: string }).sid)
        : undefined,
    };
  }
  return {
    ok: false,
    error: typeof data === "object" && data !== null && "message" in data
      ? String((data as { message: string }).message)
      : res.statusText,
  };
}

const MSG91_WA_URL =
  "https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/";

export async function sendWhatsAppText(
  mobile: string,
  message: string,
): Promise<{ ok: boolean; provider?: string; error?: string }> {
  const norm = normalizeMobile(mobile);
  if (!norm) return { ok: false, error: "Invalid mobile" };

  const authKey = msg91AuthKey();
  const integratedNumber = Deno.env.get("MSG91_WHATSAPP_INTEGRATED_NUMBER");
  const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const twilioFrom = Deno.env.get("TWILIO_WHATSAPP_FROM");

  if (authKey && integratedNumber) {
    const to = mobileDigitsE164(norm);
    const res = await fetch(MSG91_WA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", authkey: authKey },
      body: JSON.stringify({
        integrated_number: integratedNumber.replace(/\D/g, ""),
        content_type: "text",
        payload: {
          messaging_product: "whatsapp",
          type: "text",
          to,
          text: { body: message },
        },
      }),
    });
    if (res.ok) return { ok: true, provider: "msg91-wa" };
    const data = await res.json().catch(() => ({}));
    const errMsg = typeof data === "object" && data !== null && "message" in data
      ? String((data as { message: unknown }).message)
      : res.statusText;
    // fall through to Twilio
    if (!twilioSid) return { ok: false, error: `MSG91 WA: ${errMsg}` };
  }

  if (twilioSid && twilioToken && twilioFrom) {
    const to = norm.startsWith("+") ? norm : `+${mobileDigitsE164(norm)}`;
    const params = new URLSearchParams({
      From: twilioFrom.startsWith("whatsapp:") ? twilioFrom : `whatsapp:${twilioFrom}`,
      To: `whatsapp:${to}`,
      Body: message,
    });
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: "Basic " + btoa(`${twilioSid}:${twilioToken}`),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      },
    );
    if (res.ok) return { ok: true, provider: "twilio-wa" };
    const data = await res.json().catch(() => ({}));
    return {
      ok: false,
      error: typeof data === "object" && data !== null && "message" in data
        ? String((data as { message: string }).message)
        : res.statusText,
    };
  }

  return { ok: false, error: "No WhatsApp provider configured" };
}

/** Validate Indian PAN format (optional field) */
export function validatePan(pan: string): boolean {
  return /^[A-Z]{5}[0-9]{4}[A-Z]$/i.test(pan.trim());
}

/** Strip spaces, dashes, and any non-digits from Aadhaar input */
export function normalizeAadhaarDigits(num: string): string {
  return num.replace(/\D/g, "");
}

/** Verhoeff checksum for Aadhaar (UIDAI uses this algorithm) */
const VERHOEFF_D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const VERHOEFF_P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];
const VERHOEFF_INV = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9];

function verhoeffCheck(num: string): boolean {
  let c = 0;
  const digits = normalizeAadhaarDigits(num).split("").reverse();
  for (let i = 0; i < digits.length; i++) {
    c = VERHOEFF_D[c][VERHOEFF_P[i % 8][Number(digits[i])]];
  }
  return c === 0;
}

/** Validate Aadhaar number (12 digits + Verhoeff checksum) */
export function validateAadhaar(num: string): boolean {
  const d = normalizeAadhaarDigits(num);
  if (!/^\d{12}$/.test(d)) return false;
  return verhoeffCheck(d);
}

/** SHA-256 hash for sensitive identifiers (Aadhaar) — never store raw Aadhaar */
export async function hashSensitive(value: string): Promise<string> {
  const data = new TextEncoder().encode(normalizeAadhaarDigits(value));
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Hash OTP for storage */
export async function hashOtp(otp: string): Promise<string> {
  const data = new TextEncoder().encode(otp);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function generateAcceptCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  let code = "BK-";
  for (let i = 0; i < 4; i++) code += chars[bytes[i] % chars.length];
  return code;
}

/** Forward geocode address text → lat/lng (India-biased) */
export async function geocodeAddress(
  location: string,
): Promise<{ lat: number; lng: number } | null> {
  const q = location.trim();
  if (!q) return null;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=in`,
      { headers: { "User-Agent": "ScanV/5.5 booking-dispatch", "Accept-Language": "en" } },
    );
    const data = await res.json();
    const hit = Array.isArray(data) ? data[0] : null;
    if (hit?.lat && hit?.lon) {
      return { lat: parseFloat(String(hit.lat)), lng: parseFloat(String(hit.lon)) };
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** Reverse geocode country via Nominatim */
export async function geoCountryFromLatLng(
  lat: number,
  lng: number,
): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=en`,
      { headers: { "User-Agent": "ScanV/5.5 booking-dispatch" } },
    );
    const data = await res.json();
    return data?.address?.country_code?.toUpperCase() || null;
  } catch {
    return null;
  }
}

/** IP country lookup (for VPN/proxy detection) */
export async function ipCountry(ip?: string): Promise<string | null> {
  try {
    const url = ip
      ? `https://ipapi.co/${ip}/country_code/`
      : "https://ipapi.co/country_code/";
    const res = await fetch(url, { headers: { "User-Agent": "ScanV/5.5" } });
    const code = (await res.text()).trim().toUpperCase();
    return code.length === 2 ? code : null;
  } catch {
    return null;
  }
}

export function bookingAcceptMessage(
  serviceName: string,
  date: string,
  time: string,
  location: string,
  acceptCode: string,
): string {
  return (
    `ScanV NEW BOOKING: ${serviceName}\n` +
    `When: ${date} ${time}\n` +
    `Where: ${location}\n` +
    `Reply ACCEPT ${acceptCode} to confirm.\n` +
    `Or press 1 when we call you.`
  );
}

export function callFailedStatuses(): Set<string> {
  return new Set([
    "failed", "busy", "no-answer", "no_answer", "canceled", "cancelled",
  ]);
}

/** Optional email — set RESEND_API_KEY + SUPPORT_EMAIL_FROM in Supabase secrets */
export async function sendEmail(
  to: string,
  subject: string,
  body: string,
): Promise<{ ok: boolean; provider?: string; error?: string }> {
  const email = (to || "").trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Invalid email address" };
  }

  const resendKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("SUPPORT_EMAIL_FROM") || "support@dcoreglobal.com";

  if (resendKey) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [email], subject, text: body }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, provider: "resend" };
    return {
      ok: false,
      error: typeof data === "object" && data !== null && "message" in data
        ? String((data as { message: string }).message)
        : res.statusText,
    };
  }

  console.log(`[ScanV email] To: ${email} | ${subject}\n${body.slice(0, 500)}`);
  return { ok: false, error: "Email not configured — set RESEND_API_KEY and SUPPORT_EMAIL_FROM" };
}

export function ticketClosureMessage(
  ticketNumber: string,
  subject: string,
  closureNote: string,
): string {
  return (
    `ScanV Support — Ticket ${ticketNumber} resolved\n` +
    `Subject: ${subject}\n` +
    `Resolution: ${closureNote}\n` +
    `Track: https://scanv-tau.vercel.app/#track-ticket?id=${ticketNumber}\n` +
    `Questions? Call +91-9270194842`
  );
}
