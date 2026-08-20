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

export function twoFactorApiKey(): string | undefined {
  const key = Deno.env.get("TWOFACTOR_API_KEY") || Deno.env.get("TWOFACTOR_KEY") || "";
  return key.trim() || undefined;
}

function parse2FactorResponse(bodyText: string): { ok: boolean; ref?: string; error?: string } {
  try {
    const data = JSON.parse(bodyText);
    const status = String(data?.Status || "").toLowerCase();
    if (status === "success") {
      const ref = data?.Details ? String(data.Details) : undefined;
      return { ok: true, ref };
    }
    return { ok: false, error: String(data?.Details || data?.Status || bodyText || "2Factor failed") };
  } catch {
    if (/success/i.test(bodyText)) return { ok: true, ref: bodyText.trim().slice(0, 80) };
    return { ok: false, error: bodyText || "2Factor failed" };
  }
}

async function send2FactorOtpSms(
  twoFactorKey: string,
  norm: string,
  otp: string,
): Promise<{ ok: boolean; provider?: string; ref?: string; error?: string }> {
  const phone10 = mobileDigitsE164(norm).slice(-10);
  const url = `https://2factor.in/API/V1/${twoFactorKey}/SMS/${phone10}/${otp}/ScanV%20OTP`;
  const res = await fetch(url);
  const bodyText = await res.text().catch(() => "");
  const parsed = parse2FactorResponse(bodyText);
  if (parsed.ok) return { ok: true, provider: "2factor", ref: parsed.ref };
  return { ok: false, error: parsed.error || bodyText || "2Factor SMS failed" };
}

async function send2FactorOtpVoice(
  twoFactorKey: string,
  norm: string,
  otp: string,
): Promise<{ ok: boolean; provider?: string; ref?: string; error?: string }> {
  const phone10 = mobileDigitsE164(norm).slice(-10);
  const url = `https://2factor.in/API/V1/${twoFactorKey}/VOICE/${phone10}/${otp}`;
  const res = await fetch(url);
  const bodyText = await res.text().catch(() => "");
  const parsed = parse2FactorResponse(bodyText);
  if (parsed.ok) return { ok: true, provider: "2factor-voice", ref: parsed.ref };
  return { ok: false, error: parsed.error || bodyText || "2Factor voice failed" };
}

function msg91LooksSuccessful(data: unknown, bodyText: string): boolean {
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    const type = String(o.type || o.Type || "").toLowerCase();
    if (type === "error" || type === "failure") return false;
    if (o.message && /invalid|error|fail/i.test(String(o.message))) return false;
    if (o.success === false) return false;
  }
  return !/invalid authkey|authentication fail|error/i.test(bodyText);
}

function fast2SmsApiKey(): string | undefined {
  return Deno.env.get("FAST2SMS_API_KEY") || Deno.env.get("FAST2SMS_KEY");
}

function fast2SmsLooksSuccessful(data: unknown, bodyText: string): boolean {
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    if (o.return === true) return true;
    if (String(o.status || "").toLowerCase() === "success") return true;
  }
  return /message sent successfully|"return"\s*:\s*true/i.test(bodyText);
}

