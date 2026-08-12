/**
 * ScanV booking dispatch — nearest vendor match + in-app Uber-style offers
 *
 * Actions:
 *   start        — { booking_id, service_id, service_name, lat, lng, location, date, time }
 *   tick         — process due dispatches (cron or manual)
 *   respond      — partner accept/reject in app { accept_code, response: accept|reject, partner_id? }
 *   call-status  — Twilio webhook for call outcomes
 *   twiml        — Twilio voice TwiML for outbound calls
 *   inbound-sms  — SMS reply webhook (ACCEPT BK-XXXX) — optional fallback
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  corsHeaders,
  json,
  normalizeMobile,
  sendSms,
  makeOutboundCall,
  sendWhatsAppText,
  generateAcceptCode,
  bookingAcceptMessage,
  callFailedStatuses,
  geocodeAddress,
} from "../_shared/notify.ts";

const RETRY_GAP_MS = 2 * 60 * 1000; // 2 minutes between retry rounds
const OFFER_TIMEOUT_MS = 60 * 1000; // 60s per partner before moving to next nearest
const MAX_VENDORS = 3;
const MAX_ATTEMPTS_PER_VENDOR = 2;

type DispatchMode = "both" | "in_app" | "external" | "disabled";
const DISPATCH_MODES = new Set<string>(["both", "in_app", "external", "disabled"]);

async function getDispatchMode(
  supabase: ReturnType<typeof createClient>,
): Promise<DispatchMode> {
  const { data } = await supabase
    .from("platform_settings")
    .select("value")
    .eq("key", "dispatch_mode")
    .maybeSingle();
  const mode = String(data?.value || "both").toLowerCase();
  if (DISPATCH_MODES.has(mode)) return mode as DispatchMode;
  return "both";
}

function inAppOffersEnabled(mode: DispatchMode): boolean {
  return mode === "both" || mode === "in_app";
}

function externalAlertsEnabled(mode: DispatchMode): boolean {
  return mode === "both" || mode === "external";
}

/** Vendor IDs with a confirmed in-progress booking — one active job at a time until completed. */
async function getUnavailableVendorIds(
  supabase: ReturnType<typeof createClient>,
): Promise<Set<string>> {
  const { data: activeBookings } = await supabase
    .from("bookings")
    .select("partner_id")
    .eq("status", "confirmed")
    .not("partner_id", "is", null);

  if (!activeBookings?.length) return new Set();

  const partnerIds = [...new Set(
    activeBookings.map((b) => String(b.partner_id)).filter(Boolean),
  )];
  const { data: vendors } = await supabase
    .from("vendor_partners")
    .select("id, profile_id")
    .in("profile_id", partnerIds);

  return new Set((vendors || []).map((v) => String(v.id)));
}

function dispatchSecretOk(req: Request): boolean {
  const secret = Deno.env.get("DISPATCH_SECRET") || "";
  if (!secret) {
    // Fail closed in production; allow only explicit dev bypass
    return Deno.env.get("OTP_DEV_MODE") === "1" ||
      Deno.env.get("DISPATCH_OPEN") === "1";
  }
  return req.headers.get("x-dispatch-secret") === secret;
}

/** Customer/partner owns booking — used when DISPATCH_SECRET not sent from client */
async function bookingPartyAuthorized(
  supabase: ReturnType<typeof createClient>,
  supabaseUrl: string,
  req: Request,
  bookingId: string,
  body: Record<string, unknown>,
): Promise<boolean> {
  const { data: bk } = await supabase
    .from("bookings")
    .select("customer_id, partner_id")
    .eq("id", bookingId)
    .maybeSingle();
  if (!bk) return false;

  const customerId = String(body.customer_id || "").trim();
  const partnerId = String(body.partner_id || "").trim();
  if (customerId && String(bk.customer_id) === customerId) return true;
  if (partnerId && String(bk.partner_id) === partnerId) return true;

  const authHeader = req.headers.get("Authorization") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (authHeader && anonKey) {
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData } = await userClient.auth.getUser();
    const uid = authData?.user?.id;
    if (uid) {
      if (String(bk.customer_id) === String(uid)) return true;
      if (String(bk.partner_id) === String(uid)) return true;
      const email = authData?.user?.email;
      if (email) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", email)
          .maybeSingle();
        if (prof?.id) {
          if (String(bk.customer_id) === String(prof.id)) return true;
          if (String(bk.partner_id) === String(prof.id)) return true;
        }
      }
    }
  }
  return false;
}

