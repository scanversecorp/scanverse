import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { executeBookingCancellation } from "./booking-cancel.ts";

function escIlike(q: string): string {
  return q.replace(/[%_\\]/g, "\\$&");
}

async function payerVpaByTxnIds(
  sb: ReturnType<typeof createClient>,
  txnIds: string[],
): Promise<Record<string, string>> {
  const ids = [...new Set(txnIds.filter(Boolean))];
  if (!ids.length) return {};

  const [{ data: intents }, { data: pays }] = await Promise.all([
    sb.from("payment_intents").select("txn_id, payer_vpa").in("txn_id", ids),
    sb.from("payments").select("txn_id, payer_vpa").in("txn_id", ids),
  ]);

  const out: Record<string, string> = {};
  for (const row of intents || []) {
    const txn = String((row as { txn_id?: string }).txn_id || "");
    const vpa = String((row as { payer_vpa?: string }).payer_vpa || "").trim();
    if (txn && vpa.includes("@")) out[txn] = vpa.toLowerCase();
  }
  for (const row of pays || []) {
    const txn = String((row as { txn_id?: string }).txn_id || "");
    const vpa = String((row as { payer_vpa?: string }).payer_vpa || "").trim();
    if (txn && vpa.includes("@") && !out[txn]) out[txn] = vpa.toLowerCase();
  }
  return out;
}

async function attachPayerVpa<T extends { txn_id?: string | null }>(
  sb: ReturnType<typeof createClient>,
  rows: T[],
): Promise<Array<T & {
  payer_vpa: string | null;
  verified_via: string | null;
  paid_amount_paise: number | null;
}>> {
  const vpaMap = await payerVpaByTxnIds(sb, rows.map((r) => String(r.txn_id || "")));
  const txnIds = [...new Set(rows.map((r) => String(r.txn_id || "")).filter(Boolean))];
  const verifiedVia: Record<string, string> = {};
  const paidAmount: Record<string, number> = {};
  if (txnIds.length) {
    const { data: intents } = await sb
      .from("payment_intents")
      .select("txn_id, verified_via, status, amount_paise")
      .in("txn_id", txnIds)
      .eq("status", "paid");
    for (const row of intents || []) {
      const txn = String((row as { txn_id?: string }).txn_id || "");
      const via = String((row as { verified_via?: string }).verified_via || "").trim();
      const amt = Number((row as { amount_paise?: number }).amount_paise);
      if (txn && via) verifiedVia[txn] = via;
      if (txn && Number.isFinite(amt)) paidAmount[txn] = amt;
    }
  }
  return rows.map((row) => ({
    ...row,
    payer_vpa: row.txn_id ? vpaMap[String(row.txn_id)] || null : null,
    verified_via: row.txn_id ? verifiedVia[String(row.txn_id)] || null : null,
    paid_amount_paise: row.txn_id ? paidAmount[String(row.txn_id)] ?? null : null,
  }));
}

async function attachCustomerPhones<T extends { customer_id?: string | null }>(
  sb: ReturnType<typeof createClient>,
  rows: T[],
): Promise<Array<T & { customer_phone: string | null }>> {
  const ids = [...new Set(rows.map((r) => String(r.customer_id || "")).filter(Boolean))];
  if (!ids.length) return rows.map((row) => ({ ...row, customer_phone: null }));

  const { data: profiles } = await sb
    .from("profiles")
    .select("id, phone")
    .in("id", ids);
  const phoneById: Record<string, string> = {};
  for (const p of profiles || []) {
    phoneById[String((p as { id: string }).id)] = String((p as { phone?: string }).phone || "");
  }
  return rows.map((row) => ({
    ...row,
    customer_phone: row.customer_id ? phoneById[String(row.customer_id)] || null : null,
  }));
}

