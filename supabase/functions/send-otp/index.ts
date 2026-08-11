/**
 * ScanV send-otp edge function
 * Actions: send (default), verify
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  corsHeaders,
  json,
  normalizeMobile,
  sendSms,
  hashOtp,
  generateOtp,
} from "../_shared/notify.ts";

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
    const action = String(body.action || "send").toLowerCase();
    const mobile = normalizeMobile(String(body.mobile || ""));

    if (!mobile) return json({ error: "Invalid mobile number" }, 400);

    if (action === "verify") {
      const otp = String(body.otp || "").trim();
      if (!otp) return json({ success: false, error: "OTP required" }, 400);

      const otpHash = await hashOtp(otp);
      const { data: row } = await supabase
        .from("vendor_otp")
        .select("id, verified, expires_at")
        .eq("mobile", mobile)
        .eq("otp_hash", otpHash)
        .eq("verified", false)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!row) {
        // Fallback: custom_otp table used by client
        const { data: custom } = await supabase
          .from("custom_otp")
          .select("id, otp, expires_at")
          .eq("mobile", mobile)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (custom && custom.otp === otp && new Date(custom.expires_at) > new Date()) {
          return json({ success: true, provider: "custom_otp" });
        }
        return json({ success: false, error: "Invalid or expired OTP" });
      }

      await supabase.from("vendor_otp").update({ verified: true }).eq("id", row.id);
      return json({ success: true });
    }

    // Send OTP
    const otp = generateOtp();
    const otpHash = await hashOtp(otp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await supabase.from("vendor_otp").insert({
      mobile,
      otp_hash: otpHash,
      purpose: String(body.purpose || "general"),
      expires_at: expiresAt,
    });

    const message = `ScanV OTP: ${otp}. Valid 10 min. Do not share.`;
    const sms = await sendSms(mobile, message);

    // Dev fallback: return OTP when no provider (never in production with providers set)
    const devMode = !sms.ok && Deno.env.get("OTP_DEV_MODE") === "1";

    if (!sms.ok && !devMode) {
      return json({ success: false, error: sms.error || "SMS send failed" }, 502);
    }

    return json({
      success: true,
      provider: sms.provider || "dev",
      ...(devMode ? { dev_otp: otp } : {}),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    return json({ error: msg }, 500);
  }
});