/** Resolve active vendor from partner profile id, phone, or JWT */
async function resolveVendorFromRequest(
  supabase: ReturnType<typeof createClient>,
  supabaseUrl: string,
  req: Request,
  body: Record<string, unknown>,
): Promise<{ id: string; phone: string; profile_id: string | null } | null> {
  const profileId = String(body.partner_id || body.profile_id || "").trim();
  if (profileId) {
    const { data: v } = await supabase
      .from("vendor_partners")
      .select("id, phone, profile_id")
      .eq("profile_id", profileId)
      .eq("status", "active")
      .maybeSingle();
    if (v) return v;
  }

  const mobile = normalizeMobile(String(body.mobile || ""));
  if (mobile) {
    const { data: v } = await supabase
      .from("vendor_partners")
      .select("id, phone, profile_id")
      .eq("phone", mobile)
      .eq("status", "active")
      .maybeSingle();
    if (v) return v;
  }

  const authHeader = req.headers.get("Authorization") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (authHeader && anonKey) {
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData } = await userClient.auth.getUser();
    const email = authData?.user?.email;
    if (email) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      if (prof?.id) {
        const { data: v } = await supabase
          .from("vendor_partners")
          .select("id, phone, profile_id")
          .eq("profile_id", prof.id)
          .eq("status", "active")
          .maybeSingle();
        if (v) return v;
      }
    }
  }
  return null;
}

/** pg_cron may call tick with service role bearer (stored in Vault) */
function tickAuthOk(req: Request): boolean {
  if (dispatchSecretOk(req)) return true;
  const auth = req.headers.get("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  return !!(serviceKey && token === serviceKey);
}

function baseUrl(): string {
  return Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "") +
    "/functions/v1/booking-dispatch";
}

async function logAttempt(
  supabase: ReturnType<typeof createClient>,
  dispatchId: string,
  vendorId: string,
  attemptNum: number,
  channel: string,
  status: string,
  provider?: string,
  providerRef?: string,
  error?: string,
) {
  await supabase.from("booking_dispatch_attempts").insert({
    dispatch_id: dispatchId,
    vendor_id: vendorId,
    attempt_num: attemptNum,
    channel,
    status,
    provider: provider || null,
    provider_ref: providerRef || null,
    error_message: error || null,
    sent_at: status !== "pending" ? new Date().toISOString() : null,
    completed_at: ["accepted", "rejected", "failed", "no_answer", "timeout"].includes(status)
      ? new Date().toISOString()
      : null,
  });
}

function serviceMatchOr(serviceId: string, categoryId: string): string {
  const ids = [serviceId, categoryId].filter(Boolean);
  const uniq = [...new Set(ids)];
  return uniq.map((id) => `service_id.eq.${id},category_id.eq.${id}`).join(",");
}

type VendorQueueRow = {
  vendor_id: string;
  business_name: string;
  phone: string;
  distance_km: number;
};

type VendorQueueResult = {
  queue: VendorQueueRow[];
  rpc_error?: string;
  rpc_total?: number;
  blocked_count?: number;
};

type EmptyQueueDiagnostics = {
  reason: string;
  customer_has_gps: boolean;
  active_service_vendors: number;
  with_dispatch_coords: number;
  gps_only_vendors: number;
  unavailable_busy: number;
  blocked_in_queue: number;
  rpc_error?: string;
};

async function diagnoseEmptyVendorQueue(
  supabase: ReturnType<typeof createClient>,
  serviceId: string,
  lat: number | null,
  lng: number | null,
  categoryId = "",
  rpcError?: string,
  blockedCount = 0,
): Promise<EmptyQueueDiagnostics> {
  const matchOr = serviceMatchOr(serviceId, categoryId);
  const { data: rows } = await supabase
    .from("vendor_partner_services")
    .select("vendor_id, vendor_partners!inner(id, status, address_lat, address_lng, gps_lat, gps_lng)")
    .eq("is_active", true)
    .or(matchOr)
    .limit(200);

  const active = (rows || []).filter(
    (r: { vendor_partners: { status: string } }) => r.vendor_partners?.status === "active",
  );
  const withCoords = active.filter((r: {
    vendor_partners: {
      address_lat: number | null;
      address_lng: number | null;
      gps_lat: number | null;
      gps_lng: number | null;
    };
  }) => {
    const vp = r.vendor_partners;
    const vLat = vp.address_lat ?? vp.gps_lat;
    const vLng = vp.address_lng ?? vp.gps_lng;
    return vLat != null && vLng != null;
  });
  const gpsOnly = active.filter((r: {
    vendor_partners: {
      address_lat: number | null;
      address_lng: number | null;
      gps_lat: number | null;
      gps_lng: number | null;
    };
  }) => {
    const vp = r.vendor_partners;
    return (vp.address_lat == null || vp.address_lng == null) && vp.gps_lat != null && vp.gps_lng != null;
  });

  const unavailable = await getUnavailableVendorIds(supabase);

  let reason = "no_active_vendors_for_service";
  if (!serviceId && !categoryId) reason = "missing_service_id";
  else if (!lat || !lng) reason = "missing_customer_gps";
  else if (rpcError) reason = "rpc_error";
  else if (!active.length) reason = "no_active_vendors_for_service";
  else if (!withCoords.length) reason = "vendors_missing_gps";
  else if (blockedCount >= withCoords.length) reason = "all_candidates_busy_or_blocked";
  else reason = "no_vendors_within_range";

  return {
    reason,
    customer_has_gps: !!(lat && lng),
    active_service_vendors: active.length,
    with_dispatch_coords: withCoords.length,
    gps_only_vendors: gpsOnly.length,
    unavailable_busy: unavailable.size,
    blocked_in_queue: blockedCount,
    ...(rpcError ? { rpc_error: rpcError } : {}),
  };
}