/** Fast2SMS DLT route — India (+91) only; https://docs.fast2sms.com/reference/dlt-manual-single */
async function sendFast2Sms(
  norm: string,
  message: string,
  otpCode?: string,
): Promise<{ ok: boolean; provider?: string; ref?: string; error?: string }> {
  const apiKey = fast2SmsApiKey();
  if (!apiKey) return { ok: false, error: "Fast2SMS not configured" };
  if (!norm.startsWith("+91")) return { ok: false, error: "Fast2SMS India only" };

  const phone10 = mobileDigitsE164(norm).slice(-10);
  const sender = Deno.env.get("FAST2SMS_SENDER_ID") || "SCANV";
  const dltMessageId = Deno.env.get("FAST2SMS_DLT_MESSAGE_ID");
  const dltTemplateId = Deno.env.get("FAST2SMS_DLT_TEMPLATE_ID");
  const dltEntityId = Deno.env.get("FAST2SMS_DLT_ENTITY_ID");
  const otp = otpCode || message.match(/\b(\d{6})\b/)?.[1];

  const body: Record<string, string> = dltMessageId && otp
    ? {
      route: "dlt",
      sender_id: sender,
      message: dltMessageId,
      variables_values: otp,
      numbers: phone10,
    }
    : {
      route: "dlt_manual",
      sender_id: sender,
      message: message.slice(0, 480),
      numbers: phone10,
      ...(dltTemplateId ? { template_id: dltTemplateId } : {}),
      ...(dltEntityId ? { entity_id: dltEntityId } : {}),
    };

  const res = await fetch("https://www.fast2sms.com/dev/bulkV2", {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  }).catch(() => null);

  if (!res) return { ok: false, error: "Fast2SMS request failed" };

  const bodyText = await res.text().catch(() => "");
  let data: unknown;
  try {
    data = JSON.parse(bodyText);
  } catch {
    data = null;
  }

  if (res.ok && fast2SmsLooksSuccessful(data, bodyText)) {
    const ref = data && typeof data === "object" && "request_id" in data
      ? String((data as { request_id: string }).request_id)
      : bodyText.slice(0, 120);
    return { ok: true, provider: dltMessageId && otp ? "fast2sms-dlt" : "fast2sms", ref };
  }

  const errMsg = data && typeof data === "object"
    ? String((data as Record<string, unknown>).message ?? (data as Record<string, unknown>).msg ?? bodyText)
    : bodyText;
  return { ok: false, error: errMsg.slice(0, 200) || "Fast2SMS failed" };
}

/** OTP delivery — try every SMS provider first (2Factor → MSG91 → Fast2SMS → Twilio), then 2Factor voice (+91). */
export async function sendOtpDelivery(
  mobile: string,
  otpCode: string,
  message: string,
  opts?: {
    allowVoiceFallback?: boolean;
    skip2Factor?: boolean;
    skipMsg91?: boolean;
    skipFast2Sms?: boolean;
    skipTwilio?: boolean;
  },
): Promise<{ ok: boolean; provider?: string; ref?: string; error?: string; channel?: "sms" | "voice" }> {
  const allowVoice = opts?.allowVoiceFallback !== false;
  const norm = normalizeMobile(mobile);
  if (!norm) return { ok: false, error: "Invalid mobile" };

  const sms = await sendSms(mobile, message, otpCode, {
    skip2Factor: opts?.skip2Factor,
    skipMsg91: opts?.skipMsg91,
    skipFast2Sms: opts?.skipFast2Sms,
    skipTwilio: opts?.skipTwilio,
  });
  if (sms.ok) return { ...sms, channel: "sms" };

  const twoFactorKey = twoFactorApiKey();
  if (allowVoice && twoFactorKey && norm.startsWith("+91")) {
    console.warn("[OTP] SMS chain failed — trying 2Factor voice:", sms.error?.slice(0, 120));
    const voice = await send2FactorOtpVoice(twoFactorKey, norm, otpCode);
    if (voice.ok) return { ...voice, channel: "voice" };
    return {
      ok: false,
      error: voice.error || sms.error || "OTP delivery failed — try Resend or WhatsApp verify",
    };
  }

  return {
    ok: false,
    error: sms.error || "OTP delivery failed — try Resend or WhatsApp verify",
  };
}