export async function searchBookingsAdmin(
  sb: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
) {
  const q = String(body.q || "").trim();
  const status = body.status ? String(body.status) : null;
  const customerId = body.customer_id ? String(body.customer_id).trim() : null;
  const dateFrom = body.date_from ? String(body.date_from) : null;
  const dateTo = body.date_to ? String(body.date_to) : null;
  const limit = Math.min(Number(body.limit) || 50, 100);

  let query = sb
    .from("bookings")
    .select(
      "id,customer_id,service_name,service_id,date,time,status,total,txn_id,paid_at,location_text,created_at,partner_id,cancelled_at,customer_name,notes",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status && status !== "all") query = query.eq("status", status);
  if (customerId) query = query.eq("customer_id", customerId);
  if (dateFrom) query = query.gte("date", dateFrom);
  if (dateTo) query = query.lte("date", dateTo);
  if (q) {
    const like = `%${escIlike(q)}%`;
    query = query.or(
      `id.ilike.${like},customer_id.ilike.${like},service_name.ilike.${like},txn_id.ilike.${like},location_text.ilike.${like},customer_name.ilike.${like}`,
    );
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const withVpa = await attachPayerVpa(sb, data || []);
  return attachCustomerPhones(sb, withVpa);
}

export async function bookingDetailAdmin(
  sb: ReturnType<typeof createClient>,
  bookingId: string,
) {
  if (!bookingId) throw new Error("booking_id required");

  const { data: booking, error: bkErr } = await sb
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .maybeSingle();
  if (bkErr) throw new Error(bkErr.message);
  if (!booking) throw new Error("Booking not found");

  const [
    { data: customer },
    { data: dispatch },
    { data: cancellation },
    { data: live },
  ] = await Promise.all([
    sb.from("profiles")
      .select("id, first_name, last_name, name, phone, email, city")
      .eq("id", booking.customer_id)
      .maybeSingle(),
    sb.from("booking_dispatch")
      .select("*, booking_dispatch_attempts(*)")
      .eq("booking_id", bookingId)
      .maybeSingle(),
    sb.from("booking_cancellations")
      .select("*")
      .eq("booking_id", bookingId)
      .maybeSingle(),
    sb.from("vendor_live_locations")
      .select("*")
      .eq("booking_id", bookingId)
      .maybeSingle(),
  ]);

  let partner = null;
  if (booking.partner_id) {
    const { data: prof } = await sb
      .from("profiles")
      .select("id, first_name, last_name, name, phone")
      .eq("id", booking.partner_id)
      .maybeSingle();
    partner = prof;
  }

  const txnId = booking.txn_id ? String(booking.txn_id) : "";
  const [{ data: paymentIntents }, { data: payments }] = txnId
    ? await Promise.all([
      sb.from("payment_intents")
        .select("id, txn_id, status, amount_paise, payer_vpa, verified_via, paid_at, razorpay_payment_id")
        .eq("txn_id", txnId)
        .order("created_at", { ascending: false }),
      sb.from("payments")
        .select("id, txn_id, amount, status, method, gateway, payer_vpa, created_at")
        .eq("txn_id", txnId)
        .order("created_at", { ascending: false }),
    ])
    : [{ data: [] }, { data: [] }];

  const vpaMap = txnId ? await payerVpaByTxnIds(sb, [txnId]) : {};
  const payer_vpa = txnId ? vpaMap[txnId] || null : null;

  return {
    booking: { ...booking, payer_vpa },
    customer: customer || null,
    partner,
    dispatch: dispatch || null,
    cancellation: cancellation || null,
    live_location: live || null,
    payment_intents: paymentIntents || [],
    payments: payments || [],
    payer_vpa,
  };
}

const BOOKING_PATCH_FIELDS = [
  "status",
  "notes",
  "partner_id",
  "date",
  "time",
  "location_text",
  "customer_lat",
  "customer_lng",
] as const;

const BOOKING_STATUSES = new Set([
  "pending",
  "confirmed",
  "in_progress",
  "in-progress",
  "completed",
  "cancelled",
  "disputed",
]);

export async function updateBookingAdmin(
  sb: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
) {
  const bookingId = String(body.booking_id || "").trim();
  if (!bookingId) throw new Error("booking_id required");

  const patch = body.patch as Record<string, unknown> | undefined;
  if (!patch || typeof patch !== "object") {
    throw new Error("patch object required");
  }

  const row: Record<string, unknown> = {};
  for (const k of BOOKING_PATCH_FIELDS) {
    if (patch[k] !== undefined) row[k] = patch[k];
  }
  if (!Object.keys(row).length) {
    throw new Error("No valid fields to update");
  }
  if (row.status != null && !BOOKING_STATUSES.has(String(row.status))) {
    throw new Error("Invalid booking status");
  }
  if (row.partner_id === "") row.partner_id = null;

  const { data, error } = await sb
    .from("bookings")
    .update(row)
    .eq("id", bookingId)
    .select()
    .single();
  if (error) throw new Error(error.message);

  const dispatchPatch: Record<string, unknown> = {};
  if (row.location_text !== undefined) {
    dispatchPatch.customer_location = row.location_text;
  }
  if (row.date !== undefined) dispatchPatch.scheduled_date = row.date;
  if (row.time !== undefined) dispatchPatch.scheduled_time = row.time;
  if (row.customer_lat !== undefined) dispatchPatch.customer_lat = row.customer_lat;
  if (row.customer_lng !== undefined) dispatchPatch.customer_lng = row.customer_lng;

  if (Object.keys(dispatchPatch).length) {
    await sb.from("booking_dispatch").update({
      ...dispatchPatch,
      updated_at: new Date().toISOString(),
    }).eq("booking_id", bookingId);
  }

  if (row.partner_id !== undefined) {
    const partnerId = row.partner_id ? String(row.partner_id) : null;
    if (partnerId) {
      const { data: vendor } = await sb
        .from("vendor_partners")
        .select("id, profile_id, status")
        .or(`profile_id.eq.${partnerId},id.eq.${partnerId}`)
        .maybeSingle();
      if (vendor?.id && vendor.status === "active") {
        const now = new Date().toISOString();
        await sb.from("booking_dispatch").update({
          status: "assigned",
          assigned_vendor_id: vendor.id,
          assigned_at: now,
          accepted_at: now,
          next_action_at: null,
          updated_at: now,
        }).eq("booking_id", bookingId);
      }
    }
  }

  return data;
}

export async function cancelBookingAdmin(
  sb: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
  cancelledBy: string,
) {
  const bookingId = String(body.booking_id || "").trim();
  if (!bookingId) throw new Error("booking_id required");

  const cancelReason = body.cancel_reason
    ? String(body.cancel_reason).trim()
    : "support_cancelled";

  const result = await executeBookingCancellation(sb, {
    bookingId,
    cancelledBy,
    cancelReason,
  });

  if (!result.success) {
    throw new Error(result.error || "Cancellation failed");
  }

  const bd = result.breakdown!;
  return {
    success: true,
    already_cancelled: result.already_cancelled || false,
    booking_id: bookingId,
    breakdown: {
      total_paid_paise: bd.totalPaidPaise,
      cancel_fee_paise: bd.cancelFeePaise,
      cancel_fee_gst_paise: bd.cancelFeeGstPaise,
      cancel_fee_platform_paise: bd.cancelFeePlatformPaise,
      refund_paise: bd.refundPaise,
    },
    refund_status: result.refund_status,
    refund_due_by: result.refund_due_by,
  };
}