async function getVendorQueue(
  supabase: ReturnType<typeof createClient>,
  serviceId: string,
  lat: number | null,
  lng: number | null,
  excludeIds: string[] = [],
  categoryId = "",
): Promise<VendorQueueResult> {
  const unavailable = await getUnavailableVendorIds(supabase);
  const blocked = new Set([...excludeIds, ...unavailable]);
  const matchOr = serviceMatchOr(serviceId, categoryId);
  if (!lat || !lng) {
    const { data } = await supabase
      .from("vendor_partner_services")
      .select("vendor_id, vendor_partners!inner(id, business_name, phone, status, address_lat, address_lng, gps_lat, gps_lng)")
      .eq("is_active", true)
      .or(matchOr)
      .limit(MAX_VENDORS * 4);
    const queue = (data || [])
      .filter((r: { vendor_partners: { status: string; id: string; address_lat: number | null; address_lng: number | null; gps_lat: number | null; gps_lng: number | null } }) => {
        const vp = r.vendor_partners;
        const hasCoords = (vp.address_lat ?? vp.gps_lat) != null && (vp.address_lng ?? vp.gps_lng) != null;
        return vp?.status === "active" && hasCoords && !blocked.has(String(vp.id));
      })
      .slice(0, MAX_VENDORS)
      .map((r: { vendor_id: string; vendor_partners: { business_name: string; phone: string } }) => ({
        vendor_id: r.vendor_id,
        business_name: r.vendor_partners.business_name,
        phone: r.vendor_partners.phone,
        distance_km: 999,
      }));
    return { queue };
  }

  const { data, error } = await supabase.rpc("find_nearest_vendors", {
    p_service_id: serviceId,
    p_category_id: categoryId || null,
    p_lat: lat,
    p_lng: lng,
    p_limit: MAX_VENDORS * 4,
    p_max_km: 100,
  });
  if (error) return { queue: [], rpc_error: error.message };
  const all = (data as VendorQueueRow[]) || [];
  const queue = all
    .filter((v) => !blocked.has(String(v.vendor_id)))
    .slice(0, MAX_VENDORS);
  const blockedCount = all.filter((v) => blocked.has(String(v.vendor_id))).length;
  return { queue, rpc_total: all.length, blocked_count: blockedCount };
}

