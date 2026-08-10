/**
 * ScanV WhatsApp verification edge function
 *
 * Outbound flow: generate token → send WA message TO user → user replies → webhook marks verified
 *
 * Actions (JSON body):
 *   generate — { mobile: "+91XXXXXXXXXX" } → { success, token, messageSent, provider? }
 *   check    — { token: "SCANV-XXXX" }       → { verified, mobile?, mode? }
 *   webhook  — manual or provider inbound payload → marks verified
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TOKEN_PREFIX = "SCANV-";
const TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes
/** Minimum age before honor-system auto-verify (dev / no provider configured) */
const HONOR_DELAY_MS = 10 * 1000;

const TOKEN_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const MSG91_WA_URL =
  "https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeMobile(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (raw.startsWith("+") && digits.length >= 10 && digits.length <= 15) {
    return `+${digits}`;
  }
  return null;
}

function mobileDigitsE164(mobile: string): string {
  return mobile.replace(/\D/g, "");
}

function generateToken(): string {
  let suffix = "";
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  for (let i = 0; i < 4; i++) {
    suffix += TOKEN_CHARS[bytes[i] % TOKEN_CHARS.length];
  }
  return `${TOKEN_PREFIX}${suffix}`;
}

function verificationMessage(token: string): string {
  return `ScanV verification: Reply VERIFY ${token} to confirm your booking.`;
}

function msg91AuthKey(): string | undefined {
  return (
    Deno.env.get("MSG91_WHATSAPP_AUTH_KEY") ||
    Deno.env.get("MSG91_AUTH_KEY") ||
    undefined
  );
}

function hasOutboundWhatsApp(): boolean {
  const msg91Key = msg91AuthKey();
  const msg91Number = Deno.env.get("MSG91_WHATSAPP_INTEGRATED_NUMBER");
  const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const twilioFrom = Deno.env.get("TWILIO_WHATSAPP_FROM");
  return Boolean(
    (msg91Key && msg91Number) || (twilioSid && twilioToken && twilioFrom),
  );
}

function hasStrictVerification(): boolean {
  return Boolean(
    Deno.env.get("WHATSAPP_WEBHOOK_SECRET") ||
      msg91AuthKey() ||
      Deno.env.get("TWILIO_AUTH_TOKEN"),
  );
}

function extractTokenFromMessage(text: string): string | null {
  const upper = text.toUpperCase();
  const explicit = upper.match(/SCANV\s+VERIFY\s+(SCANV-[A-Z0-9]{4})/);
  if (explicit) return explicit[1];
  const verify = upper.match(/VERIFY\s+(SCANV-[A-Z0-9]{4})/);
  if (verify) return verify[1];
  const bare = upper.match(/\b(SCANV-[A-Z0-9]{4})\b/);
  return bare ? bare[1] : null;
}

async function parseRequestBody(req: Request): Promise<Record<string, unknown>> {
  const ct = req.headers.get("content-type") || "";
  if (
    ct.includes("application/x-www-form-urlencoded") ||
    ct.includes("multipart/form-data")
  ) {
    const form = await req.formData();
    const obj: Record<string, unknown> = {};
    form.forEach((v, k) => {
      obj[k] = typeof v === "string" ? v : v.toString();
    });
    return obj;
  }
  return await req.json().catch(() => ({}));
}

function parseInboundFrom(body: Record<string, unknown>): string | null {
  const twilioFrom = String(body.From || "");
  if (twilioFrom.startsWith("whatsapp:")) {
    return normalizeMobile(twilioFrom.replace(/^whatsapp:/i, ""));
  }

  const customerNumber = String(
    body.customer_number || body.customerNumber || "",
  );
  if (customerNumber) {
    return normalizeMobile(customerNumber);
  }

  const messagesRaw = body.messages;
  if (typeof messagesRaw === "string" && messagesRaw.trim()) {
    try {
      const arr = JSON.parse(messagesRaw) as Array<{ from?: string }>;
      if (arr[0]?.from) return normalizeMobile(arr[0].from);
    } catch {
      /* ignore */
    }
  }
  if (Array.isArray(messagesRaw) && messagesRaw[0]?.from) {
    return normalizeMobile(String(messagesRaw[0].from));
  }

  const contactsRaw = body.contacts;
  if (typeof contactsRaw === "string" && contactsRaw.trim()) {
    try {
      const arr = JSON.parse(contactsRaw) as Array<{ wa_id?: string }>;
      if (arr[0]?.wa_id) return normalizeMobile(arr[0].wa_id);
    } catch {
      /* ignore */
    }
  }

  return null;
}