export async function sendSms(
  mobile: string,
  message: string,
  otpCode?: string,
  opts?: {
    skip2Factor?: boolean;
    skipMsg91?: boolean;
    skipFast2Sms?: boolean;
    skipTwilio?: boolean;
  },
): Promise<{ ok: boolean; provider?: string; ref?: string; error?: string }> {
  const norm = normalizeMobile(mobile);
  if (!norm) return { ok: false, error: "Invalid mobile" };

  const msg91Key = msg91AuthKey();
  const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const twilioFrom = Deno.env.get("TWILIO_SMS_FROM") || Deno.env.get("TWILIO_PHONE_NUMBER");
  const twoFactorKey = twoFactorApiKey();
  let lastErr: string | undefined;

  // 2Factor.in — primary for India (+91); cheapest DLT route; fall through on failure
  if (!opts?.skip2Factor && twoFactorKey && norm.startsWith("+91")) {
    const phone10 = mobileDigitsE164(norm).slice(-10);
    const otp = otpCode || message.match(/\b(\d{6})\b/)?.[1];
    if (otp) {
      const tf = await send2FactorOtpSms(twoFactorKey, norm, otp);
      if (tf.ok) return tf;
      lastErr = tf.error;
      console.warn("[SMS] 2Factor OTP failed:", tf.error);
    } else {
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
      lastErr = transBody.slice(0, 120) || "2Factor transactional failed";
      console.warn("[SMS] 2Factor transactional failed:", lastErr);
    }
  }

  // MSG91 SMS — fallback after 2Factor
  if (!opts?.skipMsg91 && msg91Key) {
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
      const bodyText = JSON.stringify(data);
      if (msg91LooksSuccessful(data, bodyText)) {
        return { ok: true, provider: "msg91", ref: bodyText.slice(0, 120) };
      }
    }

    // MSG91 legacy route
    const legacy = await fetch(
      `https://api.msg91.com/api/sendhttp.php?authkey=${msg91Key}&mobiles=${mobileDigitsE164(norm)}&sender=${sender}&route=4&country=91&message=${encodeURIComponent(message)}`,
    ).catch(() => null);
    if (legacy?.ok) {
      const legacyBody = await legacy.text().catch(() => "");
      if (msg91LooksSuccessful(null, legacyBody)) return { ok: true, provider: "msg91-legacy" };
    }
  }

  // Fast2SMS — third in chain (DLT); India (+91) only
  if (!opts?.skipFast2Sms && norm.startsWith("+91")) {
    const f2s = await sendFast2Sms(norm, message, otpCode);
    if (f2s.ok) return f2s;
    if (fast2SmsApiKey()) console.warn("[SMS] Fast2SMS failed:", f2s.error);
  }

  // Twilio SMS — last resort (expensive for India)
  if (!opts?.skipTwilio && twilioSid && twilioToken && twilioFrom) {
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
    console.warn(
      "[SMS] Twilio failed:",
      typeof data === "object" && data !== null && "message" in data
        ? String((data as { message: string }).message)
        : res.statusText,
    );
  }

  // 2Factor for non-India numbers (international SMS route)
  if (!opts?.skip2Factor && twoFactorKey && !norm.startsWith("+91")) {
    const otp = otpCode || message.match(/\b(\d{6})\b/)?.[1];
    if (otp) {
      const tf = await send2FactorOtpSms(twoFactorKey, norm, otp);
      if (tf.ok) return tf;
    }
  }

  if (!twoFactorKey && !msg91Key && !fast2SmsApiKey() && !(twilioSid && twilioToken && twilioFrom)) {
    return { ok: false, error: "No SMS provider configured (2Factor/MSG91/Fast2SMS/Twilio)" };
  }
  return { ok: false, error: lastErr ? `SMS failed: ${lastErr}` : "SMS delivery failed — try again or contact support" };
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

/** Customer SMS after booking + payment confirmed */
export function bookingConfirmationMessage(opts: {
  firstName?: string | null;
  serviceName: string;
  date: string;
  time?: string | null;
  amountPaise: number;
  txnId?: string | null;
  bookingId: string;
  appUrl?: string;
}): string {
  const base = (opts.appUrl || Deno.env.get("APP_URL") || "https://getscanv.com").replace(/\/$/, "");
  const name = String(opts.firstName || "").trim() || "there";
  const rs = (Math.max(0, Number(opts.amountPaise) || 0) / 100).toLocaleString("en-IN");
  const when = opts.time ? `${opts.date} ${opts.time}` : opts.date;
  const ref = String(opts.txnId || opts.bookingId).slice(0, 24);
  const track = `${base}/#track?id=${encodeURIComponent(opts.bookingId)}`;
  return (
    `ScanV: Hi ${name}, booking confirmed! ${opts.serviceName} · ${when}. ` +
    `Paid Rs.${rs}. Ref ${ref}. Track: ${track}`
  ).slice(0, 480);
}

