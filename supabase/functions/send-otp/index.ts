/**
 * ScanV send-otp edge function
 * Actions: send (default), verify, establish_session, session
 */
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  corsHeaders,
  json,
  normalizeMobile,
  sendSms,
  hashOtp,
  generateOtp,
} from "../_shared/notify.ts";

function profileAuthEmail(mobile: string): string {
  const digits = mobile.replace(/\D/g, "").slice(-10);
  return `${digits}@scanv.app`;
}

function profileAuthPassword(mobile: string): string {
  const digits = mobile.replace(/\D/g, "").slice(-10);
  return `ScanV_${digits}`;
}

function profileAuthEmails(mobile: string): string[] {
  const digits = mobile.replace(/\D/g, "").slice(-10);
  return [
    `${digits}@scanv.app`,
    `${mobile.replace(/^\+/, "").replace(/\s/g, "")}@scanv.app`,
  ];
}

async function verifyOtpStored(
  supabase: SupabaseClient,
  mobile: string,
  otp: string,
): Promise<boolean> {
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

  if (row) {
    await supabase.from("vendor_otp").update({ verified: true }).eq("id", row.id);
    return true;
  }

  const { data: custom } = await supabase
    .from("custom_otp")
    .select("id, otp, expires_at, used")
    .eq("mobile", mobile)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (custom && custom.otp === otp && new Date(custom.expires_at) > new Date()) {
    if (!custom.used) {
      await supabase.from("custom_otp").update({ used: true }).eq("id", custom.id);
    }
    return true;
  }
  return false;
}

/** Accept OTP already verified by a prior verify call (same booking flow) */
async function verifyOtpRecentlyUsed(
  supabase: SupabaseClient,
  mobile: string,
  otp: string,
): Promise<boolean> {
  const otpHash = await hashOtp(otp);
  const { data: row } = await supabase
    .from("vendor_otp")
    .select("id")
    .eq("mobile", mobile)
    .eq("otp_hash", otpHash)
    .eq("verified", true)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (row) return true;

  const { data: custom } = await supabase
    .from("custom_otp")
    .select("id")
    .eq("mobile", mobile)
    .eq("otp", otp)
    .eq("used", true)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return !!custom;
}

async function verifyWaToken(
  supabase: SupabaseClient,
  mobile: string,
  token: string,
): Promise<boolean> {
  const { data: row } = await supabase
    .from("wa_verifications")
    .select("mobile, verified, expires_at")
    .eq("token", token.trim().toUpperCase())
    .maybeSingle();
  if (!row?.verified) return false;
  if (new Date(row.expires_at) < new Date()) return false;
  return normalizeMobile(String(row.mobile || "")) === mobile;
}

async function assertRecentOtpVerified(
  supabase: SupabaseClient,
  mobile: string,
): Promise<{ ok: boolean; error?: string }> {
  const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data: row } = await supabase
    .from("vendor_otp")
    .select("id")
    .eq("mobile", mobile)
    .eq("verified", true)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (row) return { ok: true };
  return { ok: false, error: "OTP verification required" };
}

async function findAuthUserByEmail(
  supabaseUrl: string,
  serviceKey: string,
  email: string,
) {
  const res = await fetch(
    `${supabaseUrl}/auth/v1/admin/users?filter=${encodeURIComponent(`email.eq.${email}`)}`,
    {
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
      },
    },
  );
  if (!res.ok) return null;
  const data = await res.json().catch(() => ({}));
  const users = (data as { users?: Array<{ id: string; email?: string }> }).users;
  return users?.[0] || null;
}

