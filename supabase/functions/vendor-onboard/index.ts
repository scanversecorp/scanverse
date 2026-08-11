/**
 * ScanV vendor onboarding edge function
 *
 * Actions:
 *   send-otp     — { mobile }
 *   verify-otp   — { mobile, otp }
 *   validate-pan — { pan }
 *   ekyc-aadhaar — { aadhaar, name?, otp? }  (Digio/Signzy when configured)
 *   check-gps    — { lat, lng, ip? }
 *   register     — full vendor payload
 *   list         — admin list (PIN header)
 *   offboard     — { vendor_id } (PIN header)
 *   activate     — { vendor_id } (PIN header)
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
  geoCountryFromLatLng,
  ipCountry,
} from "../_shared/notify.ts";

function adminPinOk(req: Request): boolean {
  const pin = req.headers.get("x-vendor-admin-pin") || "";
  const expected = Deno.env.get("VENDOR_ADMIN_PIN") || Deno.env.get("PRICING_ADMIN_PIN") || "";
  return !!expected && pin === expected;
}

async function digioEkyc(
  aadhaar: string,
  name: string,
): Promise<{ verified: boolean; ref?: string; last4?: string; error?: string }> {
  const apiKey = Deno.env.get("DIGIO_API_KEY");
  const clientId = Deno.env.get("DIGIO_CLIENT_ID");
  const clientSecret = Deno.env.get("DIGIO_CLIENT_SECRET");

  if (!apiKey && !(clientId && clientSecret)) {
    // Stub: format-only validation for dev; production requires Digio/Signzy
    if (!validateAadhaar(aadhaar)) {
      return { verified: false, error: "Invalid Aadhaar number format" };
    }
    const last4 = aadhaar.replace(/\s/g, "").slice(-4);
    if (Deno.env.get("EKYC_STRICT") === "1") {
      return { verified: false, error: "eKYC provider not configured (set DIGIO_API_KEY)" };
    }
    return { verified: true, ref: `stub-${Date.now()}`, last4 };
  }

  // Digio Aadhaar eKYC API (simplified — full flow uses redirect/OTP on Aadhaar-linked mobile)
  try {
    const auth = btoa(`${clientId}:${clientSecret}`);
    const res = await fetch("https://api.digio.in/v2/client/kyc/aadhaar/initiate", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
        ...(apiKey ? { "X-API-KEY": apiKey } : {}),
      },
      body: JSON.stringify({
        aadhaar_number: aadhaar.replace(/\s/g, ""),
        name,
        consent: true,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        verified: false,
        error: typeof data === "object" && data !== null && "message" in data
          ? String((data as { message: string }).message)
          : "eKYC failed",
      };
    }
    const last4 = aadhaar.replace(/\s/g, "").slice(-4);
    const ref = typeof data === "object" && data !== null && "id" in data
      ? String((data as { id: string }).id)
      : `digio-${Date.now()}`;
    const status = typeof data === "object" && data !== null && "status" in data
      ? String((data as { status: string }).status)
      : "pending";
    return {
      verified: status === "verified" || status === "success",
      ref,
      last4,
      ...(status === "pending" ? { error: "Complete eKYC on your Aadhaar-linked mobile" } : {}),
    };
  } catch (e) {
    return { verified: false, error: e instanceof Error ? e.message : "eKYC error" };
  }
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

      const sms = await sendSms(mobile, `ScanV Partner OTP: ${otp}. Valid 10 min.`);
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

    if (action === "validate-pan") {
      const pan = String(body.pan || "").trim().toUpperCase();
      if (!pan) return json({ valid: true, optional: true });
      if (!validatePan(pan)) return json({ valid: false, error: "Invalid PAN format (AAAAA9999A)" });

      // Optional NSDL-style check via provider
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
      const result = await digioEkyc(aadhaar, name);
      return json(result);
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

    if (action === "register") {
      const mobile = normalizeMobile(String(body.phone || body.mobile || ""));
      if (!mobile) return json({ error: "Valid phone required" }, 400);

      // Verify OTP was completed
      const { data: otpRow } = await supabase
        .from("vendor_otp")
        .select("id")
        .eq("mobile", mobile)
        .eq("purpose", "onboard")
        .eq("verified", true)
        .gt("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString())
        .limit(1)
        .maybeSingle();
      if (!otpRow) return json({ error: "Phone not verified — complete OTP first" }, 400);

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

      let aadhaarLast4: string | null = null;
      let aadhaarVerified = false;
      let aadhaarRef: string | null = null;
      if (body.aadhaar_number) {
        const ekyc = await digioEkyc(String(body.aadhaar_number), String(body.contact_name || ""));
        if (!ekyc.verified) return json({ error: ekyc.error || "Aadhaar eKYC failed" }, 400);
        aadhaarLast4 = ekyc.last4 || String(body.aadhaar_number).replace(/\s/g, "").slice(-4);
        aadhaarVerified = true;
        aadhaarRef = ekyc.ref || null;
      } else {
        return json({ error: "Aadhaar eKYC is required" }, 400);
      }

      const vendorPayload = {
        business_name: String(body.business_name || "").trim(),
        contact_name: String(body.contact_name || "").trim(),
        phone: mobile,
        phone_verified: true,
        email: body.email ? String(body.email).trim() : null,
        pan_number: pan,
        pan_verified: !!pan && !!body.pan_verified,
        aadhaar_last4: aadhaarLast4,
        aadhaar_verified: aadhaarVerified,
        aadhaar_ekyc_ref: aadhaarRef,
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

      // Service selections
      const services: Array<{ service_id: string; category_id: string }> =
        Array.isArray(body.services) ? body.services : [];
      if (services.length) {
        await supabase.from("vendor_partner_services").delete().eq("vendor_id", vendorId);
        await supabase.from("vendor_partner_services").insert(
          services.map((s) => ({
            vendor_id: vendorId,
            service_id: s.service_id,
            category_id: s.category_id,
            is_active: true,
          })),
        );
      }

      return json({
        success: true,
        vendor_id: vendorId,
        status: "pending",
        message: "Registration submitted — ScanV will activate your partner account shortly.",
      });
    }

    if (action === "list") {
      if (!adminPinOk(req)) return json({ error: "Unauthorized" }, 401);
      const { data, error } = await supabase
        .from("vendor_partners")
        .select("*, vendor_partner_services(service_id, category_id, is_active)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return json({ vendors: data });
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

      let profileId = vendor.profile_id;
      if (!profileId) {
        const syntheticEmail = `${vendor.phone.replace(/\D/g, "")}@scanv.partner`;
        const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
          email: syntheticEmail,
          phone: vendor.phone,
          email_confirm: true,
          phone_confirm: true,
          user_metadata: { role: "partner", business_name: vendor.business_name },
        });
        if (authErr && !/already/i.test(authErr.message)) {
          return json({ error: authErr.message }, 500);
        }
        profileId = authUser?.user?.id;
        if (profileId) {
          await supabase.from("profiles").upsert({
            id: profileId,
            role: "partner",
            first_name: vendor.contact_name?.split(" ")[0] || vendor.contact_name,
            last_name: vendor.contact_name?.split(" ").slice(1).join(" ") || "",
            phone: vendor.phone,
            mobile_verified: true,
            address: [vendor.shop_or_flat, vendor.street_name, vendor.city].filter(Boolean).join(", "),
            city: vendor.city,
            pincode: vendor.pincode,
            village: vendor.village,
            last_lat: vendor.address_lat,
            last_lng: vendor.address_lng,
            status: "active",
          }).catch(() => {});
          await supabase.from("vendor_partners").update({ profile_id: profileId }).eq("id", vendorId);
        }
      }

      const { error } = await supabase
        .from("vendor_partners")
        .update({
          status: "active",
          onboarded_at: new Date().toISOString(),
          offboarded_at: null,
          profile_id: profileId || vendor.profile_id,
        })
        .eq("id", vendorId);
      if (error) throw error;
      return json({ success: true, status: "active", profile_id: profileId });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    return json({ error: msg }, 500);
  }
});