async function notifyVendor(
  supabase: ReturnType<typeof createClient>,
  dispatch: Record<string, unknown>,
  vendor: { vendor_id: string; phone: string; business_name: string },
  attemptNum: number,
): Promise<{ callFailed: boolean }> {
  const msg = bookingAcceptMessage(
    String(dispatch.service_name),
    String(dispatch.scheduled_date || "ASAP"),
    String(dispatch.scheduled_time || ""),
    String(dispatch.customer_location || ""),
    String(dispatch.accept_code),
  );

  let callFailed = false;

  // 1. SMS
  const sms = await sendSms(vendor.phone, msg);
  await logAttempt(
    supabase,
    String(dispatch.id),
    vendor.vendor_id,
    attemptNum,
    "sms",
    sms.ok ? "sent" : "failed",
    sms.provider,
    sms.ref,
    sms.error,
  );

  // 2. Outbound phone call
  const twimlUrl = `${baseUrl()}?action=twiml&code=${encodeURIComponent(String(dispatch.accept_code))}`;
  const call = await makeOutboundCall(vendor.phone, twimlUrl);
  await logAttempt(
    supabase,
    String(dispatch.id),
    vendor.vendor_id,
    attemptNum,
    "call",
    call.ok ? "ringing" : "failed",
    call.provider,
    call.ref,
    call.error,
  );
  if (!call.ok) callFailed = true;

  // 3. If call failed → WhatsApp text + note for WA call
  if (callFailed || !call.ok) {
    const wa = await sendWhatsAppText(vendor.phone, msg);
    await logAttempt(
      supabase,
      String(dispatch.id),
      vendor.vendor_id,
      attemptNum,
      "whatsapp_text",
      wa.ok ? "sent" : "failed",
      wa.provider,
      undefined,
      wa.error,
    );

    // WhatsApp voice call via Twilio (same as voice if WA number configured)
    const waCallUrl = twimlUrl;
    const waCall = await makeOutboundCall(vendor.phone, waCallUrl);
    await logAttempt(
      supabase,
      String(dispatch.id),
      vendor.vendor_id,
      attemptNum,
      "whatsapp_call",
      waCall.ok ? "ringing" : "failed",
      waCall.provider,
      waCall.ref,
      waCall.error,
    );
  }

  return { callFailed: callFailed || !call.ok };
}

async function dispatchIgnore(
  query: PromiseLike<{ error?: { message?: string } | null }>,
) {
  try {
    const { error } = await query;
    if (error) console.warn("[dispatch]", error.message);
  } catch (e) {
    console.warn("[dispatch]", e instanceof Error ? e.message : e);
  }
}

async function assignVendor(
  supabase: ReturnType<typeof createClient>,
  dispatchId: string,
  bookingId: string,
  vendorId: string,
): Promise<boolean> {
  const now = new Date().toISOString();

  const { data: vendor } = await supabase
    .from("vendor_partners")
    .select("id, profile_id, business_name, contact_name, phone, status")
    .eq("id", vendorId)
    .single();

  if (!vendor || vendor.status !== "active") return false;

  const { data: bkStatus } = await supabase
    .from("bookings")
    .select("status")
    .eq("id", bookingId)
    .maybeSingle();
  if (String(bkStatus?.status || "").toLowerCase() === "cancelled") return false;

  const unavailable = await getUnavailableVendorIds(supabase);
  if (unavailable.has(String(vendorId))) {
    console.warn("[dispatch] vendor busy — active booking not completed", vendorId);
    return false;
  }

  const partnerId = vendor.profile_id || vendorId;

  const { data: claimed } = await supabase
    .from("booking_dispatch")
    .update({
      status: "assigned",
      assigned_vendor_id: vendorId,
      assigned_at: now,
      accepted_at: now,
      next_action_at: null,
    })
    .eq("id", dispatchId)
    .in("status", ["pending", "dispatching"])
    .select("id")
    .maybeSingle();

  if (!claimed) return false;

  await dispatchIgnore(
    supabase.from("bookings").update({ partner_id: partnerId, status: "confirmed" })
      .eq("id", bookingId),
  );

  await supabase.from("booking_dispatch_attempts")
    .update({ status: "accepted", completed_at: now })
    .eq("dispatch_id", dispatchId)
    .eq("vendor_id", vendorId)
    .eq("channel", "app")
    .eq("status", "offered");

  await supabase.from("booking_dispatch_attempts")
    .update({ status: "timeout", completed_at: now })
    .eq("dispatch_id", dispatchId)
    .eq("channel", "app")
    .eq("status", "offered");

  const { data: bk } = await supabase.from("bookings").select("txn_id").eq("id", bookingId).single();
  if (bk?.txn_id) {
    await dispatchIgnore(
      supabase.from("service_requests").update({ status: "assigned" }).eq("txn_id", bk.txn_id),
    );
  }

  const { data: vp } = await supabase
    .from("vendor_partners")
    .select("address_lat, address_lng, gps_lat, gps_lng")
    .eq("id", vendorId)
    .maybeSingle();
  const seedLat = vp?.address_lat ?? vp?.gps_lat;
  const seedLng = vp?.address_lng ?? vp?.gps_lng;
  if (seedLat != null && seedLng != null) {
    await dispatchIgnore(
      supabase.from("vendor_live_locations").upsert({
        booking_id: bookingId,
        vendor_id: vendorId,
        partner_id: partnerId,
        lat: seedLat,
        lng: seedLng,
        tracking_active: false,
        updated_at: now,
      }, { onConflict: "booking_id" }),
    );
  }
  return true;
}

