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

function mobile10FromEmail(email: string): string | null {
  const local = (email || "").split("@")[0] || "";
  const m10 = local.replace(/\D/g, "").slice(-10);
  return m10.length === 10 ? m10 : null;
}

function profileIdFromMobile(mobile: string): string {
  return `cust_${mobile.replace(/\D/g, "").slice(-10)}`;
}

function phoneLookupVariants(mobile: string): string[] {
  const d10 = mobile.replace(/\D/g, "").slice(-10);
  if (d10.length !== 10) return [mobile].filter(Boolean);
  const norm = normalizeMobile(mobile);
  return [...new Set([norm, `+91${d10}`, `91${d10}`, d10, mobile].filter(Boolean))];
}

function profileLooksRegistered(p: {
  first_name?: string | null;
  name?: string | null;
} | null): boolean {
  return !!(String(p?.first_name || "").trim() || String(p?.name || "").trim());
}

async function findProfileByMobile(
  supabase: SupabaseClient,
  mobile: string,
) {
  for (const ph of phoneLookupVariants(mobile)) {
    const { data } = await supabase
      .from("profiles")
      .select("id,first_name,last_name,name,phone,email")
      .eq("phone", ph)
      .maybeSingle();
    if (data?.id) return data;
  }
  for (const email of profileAuthEmails(mobile)) {
    const { data } = await supabase
      .from("profiles")
      .select("id,first_name,last_name,name,phone,email")
      .eq("email", email)
      .maybeSingle();
    if (data?.id) return data;
  }
  return null;
}

async function verifyAuthMobileMatch(
  req: Request,
  supabaseUrl: string,
  mobile: string,
): Promise<boolean> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  const anonKey = resolveAnonKey(req);
  if (!anonKey) return false;
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user?.email) return false;
  const jwtM10 = mobile10FromEmail(user.email);
  const mobM10 = mobile.replace(/\D/g, "").slice(-10);
  return !!jwtM10 && jwtM10 === mobM10;
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

function emailMatches(userEmail: string | undefined, target: string): boolean {
  return !!userEmail && userEmail.toLowerCase() === target.toLowerCase();
}

/** listUsers SDK has no email filter — paginate and match exactly */
async function findAuthUserByEmail(
  supabase: SupabaseClient,
  supabaseUrl: string,
  serviceKey: string,
  email: string,
): Promise<{ id: string; email?: string } | null> {
  const target = email.toLowerCase();
  const perPage = 1000;

  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) break;
    const match = data.users?.find((u) => emailMatches(u.email, target));
    if (match) return match;
    if (!data.users?.length || data.users.length < perPage) break;
  }

  const res = await fetch(
    `${supabaseUrl}/auth/v1/admin/users?filter=${encodeURIComponent(email)}&page=1&per_page=50`,
    {
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
      },
    },
  );
  if (res.ok) {
    const payload = await res.json().catch(() => ({}));
    const users = (payload as { users?: Array<{ id: string; email?: string }> }).users;
    const match = users?.find((u) => emailMatches(u.email, target));
    if (match) return match;
  }

  return null;
}

async function findAuthUserForMobile(
  supabase: SupabaseClient,
  supabaseUrl: string,
  serviceKey: string,
  mobile: string,
): Promise<{ id: string; email?: string } | null> {
  for (const email of profileAuthEmails(mobile)) {
    const found = await findAuthUserByEmail(supabase, supabaseUrl, serviceKey, email);
    if (found) return found;
  }
  const digits = mobile.replace(/\D/g, "").slice(-10);
  if (!digits) return null;

  const res = await fetch(
    `${supabaseUrl}/auth/v1/admin/users?filter=${encodeURIComponent(digits)}&page=1&per_page=50`,
    {
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
      },
    },
  );
  if (!res.ok) return null;
  const payload = await res.json().catch(() => ({}));
  const users = (payload as { users?: Array<{ id: string; email?: string }> }).users;
  return users?.find((u) => u.email?.includes(digits)) || null;
}

async function ensureProfileAuthUser(
  supabase: SupabaseClient,
  supabaseUrl: string,
  serviceKey: string,
  mobile: string,
) {
  const canonicalEmail = profileAuthEmail(mobile);
  const password = profileAuthPassword(mobile);

  const existing = await findAuthUserForMobile(supabase, supabaseUrl, serviceKey, mobile);

  if (existing) {
    const updates: { password: string; email_confirm: boolean; email?: string } = {
      password,
      email_confirm: true,
    };
    if (existing.email !== canonicalEmail) updates.email = canonicalEmail;
    const { error: updateErr } = await supabase.auth.admin.updateUserById(existing.id, updates);
    if (updateErr) throw new Error(updateErr.message);
    return { email: canonicalEmail, password };
  }

  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email: canonicalEmail,
    password,
    email_confirm: true,
  });
  if (createErr) {
    const msg = createErr.message || "";
    const retryable = /already registered|already exists|duplicate|database error/i.test(msg);
    if (retryable) {
      const retry = await findAuthUserForMobile(supabase, supabaseUrl, serviceKey, mobile);
      if (retry) {
        const updates: { password: string; email_confirm: boolean; email?: string } = {
          password,
          email_confirm: true,
        };
        if (retry.email !== canonicalEmail) updates.email = canonicalEmail;
        const { error: updateErr } = await supabase.auth.admin.updateUserById(retry.id, updates);
        if (updateErr) throw new Error(updateErr.message);
        return { email: canonicalEmail, password };
      }
    }
    if (/profiles_email_key|duplicate key/i.test(msg)) {
      throw new Error("Profile already exists — retry OTP verify");
    }
    throw new Error(createErr.message);
  }
  if (!created.user) throw new Error("Could not create auth user");
  return { email: canonicalEmail, password };
}

