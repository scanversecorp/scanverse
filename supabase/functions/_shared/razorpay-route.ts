import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/** Platform commission on service price (before GST). Vendor receives the remainder. */
export const ROUTE_PLATFORM_PCT = 0.15;
export const ROUTE_VENDOR_PCT = 0.85;

export function calcRouteSplit(servicePricePaise: number) {
  const base = Math.max(0, Math.round(Number(servicePricePaise) || 0));
  const platform_share_paise = Math.round(base * ROUTE_PLATFORM_PCT);
  const vendor_share_paise = Math.round(base * ROUTE_VENDOR_PCT);
  return { service_price_paise: base, platform_share_paise, vendor_share_paise };
}

/** Infer service price from checkout total (10% fee + 18% GST on service+fee). */
export function inferServicePriceFromTotal(totalPaise: number): number {
  const total = Math.max(0, Math.round(Number(totalPaise) || 0));
  if (!total) return 0;
  const feePct = 0.10;
  const gstRate = 0.18;
  const denom = 1 + feePct + gstRate * (1 + feePct);
  return Math.round(total / denom);
}

function razorpayAuth(): string | null {
  const keyId = Deno.env.get("RAZORPAY_KEY_ID");
  const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
  if (!keyId || !keySecret) return null;
  return "Basic " + btoa(`${keyId}:${keySecret}`);
}

export function routeTransfersEnabled(): boolean {
  const v = (Deno.env.get("RAZORPAY_ROUTE_ENABLED") || "").toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export async function createTransferFromPayment(
  paymentId: string,
  linkedAccountId: string,
  amountPaise: number,
  notes: Record<string, string> = {},
): Promise<{ ok: boolean; transfer?: Record<string, unknown>; error?: string }> {
  const auth = razorpayAuth();
  if (!auth) return { ok: false, error: "Razorpay keys not configured" };
  if (!paymentId.startsWith("pay_")) {
    return { ok: false, error: "Invalid Razorpay payment id" };
  }
  if (!linkedAccountId.startsWith("acc_")) {
    return { ok: false, error: "Invalid linked account id (expected acc_…)" };
  }
  const amount = Math.max(1, Math.round(amountPaise));
  try {
    const res = await fetch(
      `https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}/transfers`,
      {
        method: "POST",
        headers: {
          Authorization: auth,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transfers: [{
            account: linkedAccountId,
            amount,
            currency: "INR",
            notes,
          }],
        }),
      },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = String(
        (data as { error?: { description?: string } }).error?.description ||
          JSON.stringify(data).slice(0, 200),
      );
      return { ok: false, error: msg };
    }
    const items = (data as { items?: Record<string, unknown>[] }).items || [];
    const transfer = items[0] || data;
    return { ok: true, transfer: transfer as Record<string, unknown> };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Transfer failed" };
  }
}

type TransferResult = {
  attempted: boolean;
  success: boolean;
  skipped?: boolean;
  reason?: string;
  transfer_id?: string;
  vendor_share_paise?: number;
};