function parseInboundMessage(body: Record<string, unknown>): string {
  const twilioBody = String(body.Body || "");
  if (twilioBody) return twilioBody;

  const text = String(body.text || "");
  if (text) return text;

  const content = body.content;
  if (typeof content === "string" && content.trim()) {
    try {
      const parsed = JSON.parse(content) as { text?: string };
      if (parsed.text) return parsed.text;
    } catch {
      return content;
    }
  }
  if (content && typeof content === "object" && "text" in content) {
    return String((content as { text?: string }).text || "");
  }

  const messagesRaw = body.messages;
  if (typeof messagesRaw === "string" && messagesRaw.trim()) {
    try {
      const arr = JSON.parse(messagesRaw) as Array<{ text?: { body?: string } }>;
      if (arr[0]?.text?.body) return arr[0].text.body;
    } catch {
      /* ignore */
    }
  }
  if (Array.isArray(messagesRaw)) {
    const bodyText = messagesRaw[0]?.text?.body;
    if (bodyText) return String(bodyText);
  }

  return String(body.message || "");
}

function isProviderInbound(body: Record<string, unknown>): boolean {
  if (body.Body || body.From) return true; // Twilio
  if (body.text || body.messages || body.customer_number || body.customerNumber) {
    return true; // MSG91
  }
  if (body.direction === "inbound") return true;
  return false;
}

async function sendViaMsg91(
  mobile: string,
  token: string,
): Promise<{ ok: boolean; error?: string }> {
  const authKey = msg91AuthKey();
  const integratedNumber = Deno.env.get("MSG91_WHATSAPP_INTEGRATED_NUMBER");
  const templateName = Deno.env.get("MSG91_WHATSAPP_TEMPLATE_NAME");
  if (!authKey || !integratedNumber) {
    return { ok: false, error: "MSG91 WhatsApp not configured" };
  }

  const to = mobileDigitsE164(mobile);
  const messageText = verificationMessage(token);

  // Template path (required for WhatsApp Business API cold outbound)
  if (templateName) {
    const namespace = Deno.env.get("MSG91_WHATSAPP_TEMPLATE_NAMESPACE") || "";
    const lang = Deno.env.get("MSG91_WHATSAPP_TEMPLATE_LANG") || "en";
    const components: Record<string, unknown> = {
      body_1: { type: "text", value: token },
    };
    // Optional second body var for full message text
    if (Deno.env.get("MSG91_WHATSAPP_TEMPLATE_BODY2") === "1") {
      components.body_2 = { type: "text", value: "your booking" };
    }

    const payload: Record<string, unknown> = {
      integrated_number: integratedNumber.replace(/\D/g, ""),
      content_type: "template",
      payload: {
        messaging_product: "whatsapp",
        type: "template",
        template: {
          name: templateName,
          language: { code: lang, policy: "deterministic" },
          to_and_components: [{ to: [to], components }],
        },
      },
    };
    if (namespace) {
      (payload.payload as Record<string, unknown>).template = {
        ...(payload.payload as { template: Record<string, unknown> }).template,
        namespace,
      };
    }

    const res = await fetch(MSG91_WA_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authkey: authKey,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errMsg = typeof data === "object" && data !== null && "message" in data
        ? String((data as { message: unknown }).message)
        : res.statusText;
      return { ok: false, error: `MSG91 ${res.status}: ${errMsg}` };
    }
    return { ok: true };
  }

  // Session / text outbound (only works inside an open 24h customer service window)
  const sessionPayload = {
    integrated_number: integratedNumber.replace(/\D/g, ""),
    content_type: "text",
    payload: {
      messaging_product: "whatsapp",
      type: "text",
      to: to,
      text: { body: messageText },
    },
  };

  const res = await fetch(MSG91_WA_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authkey: authKey,
    },
    body: JSON.stringify(sessionPayload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      error:
        `MSG91 ${res.status}: set MSG91_WHATSAPP_TEMPLATE_NAME for cold outbound — ` +
        (typeof data === "object" && data !== null && "message" in data
          ? String((data as { message: unknown }).message)
          : res.statusText),
    };
  }
  return { ok: true };
}