const SUPPORT_EMAIL_DEFAULT = "support@getscanv.com";

function isRealEmail(email: string): boolean {
  const e = (email || "").trim();
  return !!e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && !/@scanv\.app$/i.test(e);
}

/** Customer booking confirmation email with support CC. */
export function cloudBookingConfirmationEmail(opts: {
  customerName?: string | null;
  serviceName: string;
  date: string;
  time?: string | null;
  amountPaise: number;
  txnId?: string | null;
  bookingId: string;
  appUrl?: string;
}): { subject: string; body: string } {
  const base = (opts.appUrl || Deno.env.get("APP_URL") || "https://getscanv.com").replace(/\/$/, "");
  const name = String(opts.customerName || "").trim() || "Customer";
  const rs = (Math.max(0, Number(opts.amountPaise) || 0) / 100).toLocaleString("en-IN");
  const when = opts.time ? `${opts.date} at ${opts.time}` : opts.date;
  const ref = String(opts.txnId || opts.bookingId).slice(0, 32);
  const bookingsUrl = `${base}/#bookings`;
  const subject = "SGR Booking Confirmation";
  const body = [
    `Hi ${name},`,
    "",
    "Your AI, Cloud & Data Center booking is confirmed and payment received.",
    "",
    `Service: ${opts.serviceName}`,
    `Scheduled: ${when}`,
    `Amount paid: Rs.${rs}`,
    `Reference: ${ref}`,
    `Booking ID: ${opts.bookingId}`,
    "",
    "This is a digital / consulting service — no partner dispatch or live tracking applies.",
    "Our team will reach out if any onboarding steps are needed.",
    "",
    `View your bookings: ${bookingsUrl}`,
    "",
    "Questions? Reply to this email or contact support@getscanv.com",
    "",
    "— ScanV · getscanv.com",
  ].join("\n");
  return { subject, body };
}

export async function sendEmailToCustomerWithSupportCc(
  customerEmail: string,
  subject: string,
  body: string,
  supportEmail = Deno.env.get("SUPPORT_EMAIL_CC") || SUPPORT_EMAIL_DEFAULT,
): Promise<{ ok: boolean; provider?: string; error?: string; sent?: number }> {
  const to = (customerEmail || "").trim();
  if (!isRealEmail(to)) return { ok: false, error: "Invalid customer email" };
  const cc = isRealEmail(supportEmail) ? [supportEmail] : [];

  const resendKey = Deno.env.get("RESEND_API_KEY");
  const cfToken = Deno.env.get("CLOUDFLARE_API_TOKEN") || Deno.env.get("CF_API_TOKEN") || "";
  const cfAccount = Deno.env.get("CLOUDFLARE_ACCOUNT_ID") || "7f8fbca1a540bef510c9c39cf15aa0a8";
  const from = Deno.env.get("SUPPORT_EMAIL_FROM")
    || Deno.env.get("HEALTH_REPORT_FROM")
    || "support@getscanv.com";

  if (resendKey) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        ...(cc.length ? { cc } : {}),
        subject,
        text: body,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, provider: "resend", sent: 1 + cc.length };
    return {
      ok: false,
      error: typeof data === "object" && data !== null && "message" in data
        ? String((data as { message: string }).message)
        : res.statusText,
    };
  }

  if (cfToken) {
    const recipients = cc.length ? [to, ...cc] : [to];
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${cfAccount}/email/sending/send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: recipients.length === 1 ? recipients[0] : recipients,
          from: { address: from, name: "ScanV" },
          subject,
          text: body,
        }),
      },
    );
    const data = await res.json().catch(() => ({})) as {
      success?: boolean;
      errors?: Array<{ message?: string }>;
      result?: { delivered?: string[]; queued?: string[] };
    };
    if (res.ok && data.success) {
      const delivered = data.result?.delivered?.length || 0;
      const queued = data.result?.queued?.length || 0;
      if (delivered + queued > 0) return { ok: true, provider: "cloudflare-email", sent: recipients.length };
    }
    const err = data.errors?.[0]?.message || res.statusText;
    return { ok: false, error: err || "Cloudflare Email Sending failed" };
  }

  console.log(`[ScanV email] To: ${to} CC: ${cc.join(", ")} | ${subject}\n${body.slice(0, 500)}`);
  return { ok: false, error: "Email not configured — set RESEND_API_KEY or CLOUDFLARE_API_TOKEN" };
}

