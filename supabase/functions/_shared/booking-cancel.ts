import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export const CANCEL_FEE_GST_PCT = 0.18;
export const CANCEL_FEE_PLATFORM_PCT = 0.12;
export const CANCELLABLE_STATUSES = new Set([
  "confirmed",
  "in_progress",
  "in-progress",
]);

export type CancellationBreakdown = {
  totalPaidPaise: number;
  cancelFeePaise: number;
  cancelFeeGstPaise: number;
  cancelFeePlatformPaise: number;
  refundPaise: number;
};

export function calcCancellationBreakdown(
  totalPaidPaise: number,
): CancellationBreakdown {
  const totalPaid = Math.max(0, Math.round(Number(totalPaidPaise) || 0));
  const cancelFeeGstPaise = Math.round(totalPaid * CANCEL_FEE_GST_PCT);
  const cancelFeePlatformPaise = Math.round(totalPaid * CANCEL_FEE_PLATFORM_PCT);
  const cancelFeePaise = cancelFeeGstPaise + cancelFeePlatformPaise;
  const refundPaise = Math.max(0, totalPaid - cancelFeePaise);
  return {
    totalPaidPaise: totalPaid,
    cancelFeePaise,
    cancelFeeGstPaise,
    cancelFeePlatformPaise,
    refundPaise,
  };
}

export function addBusinessDays(from: Date, days: number): Date {
  const d = new Date(from);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return d;
}

/** Stop dispatch, partner alerts, GPS, and linked service requests immediately. */
export async function stopBookingSideEffects(
  supabase: ReturnType<typeof createClient>,
  bookingId: string,
  txnId?: string | null,
): Promise<void> {
  const now = new Date().toISOString();

  const { data: dispatches } = await supabase
    .from("booking_dispatch")
    .select("id")
    .eq("booking_id", bookingId);

  const dispatchIds = (dispatches || []).map((d: { id: string }) => d.id);

  if (dispatchIds.length) {
    await supabase
      .from("booking_dispatch")
      .update({ status: "cancelled", next_action_at: null })
      .in("id", dispatchIds)
      .in("status", ["pending", "dispatching"]);

    await supabase
      .from("booking_dispatch_attempts")
      .update({ status: "cancelled", completed_at: now })
      .in("dispatch_id", dispatchIds)
      .in("status", ["offered", "pending", "sent", "ringing"]);
  }

  await supabase
    .from("vendor_live_locations")
    .update({ tracking_active: false })
    .eq("booking_id", bookingId);

  if (txnId) {
    await supabase
      .from("service_requests")
      .update({ status: "cancelled" })
      .eq("txn_id", txnId);
  }
}

export type ExecuteCancelResult = {
  success: boolean;
  already_cancelled?: boolean;
  booking_id: string;
  breakdown?: CancellationBreakdown;
  refund_status?: string;
  refund_due_by?: string;
  error?: string;
};

export async function executeBookingCancellation(
  supabase: ReturnType<typeof createClient>,
  opts: {
    bookingId: string;
    cancelledBy: string;
    cancelReason?: string;
    customerIdOverride?: string | null;
  },
): Promise<ExecuteCancelResult> {
  const bookingId = String(opts.bookingId || "").trim();
  if (!bookingId) {
    return { success: false, booking_id: "", error: "booking_id required" };
  }

  const { data: existingCancel } = await supabase
    .from("booking_cancellations")
    .select("*")
    .eq("booking_id", bookingId)
    .maybeSingle();

  if (existingCancel) {
    return {
      success: true,
      already_cancelled: true,
      booking_id: bookingId,
      breakdown: {
        totalPaidPaise: existingCancel.total_paid_paise,
        cancelFeePaise: existingCancel.cancel_fee_paise,
        cancelFeeGstPaise: existingCancel.cancel_fee_gst_paise,
        cancelFeePlatformPaise: existingCancel.cancel_fee_platform_paise,
        refundPaise: existingCancel.refund_paise,
      },
      refund_status: existingCancel.refund_status,
      refund_due_by: existingCancel.refund_due_by,
    };
  }

  const { data: booking, error: bkErr } = await supabase
    .from("bookings")
    .select("id, customer_id, status, total, txn_id, partner_id")
    .eq("id", bookingId)
    .maybeSingle();

  if (bkErr || !booking) {
    return { success: false, booking_id: bookingId, error: "Booking not found" };
  }

  const status = String(booking.status || "").toLowerCase();
  if (!CANCELLABLE_STATUSES.has(status)) {
    return {
      success: false,
      booking_id: bookingId,
      error: `Booking cannot be cancelled (status: ${booking.status})`,
    };
  }

  const customerId = opts.customerIdOverride || String(booking.customer_id);
  const breakdown = calcCancellationBreakdown(Number(booking.total) || 0);
  if (breakdown.totalPaidPaise <= 0) {
    return {
      success: false,
      booking_id: bookingId,
      error: "Booking has no paid amount on record",
    };
  }

  const now = new Date();
  const refundDueBy = addBusinessDays(now, 7).toISOString();
  const cancelReason = opts.cancelReason || "customer_cancelled";

  const { error: cancelInsertErr } = await supabase
    .from("booking_cancellations")
    .insert({
      booking_id: bookingId,
      customer_id: customerId,
      txn_id: booking.txn_id || null,
      total_paid_paise: breakdown.totalPaidPaise,
      cancel_fee_paise: breakdown.cancelFeePaise,
      cancel_fee_gst_paise: breakdown.cancelFeeGstPaise,
      cancel_fee_platform_paise: breakdown.cancelFeePlatformPaise,
      refund_paise: breakdown.refundPaise,
      refund_status: "refund_pending",
      refund_due_by: refundDueBy,
      cancelled_by: opts.cancelledBy,
    });

  if (cancelInsertErr) {
    console.error("booking_cancellations insert:", cancelInsertErr.message);
    return {
      success: false,
      booking_id: bookingId,
      error: "Could not record cancellation",
    };
  }

  await supabase
    .from("bookings")
    .update({
      status: "cancelled",
      cancelled_at: now.toISOString(),
      cancel_reason: cancelReason,
      partner_id: null,
    })
    .eq("id", bookingId)
    .in("status", [...CANCELLABLE_STATUSES]);

  await stopBookingSideEffects(supabase, bookingId, booking.txn_id);

  return {
    success: true,
    booking_id: bookingId,
    breakdown,
    refund_status: "refund_pending",
    refund_due_by: refundDueBy,
  };
}