async function sendViaTwilio(
  mobile: string,
  token: string,
): Promise<{ ok: boolean; error?: string }> {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const from = Deno.env.get("TWILIO_WHATSAPP_FROM");
  if (!accountSid || !authToken || !from) {
    return { ok: false, error: "Twilio WhatsApp not configured" };
  }

  const to = mobile.startsWith("+") ? mobile : `+${mobileDigitsE164(mobile)}`;
  const params = new URLSearchParams({
    From: from.startsWith("whatsapp:") ? from : `whatsapp:${from}`,
    To: `whatsapp:${to}`,
    Body: verificationMessage(token),
  });

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(`${accountSid}:${authToken}`),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errMsg = typeof data === "object" && data !== null && "message" in data
      ? String((data as { message: unknown }).message)
      : res.statusText;
    return { ok: false, error: `Twilio ${res.status}: ${errMsg}` };
  }
  return { ok: true };
}

async function sendOutboundWhatsApp(
  mobile: string,
  token: string,
): Promise<{ sent: boolean; provider?: string; error?: string }> {
  if (!hasOutboundWhatsApp()) {
    return { sent: false, error: "No WhatsApp outbound provider configured" };
  }

  // Prefer MSG91 (same vendor as send-otp for India)
  if (msg91AuthKey() && Deno.env.get("MSG91_WHATSAPP_INTEGRATED_NUMBER")) {
    const result = await sendViaMsg91(mobile, token);
    if (result.ok) return { sent: true, provider: "msg91" };
    // Fall through to Twilio if MSG91 fails and Twilio is configured
    if (Deno.env.get("TWILIO_ACCOUNT_SID")) {
      const tw = await sendViaTwilio(mobile, token);
      if (tw.ok) return { sent: true, provider: "twilio" };
      return { sent: false, error: tw.error || result.error };
    }
    return { sent: false, error: result.error };
  }

  const tw = await sendViaTwilio(mobile, token);
  if (tw.ok) return { sent: true, provider: "twilio" };
  return { sent: false, error: tw.error };
}