export function callFailedStatuses(): Set<string> {
  return new Set([
    "failed", "busy", "no-answer", "no_answer", "canceled", "cancelled",
  ]);
}

/** Optional email — Resend or Cloudflare Email Sending + SUPPORT_EMAIL_FROM in Supabase secrets */
export async function sendEmail(
  to: string,
  subject: string,
  body: string,
): Promise<{ ok: boolean; provider?: string; error?: string }> {
  return sendEmailMany([to], subject, body);
}

/** Send one email to multiple recipients via Resend. */
export async function sendEmailMany(
  recipients: string[],
  subject: string,
  body: string,
): Promise<{ ok: boolean; provider?: string; error?: string; sent?: number }> {
  const emails = [...new Set(
    (recipients || [])
      .map((r) => (r || "").trim())
      .filter((email) => email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)),
  )];
  if (!emails.length) {
    return { ok: false, error: "No valid email recipients" };
  }

  const resendKey = Deno.env.get("RESEND_API_KEY");
  const cfToken = Deno.env.get("CLOUDFLARE_API_TOKEN") || Deno.env.get("CF_API_TOKEN") || "";
  const cfAccount = Deno.env.get("CLOUDFLARE_ACCOUNT_ID") || "7f8fbca1a540bef510c9c39cf15aa0a8";
  const from = Deno.env.get("HEALTH_REPORT_FROM")
    || Deno.env.get("SUPPORT_EMAIL_FROM")
    || "reports@getscanv.com";

  if (resendKey) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: emails, subject, text: body }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, provider: "resend", sent: emails.length };
    return {
      ok: false,
      error: typeof data === "object" && data !== null && "message" in data
        ? String((data as { message: string }).message)
        : res.statusText,
    };
  }

  if (cfToken) {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${cfAccount}/email/sending/send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: emails.length === 1 ? emails[0] : emails,
          from: { address: from, name: "ScanV Health" },
          subject,
          text: body,
        }),
      },
    );
    const data = await res.json().catch(() => ({})) as {
      success?: boolean;
      errors?: Array<{ message?: string }>;
      result?: { delivered?: string[]; permanent_bounces?: string[]; queued?: string[] };
    };
    if (res.ok && data.success) {
      const delivered = data.result?.delivered?.length || 0;
      const queued = data.result?.queued?.length || 0;
      if (delivered + queued > 0) return { ok: true, provider: "cloudflare-email", sent: emails.length };
    }
    const err = data.errors?.[0]?.message || res.statusText;
    return { ok: false, error: err || "Cloudflare Email Sending failed" };
  }

  console.log(`[ScanV email] To: ${emails.join(", ")} | ${subject}\n${body.slice(0, 500)}`);
  return { ok: false, error: "Email not configured — set RESEND_API_KEY or CLOUDFLARE_API_TOKEN + SUPPORT_EMAIL_FROM" };
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
    `Track: https://getscanv.com/#track-ticket?id=${ticketNumber}\n` +
    `Questions? Call +91-9270194842`
  );
}