/** Client invoke sends apikey/Authorization; env SUPABASE_ANON_KEY is optional fallback */
function resolveAnonKey(req: Request): string | null {
  const fromEnv = Deno.env.get("SUPABASE_ANON_KEY");
  if (fromEnv) return fromEnv;

  const apikey = req.headers.get("apikey")?.trim();
  if (apikey) return apikey;

  const auth = req.headers.get("Authorization")?.trim();
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    if (token) return token;
  }
  return null;
}

async function signInAndReturnTokens(
  supabaseUrl: string,
  apiKey: string,
  email: string,
  password: string,
) {
  const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });
  const payload = await res.json().catch(() => ({})) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
    msg?: string;
  };
  if (!res.ok || !payload.access_token || !payload.refresh_token) {
    throw new Error(
      payload.error_description || payload.msg || payload.error
        || "Sign-in failed after profile auth setup",
    );
  }
  return {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    expires_in: payload.expires_in,
  };
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
        return json({ success: false, error: "Verification required" });
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
      try {
        const otp = String(body.otp || "").trim();
        const waToken = String(body.wa_token || "").trim();
        let verified = false;
        if (otp) {
          verified = await verifyOtpStored(supabase, mobile, otp)
            || await verifyOtpRecentlyUsed(supabase, mobile, otp);
        } else if (waToken) verified = await verifyWaToken(supabase, mobile, waToken);
        else return json({ success: false, error: "OTP or WhatsApp token required" });

        if (!verified) {
          return json({ success: false, error: "Invalid or expired verification" });
        }

        const { email, password } = await ensureProfileAuthUser(
          supabase,
          supabaseUrl,
          serviceKey,
          mobile,
        );
        const authKey = resolveAnonKey(req) || serviceKey;
        const tokens = await signInAndReturnTokens(supabaseUrl, authKey, email, password);
        return json({ success: true, ...tokens });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Session failed";
        return json({ success: false, error: msg });
      }
    }

    if (action === "check_mobile") {
      const existing = await findProfileByMobile(supabase, mobile);
      return json({
        exists: !!existing,
        registered: !!(existing && profileLooksRegistered(existing)),
      });
    }

    if (action === "register_profile") {
      try {
        const authed = await verifyAuthMobileMatch(req, supabaseUrl, mobile);
        if (!authed) {
          return json({ success: false, error: "Sign-in required — verify OTP first" }, 401);
        }

        const existing = await findProfileByMobile(supabase, mobile);
        if (existing && profileLooksRegistered(existing)) {
          return json({
            success: false,
            code: "already_registered",
            error: "This number is already registered. Please try login.",
          });
        }

        const profileId = existing?.id || profileIdFromMobile(mobile);
        const incoming = (body.profile || {}) as Record<string, unknown>;
        const row = {
          id: profileId,
          email: profileAuthEmail(mobile),
          name: String(incoming.name || "").trim() || null,
          first_name: String(incoming.first_name || "").trim() || null,
          last_name: String(incoming.last_name || "").trim() || null,
          phone: mobile,
          address: String(incoming.address || ""),
          village: String(incoming.village || ""),
          city: String(incoming.city || ""),
          pincode: String(incoming.pincode || ""),
          ip_address: incoming.ip_address ?? null,
          last_lat: incoming.last_lat ?? null,
          last_lng: incoming.last_lng ?? null,
          device_type: incoming.device_type ?? null,
          os_name: incoming.os_name ?? null,
          browser: incoming.browser ?? null,
          timezone: incoming.timezone ?? null,
          language: incoming.language ?? null,
          mobile_verified: incoming.mobile_verified !== false,
          mobile_verified_at: incoming.mobile_verified_at || new Date().toISOString(),
          role: "customer",
          status: "active",
          avatar: incoming.avatar || "👤",
        };

        let profile;
        let profErr;
        if (existing?.id) {
          ({ data: profile, error: profErr } = await supabase
            .from("profiles")
            .update(row)
            .eq("id", profileId)
            .select()
            .single());
        } else {
          ({ data: profile, error: profErr } = await supabase
            .from("profiles")
            .upsert(row, { onConflict: "id" })
            .select()
            .single());
          if (profErr && /profiles_phone|phone_key|duplicate key/i.test(profErr.message)) {
            const byPhone = await findProfileByMobile(supabase, mobile);
            if (byPhone?.id) {
              ({ data: profile, error: profErr } = await supabase
                .from("profiles")
                .update({ ...row, id: byPhone.id })
                .eq("id", byPhone.id)
                .select()
                .single());
            }
          }
        }
        if (profErr || !profile) {
          if (profErr && /profiles_phone|phone_key|duplicate key/i.test(profErr.message)) {
            return json({
              success: false,
              code: "already_registered",
              error: "This number is already registered. Please try login.",
            });
          }
          return json({
            success: false,
            error: "Could not save profile. Try again or log in with this number.",
          }, 500);
        }

        const loc = body.location as Record<string, unknown> | null;
        if (loc && loc.lat != null && loc.lng != null) {
          await supabase.from("user_locations").insert({
            user_id: profile.id,
            lat: Number(loc.lat),
            lng: Number(loc.lng),
            address: String(loc.address || ""),
            village: String(loc.village || ""),
            city: String(loc.city || ""),
            pincode: String(loc.pincode || ""),
            source: String(loc.source || "gps"),
            consent_given: true,
            consent_at: new Date().toISOString(),
          });
        }

        return json({ success: true, profile });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Profile save failed";
        if (/profiles_phone|phone_key|duplicate key/i.test(msg)) {
          return json({
            success: false,
            code: "already_registered",
            error: "This number is already registered. Please try login.",
          });
        }
        return json({ success: false, error: "Could not save profile. Try again." }, 500);
      }
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
