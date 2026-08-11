/**
 * ScanV — 2Factor.in SMS OTP delivery report webhook
 *
 * Configure in 2Factor control panel → Callback / Delivery Report URL:
 *   https://rwlwrmmqtedugcreweut.supabase.co/functions/v1/otp-delivery-report?key=<OTP_REPORT_SECRET>
 *
 * 2Factor POST params (SMS_OTP): mode, SessionId, To, Status
 * Status values: DELIVERED, FAILED, REJECTED (+ voice variants)
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, json, normalizeMobile } from "../_shared/notify.ts";

function normalizeStatus(raw: string): { status: string; raw_status: string } {
  const raw_status = raw.trim();
  const s = raw_status.toUpperCase();
  if (s === "DELIVERED" || s.startsWith("DELIVERED ")) {
    return { status: "delivered", raw_status };
  }
  if (s === "FAILED" || s === "REJECTED" || s.includes("FAIL") || s.includes("REJECT")) {
    return { status: "failed", raw_status };
  }
  if (s === "PENDING" || s === "SENT" || s === "QUEUED") {
    return { status: "pending", raw_status };
  }
  return { status: "unknown", raw_status };
}

function pickParam(
  params: Record<string, string>,
  ...keys: string[]
): string {
  for (const key of keys) {
    const v = params[key];
    if (v) return v;
    const lower = params[key.toLowerCase()];
    if (lower) return lower;
  }
  return "";
}

async function parsePayload(req: Request): Promise<Record<string, string>> {
  const url = new URL(req.url);
  const out: Record<string, string> = {};
  url.searchParams.forEach((v, k) => { out[k] = v; });

  if (req.method === "POST") {
    const ct = (req.headers.get("content-type") || "").toLowerCase();
    try {
      if (ct.includes("application/json")) {
        const body = await req.json();
        if (body && typeof body === "object") {
          for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
            if (v != null) out[k] = String(v);
          }
        }
      } else if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
        const form = await req.formData();
        form.forEach((v, k) => { out[k] = String(v); });
      } else {
        const text = await req.text();
        if (text.trim()) {
          try {
            const body = JSON.parse(text);
            if (body && typeof body === "object") {
              for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
                if (v != null) out[k] = String(v);
              }
            }
          } catch {
            out._raw_body = text.slice(0, 2000);
          }
        }
      }
    } catch {
      // ignore parse errors — query params may be enough
    }
  }

  return out;
}

function verifySecret(req: Request): boolean {
  const secret = Deno.env.get("OTP_REPORT_SECRET");
  if (!secret) return true;
  const url = new URL(req.url);
  const key = url.searchParams.get("key") || req.headers.get("x-otp-report-key") || "";
  return key === secret;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!["GET", "POST"].includes(req.method)) {
    return json({ error: "Method not allowed" }, 405);
  }

  if (!verifySecret(req)) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return json({ error: "Server misconfigured" }, 500);
    }

    const params = await parsePayload(req);
    const sessionId = pickParam(params, "SessionId", "session_id", "sessionId", "SessionID");
    const toRaw = pickParam(params, "To", "to", "mobile", "Mobile", "phone");
    const statusRaw = pickParam(params, "Status", "status", "callDetailStatus");
    const mode = pickParam(params, "mode", "Mode");

    const mobileNorm = toRaw ? normalizeMobile(toRaw) : null;
    const mobile = mobileNorm || (toRaw ? toRaw.replace(/\D/g, "").slice(-10) : null);
    const { status, raw_status } = normalizeStatus(statusRaw || "unknown");

    const supabase = createClient(supabaseUrl, serviceKey);

    let vendorOtpId: string | null = null;
    let otpContext: string | null = null;

    if (sessionId) {
      const { data: otpRow } = await supabase
        .from("vendor_otp")
        .select("id, purpose")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (otpRow) {
        vendorOtpId = otpRow.id;
        otpContext = otpRow.purpose || null;
      }
    }

    if (!otpContext && mobileNorm) {
      const { data: recentOtp } = await supabase
        .from("vendor_otp")
        .select("id, purpose")
        .eq("mobile", mobileNorm)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (recentOtp && !vendorOtpId) vendorOtpId = recentOtp.id;
      if (recentOtp?.purpose) otpContext = recentOtp.purpose;
    }

    const row = {
      provider: "2factor",
      session_id: sessionId || null,
      mobile: mobileNorm || mobile,
      status,
      raw_status: raw_status || statusRaw || null,
      raw_payload: { ...params, ...(mode ? { mode } : {}) },
      otp_context: otpContext,
      vendor_otp_id: vendorOtpId,
    };

    const { error } = await supabase.from("otp_delivery_reports").insert(row);
    if (error) {
      console.error("[otp-delivery-report] insert failed:", error.message);
      return json({ ok: false, error: error.message }, 500);
    }

    return json({ ok: true, status, session_id: sessionId || null });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    console.error("[otp-delivery-report]", msg);
    return json({ ok: false, error: msg }, 500);
  }
});
