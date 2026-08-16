import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { generateAcceptCode } from "./notify.ts";
import { stopBookingSideEffects } from "./booking-cancel.ts";
import { executeVendorRouteTransfer } from "./razorpay-route.ts";
import { isVendorExcludedForService } from "./service-vendor-exclusions.ts";

function escIlike(q: string): string {
  return q.replace(/[%_\\]/g, "\\$&");
}

const DISPATCH_STATUSES = new Set([
  "pending",
  "dispatching",
  "assigned",
  "exhausted",
  "cancelled",
]);

const DISPATCH_LIST_SELECT =
  "id,booking_id,service_id,service_name,customer_lat,customer_lng,customer_location,scheduled_date,scheduled_time,status,vendor_rank,attempt_num,assigned_vendor_id,assigned_at,accepted_at,next_action_at,exhausted_at,created_at,updated_at,accept_code";

export async function searchDispatchesAdmin(
  sb: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
) {
  const q = String(body.q || "").trim();
  const status = body.status ? String(body.status) : null;
  const vendorId = body.vendor_id ? String(body.vendor_id).trim() : null;
  const dateFrom = body.date_from ? String(body.date_from) : null;
  const dateTo = body.date_to ? String(body.date_to) : null;
  const limit = Math.min(Number(body.limit) || 60, 120);

  let query = sb
    .from("booking_dispatch")
    .select(DISPATCH_LIST_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status && status !== "all") query = query.eq("status", status);
  if (vendorId) query = query.eq("assigned_vendor_id", vendorId);
  if (dateFrom) query = query.gte("scheduled_date", dateFrom);
  if (dateTo) query = query.lte("scheduled_date", dateTo);
  if (q) {
    const like = `%${escIlike(q)}%`;
    query = query.or(
      `booking_id.ilike.${like},service_name.ilike.${like},customer_location.ilike.${like},accept_code.ilike.${like}`,
    );
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = data || [];
  const bookingIds = [...new Set(rows.map((r: { booking_id: string }) => r.booking_id))];
  let bookingsById: Record<string, Record<string, unknown>> = {};
  if (bookingIds.length) {
    const { data: bookings } = await sb
      .from("bookings")
      .select("id,customer_id,customer_name,status,total,txn_id,date,time,location_text,partner_id")
      .in("id", bookingIds);
    bookingsById = Object.fromEntries((bookings || []).map((b) => [b.id, b]));
  }

  return rows.map((d: Record<string, unknown>) => ({
    ...d,
    booking: bookingsById[String(d.booking_id)] || null,
    paused: d.next_action_at == null &&
      ["pending", "dispatching"].includes(String(d.status)),
  }));
}

export async function dispatchDetailAdmin(
  sb: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
) {
  const dispatchId = String(body.dispatch_id || "").trim();
  const bookingId = String(body.booking_id || "").trim();
  if (!dispatchId && !bookingId) throw new Error("dispatch_id or booking_id required");

  let query = sb
    .from("booking_dispatch")
    .select("*, booking_dispatch_attempts(*)")
    .limit(1);
  if (dispatchId) query = query.eq("id", dispatchId);
  else query = query.eq("booking_id", bookingId);

  const { data: dispatch, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  if (!dispatch) throw new Error("Dispatch not found");

  const bkId = String(dispatch.booking_id);
  const { data: booking } = await sb.from("bookings").select("*").eq("id", bkId).maybeSingle();
  const { data: customer } = booking?.customer_id
    ? await sb
      .from("profiles")
      .select("id, first_name, last_name, name, phone, email, city")
      .eq("id", booking.customer_id)
      .maybeSingle()
    : { data: null };

  let assignedVendor = null;
  if (dispatch.assigned_vendor_id) {
    const { data: vendor } = await sb
      .from("vendor_partners")
      .select("id, business_name, contact_name, phone, city, status, profile_id")
      .eq("id", dispatch.assigned_vendor_id)
      .maybeSingle();
    assignedVendor = vendor;
  }

  let partner = null;
  if (booking?.partner_id) {
    const { data: prof } = await sb
      .from("profiles")
      .select("id, first_name, last_name, name, phone")
      .eq("id", booking.partner_id)
      .maybeSingle();
    partner = prof;
  }

  const { data: live } = await sb
    .from("vendor_live_locations")
    .select("*")
    .eq("booking_id", bkId)
    .maybeSingle();

  return {
    dispatch: {
      ...dispatch,
      paused: dispatch.next_action_at == null &&
        ["pending", "dispatching"].includes(String(dispatch.status)),
    },
    booking: booking || null,
    customer: customer || null,
    partner,
    assigned_vendor: assignedVendor,
    live_location: live || null,
  };
}

const DISPATCH_PATCH_FIELDS = [
  "customer_location",
  "customer_lat",
  "customer_lng",
  "scheduled_date",
  "scheduled_time",
  "status",
  "vendor_rank",
  "attempt_num",
] as const;

export async function updateDispatchAdmin(
  sb: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
) {
  const dispatchId = String(body.dispatch_id || "").trim();
  if (!dispatchId) throw new Error("dispatch_id required");

  const patch = body.patch as Record<string, unknown> | undefined;
  if (!patch || typeof patch !== "object") throw new Error("patch object required");

  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of DISPATCH_PATCH_FIELDS) {
    if (patch[k] !== undefined) row[k] = patch[k];
  }
  if (row.status != null && !DISPATCH_STATUSES.has(String(row.status))) {
    throw new Error("Invalid dispatch status");
  }
  if (Object.keys(row).length <= 1) throw new Error("No valid fields to update");

  const { data: dispatch, error } = await sb
    .from("booking_dispatch")
    .update(row)
    .eq("id", dispatchId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  const bookingPatch: Record<string, unknown> = {};
  if (patch.customer_location !== undefined) {
    bookingPatch.location_text = patch.customer_location;
  }
  if (patch.scheduled_date !== undefined) bookingPatch.date = patch.scheduled_date;
  if (patch.scheduled_time !== undefined) bookingPatch.time = patch.scheduled_time;
  if (patch.customer_lat !== undefined) bookingPatch.customer_lat = patch.customer_lat;
  if (patch.customer_lng !== undefined) bookingPatch.customer_lng = patch.customer_lng;

  if (Object.keys(bookingPatch).length) {
    await sb.from("bookings").update(bookingPatch).eq("id", dispatch.booking_id);
  }

  return dispatch;
}

async function assignDispatchVendor(
  sb: ReturnType<typeof createClient>,
  dispatchId: string,
  vendorId: string,
) {
  const now = new Date().toISOString();
  const { data: vendor } = await sb
    .from("vendor_partners")
    .select("id, profile_id, business_name, status")
    .eq("id", vendorId)
    .maybeSingle();
  if (!vendor || vendor.status !== "active") {
    throw new Error("Vendor not found or not active");
  }

  const { data: dispatch } = await sb
    .from("booking_dispatch")
    .select("id, booking_id, status, service_id")
    .eq("id", dispatchId)
    .maybeSingle();
  if (!dispatch) throw new Error("Dispatch not found");

  if (await isVendorExcludedForService(sb, vendorId, String(dispatch.service_id || ""))) {
    throw new Error("Vendor is excluded from dispatch for this service");
  }

  const partnerId = vendor.profile_id || vendorId;
  const { data: updated, error } = await sb
    .from("booking_dispatch")
    .update({
      status: "assigned",
      assigned_vendor_id: vendorId,
      assigned_at: now,
      accepted_at: now,
      next_action_at: null,
      updated_at: now,
    })
    .eq("id", dispatchId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  await sb.from("bookings").update({
    partner_id: partnerId,
    status: "confirmed",
  }).eq("id", dispatch.booking_id);

  await sb.from("booking_dispatch_attempts")
    .update({ status: "timeout", completed_at: now })
    .eq("dispatch_id", dispatchId)
    .in("status", ["offered", "pending", "sent", "ringing"]);

  const routeResult = await executeVendorRouteTransfer(sb, {
    bookingId: dispatch.booking_id,
    vendorId,
  });

  return { dispatch: updated, partner_id: partnerId, vendor, route_transfer: routeResult };
}

export async function dispatchControlAdmin(
  sb: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
) {
  const op = String(body.op || "").trim();
  const dispatchId = String(body.dispatch_id || "").trim();
  const bookingId = String(body.booking_id || "").trim();
  const now = new Date().toISOString();

  if (op === "create") {
    if (!bookingId) throw new Error("booking_id required");
    const { data: existing } = await sb
      .from("booking_dispatch")
      .select("id")
      .eq("booking_id", bookingId)
      .maybeSingle();
    if (existing) throw new Error("Dispatch already exists for this booking");

    const { data: booking, error: bkErr } = await sb
      .from("bookings")
      .select("*")
      .eq("id", bookingId)
      .maybeSingle();
    if (bkErr || !booking) throw new Error("Booking not found");

    const acceptCode = generateAcceptCode();
    const { data: dispatch, error } = await sb
      .from("booking_dispatch")
      .insert({
        booking_id: bookingId,
        service_id: booking.service_id || null,
        category_id: booking.service_id || "",
        service_name: booking.service_name || "Service",
        customer_lat: booking.customer_lat,
        customer_lng: booking.customer_lng,
        customer_location: booking.location_text || "",
        scheduled_date: booking.date || null,
        scheduled_time: booking.time || null,
        accept_code: acceptCode,
        status: "pending",
        vendor_rank: 1,
        attempt_num: 1,
        next_action_at: now,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { dispatch, created: true };
  }

  if (!dispatchId) throw new Error("dispatch_id required");

  const { data: dispatch } = await sb
    .from("booking_dispatch")
    .select("*")
    .eq("id", dispatchId)
    .maybeSingle();
  if (!dispatch) throw new Error("Dispatch not found");

  if (op === "pause") {
    const { data, error } = await sb
      .from("booking_dispatch")
      .update({ next_action_at: null, updated_at: now })
      .eq("id", dispatchId)
      .in("status", ["pending", "dispatching"])
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { dispatch: data, paused: true };
  }

  if (op === "resume") {
    const { data, error } = await sb
      .from("booking_dispatch")
      .update({
        next_action_at: now,
        status: dispatch.status === "pending" ? "dispatching" : dispatch.status,
        updated_at: now,
      })
      .eq("id", dispatchId)
      .in("status", ["pending", "dispatching"])
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { dispatch: data, resumed: true };
  }

  if (op === "stop") {
    await sb
      .from("booking_dispatch")
      .update({ status: "cancelled", next_action_at: null, updated_at: now })
      .eq("id", dispatchId);
    await stopBookingSideEffects(sb, String(dispatch.booking_id));
    const { data } = await sb.from("booking_dispatch").select("*").eq("id", dispatchId).single();
    return { dispatch: data, stopped: true };
  }

  if (op === "restart") {
    const acceptCode = generateAcceptCode();
    const { data, error } = await sb
      .from("booking_dispatch")
      .update({
        status: "pending",
        vendor_rank: 1,
        attempt_num: 1,
        assigned_vendor_id: null,
        assigned_at: null,
        accepted_at: null,
        exhausted_at: null,
        accept_code: acceptCode,
        next_action_at: now,
        updated_at: now,
      })
      .eq("id", dispatchId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    await sb.from("bookings").update({ partner_id: null }).eq("id", dispatch.booking_id);
    return { dispatch: data, restarted: true, accept_code: acceptCode };
  }

  if (op === "delete") {
    const force = !!body.force;
    if (!force && !["cancelled", "exhausted"].includes(String(dispatch.status))) {
      throw new Error("Stop dispatch first, or pass force:true to delete");
    }
    const { error } = await sb.from("booking_dispatch").delete().eq("id", dispatchId);
    if (error) throw new Error(error.message);
    return { deleted: true, dispatch_id: dispatchId };
  }

  if (op === "assign_vendor") {
    const vendorId = String(body.vendor_id || "").trim();
    if (!vendorId) throw new Error("vendor_id required");
    return assignDispatchVendor(sb, dispatchId, vendorId);
  }

  throw new Error("Unknown op — use create, pause, resume, stop, restart, delete, assign_vendor");
}