async function ensureProfileAuthUser(
  supabase: SupabaseClient,
  supabaseUrl: string,
  serviceKey: string,
  mobile: string,
) {
  const canonicalEmail = profileAuthEmail(mobile);
  const password = profileAuthPassword(mobile);
  const emails = profileAuthEmails(mobile);

  let existing: { id: string; email?: string } | null = null;
  for (const email of emails) {
    existing = await findAuthUserByEmail(supabaseUrl, serviceKey, email);
    if (existing) break;
  }

  if (existing) {
    const { error: pwErr } = await supabase.auth.admin.updateUserById(existing.id, { password });
    if (pwErr) throw new Error(pwErr.message);
    if (existing.email !== canonicalEmail) {
      await supabase.auth.admin.updateUserById(existing.id, {
        email: canonicalEmail,
        email_confirm: true,
      });
    }
    return { email: canonicalEmail, password };
  }

  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email: canonicalEmail,
    password,
    email_confirm: true,
  });
  if (createErr) throw new Error(createErr.message);
  if (!created.user) throw new Error("Could not create auth user");
  return { email: canonicalEmail, password };
}

async function signInAndReturnTokens(
  supabaseUrl: string,
  anonKey: string,
  email: string,
  password: string,
) {
  const anonClient = createClient(supabaseUrl, anonKey);
  const { data, error } = await anonClient.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    throw new Error(error?.message || "Sign-in failed after profile auth setup");
  }
  return {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_in: data.session.expires_in,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !serviceKey) {
      return json({ error: "Server misconfigured" }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "send").toLowerCase();
    const mobile = normalizeMobile(String(body.mobile || ""));

    if (!mobile) return json({ error: "Invalid mobile number" }, 400);

    if (action === "establish_session") {
      const otp = String(body.otp || "").trim();
      const waToken = String(body.wa_token || body.token || "").trim();
      let verified = false;
      if (otp) {
        verified = await verifyOtpStored(supabase, mobile, otp)
          || await verifyOtpRecentlyUsed(supabase, mobile, otp);
      } else if (waToken) {
        verified = await verifyWaToken(supabase, mobile, waToken);
      } else {
        const check = await assertRecentOtpVerified(supabase, mobile);
        verified = check.ok;
      }
      if (!verified) {
        return json({ success: false, error: "Verification required" }, 403);
      }

      const { email } = await ensureProfileAuthUser(
        supabase,
        supabaseUrl,
        serviceKey,
        mobile,
      );
      return json({ success: true, email });
    }

    if (action === "verify") {
      const otp = String(body.otp || "").trim();
      if (!otp) return json({ success: false, error: "OTP required" }, 400);

      const ok = await verifyOtpStored(supabase, mobile, otp);
      if (!ok) return json({ success: false, error: "Invalid or expired OTP" });
      return json({ success: true });
    }

    if (action === "session") {
      if (!anonKey) return json({ error: "Server misconfigured" }, 500);

      const otp = String(body.otp || "").trim();
      const waToken = String(body.wa_token || "").trim();
      let verified = false;
      if (otp) {
        verified = await verifyOtpStored(supabase, mobile, otp)
          || await verifyOtpRecentlyUsed(supabase, mobile, otp);
      } else if (waToken) verified = await verifyWaToken(supabase, mobile, waToken);
      else return json({ success: false, error: "OTP or WhatsApp token required" }, 400);

      if (!verified) {
        return json({ success: false, error: "Invalid or expired verification" }, 401);
      }

      const { email, password } = await ensureProfileAuthUser(
        supabase,
        supabaseUrl,
        serviceKey,
        mobile,
      );
      const tokens = await signInAndReturnTokens(supabaseUrl, anonKey, email, password);
      return json({ success: true, ...tokens });
    }

    // Send OTP
    const otp = generateOtp();
    const otpHash = await hashOtp(otp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const purpose = String(body.purpose || "general");
    const { data: otpRow, error: insertErr } = await supabase
      .from("vendor_otp")
      .insert({
        mobile,
        otp_hash: otpHash,
        purpose,
        expires_at: expiresAt,
      })
      .select("id")
      .single();

    if (insertErr) {
      return json({ success: false, error: insertErr.message }, 500);
    }

    const message = `ScanV OTP: ${otp}. Valid 10 min. Do not share.`;
    const sms = await sendSms(mobile, message, otp);

    if (sms.ref && otpRow?.id) {
      await supabase
        .from("vendor_otp")
        .update({ session_id: sms.ref })
        .eq("id", otpRow.id);
    }

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
