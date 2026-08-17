/**
 * Refund desk — two-line approval + optional Razorpay refund API.
 *
 * Flow:
 *   refund_pending → pending_approval (line 1)
 *   pending_approval → approved | rejected (line 2 OTP on REFUND_APPROVAL_MOBILE)
 *   approved → processing (issue_razorpay_refund or manual)
 *   processing → completed
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  generateOtp,
  hashOtp,
  normalizeMobile,
  sendOtpDelivery,
} from "./notify.ts";
import { isPlatformFlagOn } from "./platform-settings.ts";
import { otpDeliveryVendorOpts } from "./vendor-providers.ts";

export const REFUND_STATUSES = new Set([
  "refund_pending",
  "pending_approval",
  "approved",
  "processing",
  "completed",
  "rejected",
]);

export const REFUND_OPEN_STATUSES = [
  "refund_pending",
  "pending_approval",
  "approved",
  "processing",
] as const;

const REFUND_OTP_PURPOSE = "refund_second_line_approval";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json",
    },
  });
}

function razorpayAuth(): string | null {
  const keyId = Deno.env.get("RAZORPAY_KEY_ID");
  const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
  if (!keyId || !keySecret) return null;
  return "Basic " + btoa(`${keyId}:${keySecret}`);
}

function maskMobile10(mobile: string): string {
  const d = mobile.replace(/\D/g, "").slice(-10);
  return d.length === 10 ? `******${d.slice(-4)}` : "**********";
}

export async function refundApprovalMobile(
  sb: SupabaseClient,
): Promise<string | null> {
  const envRaw = Deno.env.get("REFUND_APPROVAL_MOBILE")
    || Deno.env.get("PRICING_2FA_RESET_MOBILE")
    || Deno.env.get("ADMIN_OWNER_MOBILE")
    || "";
  const fromEnv = normalizeMobile(String(envRaw).trim());
  if (fromEnv) return fromEnv;

  const { data } = await sb
    .from("platform_settings")
    .select("value")
    .eq("key", "refund_approval_mobile")
    .maybeSingle();
  return normalizeMobile(String(data?.value || "").trim());
}

export async function refundApprovalStatus(sb: SupabaseClient) {
  const mobile = await refundApprovalMobile(sb);
  return {
    approver_configured: !!mobile,
    approver_mobile_masked: mobile ? maskMobile10(mobile) : null,
  };
}

type CancelRow = Record<string, unknown>;

function allowedTransition(from: string, to: string): boolean {
  const map: Record<string, string[]> = {
    refund_pending: ["pending_approval", "rejected"],
    approved: ["processing", "rejected"],
    processing: ["completed"],
  };
  return (map[from] || []).includes(to);
}

async function enrichCancellations(
  sb: SupabaseClient,
  rows: CancelRow[],
) {
  const bookingIds = [...new Set(rows.map((r) => String(r.booking_id)))];
  const customerIds = [...new Set(rows.map((r) => String(r.customer_id)))];
  const txnIds = [...new Set(rows.map((r) => String(r.txn_id || "")).filter(Boolean))];

  const [{ data: bookings }, { data: profiles }, { data: intents }] = await Promise.all([
    bookingIds.length
      ? sb.from("bookings").select("id, service_name, date, time, customer_name").in("id", bookingIds)
      : Promise.resolve({ data: [] }),
    customerIds.length
      ? sb.from("profiles").select("id, first_name, last_name, phone, email").in("id", customerIds)
      : Promise.resolve({ data: [] }),
    txnIds.length
      ? sb.from("payment_intents").select(
        "txn_id, razorpay_payment_id, payer_vpa, amount_paise, verified_via, status",
      ).in("txn_id", txnIds)
      : Promise.resolve({ data: [] }),
  ]);

  const bookingById = Object.fromEntries((bookings || []).map((b: { id: string }) => [b.id, b]));
  const profileById = Object.fromEntries((profiles || []).map((p: { id: string }) => [p.id, p]));
  const intentByTxn = Object.fromEntries((intents || []).map((pi: { txn_id: string }) => [pi.txn_id, pi]));
  const now = Date.now();

  return rows.map((row) => ({
    ...row,
    booking: bookingById[String(row.booking_id)] || null,
    customer: profileById[String(row.customer_id)] || null,
    payment_intent: row.txn_id ? intentByTxn[String(row.txn_id)] || null : null,
    overdue: row.refund_due_by
      ? new Date(String(row.refund_due_by)).getTime() < now
        && row.refund_status !== "completed"
        && row.refund_status !== "rejected"
      : false,
  }));
}

export async function listPendingRefundsDesk(
  sb: SupabaseClient,
  body: Record<string, unknown>,
): Promise<Response> {
  const statusFilter = String(body.status || "open");
  let query = sb
    .from("booking_cancellations")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(Math.min(Number(body.limit) || 100, 200));

  if (statusFilter === "open") {
    query = query.in("refund_status", [...REFUND_OPEN_STATUSES]);
  } else if (statusFilter !== "all" && REFUND_STATUSES.has(statusFilter)) {
    query = query.eq("refund_status", statusFilter);
  }

  const { data, error } = await query;
  if (error) return json({ error: error.message }, 500);

  const enriched = await enrichCancellations(sb, data || []);
  const approval = await refundApprovalStatus(sb);

  return json({
    cancellations: enriched,
    count: enriched.length,
    open_count: enriched.filter((r: { refund_status: string }) =>
      REFUND_OPEN_STATUSES.includes(r.refund_status as typeof REFUND_OPEN_STATUSES[number])
    ).length,
    ...approval,
  });
}

export async function updateRefundDesk(
  sb: SupabaseClient,
  body: Record<string, unknown>,
  actor: string,
): Promise<Response> {
  const cancellationId = String(body.cancellation_id || "");
  const newStatus = String(body.refund_status || "");
  const processNote = body.process_note != null
    ? String(body.process_note).trim()
    : null;
  const reviewNote = body.review_note != null
    ? String(body.review_note).trim()
    : null;

  if (!cancellationId) return json({ error: "cancellation_id required" }, 400);
  if (!REFUND_STATUSES.has(newStatus)) {
    return json({ error: "Invalid refund_status" }, 400);
  }
  if (newStatus === "approved") {
    return json({ error: "Use refund_approval_confirm with owner OTP to approve" }, 400);
  }
  if (
    (newStatus === "completed" || newStatus === "rejected") &&
    !processNote
  ) {
    return json({ error: "process_note required when completing or rejecting" }, 400);
  }

  const { data: existing, error: fetchErr } = await sb
    .from("booking_cancellations")
    .select("*")
    .eq("id", cancellationId)
    .maybeSingle();
  if (fetchErr) return json({ error: fetchErr.message }, 500);
  if (!existing) return json({ error: "Cancellation not found" }, 404);

  const current = String(existing.refund_status);
  if (current === newStatus) {
    return json({ success: true, cancellation: existing, unchanged: true });
  }
  if (!allowedTransition(current, newStatus)) {
    return json({
      error: `Cannot move refund from ${current} to ${newStatus}. Follow the approval workflow.`,
    }, 400);
  }

  const patch: Record<string, unknown> = {
    refund_status: newStatus,
  };

  if (newStatus === "pending_approval") {
    patch.approval_requested_by = actor;
    patch.approval_requested_at = new Date().toISOString();
    if (reviewNote) patch.review_note = reviewNote;
  }

  if (processNote) {
    patch.process_note = processNote;
  }

  if (newStatus === "completed" || newStatus === "rejected") {
    patch.processed_by = actor;
    patch.processed_at = new Date().toISOString();
  }

  const { data, error } = await sb
    .from("booking_cancellations")
    .update(patch)
    .eq("id", cancellationId)
    .select()
    .single();
  if (error) return json({ error: error.message }, 500);

  return json({ success: true, cancellation: data });
}

export async function refundApprovalSendDesk(
  sb: SupabaseClient,
  body: Record<string, unknown>,
): Promise<Response> {
  const cancellationId = String(body.cancellation_id || "").trim();
  if (!cancellationId) return json({ error: "cancellation_id required" }, 400);

  const approver = await refundApprovalMobile(sb);
  if (!approver) {
    return json({
      error: "Set REFUND_APPROVAL_MOBILE in Supabase secrets (owner mobile for refund approval OTP)",
    }, 503);
  }

  const { data: row } = await sb
    .from("booking_cancellations")
    .select("id, refund_status, refund_paise, txn_id, booking_id")
    .eq("id", cancellationId)
    .maybeSingle();
  if (!row) return json({ error: "Cancellation not found" }, 404);
  if (row.refund_status !== "pending_approval") {
    return json({ error: "Refund must be pending_approval before sending approval OTP" }, 400);
  }

  const otp = generateOtp();
  const otpHash = await hashOtp(otp);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const { error: insertErr } = await sb.from("vendor_otp").insert({
    mobile: approver,
    otp_hash: otpHash,
    purpose: REFUND_OTP_PURPOSE,
    expires_at: expiresAt,
  });
  if (insertErr) return json({ error: insertErr.message }, 500);

  const refundRu = (Number(row.refund_paise) / 100).toFixed(2);
  const allowVoice = await isPlatformFlagOn(sb, "voice_otp_fallback", { defaultValue: true });
  const message = `ScanV Refund approval: ₹${refundRu} for ${row.txn_id || row.booking_id}. Code ${otp}. Valid 10 min.`;
  const vendorOpts = await otpDeliveryVendorOpts(sb, allowVoice);
  const delivery = await sendOtpDelivery(approver, otp, message, vendorOpts);

  if (delivery.ref) {
    await sb.from("vendor_otp")
      .update({ session_id: delivery.ref })
      .eq("mobile", approver)
      .eq("otp_hash", otpHash)
      .eq("purpose", REFUND_OTP_PURPOSE)
      .eq("verified", false);
  }

  const devMode = !delivery.ok && await isPlatformFlagOn(sb, "otp_dev_mode", {
    envFallbackKey: "OTP_DEV_MODE",
  });
  if (!delivery.ok && !devMode) {
    return json({ success: false, error: delivery.error || "Could not send approval OTP" }, 502);
  }

  return json({
    success: true,
    approver_mobile_masked: maskMobile10(approver),
    channel: delivery.channel || "sms",
    ...(devMode ? { dev_otp: otp } : {}),
  });
}

export async function refundApprovalConfirmDesk(
  sb: SupabaseClient,
  body: Record<string, unknown>,
): Promise<Response> {
  const cancellationId = String(body.cancellation_id || "").trim();
  const decision = String(body.decision || "approve").toLowerCase();
  const otp = String(body.otp || "").replace(/\D/g, "");
  const rejectNote = body.process_note != null
    ? String(body.process_note).trim()
    : null;

  if (!cancellationId) return json({ error: "cancellation_id required" }, 400);
  if (!["approve", "reject"].includes(decision)) {
    return json({ error: "decision must be approve or reject" }, 400);
  }
  if (otp.length !== 6) return json({ error: "Enter 6-digit approval OTP" }, 400);
  if (decision === "reject" && !rejectNote) {
    return json({ error: "process_note required when rejecting at approval stage" }, 400);
  }

  const approver = await refundApprovalMobile(sb);
  if (!approver) return json({ error: "Approver mobile not configured" }, 503);

  const otpHash = await hashOtp(otp);
  const { data: otpRow } = await sb
    .from("vendor_otp")
    .select("id, expires_at")
    .eq("mobile", approver)
    .eq("otp_hash", otpHash)
    .eq("purpose", REFUND_OTP_PURPOSE)
    .eq("verified", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!otpRow || new Date(String(otpRow.expires_at)) < new Date()) {
    return json({ error: "Invalid or expired approval OTP" }, 401);
  }

  await sb.from("vendor_otp").update({ verified: true }).eq("id", otpRow.id);

  const { data: existing } = await sb
    .from("booking_cancellations")
    .select("*")
    .eq("id", cancellationId)
    .maybeSingle();
  if (!existing) return json({ error: "Cancellation not found" }, 404);
  if (existing.refund_status !== "pending_approval") {
    return json({ error: "Refund is not awaiting second-line approval" }, 400);
  }

  const now = new Date().toISOString();
  const approverLabel = `otp:${approver.slice(-10)}`;

  if (decision === "reject") {
    const { data, error } = await sb
      .from("booking_cancellations")
      .update({
        refund_status: "rejected",
        process_note: rejectNote,
        processed_by: approverLabel,
        processed_at: now,
        approved_by: approverLabel,
        approved_at: now,
      })
      .eq("id", cancellationId)
      .select()
      .single();
    if (error) return json({ error: error.message }, 500);
    return json({ success: true, decision: "reject", cancellation: data });
  }

  const { data, error } = await sb
    .from("booking_cancellations")
    .update({
      refund_status: "approved",
      approved_by: approverLabel,
      approved_at: now,
    })
    .eq("id", cancellationId)
    .select()
    .single();
  if (error) return json({ error: error.message }, 500);

  return json({ success: true, decision: "approve", cancellation: data });
}

async function createRazorpayRefund(
  paymentId: string,
  amountPaise: number,
  notes: Record<string, string>,
): Promise<{ ok: boolean; refund?: Record<string, unknown>; error?: string }> {
  const auth = razorpayAuth();
  if (!auth) return { ok: false, error: "Razorpay not configured (RAZORPAY_KEY_ID/SECRET)" };

  try {
    const res = await fetch(
      `https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}/refund`,
      {
        method: "POST",
        headers: {
          Authorization: auth,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ amount: amountPaise, notes }),
      },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errMsg = data?.error?.description || data?.error?.reason || res.statusText;
      return { ok: false, error: errMsg || "Razorpay refund failed" };
    }
    return { ok: true, refund: data as Record<string, unknown> };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Razorpay refund request failed" };
  }
}

export async function issueRazorpayRefundDesk(
  sb: SupabaseClient,
  body: Record<string, unknown>,
  actor: string,
): Promise<Response> {
  const cancellationId = String(body.cancellation_id || "").trim();
  if (!cancellationId) return json({ error: "cancellation_id required" }, 400);

  const { data: row } = await sb
    .from("booking_cancellations")
    .select("*")
    .eq("id", cancellationId)
    .maybeSingle();
  if (!row) return json({ error: "Cancellation not found" }, 404);
  if (row.refund_status !== "approved") {
    return json({ error: "Refund must be approved before issuing Razorpay refund" }, 400);
  }
  if (row.razorpay_refund_id) {
    return json({
      success: true,
      already_issued: true,
      razorpay_refund_id: row.razorpay_refund_id,
      cancellation: row,
    });
  }

  const txnId = String(row.txn_id || "");
  const { data: intent } = txnId
    ? await sb.from("payment_intents").select(
      "razorpay_payment_id, verified_via, status",
    ).eq("txn_id", txnId).maybeSingle()
    : { data: null };

  const paymentId = String(intent?.razorpay_payment_id || "");
  const via = String(intent?.verified_via || "").toLowerCase();
  if (!paymentId || via === "vyapar_webhook") {
    return json({
      error: "No Razorpay payment on file — mark processing manually after UPI/bank refund",
      manual_required: true,
    }, 400);
  }

  const refundPaise = Number(row.refund_paise) || 0;
  if (refundPaise <= 0) return json({ error: "Refund amount is zero" }, 400);

  const result = await createRazorpayRefund(paymentId, refundPaise, {
    booking_id: String(row.booking_id),
    txn_id: txnId,
    cancellation_id: cancellationId,
  });

  if (!result.ok) {
    return json({ error: result.error || "Razorpay refund failed" }, 502);
  }

  const refundId = String(result.refund?.id || "");
  const note = `Razorpay refund ${refundId} · ₹${(refundPaise / 100).toFixed(2)}`;

  const { data, error } = await sb
    .from("booking_cancellations")
    .update({
      refund_status: "processing",
      razorpay_refund_id: refundId || null,
      process_note: note,
      processed_by: actor,
    })
    .eq("id", cancellationId)
    .select()
    .single();
  if (error) return json({ error: error.message }, 500);

  return json({
    success: true,
    razorpay_refund_id: refundId,
    cancellation: data,
  });
}
