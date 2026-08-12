/**
 * ScanV booking dispatch — nearest vendor match + SMS/call/WhatsApp retries
 *
 * Actions:
 *   start        — { booking_id, service_id, service_name, lat, lng, location, date, time }
 *   tick         — process due dispatches (cron or manual)
 *   respond      — vendor accepts/rejects { accept_code, action: accept|reject, mobile? }
 *   call-status  — Twilio webhook for call outcomes
 *   twiml        — Twilio voice TwiML for outbound calls
 *   inbound-sms  — SMS reply webhook (ACCEPT BK-XXXX)
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

const RETRY_GAP_MS = 2 * 60 * 1000; // 2 minutes
const MAX_VENDORS = 3;
const MAX_ATTEMPTS_PER_VENDOR = 2;
/** Partners with an active job are excluded unless live GPS is within this distance of that job's customer */
const IN_ROUTE_ARRIVAL_M = 500;

function haversineM(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Vendor IDs blocked from new dispatch while on an active job (unless within 500m of current customer). */
async function getUnavailableVendorIds(
  supabase: ReturnType<typeof createClient>,
): Promise<Set<string>> {
  const { data: activeBookings } = await supabase
    .from("bookings")
    .select("id, partner_id, customer_lat, customer_lng")
    .eq("status", "confirmed")
    .not("partner_id", "is", null);

  if (!activeBookings?.length) return new Set();

  const partnerIds = [...new Set(
    activeBookings.map((b) => String(b.partner_id)).filter(Boolean),
  )];
  const { data: vendors } = await supabase
    .from("vendor_partners")
    .select("id, profile_id, address_lat, address_lng")
    .in("profile_id", partnerIds);

  const profileToVendor = new Map(
    (vendors || []).map((v) => [String(v.profile_id), v]),
  );

  const bookingIds = activeBookings.map((b) => b.id);
  const { data: liveLocs } = await supabase
    .from("vendor_live_locations")
    .select("booking_id, lat, lng, tracking_active")
    .in("booking_id", bookingIds);

  const liveByBooking = new Map(
    (liveLocs || []).map((l) => [String(l.booking_id), l]),
  );

  const unavailable = new Set<string>();
  for (const b of activeBookings) {
    const vendor = profileToVendor.get(String(b.partner_id));
    if (!vendor?.id) continue;

    const custLat = b.customer_lat as number | null;
    const custLng = b.customer_lng as number | null;
    if (custLat == null || custLng == null) {
      unavailable.add(String(vendor.id));
      continue;
    }

    const live = liveByBooking.get(String(b.id));
    let vLat: number | null = live?.tracking_active ? (live.lat as number) : null;
    let vLng: number | null = live?.tracking_active ? (live.lng as number) : null;
    if (vLat == null || vLng == null) {
      vLat = vendor.address_lat as number | null;
      vLng = vendor.address_lng as number | null;
    }

    if (vLat != null && vLng != null) {
      const dist = haversineM(vLat, vLng, custLat, custLng);
      if (dist <= IN_ROUTE_ARRIVAL_M) continue;
    }

    unavailable.add(String(vendor.id));
  }
  return unavailable;
}

function dispatchSecretOk(req: Request): boolean {
  const secret = Deno.env.get("DISPATCH_SECRET") || "";
  if (!secret) return true; // open if not set (dev)
  return req.headers.get("x-dispatch-secret") === secret;
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

async function getVendorQueue(
  supabase: ReturnType<typeof createClient>,
  serviceId: string,
  lat: number | null,
  lng: number | null,
  excludeIds: string[] = [],
  categoryId = "",
): Promise<Array<{ vendor_id: string; business_name: string; phone: string; distance_km: number }>> {
  const unavailable = await getUnavailableVendorIds(supabase);
  const blocked = new Set([...excludeIds, ...unavailable]);
  const matchOr = serviceMatchOr(serviceId, categoryId);
  if (!lat || !lng) {
    const { data } = await supabase
      .from("vendor_partner_services")
      .select("vendor_id, vendor_partners!inner(id, business_name, phone, status, address_lat, address_lng)")
      .eq("is_active", true)
      .or(matchOr)
      .limit(MAX_VENDORS * 4);
    return (data || [])
      .filter((r: { vendor_partners: { status: string; id: string } }) =>
        r.vendor_partners?.status === "active" && !blocked.has(String(r.vendor_partners.id))
      )
      .slice(0, MAX_VENDORS)
      .map((r: { vendor_id: string; vendor_partners: { business_name: string; phone: string } }) => ({
        vendor_id: r.vendor_id,
        business_name: r.vendor_partners.business_name,
        phone: r.vendor_partners.phone,
        distance_km: 999,
      }));
  }

  const { data, error } = await supabase.rpc("find_nearest_vendors", {
    p_service_id: serviceId,
    p_category_id: categoryId || null,
    p_lat: lat,
    p_lng: lng,
    p_limit: MAX_VENDORS * 4,
    p_max_km: 100,
  });
  if (error || !data?.length) return [];
  return (data as Array<{ vendor_id: string; business_name: string; phone: string; distance_km: number }>)
    .filter((v) => !blocked.has(String(v.vendor_id)))
    .slice(0, MAX_VENDORS);
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
) {
  const now = new Date().toISOString();

  const { data: vendor } = await supabase
    .from("vendor_partners")
    .select("id, profile_id, business_name, contact_name, phone, status")
    .eq("id", vendorId)
    .single();

  if (!vendor || vendor.status !== "active") return;

  const partnerId = vendor.profile_id || vendorId;

  await supabase.from("booking_dispatch").update({
    status: "assigned",
    assigned_vendor_id: vendorId,
    assigned_at: now,
    accepted_at: now,
    next_action_at: null,
  }).eq("id", dispatchId);

  await dispatchIgnore(
    supabase.from("bookings").update({ partner_id: partnerId, status: "confirmed" })
      .eq("id", bookingId),
  );

  const { data: bk } = await supabase.from("bookings").select("txn_id").eq("id", bookingId).single();
  if (bk?.txn_id) {
    await dispatchIgnore(
      supabase.from("service_requests").update({ status: "assigned" }).eq("txn_id", bk.txn_id),
    );
  }

  // Seed live tracking from vendor base location until partner GPS updates
  const { data: vp } = await supabase
    .from("vendor_partners")
    .select("address_lat, address_lng")
    .eq("id", vendorId)
    .maybeSingle();
  if (vp?.address_lat && vp?.address_lng) {
    await dispatchIgnore(
      supabase.from("vendor_live_locations").upsert({
        booking_id: bookingId,
        vendor_id: vendorId,
        partner_id: partnerId,
        lat: vp.address_lat,
        lng: vp.address_lng,
        tracking_active: false,
        updated_at: now,
      }, { onConflict: "booking_id" }),
    );
  }
}

async function processDispatchTick(
  supabase: ReturnType<typeof createClient>,
  dispatch: Record<string, unknown>,
): Promise<Array<{ vendor_id: string; business_name: string; distance_km: number }>> {
  if (dispatch.status === "assigned" || dispatch.status === "exhausted") return [];

  const lat = dispatch.customer_lat as number | null;
  const lng = dispatch.customer_lng as number | null;
  const serviceId = String(dispatch.service_id || "");
  const categoryId = String(dispatch.category_id || "");
  const attemptNum = Number(dispatch.attempt_num || 1);

  const queue = await getVendorQueue(supabase, serviceId, lat, lng, [], categoryId);
  const top3 = queue.slice(0, MAX_VENDORS);

  if (!top3.length) {
    await supabase.from("booking_dispatch").update({
      status: "exhausted",
      exhausted_at: new Date().toISOString(),
      next_action_at: null,
    }).eq("id", dispatch.id);
    return [];
  }

  await supabase.from("booking_dispatch").update({ status: "dispatching" }).eq("id", dispatch.id);

  // Alert nearest 3 GPS-matched partners in parallel (first accept wins)
  for (const vendor of top3) {
    await notifyVendor(supabase, dispatch, vendor, attemptNum);
  }

  if (attemptNum < MAX_ATTEMPTS_PER_VENDOR) {
    await supabase.from("booking_dispatch").update({
      attempt_num: attemptNum + 1,
      vendor_rank: MAX_VENDORS,
      next_action_at: new Date(Date.now() + RETRY_GAP_MS).toISOString(),
    }).eq("id", dispatch.id);
  } else {
    await supabase.from("booking_dispatch").update({
      status: "exhausted",
      exhausted_at: new Date().toISOString(),
      next_action_at: null,
    }).eq("id", dispatch.id);
  }

  return top3.map((v) => ({
    vendor_id: v.vendor_id,
    business_name: v.business_name,
    distance_km: v.distance_km,
  }));
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
      const mobile = normalizeMobile(String(body.mobile || ""));
      const { data: disp } = await supabase
        .from("booking_dispatch")
        .select("*")
        .eq("accept_code", code)
        .in("status", ["pending", "dispatching"])
        .maybeSingle();
      if (!disp) return json({ error: "Dispatch not found or already assigned" }, 404);

      if (respAction === "accept" && mobile) {
        const { data: vendor } = await supabase
          .from("vendor_partners")
          .select("id")
          .eq("phone", mobile)
          .eq("status", "active")
          .maybeSingle();
        if (!vendor) return json({ error: "Vendor not found" }, 404);
        await assignVendor(supabase, disp.id, disp.booking_id, vendor.id);
        return json({ success: true, assigned: vendor.id });
      }
      return json({ error: "Invalid response" }, 400);
    }

    if (action === "start") {
      const bookingId = String(body.booking_id || "");
      const serviceId = String(body.service_id || "");
      const serviceName = String(body.service_name || "Service");
      if (!bookingId) return json({ error: "booking_id required" }, 400);

      if (!dispatchSecretOk(req)) {
        const { data: owned } = await supabase
          .from("bookings")
          .select("customer_id")
          .eq("id", bookingId)
          .maybeSingle();
        if (!owned) return json({ error: "Booking not found" }, 404);

        const customerId = String(body.customer_id || "").trim();
        let authorized = customerId && String(owned.customer_id) === customerId;

        if (!authorized) {
          const authHeader = req.headers.get("Authorization") || "";
          const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
          const userClient = createClient(supabaseUrl, anonKey, {
            global: { headers: { Authorization: authHeader } },
          });
          const { data: authData } = await userClient.auth.getUser();
          const uid = authData?.user?.id;
          authorized = !!(uid && String(owned.customer_id) === String(uid));
        }

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
      const vendorsNotified = await processDispatchTick(supabase, dispatchRow);

      return json({
        success: true,
        dispatch_id: dispatch.id,
        accept_code: acceptCode,
        status: "dispatching",
        customer_gps: custLat && custLng ? { lat: custLat, lng: custLng } : null,
        vendors_notified: vendorsNotified,
        nearest_count: vendorsNotified.length,
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
