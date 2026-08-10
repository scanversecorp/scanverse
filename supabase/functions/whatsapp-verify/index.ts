/**
 * ScanV WhatsApp verification edge function
 *
 * Actions (JSON body):
 *   generate — { mobile: "+91XXXXXXXXXX" } → { success, token }
 *   check    — { token: "SCANV-XXXX" }       → { verified, mobile? }
 *   webhook  — { token, secret? }            → { success } (marks verified)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TOKEN_PREFIX = "SCANV-";
const TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes
/** Minimum age before honor-system auto-verify (user time to open WA & send) */
const HONOR_DELAY_MS = 10 * 1000;

const TOKEN_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

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

function generateToken(): string {
  let suffix = "";
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  for (let i = 0; i < 4; i++) {
    suffix += TOKEN_CHARS[bytes[i] % TOKEN_CHARS.length];
  }
  return `${TOKEN_PREFIX}${suffix}`;
}

function hasWebhookIntegration(): boolean {
  return Boolean(
    Deno.env.get("WHATSAPP_WEBHOOK_SECRET") ||
      Deno.env.get("MSG91_WHATSAPP_AUTH_KEY"),
  );
}

function extractTokenFromMessage(text: string): string | null {
  const match = text.match(/SCANV\s+VERIFY\s+(SCANV-[A-Z0-9]{4})/i);
  return match ? match[1].toUpperCase() : null;
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
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "").toLowerCase();

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

      return json({ success: true, token });
    }

    if (action === "check") {
      const token = String(body.token || "").trim().toUpperCase();
      if (!token || !token.startsWith(TOKEN_PREFIX)) {
        return json({ verified: false, error: "Invalid token" }, 400);
      }

      const { data: row, error } = await supabase
        .from("wa_verifications")
        .select("mobile, verified, verified_at, created_at, expires_at")
        .eq("token", token)
        .maybeSingle();

      if (error) return json({ verified: false, error: error.message }, 500);
      if (!row) return json({ verified: false });
      if (new Date(row.expires_at) < new Date()) {
        return json({ verified: false, error: "Token expired" });
      }
      if (row.verified) {
        return json({ verified: true, mobile: row.mobile });
      }

      // Strict mode when webhook / MSG91 credentials are configured
      if (hasWebhookIntegration()) {
        return json({ verified: false });
      }

      // MVP honor system: auto-verify after delay (user expected to send WA message)
      const ageMs = Date.now() - new Date(row.created_at).getTime();
      if (ageMs < HONOR_DELAY_MS) {
        return json({ verified: false });
      }

      const result = await markVerified(supabase, token, "honor");
      if (result.verified) {
        return json({ verified: true, mobile: result.mobile });
      }
      return json({ verified: false, error: result.error });
    }

    if (action === "webhook") {
      const secret = Deno.env.get("WHATSAPP_WEBHOOK_SECRET");
      if (secret && body.secret !== secret) {
        return json({ error: "Unauthorized" }, 401);
      }

      let token = String(body.token || "").trim().toUpperCase();
      if (!token && body.message) {
        token = extractTokenFromMessage(String(body.message)) || "";
      }
      if (!token) {
        return json({ error: "Token or message required" }, 400);
      }

      const result = await markVerified(supabase, token, "webhook");
      if (!result.verified && result.error) {
        return json({ success: false, error: result.error }, 400);
      }
      return json({ success: true, verified: result.verified, mobile: result.mobile });
    }

    return json({ error: "Unknown action. Use generate, check, or webhook." }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    return json({ error: msg }, 500);
  }
});