async function markVerified(
  supabase: ReturnType<typeof createClient>,
  token: string,
  via: string,
): Promise<{ verified: boolean; mobile?: string; error?: string }> {
  const now = new Date().toISOString();
  const { data: row, error: fetchErr } = await supabase
    .from("wa_verifications")
    .select("id, mobile, verified, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (fetchErr) return { verified: false, error: fetchErr.message };
  if (!row) return { verified: false, error: "Token not found" };
  if (new Date(row.expires_at) < new Date()) {
    return { verified: false, error: "Token expired" };
  }
  if (row.verified) {
    return { verified: true, mobile: row.mobile };
  }

  const { error: updateErr } = await supabase
    .from("wa_verifications")
    .update({
      verified: true,
      verified_at: now,
      verified_via: via,
    })
    .eq("id", row.id);

  if (updateErr) return { verified: false, error: updateErr.message };
  return { verified: true, mobile: row.mobile };
}

async function handleInboundWebhook(
  supabase: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
): Promise<Response> {
  const secret = Deno.env.get("WHATSAPP_WEBHOOK_SECRET");
  const headerSecret = Deno.env.get("WHATSAPP_WEBHOOK_HEADER") || "x-webhook-secret";
  // Manual / test webhook with shared secret
  if (secret && body.secret !== secret && body.action === "webhook") {
    return json({ error: "Unauthorized" }, 401);
  }

  const message = parseInboundMessage(body);
  const fromMobile = parseInboundFrom(body);

  let token = String(body.token || "").trim().toUpperCase();
  if (!token && message) {
    token = extractTokenFromMessage(message) || "";
  }

  if (!token && fromMobile && message.toUpperCase().includes("VERIFY")) {
    // Match latest pending token for this mobile when user replies VERIFY only
    const { data: pending } = await supabase
      .from("wa_verifications")
      .select("token")
      .eq("mobile", fromMobile)
      .eq("verified", false)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (pending?.token) token = pending.token;
  }

  if (!token) {
    return json({ error: "Token or inbound message required" }, 400);
  }

  // Optional: inbound mobile must match token row
  if (fromMobile) {
    const { data: row } = await supabase
      .from("wa_verifications")
      .select("mobile")
      .eq("token", token)
      .maybeSingle();
    if (row && row.mobile !== fromMobile) {
      return json({ success: false, error: "Mobile mismatch" }, 400);
    }
  }

  const via = body.From ? "twilio" : body.messages || body.text ? "msg91" : "webhook";
  const result = await markVerified(supabase, token, via);
  if (!result.verified && result.error) {
    return json({ success: false, error: result.error }, 400);
  }
  return json({
    success: true,
    verified: result.verified,
    mobile: result.mobile,
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return json({ error: "Server misconfigured" }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const body = await parseRequestBody(req);
    let action = String(body.action || "").toLowerCase();

    // Provider inbound webhooks (MSG91 / Twilio) — no action field
    if (!action && isProviderInbound(body)) {
      return handleInboundWebhook(supabase, body);
    }

    if (action === "generate") {
      const mobile = normalizeMobile(String(body.mobile || ""));
      if (!mobile) {
        return json({ error: "Invalid mobile number" }, 400);
      }

      const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
      let token = generateToken();
      let inserted = false;

      for (let attempt = 0; attempt < 5 && !inserted; attempt++) {
        if (attempt > 0) token = generateToken();
        const { error } = await supabase.from("wa_verifications").insert({
          mobile,
          token,
          expires_at: expiresAt,
        });
        if (!error) inserted = true;
        else if (!/duplicate|unique/i.test(error.message)) {
          return json({ error: error.message }, 500);
        }
      }

      if (!inserted) {
        return json({ error: "Could not generate unique token" }, 500);
      }

      const outbound = await sendOutboundWhatsApp(mobile, token);
      if (outbound.sent) {
        await supabase
          .from("wa_verifications")
          .update({
            outbound_sent_at: new Date().toISOString(),
            outbound_provider: outbound.provider,
          })
          .eq("token", token);
      }

      return json({
        success: true,
        token,
        messageSent: outbound.sent,
        provider: outbound.provider,
        sendError: outbound.error,
        mode: hasStrictVerification() ? "strict" : "honor",
        instruction: `Reply VERIFY ${token} on WhatsApp to confirm.`,
      });
    }

    if (action === "check") {
      const token = String(body.token || "").trim().toUpperCase();
      if (!token || !token.startsWith(TOKEN_PREFIX)) {
        return json({ verified: false, error: "Invalid token" }, 400);
      }

      const { data: row, error } = await supabase
        .from("wa_verifications")
        .select(
          "mobile, verified, verified_at, created_at, expires_at, outbound_sent_at",
        )
        .eq("token", token)
        .maybeSingle();

      if (error) return json({ verified: false, error: error.message }, 500);
      if (!row) return json({ verified: false, mode: hasStrictVerification() ? "strict" : "honor" });
      if (new Date(row.expires_at) < new Date()) {
        return json({ verified: false, error: "Token expired" });
      }
      if (row.verified) {
        return json({ verified: true, mobile: row.mobile, mode: "webhook" });
      }

      const mode = hasStrictVerification() ? "strict" : "honor";

      // Strict: only webhook/inbound marks verified
      if (hasStrictVerification()) {
        return json({
          verified: false,
          mode,
          note: "Waiting for your WhatsApp reply.",
        });
      }

      // Dev / honor: auto-verify after delay when outbound not configured or for local testing
      const ageMs = Date.now() - new Date(row.created_at).getTime();
      if (ageMs < HONOR_DELAY_MS) {
        return json({
          verified: false,
          mode,
          note: "Honor mode — auto-verifies shortly if no webhook configured.",
        });
      }

      const result = await markVerified(supabase, token, "honor");
      if (result.verified) {
        return json({
          verified: true,
          mobile: result.mobile,
          mode,
          note: "Honor mode — configure MSG91/Twilio webhook for production.",
        });
      }
      return json({ verified: false, error: result.error, mode });
    }

    if (action === "webhook") {
      return handleInboundWebhook(supabase, body);
    }

    return json({ error: "Unknown action. Use generate, check, or webhook." }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    return json({ error: msg }, 500);
  }
});
