/** Shared SMS / Voice / WhatsApp helpers for ScanV edge functions */

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-vendor-admin-pin, x-dispatch-secret",
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
    return {
      ok: false,
      error: typeof data === "object" && data !== null && "message" in data
        ? String((data as { message: string }).message)
        : res.statusText,
    };
  }

  // 2Factor.in (India) — pass otpCode so SMS matches vendor_otp hash
  if (twoFactorKey) {
    const phone10 = mobileDigitsE164(norm).slice(-10);
    const otp = otpCode || message.match(/\b(\d{6})\b/)?.[1];
    const url = otp
      ? `https://2factor.in/API/V1/${twoFactorKey}/SMS/${phone10}/${otp}/ScanV%20OTP`
      : `https://2factor.in/API/V1/${twoFactorKey}/SMS/${phone10}/AUTOGEN/ScanV%20OTP`;
    const res = await fetch(url);
    if (res.ok) return { ok: true, provider: "2factor" };
    const body = await res.text().catch(() => "");
    return { ok: false, error: body || "2Factor SMS failed" };
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

/** Validate Aadhaar number format (12 digits, Verhoeff not checked here) */
export function validateAadhaar(num: string): boolean {
  const d = num.replace(/\s/g, "");
  return /^\d{12}$/.test(d);
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
