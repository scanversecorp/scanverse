/**
 * ScanV vendor onboarding edge function
 *
 * Actions:
 *   send-otp        — { mobile }
 *   verify-otp      — { mobile, otp }
 *   lookup-partner  — { mobile }  (requires recent OTP)
 *   validate-pan    — { pan }
 *   ekyc-aadhaar    — { aadhaar, name?, otp?, ekyc_ref? }
 *   check-gps       — { lat, lng, ip? }
 *   register        — full vendor payload (+ ekyc_ref)
 *   update-services — { mobile, services[] }  (existing partner)
 *   update-location — { mobile?, profile_id?, lat, lng }  (continuous partner GPS)
 *   photo-upload-url — { mobile } signed upload URL (OTP required)
 *   photo-view-url   — { vendor_id } signed view URL (PIN header)
 *   gps-history      — { vendor_id, limit? } (PIN header)
 *   list            — admin list (PIN header)
 *   offboard        — { vendor_id } (PIN header)
 *   activate        — { vendor_id } (PIN header)
 *   pause           — { vendor_id } (PIN header)
 *   unpause         — { vendor_id } (PIN header)
 *   delete          — { vendor_id } (PIN header)
 *   enroll          — admin direct enrollment (PIN header)
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  corsHeaders,
  json,
  normalizeMobile,
  sendSms,
  hashOtp,
  generateOtp,
  validatePan,
  validateAadhaar,
  normalizeAadhaarDigits,
  hashSensitive,
  geoCountryFromLatLng,
  ipCountry,
} from "../_shared/notify.ts";

type SupabaseClient = ReturnType<typeof createClient>;

type VendorAdminRole = "admin" | "readonly" | null;

function resolveVendorAdminRole(req: Request): VendorAdminRole {
  const pin = req.headers.get("x-vendor-admin-pin") || "";
  if (!pin) return null;

  const adminPins = [
    Deno.env.get("VENDOR_ADMIN_PIN"),
    Deno.env.get("PRICING_ADMIN_PIN"),
    Deno.env.get("ADMIN_HUB_PIN"),
    Deno.env.get("SUPPORT_ADMIN_PIN"),
  ].filter((p): p is string => !!p && p.length >= 6);

  if (adminPins.some((p) => pin === p)) return "admin";

  const agentPin = Deno.env.get("SUPPORT_AGENT_PIN");
  if (agentPin && pin === agentPin) return "readonly";

  return null;
}

function vendorAdminAuthorized(req: Request): boolean {
  return resolveVendorAdminRole(req) !== null;
}

function vendorAdminCanWrite(req: Request): boolean {
  return resolveVendorAdminRole(req) === "admin";
}

/** @deprecated use vendorAdminAuthorized / vendorAdminCanWrite */
function adminPinOk(req: Request): boolean {
  return vendorAdminCanWrite(req);
}

async function assertRecentOtpVerified(
  supabase: SupabaseClient,
  mobile: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: otpRow } = await supabase
    .from("vendor_otp")
    .select("id")
    .eq("mobile", mobile)
    .eq("purpose", "onboard")
    .eq("verified", true)
    .gt("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString())
    .limit(1)
    .maybeSingle();
  if (!otpRow) return { ok: false, error: "Phone not verified — complete OTP first" };
  return { ok: true };
}

async function storeEkycSession(
  supabase: SupabaseClient,
  params: {
    ekycRef: string;
    aadhaarHash: string;
    last4: string;
    verified: boolean;
    provider: string;
  },
): Promise<void> {
  await supabase.from("vendor_ekyc_sessions").upsert({
    ekyc_ref: params.ekycRef,
    aadhaar_hash: params.aadhaarHash,
    last4: params.last4,
    verified: params.verified,
    provider: params.provider,
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  }, { onConflict: "ekyc_ref" });
}

async function getVerifiedEkycSession(
  supabase: SupabaseClient,
  aadhaarHash: string,
  ekycRef?: string,
) {
  let query = supabase
    .from("vendor_ekyc_sessions")
    .select("ekyc_ref, last4, provider")
    .eq("aadhaar_hash", aadhaarHash)
    .eq("verified", true)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1);
  if (ekycRef) query = query.eq("ekyc_ref", ekycRef);
  const { data } = await query.maybeSingle();
  return data;
}

function digioAuthHeaders(apiKey?: string): Record<string, string> {
  const clientId = Deno.env.get("DIGIO_CLIENT_ID");
  const clientSecret = Deno.env.get("DIGIO_CLIENT_SECRET");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (clientId && clientSecret) {
    headers.Authorization = `Basic ${btoa(`${clientId}:${clientSecret}`)}`;
  }
  if (apiKey) headers["X-API-KEY"] = apiKey;
  return headers;
}

function digioApiError(data: unknown, fallback: string): string {
  if (typeof data !== "object" || data === null) return fallback;
  const obj = data as Record<string, unknown>;
  for (const key of ["message", "error_message", "error", "detail", "description"]) {
    const val = obj[key];
    if (typeof val === "string" && val.trim()) return val.trim();
  }
  return fallback;
}

type EkycResult = {
  verified: boolean;
  pending?: boolean;
  requires_otp?: boolean;
  otp_sent?: boolean;
  mode?: "digio" | "stub" | "disabled";
  ref?: string;
  ekyc_ref?: string;
  last4?: string;
  provider?: string;
  message?: string;
  error?: string;
};