/** After vendor assign: transfer 85% service share via Razorpay Route (Razorpay-captured payments only). */
export async function executeVendorRouteTransfer(
  sb: ReturnType<typeof createClient>,
  opts: { bookingId: string; vendorId: string },
): Promise<TransferResult> {
  if (!routeTransfersEnabled()) {
    return { attempted: false, success: false, skipped: true, reason: "route_disabled" };
  }

  const bookingId = String(opts.bookingId || "").trim();
  const vendorId = String(opts.vendorId || "").trim();
  if (!bookingId || !vendorId) {
    return { attempted: false, success: false, reason: "missing_ids" };
  }

  const { data: booking } = await sb
    .from("bookings")
    .select("id, txn_id, price, transfer_status")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking?.txn_id) {
    return { attempted: false, success: false, reason: "no_txn" };
  }
  if (booking.transfer_status === "processed") {
    return { attempted: false, success: true, skipped: true, reason: "already_transferred" };
  }

  const { data: vendor } = await sb
    .from("vendor_partners")
    .select("id, razorpay_linked_account_id, razorpay_route_status, business_name")
    .eq("id", vendorId)
    .maybeSingle();
  if (!vendor?.razorpay_linked_account_id) {
    return { attempted: false, success: false, skipped: true, reason: "no_linked_account" };
  }
  if (vendor.razorpay_route_status !== "activated") {
    return { attempted: false, success: false, skipped: true, reason: "route_not_activated" };
  }

  const { data: intent } = await sb
    .from("payment_intents")
    .select(
      "txn_id, status, amount_paise, service_price_paise, vendor_share_paise, platform_share_paise, razorpay_payment_id, verified_via, transfer_status",
    )
    .eq("txn_id", booking.txn_id)
    .maybeSingle();

  if (!intent || intent.status !== "paid") {
    return { attempted: false, success: false, skipped: true, reason: "not_razorpay_paid" };
  }
  const via = String(intent.verified_via || "").toLowerCase();
  if (via === "vyapar_webhook") {
    return { attempted: false, success: false, skipped: true, reason: "vyapar_payment" };
  }
  if (!intent.razorpay_payment_id) {
    return { attempted: false, success: false, skipped: true, reason: "no_razorpay_payment_id" };
  }
  if (intent.transfer_status === "processed") {
    return { attempted: false, success: true, skipped: true, reason: "already_transferred" };
  }

  let vendorShare = Number(intent.vendor_share_paise) || 0;
  if (!vendorShare) {
    const servicePrice = Number(intent.service_price_paise) ||
      Number(booking.price) ||
      inferServicePriceFromTotal(Number(intent.amount_paise));
    vendorShare = calcRouteSplit(servicePrice).vendor_share_paise;
  }
  if (vendorShare <= 0) {
    return { attempted: false, success: false, reason: "zero_vendor_share" };
  }

  const transferRes = await createTransferFromPayment(
    String(intent.razorpay_payment_id),
    String(vendor.razorpay_linked_account_id),
    vendorShare,
    {
      booking_id: bookingId,
      txn_id: String(booking.txn_id),
      vendor_id: vendorId,
    },
  );

  const now = new Date().toISOString();
  if (!transferRes.ok) {
    await sb.from("payment_intents").update({
      transfer_status: "failed",
      route_vendor_id: vendorId,
    }).eq("txn_id", booking.txn_id);
    await sb.from("bookings").update({
      transfer_status: "failed",
      route_vendor_id: vendorId,
    }).eq("id", bookingId);
    console.error("[route] transfer failed", bookingId, transferRes.error);
    return {
      attempted: true,
      success: false,
      reason: transferRes.error,
      vendor_share_paise: vendorShare,
    };
  }

  const transferId = String(transferRes.transfer?.id || "");
  const transferStatus = String(transferRes.transfer?.status || "created");

  await sb.from("payment_intents").update({
    transfer_status: transferStatus === "processed" ? "processed" : "created",
    razorpay_transfer_id: transferId || null,
    route_vendor_id: vendorId,
    vendor_share_paise: vendorShare,
  }).eq("txn_id", booking.txn_id);

  await sb.from("bookings").update({
    transfer_status: transferStatus === "processed" ? "processed" : "created",
    razorpay_transfer_id: transferId || null,
    route_vendor_id: vendorId,
  }).eq("id", bookingId);

  return {
    attempted: true,
    success: true,
    transfer_id: transferId,
    vendor_share_paise: vendorShare,
  };
}

export async function handleRouteTransferWebhook(
  sb: ReturnType<typeof createClient>,
  payload: Record<string, unknown>,
): Promise<{ updated: boolean; transfer_id?: string; status?: string }> {
  const event = String(payload.event || "");
  if (!event.startsWith("transfer.")) return { updated: false };

  const pl = payload.payload as Record<string, unknown> | undefined;
  const entity =
    (pl?.transfer as { entity?: Record<string, unknown> })?.entity ||
    (payload.transfer as Record<string, unknown>) ||
    {};
  const transferId = String(entity.id || "");
  if (!transferId) return { updated: false };

  let status = "created";
  if (event === "transfer.processed") status = "processed";
  else if (event === "transfer.failed") status = "failed";
  else if (event === "transfer.reversed") status = "reversed";

  const notes = (entity.notes || {}) as Record<string, string>;
  const txnId = notes.txn_id || null;

  let query = sb.from("payment_intents").update({
    transfer_status: status,
    razorpay_transfer_id: transferId,
  });
  if (txnId) {
    query = query.eq("txn_id", String(txnId));
  } else {
    query = query.eq("razorpay_transfer_id", transferId);
  }
  const { data } = await query.select("txn_id").maybeSingle();

  if (data?.txn_id) {
    await sb.from("bookings").update({ transfer_status: status, razorpay_transfer_id: transferId })
      .eq("txn_id", data.txn_id);
  }

  return { updated: Boolean(data), transfer_id: transferId, status };
}