type DispatchTickResult = {
  vendors: Array<{ vendor_id: string; business_name: string; distance_km: number }>;
  empty_diagnostics?: EmptyQueueDiagnostics;
  current_vendor_rank?: number;
  offer_mode?: string;
};

async function offerVendorInApp(
  supabase: ReturnType<typeof createClient>,
  dispatch: Record<string, unknown>,
  vendor: VendorQueueRow,
  attemptNum: number,
  mode: DispatchMode,
) {
  if (inAppOffersEnabled(mode)) {
    await logAttempt(
      supabase,
      String(dispatch.id),
      vendor.vendor_id,
      attemptNum,
      "app",
      "offered",
      "in_app",
    );
  }
  if (externalAlertsEnabled(mode)) {
    await notifyVendor(supabase, dispatch, vendor, attemptNum);
  }
}

async function markOfferEnded(
  supabase: ReturnType<typeof createClient>,
  dispatchId: string,
  vendorId: string,
  status: string,
) {
  const now = new Date().toISOString();
  await supabase.from("booking_dispatch_attempts")
    .update({ status, completed_at: now })
    .eq("dispatch_id", dispatchId)
    .eq("vendor_id", vendorId)
    .eq("channel", "app")
    .eq("status", "offered");
}

async function advanceToNextVendor(
  supabase: ReturnType<typeof createClient>,
  dispatch: Record<string, unknown>,
  queue: VendorQueueRow[],
): Promise<DispatchTickResult> {
  const vendorRank = Number(dispatch.vendor_rank || 1);
  const attemptNum = Number(dispatch.attempt_num || 1);
  const nextRank = vendorRank + 1;

  if (nextRank > Math.min(queue.length, MAX_VENDORS)) {
    if (attemptNum < MAX_ATTEMPTS_PER_VENDOR) {
      await supabase.from("booking_dispatch").update({
        vendor_rank: 1,
        attempt_num: attemptNum + 1,
        next_action_at: new Date(Date.now() + RETRY_GAP_MS).toISOString(),
      }).eq("id", dispatch.id);
      return { vendors: [], offer_mode: "retry_scheduled" };
    }
    await supabase.from("booking_dispatch").update({
      status: "exhausted",
      exhausted_at: new Date().toISOString(),
      next_action_at: null,
    }).eq("id", dispatch.id);
    return { vendors: [] };
  }

  await supabase.from("booking_dispatch").update({
    vendor_rank: nextRank,
    next_action_at: new Date().toISOString(),
  }).eq("id", dispatch.id);

  const { data: refreshed } = await supabase
    .from("booking_dispatch")
    .select("*")
    .eq("id", dispatch.id)
    .maybeSingle();
  if (refreshed) return processDispatchTick(supabase, refreshed);
  return { vendors: [] };
}