async function digioEkyc(
  aadhaar: string,
  name: string,
  otp?: string,
  ekycRef?: string,
): Promise<EkycResult> {
  const digits = normalizeAadhaarDigits(aadhaar);
  const last4 = digits.slice(-4);
  const apiKey = Deno.env.get("DIGIO_API_KEY");
  const clientId = Deno.env.get("DIGIO_CLIENT_ID");
  const clientSecret = Deno.env.get("DIGIO_CLIENT_SECRET");
  const hasDigio = !!(apiKey || (clientId && clientSecret));

  if (!/^\d{12}$/.test(digits)) {
    return { verified: false, mode: hasDigio ? "digio" : "stub", error: "Enter a valid 12-digit Aadhaar number" };
  }
  if (!validateAadhaar(aadhaar)) {
    return {
      verified: false,
      mode: hasDigio ? "digio" : "stub",
      error: "Invalid Aadhaar number — please re-check all 12 digits (checksum failed)",
    };
  }

  // Step 2: complete Digio OTP verification
  if (hasDigio && otp && ekycRef) {
    try {
      const res = await fetch("https://api.digio.in/v2/client/kyc/aadhaar/verify", {
        method: "POST",
        headers: digioAuthHeaders(apiKey),
        body: JSON.stringify({ id: ekycRef, otp: String(otp).trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return {
          verified: false,
          mode: "digio",
          error: digioApiError(data, `Aadhaar OTP verification failed (${res.status})`),
        };
      }
      const status = typeof data === "object" && data !== null && "status" in data
        ? String((data as { status: string }).status)
        : "verified";
      const verified = status === "verified" || status === "success" || status === "completed";
      return {
        verified,
        mode: "digio",
        ref: ekycRef,
        ekyc_ref: ekycRef,
        last4,
        provider: "digio",
        ...(verified
          ? { message: "Aadhaar verified via UIDAI-approved provider" }
          : { error: digioApiError(data, "Aadhaar OTP verification incomplete") }),
      };
    } catch (e) {
      return { verified: false, mode: "digio", error: e instanceof Error ? e.message : "eKYC verify error" };
    }
  }

  if (!hasDigio) {
    if (Deno.env.get("EKYC_STRICT") === "1") {
      return {
        verified: false,
        mode: "disabled",
        error: "eKYC provider not configured — contact ScanV support (Digio credentials missing)",
      };
    }
    const ref = `stub-${Date.now()}`;
    return {
      verified: true,
      ref,
      ekyc_ref: ref,
      last4,
      provider: "stub",
      mode: "stub",
      message: "Format validated (test mode — UIDAI OTP skipped; ScanV may manually review)",
    };
  }

  // Step 1: initiate Digio Aadhaar eKYC (OTP sent to Aadhaar-linked mobile)
  try {
    const res = await fetch("https://api.digio.in/v2/client/kyc/aadhaar/initiate", {
      method: "POST",
      headers: digioAuthHeaders(apiKey),
      body: JSON.stringify({
        aadhaar_number: digits,
        name: name || undefined,
        consent: true,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        verified: false,
        mode: "digio",
        error: digioApiError(data, `eKYC initiation failed (${res.status}) — check Aadhaar number or try again`),
      };
    }
    const ref = typeof data === "object" && data !== null && "id" in data
      ? String((data as { id: string }).id)
      : "";
    if (!ref) {
      return {
        verified: false,
        mode: "digio",
        error: digioApiError(data, "eKYC initiation failed — no session ID from provider"),
      };
    }
    const status = typeof data === "object" && data !== null && "status" in data
      ? String((data as { status: string }).status)
      : "pending";
    if (status === "verified" || status === "success" || status === "completed") {
      return {
        verified: true,
        ref,
        ekyc_ref: ref,
        last4,
        provider: "digio",
        mode: "digio",
        message: "Aadhaar verified via UIDAI-approved provider",
      };
    }
    return {
      verified: false,
      pending: true,
      requires_otp: true,
      otp_sent: true,
      ref,
      ekyc_ref: ref,
      last4,
      provider: "digio",
      mode: "digio",
      message: "OTP sent to your Aadhaar-linked mobile — enter it below",
    };
  } catch (e) {
    return { verified: false, mode: "digio", error: e instanceof Error ? e.message : "eKYC error" };
  }
}

async function resolveAadhaarForRegister(
  supabase: SupabaseClient,
  body: Record<string, unknown>,
  contactName: string,
): Promise<
  | { ok: true; last4: string; ref: string | null; provider: string }
  | { ok: false; error: string }
> {
  const aadhaar = String(body.aadhaar_number || "");
  if (!aadhaar) return { ok: false, error: "Aadhaar eKYC is required" };

  const aadhaarHash = await hashSensitive(aadhaar);
  const ekycRef = body.ekyc_ref ? String(body.ekyc_ref) : null;
  const session = await getVerifiedEkycSession(supabase, aadhaarHash, ekycRef || undefined);
  if (session) {
    return {
      ok: true,
      last4: session.last4,
      ref: session.ekyc_ref,
      provider: session.provider || "session",
    };
  }

  const ekyc = await digioEkyc(aadhaar, contactName);
  if (!ekyc.verified) {
    return { ok: false, error: ekyc.error || "Aadhaar eKYC failed — verify in step 3 first" };
  }
  const ref = ekyc.ref || ekyc.ekyc_ref || null;
  if (ref) {
    await storeEkycSession(supabase, {
      ekycRef: ref,
      aadhaarHash,
      last4: ekyc.last4 || normalizeAadhaarDigits(aadhaar).slice(-4),
      verified: true,
      provider: ekyc.provider || "digio",
    });
  }
  return {
    ok: true,
    last4: ekyc.last4 || normalizeAadhaarDigits(aadhaar).slice(-4),
    ref,
    provider: ekyc.provider || "unknown",
  };
}

async function upsertPartnerServices(
  supabase: SupabaseClient,
  vendorId: string,
  services: Array<{ service_id: string; category_id: string }>,
  replace = false,
): Promise<void> {
  if (!services.length && !replace) return;

  const selectedIds = new Set(services.map((s) => s.service_id));

  if (replace) {
    const { data: existing } = await supabase
      .from("vendor_partner_services")
      .select("service_id")
      .eq("vendor_id", vendorId);
    for (const row of existing || []) {
      if (!selectedIds.has(row.service_id)) {
        await supabase
          .from("vendor_partner_services")
          .update({ is_active: false })
          .eq("vendor_id", vendorId)
          .eq("service_id", row.service_id);
      }
    }
  }

  for (const s of services) {
    const { error } = await supabase.from("vendor_partner_services").upsert({
      vendor_id: vendorId,
      service_id: s.service_id,
      category_id: s.category_id,
      is_active: true,
    }, { onConflict: "vendor_id,service_id" });
    if (error) throw error;
  }
}

type VendorRow = {
  phone: string;
  contact_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  business_name?: string | null;
  shop_or_flat?: string | null;
  street_name?: string | null;
  city?: string | null;
  pincode?: string | null;
  village?: string | null;
  address_lat?: number | null;
  address_lng?: number | null;
  email?: string | null;
};

const VENDOR_PHOTO_BUCKET = "vendor-photos";
const PHOTO_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

function splitContactName(contactName: string): { first: string; last: string } {
  const parts = String(contactName || "").trim().split(/\s+/).filter(Boolean);
  return {
    first: parts[0] || "",
    last: parts.slice(1).join(" "),
  };
}

function resolveVendorNames(body: Record<string, unknown>): {
  first_name: string;
  last_name: string;
  contact_name: string;
} {
  const firstRaw = String(body.first_name || "").trim();
  const lastRaw = String(body.last_name || "").trim();
  const contactRaw = String(body.contact_name || "").trim();
  if (firstRaw) {
    const contact_name = `${firstRaw} ${lastRaw}`.trim();
    return { first_name: firstRaw, last_name: lastRaw, contact_name: contact_name || firstRaw };
  }
  const split = splitContactName(contactRaw);
  return {
    first_name: split.first,
    last_name: split.last,
    contact_name: contactRaw || split.first,
  };
}

function normalizeMobile2(value: unknown): string | null {
  if (!value) return null;
  const m = normalizeMobile(String(value));
  return m || null;
}

function normalizeVehicleType(value: unknown): "2W" | "4W" | null {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw) return null;
  if (raw === "2W" || raw === "2" || raw.includes("2W") || raw.includes("TWO")) return "2W";
  if (raw === "4W" || raw === "4" || raw.includes("4W") || raw.includes("FOUR")) return "4W";
  return null;
}

function vendorProfileFields(body: Record<string, unknown>) {
  const names = resolveVendorNames(body);
  const mobile2 = normalizeMobile2(body.mobile2 || body.phone2);
  const vehicleType = normalizeVehicleType(body.vehicle_type);
  return {
    first_name: names.first_name || null,
    last_name: names.last_name || null,
    contact_name: names.contact_name,
    mobile2,
    vehicle_type: vehicleType,
    license_number: body.license_number ? String(body.license_number).trim().toUpperCase() : null,
    photo_path: body.photo_path ? String(body.photo_path).trim() : null,
    highest_education: body.highest_education ? String(body.highest_education).trim() : null,
    app_installed_confirmed: body.app_installed_confirmed === true,
    gps_allowed_confirmed: body.gps_allowed_confirmed === true,
  };
}

async function recordGpsHistory(
  supabase: SupabaseClient,
  vendorId: string,
  lat: number,
  lng: number,
  accuracyM?: number | null,
): Promise<void> {
  await supabase.from("vendor_gps_history").insert({
    vendor_id: vendorId,
    lat,
    lng,
    accuracy_m: accuracyM ?? null,
    source: "app",
  });
}

async function signedPhotoUploadUrl(
  supabase: SupabaseClient,
  mobile: string,
  contentType: string,
) {
  const mime = contentType.toLowerCase();
  if (!PHOTO_MIME.has(mime)) {
    return { ok: false as const, error: "Photo must be JPEG, PNG, or WebP" };
  }
  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  const digits = mobile.replace(/\D/g, "");
  const path = `pending/${digits}/${Date.now()}.${ext}`;
  const { data, error } = await supabase.storage
    .from(VENDOR_PHOTO_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data?.signedUrl) {
    return { ok: false as const, error: error?.message || "Could not create upload URL" };
  }
  return {
    ok: true as const,
    signed_url: data.signedUrl,
    path,
    token: data.token,
  };
}

/** Link vendor to a TEXT profiles row (same pattern as customer cust_* ids). */
async function ensurePartnerProfile(
  supabase: SupabaseClient,
  vendor: VendorRow,
): Promise<string> {
  const phone = normalizeMobile(vendor.phone) || vendor.phone;
  const digits = phone.replace(/\D/g, "");
  const defaultId = `partner_${digits}`;

  const { data: byPhone } = await supabase
    .from("profiles")
    .select("id")
    .eq("phone", phone)
    .maybeSingle();

  const profileId = byPhone?.id || defaultId;
  const firstName = String(vendor.first_name || "").trim()
    || splitContactName(String(vendor.contact_name || "")).first
    || String(vendor.business_name || "Partner");
  const lastName = String(vendor.last_name || "").trim()
    || splitContactName(String(vendor.contact_name || "")).last;

  const { error } = await supabase.from("profiles").upsert({
    id: profileId,
    role: "partner",
    first_name: firstName,
    last_name: lastName,
    name: `${firstName} ${lastName}`.trim(),
    phone,
    email: vendor.email || `${digits.slice(-10)}@scanv.partner`,
    mobile_verified: true,
    address: [vendor.shop_or_flat, vendor.street_name, vendor.city].filter(Boolean).join(", "),
    city: vendor.city || "",
    pincode: vendor.pincode || "",
    village: vendor.village || "",
    last_lat: vendor.address_lat ?? null,
    last_lng: vendor.address_lng ?? null,
    status: "active",
  }, { onConflict: "id" });
  if (error) throw error;
  return profileId;
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

    if (action === "send-otp") {
      const mobile = normalizeMobile(String(body.mobile || ""));
      if (!mobile) return json({ error: "Invalid mobile" }, 400);

      const otp = generateOtp();
      const otpHash = await hashOtp(otp);
      await supabase.from("vendor_otp").insert({
        mobile,
        otp_hash: otpHash,
        purpose: "onboard",
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      });

      const sms = await sendSms(mobile, `ScanV Partner OTP: ${otp}. Valid 10 min.`, otp);
      const devMode = !sms.ok && Deno.env.get("OTP_DEV_MODE") === "1";
      if (!sms.ok && !devMode) {
        return json({ success: false, error: sms.error }, 502);
      }
      return json({ success: true, provider: sms.provider || "dev", ...(devMode ? { dev_otp: otp } : {}) });
    }

    if (action === "verify-otp") {
      const mobile = normalizeMobile(String(body.mobile || ""));
      const otp = String(body.otp || "").trim();
      if (!mobile || !otp) return json({ success: false, error: "Mobile and OTP required" }, 400);

      const otpHash = await hashOtp(otp);
      const { data: row } = await supabase
        .from("vendor_otp")
        .select("id")
        .eq("mobile", mobile)
        .eq("otp_hash", otpHash)
        .eq("purpose", "onboard")
        .eq("verified", false)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!row) return json({ success: false, error: "Invalid or expired OTP" });
      await supabase.from("vendor_otp").update({ verified: true }).eq("id", row.id);
      return json({ success: true, mobile_verified: true });
    }

    if (action === "lookup-partner") {
      const mobile = normalizeMobile(String(body.mobile || body.phone || ""));
      if (!mobile) return json({ error: "Invalid mobile" }, 400);
      const otpCheck = await assertRecentOtpVerified(supabase, mobile);
      if (!otpCheck.ok) return json({ error: otpCheck.error }, 400);

      const { data: partner, error } = await supabase
        .from("vendor_partners")
        .select("id, business_name, contact_name, phone, status, aadhaar_verified, aadhaar_last4, vendor_partner_services(service_id, category_id, is_active)")
        .eq("phone", mobile)
        .maybeSingle();
      if (error) throw error;
      if (!partner) return json({ found: false });

      const canAddServices = partner.status === "active" || partner.status === "pending";
      return json({
        found: true,
        can_add_services: canAddServices,
        partner,
      });
    }

    if (action === "validate-pan") {
      const pan = String(body.pan || "").trim().toUpperCase();
      if (!pan) return json({ valid: true, optional: true });
      if (!validatePan(pan)) return json({ valid: false, error: "Invalid PAN format (AAAAA9999A)" });

      const panApiKey = Deno.env.get("PAN_VERIFY_API_KEY");
      if (panApiKey) {
        const res = await fetch("https://api.attestr.com/api/v1/public/checkx/pan", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${panApiKey}`,
          },
          body: JSON.stringify({ pan, name: String(body.name || "") }),
        }).catch(() => null);
        if (res?.ok) {
          const data = await res.json().catch(() => ({}));
          const valid = typeof data === "object" && data !== null && "valid" in data
            ? Boolean((data as { valid: boolean }).valid)
            : true;
          return json({ valid, verified: valid });
        }
      }
      return json({ valid: true, verified: false, note: "Format valid; live PAN verify not configured" });
    }

    if (action === "ekyc-aadhaar") {
      const aadhaar = String(body.aadhaar || "");
      const name = String(body.name || "");
      const otp = body.otp ? String(body.otp) : undefined;
      const ekycRef = body.ekyc_ref ? String(body.ekyc_ref) : undefined;
      const result = await digioEkyc(aadhaar, name, otp, ekycRef);

      const aadhaarHash = await hashSensitive(aadhaar);
      const ref = result.ref || result.ekyc_ref;
      if (ref) {
        await storeEkycSession(supabase, {
          ekycRef: ref,
          aadhaarHash,
          last4: result.last4 || normalizeAadhaarDigits(aadhaar).slice(-4),
          verified: !!result.verified,
          provider: result.provider || (result.pending ? "digio-pending" : "unknown"),
        });
      }

      return json({
        verified: result.verified,
        pending: result.pending,
        requires_otp: result.requires_otp,
        otp_sent: result.otp_sent,
        mode: result.mode,
        ekyc_ref: result.ekyc_ref || result.ref,
        last4: result.last4,
        provider: result.provider,
        message: result.message,
        error: result.error,
      });
    }

    if (action === "check-gps") {
      const lat = Number(body.lat);
      const lng = Number(body.lng);
      if (!lat || !lng) return json({ error: "lat/lng required" }, 400);

      const gpsCountry = await geoCountryFromLatLng(lat, lng);
      const ipC = await ipCountry(String(body.ip || ""));
      const vpnSuspected = !!(gpsCountry && ipC && gpsCountry !== ipC);

      const requestedCountry = String(body.requested_country_code || "IN").toUpperCase();
      let countryAllowed = true;
      let countryMessage = "";

      if (requestedCountry !== "IN") {
        if (gpsCountry !== requestedCountry) {
          countryAllowed = false;
          countryMessage = "Non-India country only allowed when your real GPS (not VPN) shows you are outside India.";
        }
        if (vpnSuspected) {
          countryAllowed = false;
          countryMessage = "VPN/proxy detected — country selection blocked. Disable VPN and retry.";
        }
      }

      return json({
        gps_country: gpsCountry,
        ip_country: ipC,
        vpn_suspected: vpnSuspected,
        country_allowed: countryAllowed,
        message: countryMessage,
        default_country: "IN",
      });
    }

    if (action === "update-location") {
      const mobile = normalizeMobile(String(body.phone || body.mobile || ""));
      const profileId = String(body.profile_id || "").trim();
      const lat = Number(body.lat);
      const lng = Number(body.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return json({ error: "lat/lng required" }, 400);
      }

      let vendor: { id: string; phone: string; profile_id: string | null; status: string } | null = null;
      if (profileId) {
        const { data } = await supabase
          .from("vendor_partners")
          .select("id, phone, profile_id, status")
          .eq("profile_id", profileId)
          .maybeSingle();
        vendor = data;
      }
      if (!vendor && mobile) {
        const { data } = await supabase
          .from("vendor_partners")
          .select("id, phone, profile_id, status")
          .eq("phone", mobile)
          .maybeSingle();
        vendor = data;
      }
      if (!vendor) return json({ error: "Partner not found — complete registration first" }, 404);
      if (vendor.status === "offboarded") return json({ error: "Partner offboarded" }, 403);

      if (profileId && vendor.profile_id && vendor.profile_id !== profileId) {
        return json({ error: "Unauthorized" }, 401);
      }
      if (!profileId || !vendor.profile_id) {
        const otpCheck = await assertRecentOtpVerified(supabase, vendor.phone);
        if (!otpCheck.ok) return json({ error: otpCheck.error || "Verify OTP to share location" }, 401);
      }

      const now = new Date().toISOString();
      // Keep address_* in sync with live GPS so find_nearest_vendors dispatch matches portal map
      const { error } = await supabase
        .from("vendor_partners")
        .update({
          gps_lat: lat,
          gps_lng: lng,
          address_lat: lat,
          address_lng: lng,
          updated_at: now,
        })
        .eq("id", vendor.id);
      if (error) throw error;

      const pid = vendor.profile_id || profileId;
      if (pid) {
        await supabase.from("profiles").update({ last_lat: lat, last_lng: lng }).eq("id", pid);
      }

      await recordGpsHistory(supabase, vendor.id, lat, lng, body.accuracy_m != null ? Number(body.accuracy_m) : null);

      return json({ success: true, vendor_id: vendor.id, lat, lng });
    }

    if (action === "photo-upload-url") {
      const mobile = normalizeMobile(String(body.phone || body.mobile || ""));
      if (!mobile) return json({ error: "Valid phone required" }, 400);
      const otpCheck = await assertRecentOtpVerified(supabase, mobile);
      if (!otpCheck.ok) return json({ error: otpCheck.error }, 400);
      const contentType = String(body.content_type || "image/jpeg");
      const result = await signedPhotoUploadUrl(supabase, mobile, contentType);
      if (!result.ok) return json({ error: result.error }, 400);
      return json({
        signed_url: result.signed_url,
        path: result.path,
        token: result.token,
      });
    }

    if (action === "photo-view-url") {
      if (!vendorAdminAuthorized(req)) return json({ error: "Unauthorized" }, 401);
      const vendorId = String(body.vendor_id || "");
      if (!vendorId) return json({ error: "vendor_id required" }, 400);
      const { data: vendor } = await supabase
        .from("vendor_partners")
        .select("photo_path")
        .eq("id", vendorId)
        .maybeSingle();
      if (!vendor?.photo_path) return json({ error: "No photo on file" }, 404);
      const { data, error } = await supabase.storage
        .from(VENDOR_PHOTO_BUCKET)
        .createSignedUrl(vendor.photo_path, 3600);
      if (error || !data?.signedUrl) return json({ error: error?.message || "Could not load photo" }, 500);
      return json({ signed_url: data.signedUrl, expires_in: 3600 });
    }

    if (action === "gps-history") {
      if (!vendorAdminAuthorized(req)) return json({ error: "Unauthorized" }, 401);
      const vendorId = String(body.vendor_id || "");
      if (!vendorId) return json({ error: "vendor_id required" }, 400);
      const limit = Math.min(Math.max(Number(body.limit) || 50, 1), 200);
      const { data, error } = await supabase
        .from("vendor_gps_history")
        .select("id, lat, lng, accuracy_m, source, recorded_at")
        .eq("vendor_id", vendorId)
        .order("recorded_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return json({ history: data || [], count: data?.length || 0 });
    }

    if (action === "update-services") {
      const mobile = normalizeMobile(String(body.phone || body.mobile || ""));
      if (!mobile) return json({ error: "Valid phone required" }, 400);

      const otpCheck = await assertRecentOtpVerified(supabase, mobile);
      if (!otpCheck.ok) return json({ error: otpCheck.error }, 400);

      const { data: partner } = await supabase
        .from("vendor_partners")
        .select("id, status, business_name")
        .eq("phone", mobile)
        .maybeSingle();
      if (!partner) return json({ error: "No partner account for this mobile" }, 404);
      if (partner.status === "offboarded" || partner.status === "paused") {
        return json({ error: "Partner account is not active — contact ScanV support" }, 403);
      }
      if (partner.status !== "active" && partner.status !== "pending") {
        return json({ error: `Cannot update services while status is ${partner.status}` }, 403);
      }

      const services: Array<{ service_id: string; category_id: string }> =
        Array.isArray(body.services) ? body.services : [];
      if (!services.length) return json({ error: "Select at least one service" }, 400);

      await upsertPartnerServices(supabase, partner.id, services, true);

      return json({
        success: true,
        vendor_id: partner.id,
        status: partner.status,
        message: partner.status === "active"
          ? `Services updated for ${partner.business_name}. Your service list is now live.`
          : `Services saved for ${partner.business_name}. Pending ScanV activation.`,
      });
    }

    if (action === "register") {
      const mobile = normalizeMobile(String(body.phone || body.mobile || ""));
      if (!mobile) return json({ error: "Valid phone required" }, 400);

      const otpCheck = await assertRecentOtpVerified(supabase, mobile);
      if (!otpCheck.ok) return json({ error: otpCheck.error }, 400);

      const lat = Number(body.gps_lat || body.address_lat);
      const lng = Number(body.gps_lng || body.address_lng);
      const gpsCheck = lat && lng
        ? await (async () => {
          const gpsCountry = await geoCountryFromLatLng(lat, lng);
          const ipC = await ipCountry(String(body.ip || ""));
          return { gpsCountry, ipC, vpn: !!(gpsCountry && ipC && gpsCountry !== ipC) };
        })()
        : { gpsCountry: null, ipC: null, vpn: false };

      const countryCode = String(body.country_code || "IN").toUpperCase();
      if (countryCode !== "IN") {
        if (gpsCheck.vpn || gpsCheck.gpsCountry !== countryCode) {
          return json({ error: "Country selection not allowed — GPS must match and VPN disabled" }, 400);
        }
      }

      const pan = body.pan_number ? String(body.pan_number).trim().toUpperCase() : null;
      if (pan && !validatePan(pan)) return json({ error: "Invalid PAN format" }, 400);

      const contactName = String(body.contact_name || "");
      const profileFields = vendorProfileFields(body);
      const aadhaarResult = await resolveAadhaarForRegister(supabase, body, profileFields.contact_name || contactName);
      if (!aadhaarResult.ok) return json({ error: aadhaarResult.error }, 400);

      if (!profileFields.app_installed_confirmed || !profileFields.gps_allowed_confirmed) {
        return json({ error: "Confirm ScanV app installation and GPS permission before submitting" }, 400);
      }

      const vendorPayload = {
        business_name: String(body.business_name || "").trim(),
        contact_name: profileFields.contact_name.trim(),
        first_name: profileFields.first_name,
        last_name: profileFields.last_name,
        phone: mobile,
        mobile2: profileFields.mobile2,
        phone_verified: true,
        email: body.email ? String(body.email).trim() : null,
        pan_number: pan,
        pan_verified: !!pan && !!body.pan_verified,
        aadhaar_last4: aadhaarResult.last4,
        aadhaar_verified: true,
        aadhaar_ekyc_ref: aadhaarResult.ref,
        shop_or_flat: String(body.shop_or_flat || "").trim(),
        building_name: body.building_name ? String(body.building_name).trim() : null,
        street_name: String(body.street_name || "").trim(),
        village: body.village ? String(body.village).trim() : null,
        city: String(body.city || "").trim(),
        pincode: String(body.pincode || "").trim(),
        state: String(body.state || "").trim(),
        country: String(body.country || "India"),
        country_code: countryCode,
        address_lat: lat || null,
        address_lng: lng || null,
        gps_lat: lat || null,
        gps_lng: lng || null,
        gps_country: gpsCheck.gpsCountry,
        ip_country: gpsCheck.ipC,
        is_vpn_suspected: gpsCheck.vpn,
        vehicle_number: body.vehicle_number ? String(body.vehicle_number).trim().toUpperCase() : null,
        vehicle_type: profileFields.vehicle_type,
        license_number: profileFields.license_number,
        photo_path: profileFields.photo_path,
        highest_education: profileFields.highest_education,
        app_installed_confirmed: profileFields.app_installed_confirmed,
        gps_allowed_confirmed: profileFields.gps_allowed_confirmed,
        status: "pending",
      };

      if (!vendorPayload.business_name || !vendorPayload.contact_name ||
          !vendorPayload.shop_or_flat || !vendorPayload.street_name ||
          !vendorPayload.city || !vendorPayload.pincode || !vendorPayload.state) {
        return json({ error: "Complete all required address fields" }, 400);
      }

      const { data: existing } = await supabase
        .from("vendor_partners")
        .select("id, status")
        .eq("phone", mobile)
        .maybeSingle();

      let vendorId: string;
      if (existing) {
        if (existing.status === "offboarded") {
          const { data: updated, error } = await supabase
            .from("vendor_partners")
            .update({ ...vendorPayload, status: "pending", offboarded_at: null })
            .eq("id", existing.id)
            .select("id")
            .single();
          if (error) throw error;
          vendorId = updated.id;
        } else if (existing.status === "active" || existing.status === "pending" || existing.status === "paused") {
          return json({
            error: "Phone already registered — use Add Services after OTP instead of full registration",
            code: "ALREADY_REGISTERED",
            can_add_services: existing.status !== "paused",
          }, 409);
        } else {
          return json({ error: "Phone already registered as partner" }, 409);
        }
      } else {
        const { data: inserted, error } = await supabase
          .from("vendor_partners")
          .insert(vendorPayload)
          .select("id")
          .single();
        if (error) throw error;
        vendorId = inserted.id;
      }

      const services: Array<{ service_id: string; category_id: string }> =
        Array.isArray(body.services) ? body.services : [];
      if (services.length) {
        await upsertPartnerServices(supabase, vendorId, services, true);
      }

      if (lat && lng) {
        await recordGpsHistory(supabase, vendorId, lat, lng);
      }

      return json({
        success: true,
        vendor_id: vendorId,
        status: "pending",
        message: "Registration submitted — ScanV will activate your partner account shortly.",
      });
    }

    if (action === "whoami") {
      const role = resolveVendorAdminRole(req);
      if (!role) return json({ error: "Unauthorized" }, 401);
      return json({
        role,
        can_edit: role === "admin",
        read_only: role === "readonly",
      });
    }

    if (action === "update") {
      if (!vendorAdminCanWrite(req)) {
        return json({ error: "Admin PIN required — support agents have read-only access" }, 403);
      }

      const vendorId = String(body.vendor_id || "").trim();
      if (!vendorId) return json({ error: "vendor_id required" }, 400);

      const { data: existing } = await supabase
        .from("vendor_partners")
        .select("id, first_name, last_name")
        .eq("id", vendorId)
        .maybeSingle();
      if (!existing) return json({ error: "Vendor not found" }, 404);

      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      const strFields = [
        "first_name", "last_name", "business_name", "email", "mobile2",
        "pan_number", "shop_or_flat", "building_name", "street_name", "village",
        "city", "pincode", "state", "country", "vehicle_number", "license_number",
        "highest_education", "notes",
      ] as const;
      for (const k of strFields) {
        if (body[k] !== undefined) {
          patch[k] = body[k] ? String(body[k]).trim() : null;
        }
      }
      if (body.phone !== undefined) {
        const mob = normalizeMobile(String(body.phone));
        if (!mob) return json({ error: "Invalid phone" }, 400);
        patch.phone = mob;
      }
      if (body.vehicle_type !== undefined) {
        const vt = String(body.vehicle_type || "").trim();
        patch.vehicle_type = vt === "2W" || vt === "4W" ? vt : null;
      }
      if (body.pan_number !== undefined && patch.pan_number) {
        patch.pan_number = String(patch.pan_number).trim().toUpperCase();
      }
      if (body.app_installed_confirmed !== undefined) {
        patch.app_installed_confirmed = !!body.app_installed_confirmed;
      }
      if (body.gps_allowed_confirmed !== undefined) {
        patch.gps_allowed_confirmed = !!body.gps_allowed_confirmed;
      }

      const fn = String(patch.first_name ?? existing.first_name ?? "").trim();
      const ln = String(patch.last_name ?? existing.last_name ?? "").trim();
      if (body.first_name !== undefined || body.last_name !== undefined) {
        patch.contact_name = `${fn} ${ln}`.trim() || fn || ln;
      }

      const { data: updated, error } = await supabase
        .from("vendor_partners")
        .update(patch)
        .eq("id", vendorId)
        .select("*, vendor_partner_services(service_id, category_id, is_active)")
        .single();
      if (error) throw error;

      if (Array.isArray(body.services)) {
        const services = (body.services as Array<{ service_id?: string; category_id?: string }>)
          .filter((s) => s?.service_id && s?.category_id)
          .map((s) => ({
            service_id: String(s.service_id),
            category_id: String(s.category_id),
          }));
        if (services.length) {
          await upsertPartnerServices(supabase, vendorId, services, true);
        }
      }

      return json({ success: true, vendor: updated });
    }

    if (action === "list") {
      if (!vendorAdminAuthorized(req)) return json({ error: "Unauthorized" }, 401);

      const statusFilter = body.status ? String(body.status).toLowerCase() : "";
      const search = String(body.search || body.q || "").trim().toLowerCase();
      const city = String(body.city || "").trim().toLowerCase();
      const serviceId = String(body.service_id || "").trim();
      const categoryId = String(body.category_id || "").trim();

      let query = supabase
        .from("vendor_partners")
        .select("*, vendor_partner_services(service_id, category_id, is_active)")
        .order("created_at", { ascending: false });

      if (statusFilter && statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      if (city) {
        query = query.ilike("city", `%${city}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      let vendors = data || [];
      if (search) {
        vendors = vendors.filter((v) => {
          const hay = [
            v.business_name,
            v.contact_name,
            v.first_name,
            v.last_name,
            v.phone,
            v.mobile2,
            v.email,
            v.city,
            v.village,
            v.street_name,
            v.pincode,
            v.state,
            v.vehicle_number,
            v.license_number,
            v.highest_education,
            v.pan_number,
            v.aadhaar_last4,
          ].filter(Boolean).join(" ").toLowerCase();
          return hay.includes(search);
        });
      }
      if (serviceId) {
        vendors = vendors.filter((v) =>
          (v.vendor_partner_services || []).some(
            (s: { service_id: string; is_active: boolean }) =>
              s.is_active && s.service_id === serviceId,
          ),
        );
      }
      if (categoryId) {
        vendors = vendors.filter((v) =>
          (v.vendor_partner_services || []).some(
            (s: { category_id: string; is_active: boolean }) =>
              s.is_active && s.category_id === categoryId,
          ),
        );
      }

      return json({ vendors, count: vendors.length });
    }

    if (action === "offboard") {
      if (!adminPinOk(req)) return json({ error: "Unauthorized" }, 401);
      const vendorId = String(body.vendor_id || "");
      if (!vendorId) return json({ error: "vendor_id required" }, 400);
      const { error } = await supabase
        .from("vendor_partners")
        .update({ status: "offboarded", offboarded_at: new Date().toISOString() })
        .eq("id", vendorId);
      if (error) throw error;
      await supabase
        .from("vendor_partner_services")
        .update({ is_active: false })
        .eq("vendor_id", vendorId);
      return json({ success: true, status: "offboarded" });
    }

    if (action === "activate") {
      if (!adminPinOk(req)) return json({ error: "Unauthorized" }, 401);
      const vendorId = String(body.vendor_id || "");
      if (!vendorId) return json({ error: "vendor_id required" }, 400);

      const { data: vendor } = await supabase
        .from("vendor_partners")
        .select("*")
        .eq("id", vendorId)
        .single();
      if (!vendor) return json({ error: "Vendor not found" }, 404);
      if (vendor.status === "offboarded") {
        return json({ error: "Offboarded partner must re-register via onboarding before activation" }, 400);
      }

      const profileId = vendor.profile_id || await ensurePartnerProfile(supabase, vendor);

      const { error } = await supabase
        .from("vendor_partners")
        .update({
          status: "active",
          onboarded_at: vendor.onboarded_at || new Date().toISOString(),
          offboarded_at: null,
          profile_id: profileId,
          phone_verified: true,
        })
        .eq("id", vendorId);
      if (error) throw error;

      await supabase
        .from("vendor_partner_services")
        .update({ is_active: true })
        .eq("vendor_id", vendorId);

      return json({ success: true, status: "active", profile_id: profileId });
    }

    if (action === "pause") {
      if (!adminPinOk(req)) return json({ error: "Unauthorized" }, 401);
      const vendorId = String(body.vendor_id || "");
      if (!vendorId) return json({ error: "vendor_id required" }, 400);
      const { error } = await supabase
        .from("vendor_partners")
        .update({ status: "paused" })
        .eq("id", vendorId)
        .eq("status", "active");
      if (error) throw error;
      return json({ success: true, status: "paused" });
    }

    if (action === "unpause") {
      if (!adminPinOk(req)) return json({ error: "Unauthorized" }, 401);
      const vendorId = String(body.vendor_id || "");
      if (!vendorId) return json({ error: "vendor_id required" }, 400);

      const { data: vendor } = await supabase
        .from("vendor_partners")
        .select("*")
        .eq("id", vendorId)
        .single();
      if (!vendor) return json({ error: "Vendor not found" }, 404);
      if (vendor.status !== "paused") {
        return json({ error: "Only paused partners can be unpaused" }, 400);
      }

      const profileId = vendor.profile_id || await ensurePartnerProfile(supabase, vendor);
      const { error } = await supabase
        .from("vendor_partners")
        .update({ status: "active", profile_id: profileId })
        .eq("id", vendorId);
      if (error) throw error;
      return json({ success: true, status: "active", profile_id: profileId });
    }

    if (action === "delete") {
      if (!adminPinOk(req)) return json({ error: "Unauthorized" }, 401);
      const vendorId = String(body.vendor_id || "");
      if (!vendorId) return json({ error: "vendor_id required" }, 400);

      const { data: vendor } = await supabase
        .from("vendor_partners")
        .select("id, status")
        .eq("id", vendorId)
        .maybeSingle();
      if (!vendor) return json({ error: "Vendor not found" }, 404);

      const { count: attemptCount } = await supabase
        .from("booking_dispatch_attempts")
        .select("id", { count: "exact", head: true })
        .eq("vendor_id", vendorId);
      if ((attemptCount ?? 0) > 0) {
        return json({ error: "Cannot delete — vendor has dispatch history. Offboard instead." }, 400);
      }

      const { count: dispatchCount } = await supabase
        .from("booking_dispatch")
        .select("id", { count: "exact", head: true })
        .eq("assigned_vendor_id", vendorId);
      if ((dispatchCount ?? 0) > 0) {
        return json({ error: "Cannot delete — vendor was assigned to bookings. Offboard instead." }, 400);
      }

      await supabase.from("vendor_partner_services").delete().eq("vendor_id", vendorId);
      const { error } = await supabase.from("vendor_partners").delete().eq("id", vendorId);
      if (error) throw error;
      return json({ success: true, deleted: true });
    }

    if (action === "enroll") {
      if (!adminPinOk(req)) return json({ error: "Unauthorized" }, 401);

      const mobile = normalizeMobile(String(body.phone || body.mobile || ""));
      if (!mobile) return json({ error: "Valid phone required" }, 400);

      const businessName = String(body.business_name || "").trim();
      const profileFields = vendorProfileFields(body);
      const contactName = profileFields.contact_name.trim();
      const shopOrFlat = String(body.shop_or_flat || "").trim();
      const streetName = String(body.street_name || "").trim();
      const city = String(body.city || "").trim();
      const pincode = String(body.pincode || "").trim();
      const state = String(body.state || "Maharashtra").trim();
      if (!businessName || !contactName || !shopOrFlat || !streetName || !city || !pincode || !state) {
        return json({ error: "business_name, contact_name, and full address are required" }, 400);
      }

      const activateNow = body.activate_immediately === true || body.activate === true;
      const lat = body.address_lat != null ? Number(body.address_lat) : null;
      const lng = body.address_lng != null ? Number(body.address_lng) : null;

      const vendorPayload = {
        business_name: businessName,
        contact_name: contactName,
        first_name: profileFields.first_name,
        last_name: profileFields.last_name,
        phone: mobile,
        mobile2: profileFields.mobile2,
        phone_verified: true,
        email: body.email ? String(body.email).trim() : null,
        shop_or_flat: shopOrFlat,
        building_name: body.building_name ? String(body.building_name).trim() : null,
        street_name: streetName,
        village: body.village ? String(body.village).trim() : null,
        city,
        pincode,
        state,
        country: String(body.country || "India"),
        country_code: String(body.country_code || "IN").toUpperCase(),
        address_lat: lat,
        address_lng: lng,
        aadhaar_verified: body.aadhaar_verified === true,
        aadhaar_last4: body.aadhaar_last4 ? String(body.aadhaar_last4) : null,
        pan_verified: body.pan_verified === true,
        pan_number: body.pan_number ? String(body.pan_number).trim().toUpperCase() : null,
        status: activateNow ? "active" : "pending",
        onboarded_at: activateNow ? new Date().toISOString() : null,
        notes: body.notes ? String(body.notes).trim() : "Admin enrolled",
        vehicle_number: body.vehicle_number ? String(body.vehicle_number).trim().toUpperCase() : null,
        vehicle_type: profileFields.vehicle_type,
        license_number: profileFields.license_number,
        photo_path: profileFields.photo_path,
        highest_education: profileFields.highest_education,
        app_installed_confirmed: profileFields.app_installed_confirmed,
        gps_allowed_confirmed: profileFields.gps_allowed_confirmed,
      };

      const { data: existing } = await supabase
        .from("vendor_partners")
        .select("id, status")
        .eq("phone", mobile)
        .maybeSingle();

      let vendorId: string;
      if (existing) {
        if (existing.status === "active" || existing.status === "pending") {
          return json({ error: "Phone already registered as partner" }, 409);
        }
        const { data: updated, error } = await supabase
          .from("vendor_partners")
          .update({ ...vendorPayload, offboarded_at: null })
          .eq("id", existing.id)
          .select("id")
          .single();
        if (error) throw error;
        vendorId = updated.id;
      } else {
        const { data: inserted, error } = await supabase
          .from("vendor_partners")
          .insert(vendorPayload)
          .select("id")
          .single();
        if (error) throw error;
        vendorId = inserted.id;
      }

      const services: Array<{ service_id: string; category_id: string }> =
        Array.isArray(body.services) ? body.services : [];
      if (services.length) {
        await upsertPartnerServices(supabase, vendorId, services, true);
      }

      let profileId: string | null = null;
      if (activateNow) {
        profileId = await ensurePartnerProfile(supabase, { ...vendorPayload, phone: mobile });
        await supabase.from("vendor_partners").update({ profile_id: profileId }).eq("id", vendorId);
      }

      return json({
        success: true,
        vendor_id: vendorId,
        status: activateNow ? "active" : "pending",
        profile_id: profileId,
        message: activateNow
          ? `${businessName} enrolled and activated`
          : `${businessName} enrolled — pending activation`,
      });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    return json({ error: msg }, 500);
  }
});