async function processDispatchTick(
  supabase: ReturnType<typeof createClient>,
  dispatch: Record<string, unknown>,
): Promise<DispatchTickResult> {
  if (
    dispatch.status === "assigned" ||
    dispatch.status === "exhausted" ||
    dispatch.status === "cancelled"
  ) {
    return { vendors: [] };
  }

  const bookingId = String(dispatch.booking_id || "");
  if (bookingId) {
    const { data: bk } = await supabase
      .from("bookings")
      .select("status")
      .eq("id", bookingId)
      .maybeSingle();
    if (String(bk?.status || "").toLowerCase() === "cancelled") {
      await supabase.from("booking_dispatch").update({
        status: "cancelled",
        next_action_at: null,
      }).eq("id", dispatch.id);
      return { vendors: [] };
    }
  }

  const dispatchMode = await getDispatchMode(supabase);
  if (dispatchMode === "disabled") {
    return { vendors: [], offer_mode: "disabled" };
  }

  const lat = dispatch.customer_lat as number | null;
  const lng = dispatch.customer_lng as number | null;
  const serviceId = String(dispatch.service_id || "");
  const categoryId = String(dispatch.category_id || "");
  const attemptNum = Number(dispatch.attempt_num || 1);
  const vendorRank = Number(dispatch.vendor_rank || 1);

  const { queue, rpc_error: rpcError, blocked_count: blockedCount = 0 } = await getVendorQueue(
    supabase, serviceId, lat, lng, [], categoryId,
  );
  const top3 = queue.slice(0, MAX_VENDORS);

  if (!top3.length) {
    const emptyDiagnostics = await diagnoseEmptyVendorQueue(
      supabase, serviceId, lat, lng, categoryId, rpcError, blockedCount,
    );
    await supabase.from("booking_dispatch").update({
      status: "exhausted",
      exhausted_at: new Date().toISOString(),
      next_action_at: null,
    }).eq("id", dispatch.id);
    console.warn("[dispatch] empty vendor queue", {
      dispatch_id: dispatch.id,
      booking_id: dispatch.booking_id,
      ...emptyDiagnostics,
    });
    return { vendors: [], empty_diagnostics: emptyDiagnostics, offer_mode: dispatchMode };
  }

  const { data: openOffer } = inAppOffersEnabled(dispatchMode)
    ? await supabase
      .from("booking_dispatch_attempts")
      .select("id, vendor_id, created_at")
      .eq("dispatch_id", dispatch.id)
      .eq("channel", "app")
      .eq("status", "offered")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    : { data: null as { id: string; vendor_id: string; created_at: string } | null };

  let externalPending: { id: string; vendor_id: string } | null = null;
  if (!openOffer && externalAlertsEnabled(dispatchMode) && !inAppOffersEnabled(dispatchMode)) {
    const currentVendor = top3[vendorRank - 1];
    if (currentVendor) {
      const { data: extAttempt } = await supabase
        .from("booking_dispatch_attempts")
        .select("id, vendor_id")
        .eq("dispatch_id", dispatch.id)
        .eq("vendor_id", currentVendor.vendor_id)
        .eq("channel", "sms")
        .eq("attempt_num", attemptNum)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      externalPending = extAttempt;
    }
  }

  const pendingOffer = openOffer || externalPending;

  const nextActionAt = dispatch.next_action_at
    ? new Date(String(dispatch.next_action_at)).getTime()
    : 0;
  if (pendingOffer && nextActionAt > 0 && Date.now() >= nextActionAt) {
    if (openOffer) {
      await markOfferEnded(supabase, String(dispatch.id), String(openOffer.vendor_id), "timeout");
    }
    return advanceToNextVendor(supabase, dispatch, top3);
  }

  if (pendingOffer) {
    const current = top3[vendorRank - 1];
    return {
      vendors: current ? [{
        vendor_id: current.vendor_id,
        business_name: current.business_name,
        distance_km: current.distance_km,
      }] : [],
      current_vendor_rank: vendorRank,
      offer_mode: `${dispatchMode}_waiting`,
    };
  }

  const idx = vendorRank - 1;
  if (idx >= top3.length) {
    return advanceToNextVendor(supabase, dispatch, top3);
  }

  const vendor = top3[idx];
  await supabase.from("booking_dispatch").update({ status: "dispatching" }).eq("id", dispatch.id);
  await offerVendorInApp(supabase, dispatch, vendor, attemptNum, dispatchMode);
  await supabase.from("booking_dispatch").update({
    next_action_at: new Date(Date.now() + OFFER_TIMEOUT_MS).toISOString(),
  }).eq("id", dispatch.id);

  return {
    vendors: [{
      vendor_id: vendor.vendor_id,
      business_name: vendor.business_name,
      distance_km: vendor.distance_km,
    }],
    current_vendor_rank: vendorRank,
    offer_mode: dispatchMode,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  let action = url.searchParams.get("action") || "";

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return json({ error: "Server misconfigured" }, 500);
    }
    const supabase = createClient(supabaseUrl, serviceKey);

    // TwiML for outbound voice — press 1 to accept
    if (action === "twiml" || url.searchParams.get("action") === "twiml") {
      const code = url.searchParams.get("code") || "BK-0000";
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Aditi">ScanV new booking. Press 1 to accept this job.</Say>
  <Gather numDigits="1" action="${baseUrl()}?action=call-accept&amp;code=${encodeURIComponent(code)}" method="POST" timeout="10">
    <Say voice="Polly.Aditi">Press 1 to accept.</Say>
  </Gather>
  <Say voice="Polly.Aditi">No response received. Goodbye.</Say>
</Response>`;
      return new Response(twiml, {
        headers: { "Content-Type": "text/xml", ...corsHeaders },
      });
    }

    const ct = req.headers.get("content-type") || "";
    let body: Record<string, unknown> = {};
    if (ct.includes("form")) {
      const form = await req.formData();
      form.forEach((v, k) => { body[k] = String(v); });
    } else {
      body = await req.json().catch(() => ({}));
    }
    if (!action) action = String(body.action || "").toLowerCase();

    // Twilio call accept (DTMF 1)
    if (action === "call-accept") {
      const digits = String(body.Digits || url.searchParams.get("Digits") || "");
      const code = String(body.code || url.searchParams.get("code") || "");
      if (digits === "1" && code) {
        const { data: disp } = await supabase
          .from("booking_dispatch")
          .select("*")
          .eq("accept_code", code.toUpperCase())
          .in("status", ["pending", "dispatching"])
          .maybeSingle();
        if (disp) {
          const { data: lastAttempt } = await supabase
            .from("booking_dispatch_attempts")
            .select("vendor_id")
            .eq("dispatch_id", disp.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (lastAttempt) {
            await assignVendor(supabase, disp.id, disp.booking_id, lastAttempt.vendor_id);
          }
        }
      }
      const twiml = digits === "1"
        ? `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Aditi">Booking accepted. Thank you.</Say></Response>`
        : `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Aditi">Invalid input. Goodbye.</Say></Response>`;
      return new Response(twiml, { headers: { "Content-Type": "text/xml", ...corsHeaders } });
    }

    // Twilio call status webhook
    if (action === "call-status" || body.CallStatus) {
      const callStatus = String(body.CallStatus || "").toLowerCase();
      const callSid = String(body.CallSid || "");
      if (callSid && callFailedStatuses().has(callStatus)) {
        await supabase
          .from("booking_dispatch_attempts")
          .update({ status: callStatus.replace("-", "_"), completed_at: new Date().toISOString() })
          .eq("provider_ref", callSid);
      }
      return json({ ok: true });
    }

    // Inbound SMS / WhatsApp accept
    if (action === "inbound-sms" || body.Body) {
      const text = String(body.Body || body.text || "").toUpperCase();
      const match = text.match(/ACCEPT\s+(BK-[A-Z0-9]{4})/);
      if (match) {
        const code = match[1];
        const from = normalizeMobile(String(body.From || body.from || ""));
        const { data: disp } = await supabase
          .from("booking_dispatch")
          .select("*")
          .eq("accept_code", code)
          .in("status", ["pending", "dispatching"])
          .maybeSingle();
        if (disp && from) {
          const { data: vendor } = await supabase
            .from("vendor_partners")
            .select("id")
            .eq("phone", from)
            .eq("status", "active")
            .maybeSingle();
          if (vendor) {
            await assignVendor(supabase, disp.id, disp.booking_id, vendor.id);
            return json({ success: true, accepted: true });
          }
        }
      }
      return json({ success: false });
    }

    if (action === "respond") {
      const code = String(body.accept_code || "").toUpperCase();
      const respAction = String(body.response || body.action_type || "accept").toLowerCase();
      const { data: disp } = await supabase
        .from("booking_dispatch")
        .select("*")
        .eq("accept_code", code)
        .in("status", ["pending", "dispatching"])
        .maybeSingle();
      if (!disp) return json({ error: "Dispatch not found or already assigned" }, 404);

      const vendor = await resolveVendorFromRequest(supabase, supabaseUrl, req, body);
      if (!vendor) return json({ error: "Partner not found or inactive" }, 404);

      const { data: openOffer } = await supabase
        .from("booking_dispatch_attempts")
        .select("id")
        .eq("dispatch_id", disp.id)
        .eq("vendor_id", vendor.id)
        .eq("channel", "app")
        .eq("status", "offered")
        .maybeSingle();
      if (!openOffer) {
        return json({ error: "No active job offer for this partner" }, 409);
      }

      if (respAction === "accept") {
        const assigned = await assignVendor(supabase, disp.id, disp.booking_id, vendor.id);
        if (!assigned) {
          return json({ error: "Job already taken or partner unavailable" }, 409);
        }
        return json({ success: true, assigned: vendor.id, booking_id: disp.booking_id });
      }

      if (respAction === "reject" || respAction === "decline") {
        await markOfferEnded(supabase, disp.id, vendor.id, "rejected");
        const lat = disp.customer_lat as number | null;
        const lng = disp.customer_lng as number | null;
        const { queue } = await getVendorQueue(
          supabase,
          String(disp.service_id || ""),
          lat,
          lng,
          [],
          String(disp.category_id || ""),
        );
        await advanceToNextVendor(supabase, disp, queue.slice(0, MAX_VENDORS));
        return json({ success: true, rejected: true });
      }

      return json({ error: "Invalid response — use accept or reject" }, 400);
    }

    if (action === "start") {
      const bookingId = String(body.booking_id || "");
      const serviceId = String(body.service_id || "");
      const serviceName = String(body.service_name || "Service");
      if (!bookingId) return json({ error: "booking_id required" }, 400);

      const dispatchModeAtStart = await getDispatchMode(supabase);
      if (dispatchModeAtStart === "disabled") {
        return json({
          success: true,
          dispatch_skipped: true,
          dispatch_mode: dispatchModeAtStart,
          message: "Partner dispatch is disabled in admin settings",
        });
      }

      if (!dispatchSecretOk(req)) {
        const authorized = await bookingPartyAuthorized(
          supabase, supabaseUrl, req, bookingId, body,
        );
        if (!authorized) return json({ error: "Unauthorized" }, 401);
      }

      const { data: existing } = await supabase
        .from("booking_dispatch")
        .select("id")
        .eq("booking_id", bookingId)
        .maybeSingle();
      if (existing) {
        const { data: full } = await supabase
          .from("booking_dispatch")
          .select("*")
          .eq("id", existing.id)
          .maybeSingle();
        if (full && !["assigned", "exhausted", "cancelled"].includes(String(full.status))) {
          const { count } = await supabase
            .from("booking_dispatch_attempts")
            .select("*", { count: "exact", head: true })
            .eq("dispatch_id", full.id);
          if (!count) {
            await processDispatchTick(supabase, full);
          }
        }
        return json({ success: true, dispatch_id: existing.id, duplicate: true, retried: true });
      }

      let custLat = body.lat != null ? Number(body.lat) : null;
      let custLng = body.lng != null ? Number(body.lng) : null;
      const customerLocation = String(body.location || "");
      if ((!custLat || !custLng) && customerLocation) {
        const geo = await geocodeAddress(customerLocation);
        if (geo) {
          custLat = geo.lat;
          custLng = geo.lng;
        }
      }
      if (custLat && custLng) {
        await dispatchIgnore(
          supabase.from("bookings").update({
            customer_lat: custLat,
            customer_lng: custLng,
          }).eq("id", bookingId),
        );
      }

      const acceptCode = generateAcceptCode();
      const { data: dispatch, error } = await supabase
        .from("booking_dispatch")
        .insert({
          booking_id: bookingId,
          service_id: serviceId,
          category_id: String(body.category_id || body.parent_id || ""),
          service_name: serviceName,
          customer_lat: custLat,
          customer_lng: custLng,
          customer_location: customerLocation,
          scheduled_date: body.date || null,
          scheduled_time: body.time || null,
          accept_code: acceptCode,
          status: "pending",
          vendor_rank: 1,
          attempt_num: 1,
          next_action_at: new Date().toISOString(),
        })
        .select("*")
        .single();
      if (error) throw error;

      // Alert nearest 3 GPS-matched partners immediately
      const dispatchRow = { ...dispatch, customer_lat: custLat, customer_lng: custLng };
      const tickResult = await processDispatchTick(supabase, dispatchRow);
      const vendorsNotified = tickResult.vendors;

      return json({
        success: true,
        dispatch_id: dispatch.id,
        accept_code: acceptCode,
        status: vendorsNotified.length ? "dispatching" : "exhausted",
        dispatch_mode: await getDispatchMode(supabase),
        customer_gps: custLat && custLng ? { lat: custLat, lng: custLng } : null,
        vendors_notified: vendorsNotified,
        nearest_count: vendorsNotified.length,
        current_vendor_rank: tickResult.current_vendor_rank,
        offer_mode: tickResult.offer_mode,
        ...(tickResult.empty_diagnostics
          ? { empty_queue: tickResult.empty_diagnostics }
          : {}),
      });
    }

    if (action === "tick") {
      if (!tickAuthOk(req)) return json({ error: "Unauthorized" }, 401);

      const { data: due } = await supabase
        .from("booking_dispatch")
        .select("*")
        .in("status", ["pending", "dispatching"])
        .lte("next_action_at", new Date().toISOString())
        .limit(20);

      let processed = 0;
      for (const d of due || []) {
        await processDispatchTick(supabase, d);
        processed++;
      }
      return json({ success: true, processed });
    }

    if (action === "status") {
      const bookingId = String(body.booking_id || url.searchParams.get("booking_id") || "");
      if (!bookingId) return json({ error: "booking_id required" }, 400);

      if (!dispatchSecretOk(req)) {
        const authorized = await bookingPartyAuthorized(
          supabase, supabaseUrl, req, bookingId, body,
        );
        if (!authorized) return json({ error: "Unauthorized" }, 401);
      }

      const { data } = await supabase
        .from("booking_dispatch")
        .select("*, booking_dispatch_attempts(*), vendor_partners:business_name")
        .eq("booking_id", bookingId)
        .maybeSingle();
      return json({ dispatch: data });
    }

    return json({ error: "Unknown action. Use start, tick, respond, twiml, call-status, inbound-sms." }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    return json({ error: msg }, 500);
  }
});
