/**
 * ScanV Razorpay payment verification
 *
 * Actions (JSON body):
 *   register — { txn_id, amount_paise, user_id? } → { success, txn_id, payment_link_url? }
 *              user_id is profiles.id TEXT (e.g. cust_919270194842), not auth UUID
 *   check    — { txn_id, amount_paise? } → { verified, status, amount_ok?, paid_at?, mode? }
 *   admin_mark_paid — admin PIN · { txn_id, amount_paise?, payer_vpa? } confirm Vyapar UPI manually
 *   cancel   — { booking_id } (auth required) → cancel booking, queue manual refund (refund_pending)
 *   webhook  — Razorpay webhook payload (no action field) OR manual test
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  executeBookingCancellation,
} from "../_shared/booking-cancel.ts";
import { isPlatformFlagOn } from "../_shared/platform-settings.ts";
import { isVendorEnabled } from "../_shared/vendor-providers.ts";
import {
  calcRouteSplit,
  handleRouteTransferWebhook,
  inferServicePriceFromTotal,
} from "../_shared/razorpay-route.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-razorpay-signature, x-admin-pin",
};

const INTENT_TTL_MS = 30 * 60 * 1000;
const APP_URL = Deno.env.get("APP_URL") || "https://getscanv.com";
const TRUSTED_VERIFIED_VIA = new Set(["webhook", "api", "vyapar_webhook", "admin_confirm"]);

function isTrustedVerifiedVia(via: unknown): boolean {
  return TRUSTED_VERIFIED_VIA.has(String(via || "").toLowerCase());
}

async function resolveCatalogPricePaise(
  supabase: ReturnType<typeof createClient>,
  serviceId: string | null,
): Promise<number | null> {
  if (!serviceId) return null;
  const { data } = await supabase
    .from("service_prices_public")
    .select("price_paise")
    .eq("service_id", serviceId)
    .maybeSingle();
  const price = data?.price_paise;
  return price != null && Number.isFinite(Number(price)) ? Number(price) : null;
}

/** ScanV share for Student Cloud course fee (typically 30% of catalog course fee). */
async function resolveScanvSharePaise(
  supabase: ReturnType<typeof createClient>,
  serviceId: string | null,
): Promise<number | null> {
  if (!serviceId) return null;
  const { data } = await supabase
    .from("service_pricing")
    .select("scanv_amount_paise, new_amount_paise, scanv_pct")
    .eq("service_id", serviceId)
    .maybeSingle();
  if (!data) return null;
  const scanv = Number(data.scanv_amount_paise);
  if (Number.isFinite(scanv) && scanv > 0) return scanv;
  const course = Number(data.new_amount_paise);
  const pct = Number(data.scanv_pct) || 30;
  return course > 0 ? Math.round(course * pct / 100) : null;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function razorpayAuth(): string | null {
  const keyId = Deno.env.get("RAZORPAY_KEY_ID");
  const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
  if (!keyId || !keySecret) return null;
  return "Basic " + btoa(`${keyId}:${keySecret}`);
}

/** Paid amount must be >= expected (exact match is the normal case). */
function amountSufficient(expectedPaise: number, paidPaise: number): boolean {
  if (!Number.isFinite(expectedPaise) || expectedPaise <= 0) return false;
  if (!Number.isFinite(paidPaise) || paidPaise <= 0) return false;
  return paidPaise >= expectedPaise;
}

async function verifyRazorpaySignature(
  rawBody: string,
  signature: string | null,
): Promise<boolean> {
  const secret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");
  if (!secret || !signature) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(rawBody),
  );
  const expected = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return expected === signature;
}

function extractTxnId(payload: Record<string, unknown>): string | null {
  const pl = payload.payload as Record<string, unknown> | undefined;
  const entity =
    (pl?.payment_link as { entity?: Record<string, unknown> })?.entity ||
    (pl?.payment as { entity?: Record<string, unknown> })?.entity ||
    (payload.payment_link as Record<string, unknown>) ||
    (payload.payment as Record<string, unknown>);

  if (!entity) return null;

  const ref =
    entity.reference_id ||
    (entity.notes as Record<string, unknown> | undefined)?.txn_id ||
    (entity.notes as Record<string, unknown> | undefined)?.reference_id;

  if (typeof ref === "string" && ref.startsWith("TXN-")) return ref;

  const desc = String(entity.description || "");
  const match = desc.match(/TXN-\d+/);
  return match ? match[0] : null;
}

function extractPaidAmountPaise(payload: Record<string, unknown>): number {
  const pl = payload.payload as Record<string, unknown> | undefined;
  const payment =
    (pl?.payment as { entity?: Record<string, unknown> })?.entity || {};
  const paymentLink =
    (pl?.payment_link as { entity?: Record<string, unknown> })?.entity || {};

  if (payment.amount != null) return Number(payment.amount);
  if (paymentLink.amount_paid != null) return Number(paymentLink.amount_paid);
  if (paymentLink.amount != null) return Number(paymentLink.amount);
  return 0;
}

function extractPayerVpa(payload: Record<string, unknown>): string | null {
  const pl = payload.payload as Record<string, unknown> | undefined;
  const payment =
    (pl?.payment as { entity?: Record<string, unknown> })?.entity;
  if (!payment) return null;
  const method = String(payment.method || "").toLowerCase();
  const vpa = payment.vpa;
  if (method === "upi" && typeof vpa === "string" && vpa.includes("@")) {
    return vpa.trim().toLowerCase();
  }
  if (typeof vpa === "string" && vpa.includes("@")) {
    return vpa.trim().toLowerCase();
  }
  return null;
}

async function fetchPaymentVpa(
  auth: string,
  paymentId: string,
): Promise<string | null> {
  if (!paymentId) return null;
  try {
    const res = await fetch(
      `https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`,
      { headers: { Authorization: auth } },
    );
    if (!res.ok) return null;
    const p = await res.json();
    const vpa = p.vpa;
    if (typeof vpa === "string" && vpa.includes("@")) {
      return vpa.trim().toLowerCase();
    }
  } catch (e) {
    console.error("fetchPaymentVpa failed:", paymentId, e);
  }
  return null;
}

async function fetchVpaFromPaymentLink(
  auth: string,
  linkId: string,
): Promise<string | null> {
  if (!linkId) return null;
  try {
    const res = await fetch(
      `https://api.razorpay.com/v1/payment_links/${encodeURIComponent(linkId)}/payments`,
      { headers: { Authorization: auth } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const items = data.items || data.payments || [];
    for (const p of items) {
      if (p.status !== "captured" && p.status !== "authorized") continue;
      const vpa = p.vpa;
      if (typeof vpa === "string" && vpa.includes("@")) {
        return vpa.trim().toLowerCase();
      }
    }
  } catch (e) {
    console.error("fetchVpaFromPaymentLink failed:", linkId, e);
  }
  return null;
}

async function markPaid(
  supabase: ReturnType<typeof createClient>,
  txnId: string,
  paidAmountPaise: number,
  opts: {
    razorpay_payment_id?: string;
    razorpay_payment_link_id?: string;
    verified_via: string;
    payer_vpa?: string | null;
  },
): Promise<boolean> {
  const { data: row, error: fetchErr } = await supabase
    .from("payment_intents")
    .select("amount_paise, status")
    .eq("txn_id", txnId)
    .maybeSingle();

  if (fetchErr || !row) {
    console.error("markPaid: intent not found", txnId, fetchErr?.message);
    return false;
  }

  if (row.status === "paid") return true;

  if (!amountSufficient(Number(row.amount_paise), paidAmountPaise)) {
    console.error(
      "markPaid: amount mismatch",
      txnId,
      "expected>=",
      row.amount_paise,
      "paid=",
      paidAmountPaise,
    );
    return false;
  }

  const { data, error } = await supabase
    .from("payment_intents")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      verified_via: opts.verified_via,
      razorpay_payment_id: opts.razorpay_payment_id || null,
      razorpay_payment_link_id: opts.razorpay_payment_link_id || null,
      ...(opts.payer_vpa ? { payer_vpa: opts.payer_vpa } : {}),
    })
    .eq("txn_id", txnId)
    .eq("status", "pending")
    .select("txn_id")
    .maybeSingle();

  if (error) {
    console.error("markPaid error:", error.message);
    return false;
  }
  return Boolean(data);
}

type RazorpayCheckResult = {
  paid: boolean;
  paidAmountPaise?: number;
  paymentId?: string;
  linkId?: string;
  payerVpa?: string | null;
};

async function checkRazorpayApi(
  txnId: string,
  expectedPaise: number,
): Promise<RazorpayCheckResult> {
  const auth = razorpayAuth();
  if (!auth) return { paid: false };

  try {
    const refs = [
      paymentLinkReferenceId(txnId, expectedPaise),
      txnId,
    ];
    for (const ref of refs) {
      const items = await listPaymentLinksByReference(auth, ref);
      for (const link of items) {
        const paidPaise = Number(link.amount_paid ?? 0);
        const linkAmount = Number(link.amount ?? 0);
        const isPaid = link.status === "paid" ||
          (paidPaise > 0 && paidPaise >= linkAmount && linkAmount > 0);
        if (
          isPaid &&
          amountSufficient(expectedPaise, paidPaise) &&
          linkAmount >= expectedPaise
        ) {
          const linkId = String(link.id || "");
          let payerVpa: string | null = null;
          if (link.payments?.length) {
            for (const p of link.payments) {
              if (typeof p.vpa === "string" && p.vpa.includes("@")) {
                payerVpa = p.vpa.trim().toLowerCase();
                break;
              }
            }
          }
          if (!payerVpa && linkId) {
            payerVpa = await fetchVpaFromPaymentLink(auth, linkId);
          }
          return {
            paid: true,
            paidAmountPaise: paidPaise,
            linkId,
            payerVpa,
          };
        }
      }
    }

    const payRes = await fetch(
      `https://api.razorpay.com/v1/payments?count=50`,
      { headers: { Authorization: auth } },
    );
    if (payRes.ok) {
      const payData = await payRes.json();
      const items = payData.items || [];
      for (const p of items) {
        if (p.status !== "captured" && p.status !== "authorized") continue;
        const notes = p.notes || {};
        const desc = String(p.description || "");
        const matches =
          notes.txn_id === txnId ||
          notes.reference_id === txnId ||
          desc.includes(txnId);
        if (!matches) continue;
        const paidPaise = Number(p.amount ?? 0);
        if (amountSufficient(expectedPaise, paidPaise)) {
          const paymentId = String(p.id || "");
          let payerVpa: string | null = null;
          if (typeof p.vpa === "string" && p.vpa.includes("@")) {
            payerVpa = p.vpa.trim().toLowerCase();
          } else if (paymentId) {
            payerVpa = await fetchPaymentVpa(auth, paymentId);
          }
          return {
            paid: true,
            paidAmountPaise: paidPaise,
            paymentId,
            payerVpa,
          };
        }
      }
    }
  } catch (e) {
    console.error("Razorpay API check failed:", e);
  }
  return { paid: false };
}

type PaymentLinkResult =
  | { ok: true; url: string; id: string }
  | { ok: false; error: string };

function paymentLinkReferenceId(txnId: string, amountPaise: number): string {
  return `${txnId}#${amountPaise}`;
}

/** Legacy SGR admission used SGR-* ids; Razorpay register requires TXN-* prefix. */
function normalizeTxnId(raw: unknown): string {
  const txnId = String(raw || "").trim();
  if (!txnId) return "";
  if (txnId.startsWith("TXN-")) return txnId;
  if (txnId.startsWith("SGR-")) return `TXN-${txnId}`;
  return txnId;
}

function isValidTxnId(txnId: string): boolean {
  return txnId.startsWith("TXN-") && txnId.length > 5;
}

async function listPaymentLinksByReference(
  auth: string,
  referenceId: string,
): Promise<Record<string, unknown>[]> {
  const res = await fetch(
    `https://api.razorpay.com/v1/payment_links/?reference_id=${encodeURIComponent(referenceId)}`,
    { headers: { Authorization: auth } },
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.payment_links || data.items || [];
}

async function createPaymentLink(
  txnId: string,
  amountPaise: number,
): Promise<PaymentLinkResult> {
  const auth = razorpayAuth();
  if (!auth) {
    return { ok: false, error: "Razorpay keys not configured on server" };
  }

  const referenceId = paymentLinkReferenceId(txnId, amountPaise);

  try {
    for (const ref of [referenceId, txnId]) {
      const items = await listPaymentLinksByReference(auth, ref);
      for (const link of items) {
        if (link.status === "cancelled" || link.status === "expired") continue;
        if (Number(link.amount) === amountPaise) {
          const url = link.short_url || link.url;
          if (url) {
            return { ok: true, url: String(url), id: String(link.id || "") };
          }
        }
      }
    }

    const res = await fetch("https://api.razorpay.com/v1/payment_links", {
      method: "POST",
      headers: {
        Authorization: auth,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: "INR",
        accept_partial: false,
        reference_id: referenceId,
        description: `ScanV Booking ${txnId}`,
        notes: { txn_id: txnId, reference_id: txnId },
        callback_url:
          `${APP_URL}/?payment=${encodeURIComponent(txnId)}&razorpay_payment_link_status=paid`,
        callback_method: "get",
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("createPaymentLink failed:", res.status, errText);
      let detail = errText.slice(0, 200);
      try {
        const parsed = JSON.parse(errText);
        detail = String(parsed.error?.description || parsed.error?.reason || detail);
      } catch { /* keep raw */ }
      return { ok: false, error: `Razorpay API ${res.status}: ${detail}` };
    }

    const link = await res.json();
    const url = link.short_url || link.url;
    if (!url) return { ok: false, error: "Razorpay returned no payment link URL" };
    return { ok: true, url: String(url), id: String(link.id || "") };
  } catch (e) {
    console.error("createPaymentLink error:", e);
    return { ok: false, error: String(e) };
  }
}

async function handleRegister(
  supabase: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
): Promise<Response> {
  let txnId = normalizeTxnId(body.txn_id);
  const amountPaise = Number(body.amount_paise);
  const userId = body.user_id ? String(body.user_id).trim() || null : null;
  const serviceId = body.service_id ? String(body.service_id).trim() || null : null;
  const serviceName = body.service_name ? String(body.service_name).trim() || null : null;
  if (!isValidTxnId(txnId) || !Number.isFinite(amountPaise) || amountPaise <= 0) {
    return json({ error: "Invalid txn_id or amount_paise" }, 400);
  }

  const catalogPricePaise = await resolveCatalogPricePaise(supabase, serviceId);
  const scanvSharePaise = await resolveScanvSharePaise(supabase, serviceId);
  let isStudentCloudCourse = body.student_cloud_course === true;
  if (!isStudentCloudCourse && catalogPricePaise != null && scanvSharePaise != null
    && amountPaise < catalogPricePaise && amountPaise >= scanvSharePaise) {
    isStudentCloudCourse = true;
  }

  if (isStudentCloudCourse && scanvSharePaise != null) {
    if (amountPaise < scanvSharePaise) {
      return json({
        error: "Amount below ScanV course share",
        expected_paise: scanvSharePaise,
      }, 400);
    }
  } else if (catalogPricePaise != null && amountPaise < catalogPricePaise) {
    return json({
      error: "Amount below catalog price",
      expected_paise: catalogPricePaise,
    }, 400);
  }

  const servicePricePaise = isStudentCloudCourse && scanvSharePaise != null
    ? scanvSharePaise
    : catalogPricePaise != null
      ? catalogPricePaise
      : body.service_price_paise != null
        ? Math.round(Number(body.service_price_paise))
        : inferServicePriceFromTotal(amountPaise);
  const split = calcRouteSplit(servicePricePaise);

  const razorpayEnabled = await isVendorEnabled(supabase, "vendor_enable_razorpay");

  const expiresAt = new Date(Date.now() + INTENT_TTL_MS).toISOString();

  const { data: existing } = await supabase
    .from("payment_intents")
    .select("status, amount_paise, razorpay_payment_link_id, verified_via")
    .eq("txn_id", txnId)
    .maybeSingle();

  if (existing?.status === "paid" && isTrustedVerifiedVia(existing.verified_via)) {
    return json({ success: true, txn_id: txnId, already_paid: true });
  }

  if (
    existing?.status === "pending" &&
    existing.amount_paise != null &&
    Number(existing.amount_paise) !== amountPaise
  ) {
    return json({
      error: "Payment amount cannot change for an existing checkout reference",
      txn_id: txnId,
      expected_paise: Number(existing.amount_paise),
    }, 400);
  }

  const { error } = await supabase.from("payment_intents").upsert(
    {
      txn_id: txnId,
      amount_paise: amountPaise,
      user_id: userId,
      service_id: serviceId,
      service_name: serviceName,
      service_price_paise: split.service_price_paise,
      platform_share_paise: split.platform_share_paise,
      vendor_share_paise: split.vendor_share_paise,
      status: "pending",
      expires_at: expiresAt,
    },
    { onConflict: "txn_id" },
  );

  if (error && !error.message.includes("duplicate")) {
    return json({ error: error.message }, 500);
  }

  let paymentLinkUrl: string | null = null;
  let paymentLinkId: string | null = existing?.razorpay_payment_link_id || null;
  let razorpayError: string | null = null;

  const link = razorpayEnabled ? await createPaymentLink(txnId, amountPaise) : { ok: false, error: "Razorpay disabled in admin Go-Live settings" };
  if (link.ok) {
    paymentLinkUrl = link.url;
    paymentLinkId = link.id;
    await supabase
      .from("payment_intents")
      .update({ razorpay_payment_link_id: link.id })
      .eq("txn_id", txnId)
      .eq("status", "pending");
  } else {
    razorpayError = link.error;
  }

  return json({
    success: true,
    txn_id: txnId,
    amount_paise: amountPaise,
    service_price_paise: split.service_price_paise,
    platform_share_paise: split.platform_share_paise,
    vendor_share_paise: split.vendor_share_paise,
    payment_link_url: paymentLinkUrl,
    payment_link_id: paymentLinkId,
    razorpay_configured: razorpayEnabled && Boolean(razorpayAuth()),
    razorpay_enabled: razorpayEnabled,
    ...(razorpayError ? { razorpay_error: razorpayError } : {}),
    ...(existing && existing.amount_paise !== amountPaise
      ? { amount_updated: true, previous_amount_paise: existing.amount_paise }
      : {}),
  });
}

async function handleCheck(
  supabase: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
): Promise<Response> {
  const txnId = normalizeTxnId(body.txn_id);
  const clientExpectedPaise = body.amount_paise != null
    ? Number(body.amount_paise)
    : null;

  if (!txnId) return json({ error: "txn_id required" }, 400);

  const { data: row } = await supabase
    .from("payment_intents")
    .select("*")
    .eq("txn_id", txnId)
    .maybeSingle();

  if (!row) {
    return json({ verified: false, status: "unknown", amount_ok: false });
  }

  const expectedPaise = Number(row.amount_paise);

  if (
    clientExpectedPaise != null &&
    Number.isFinite(clientExpectedPaise) &&
    clientExpectedPaise !== expectedPaise
  ) {
    return json({
      verified: false,
      status: row.status,
      amount_ok: false,
      error: "Client amount does not match registered intent",
    });
  }

  if (row.status === "paid") {
    if (!isTrustedVerifiedVia(row.verified_via)) {
      return json({
        verified: false,
        status: "pending",
        amount_ok: false,
        error: "Payment not verified by gateway",
      });
    }
    const amountOk = clientExpectedPaise == null || expectedPaise >= clientExpectedPaise;
    return json({
      verified: amountOk,
      status: "paid",
      amount_ok: amountOk,
      amount_paise: expectedPaise,
      paid_at: row.paid_at,
      mode: row.verified_via,
      payer_vpa: row.payer_vpa || null,
      ...(amountOk ? {} : {
        error: "Paid amount is below checkout total",
        paid_amount_paise: expectedPaise,
        expected_amount_paise: clientExpectedPaise,
      }),
    });
  }

  if (row.status === "expired" || row.status === "failed") {
    return json({ verified: false, status: row.status, amount_ok: false });
  }

  const expired = row.expires_at && new Date(row.expires_at) < new Date();
  if (expired) {
    await supabase
      .from("payment_intents")
      .update({ status: "expired" })
      .eq("txn_id", txnId)
      .eq("status", "pending");
    return json({ verified: false, status: "expired", amount_ok: false });
  }

  const apiResult = await checkRazorpayApi(txnId, expectedPaise);
  if (apiResult.paid && apiResult.paidAmountPaise != null) {
    const marked = await markPaid(supabase, txnId, apiResult.paidAmountPaise, {
      verified_via: "api",
      razorpay_payment_id: apiResult.paymentId,
      razorpay_payment_link_id: apiResult.linkId,
      payer_vpa: apiResult.payerVpa,
    });
    if (marked) {
      return json({
        verified: true,
        status: "paid",
        amount_ok: true,
        amount_paise: expectedPaise,
        paid_amount_paise: apiResult.paidAmountPaise,
        mode: "api",
        payer_vpa: apiResult.payerVpa || null,
      });
    }
    return json({
      verified: false,
      status: "pending",
      amount_ok: false,
      error: "Payment found but amount insufficient",
    });
  }

  return json({
    verified: false,
    status: "pending",
    amount_ok: false,
    amount_paise: expectedPaise,
  });
}

async function handleListPaidForUser(
  supabase: ReturnType<typeof createClient>,
  supabaseUrl: string,
  req: Request,
  body: Record<string, unknown>,
): Promise<Response> {
  const userId = String(body.user_id || "").trim();
  if (!userId) return json({ error: "user_id required" }, 400);

  const authHeader = req.headers.get("Authorization") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!bearer || bearer === anonKey || (serviceKey && bearer === serviceKey)) {
    return json({ error: "Authentication required" }, 401);
  }

  const profileId = await resolveCustomerProfileId(supabase, supabaseUrl, req);
  if (!profileId) return json({ error: "Authentication required" }, 401);
  if (profileId !== userId) return json({ error: "Forbidden" }, 403);

  const { data, error } = await supabase
    .from("payment_intents")
    .select("txn_id, amount_paise, paid_at, service_id, service_name, verified_via")
    .eq("user_id", userId)
    .eq("status", "paid")
    .order("paid_at", { ascending: false })
    .limit(10);

  if (error) return json({ error: error.message }, 500);

  const intents = (data || []).filter((row) =>
    isTrustedVerifiedVia(row.verified_via)
  ).map(({ verified_via: _via, ...rest }) => rest);

  return json({ intents });
}

async function resolveCustomerProfileId(
  supabase: ReturnType<typeof createClient>,
  supabaseUrl: string,
  req: Request,
): Promise<string | null> {
  const authHeader = req.headers.get("Authorization") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!authHeader || !anonKey) return null;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: authData } = await userClient.auth.getUser();
  const uid = authData?.user?.id;
  if (uid) {
    const { data: byUid } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", String(uid))
      .maybeSingle();
    if (byUid?.id) return String(byUid.id);
  }
  const { data: profileId, error: rpcErr } = await userClient.rpc("current_profile_id");
  if (!rpcErr && profileId) return String(profileId);

  const email = authData?.user?.email;
  if (!email) return null;
  const { data: prof } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  return prof?.id ? String(prof.id) : null;
}

async function handleCancel(
  supabase: ReturnType<typeof createClient>,
  supabaseUrl: string,
  req: Request,
  body: Record<string, unknown>,
): Promise<Response> {
  const bookingId = String(body.booking_id || "").trim();
  if (!bookingId) return json({ error: "booking_id required" }, 400);

  const profileId = await resolveCustomerProfileId(supabase, supabaseUrl, req);
  if (!profileId) return json({ error: "Authentication required" }, 401);

  const { data: booking } = await supabase
    .from("bookings")
    .select("customer_id")
    .eq("id", bookingId)
    .maybeSingle();

  if (!booking) return json({ error: "Booking not found" }, 404);
  if (String(booking.customer_id) !== profileId) {
    return json({ error: "You can only cancel your own booking" }, 403);
  }

  const result = await executeBookingCancellation(supabase, {
    bookingId,
    cancelledBy: profileId,
    cancelReason: "customer_cancelled",
  });

  if (!result.success) {
    const status = result.error?.includes("cannot be cancelled") ? 400 : 500;
    return json({ error: result.error || "Cancellation failed" }, status);
  }

  const bd = result.breakdown!;
  return json({
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
    message:
      "Refund queued for review. Owner OTP approval is required before payout (within 7 business days).",
  });
}

async function handleWebhook(
  supabase: ReturnType<typeof createClient>,
  rawBody: string,
  body: Record<string, unknown>,
  signature: string | null,
): Promise<Response> {
  const webhookSecret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");
  const sigOk = await verifyRazorpaySignature(rawBody, signature);
  if (webhookSecret) {
    if (!sigOk) return json({ error: "Invalid signature" }, 401);
  } else if (!(await isPlatformFlagOn(supabase, "otp_dev_mode", { envFallbackKey: "OTP_DEV_MODE" }))) {
    console.warn("RAZORPAY_WEBHOOK_SECRET not set — rejecting unsigned webhook");
    return json({ error: "Webhook secret not configured" }, 503);
  }

  const event = String(body.event || "");
  const paidEvents = [
    "payment.captured",
    "payment_link.paid",
    "order.paid",
  ];

  if (event.startsWith("transfer.")) {
    const routeUpdate = await handleRouteTransferWebhook(supabase, body);
    return json({ received: true, processed: routeUpdate.updated, event, ...routeUpdate });
  }

  if (!paidEvents.includes(event) && body.action !== "webhook") {
    return json({ received: true, processed: false, event });
  }

  const txnId = extractTxnId(body);
  if (!txnId) {
    return json({ received: true, processed: false, reason: "no_txn_id" });
  }

  const paidAmountPaise = extractPaidAmountPaise(body);
  if (!paidAmountPaise) {
    return json({
      received: true,
      processed: false,
      reason: "no_amount",
      txn_id: txnId,
    });
  }

  const pl = body.payload as Record<string, unknown> | undefined;
  const payment =
    (pl?.payment as { entity?: Record<string, unknown> })?.entity || {};
  const paymentLink =
    (pl?.payment_link as { entity?: Record<string, unknown> })?.entity || {};

  let payerVpa = extractPayerVpa(body);
  if (!payerVpa && payment.id) {
    const auth = razorpayAuth();
    if (auth) payerVpa = await fetchPaymentVpa(auth, String(payment.id));
  }
  if (!payerVpa && paymentLink.id) {
    const auth = razorpayAuth();
    if (auth) payerVpa = await fetchVpaFromPaymentLink(auth, String(paymentLink.id));
  }

  const marked = await markPaid(supabase, txnId, paidAmountPaise, {
    verified_via: "webhook",
    razorpay_payment_id: String(payment.id || ""),
    razorpay_payment_link_id: String(paymentLink.id || ""),
    payer_vpa: payerVpa,
  });

  return json({
    received: true,
    processed: marked,
    txn_id: txnId,
    event,
    amount_ok: marked,
  });
}

function normalizeVyaparTxnId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const id = decodeURIComponent(raw.trim());
  if (!id.startsWith("TXN-")) return null;
  const hash = id.indexOf("#");
  return hash > 0 ? id.slice(0, hash) : id;
}

function extractTxnFromRemark(text: unknown): string | null {
  if (typeof text !== "string" || !text.trim()) return null;
  const match = text.match(/TXN-\d+/);
  return match ? match[0] : null;
}

function parseVyaparAmountPaise(body: Record<string, unknown>): number | null {
  if (body.amount_paise != null) {
    const paise = Number(body.amount_paise);
    return Number.isFinite(paise) && paise > 0 ? Math.round(paise) : null;
  }
  if (body.amount != null) {
    const ru = Number(body.amount);
    if (!Number.isFinite(ru) || ru <= 0) return null;
    return Math.round(ru * 100);
  }
  if (body.amount_inr != null) {
    const ru = Number(body.amount_inr);
    if (!Number.isFinite(ru) || ru <= 0) return null;
    return Math.round(ru * 100);
  }
  return null;
}

function adminPinOk(req: Request): boolean {
  const pin = req.headers.get("x-admin-pin") || "";
  if (!pin || pin.length < 6) return false;
  for (const k of ["ADMIN_HUB_PIN", "SUPPORT_ADMIN_PIN", "PRICING_ADMIN_PIN", "VENDOR_ADMIN_PIN"]) {
    const secret = Deno.env.get(k) || "";
    if (secret.length >= 6 && pin === secret) return true;
  }
  return false;
}

async function handleAdminMarkPaid(
  supabase: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
  req: Request,
): Promise<Response> {
  if (!adminPinOk(req)) return json({ error: "Admin PIN required" }, 401);
  const txnId = String(body.txn_id || "").trim();
  if (!txnId) return json({ error: "txn_id required" }, 400);
  const { data: row, error: fetchErr } = await supabase
    .from("payment_intents")
    .select("amount_paise, status")
    .eq("txn_id", txnId)
    .maybeSingle();
  if (fetchErr || !row) return json({ error: "Payment intent not found" }, 404);
  if (row.status === "paid") {
    return json({ success: true, verified: true, txn_id: txnId, already_paid: true });
  }
  const amountPaise = body.amount_paise != null
    ? Math.round(Number(body.amount_paise))
    : Number(row.amount_paise);
  const payerVpa = typeof body.payer_vpa === "string" && body.payer_vpa.includes("@")
    ? body.payer_vpa.trim().toLowerCase()
    : null;
  const marked = await markPaid(supabase, txnId, amountPaise, {
    verified_via: "admin_confirm",
    payer_vpa: payerVpa,
  });
  if (!marked) return json({ error: "Could not mark paid — check amount and status" }, 400);
  return json({ success: true, verified: true, txn_id: txnId, amount_paise: amountPaise });
}

async function handleVyaparNotify(
  supabase: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
): Promise<Response> {
  const vyaparEnabled = await isVendorEnabled(supabase, "vendor_enable_vyapar_upi");
  if (!vyaparEnabled) {
    return json({ error: "Vyapar UPI disabled in admin Go-Live settings" }, 503);
  }
  const secret = Deno.env.get("VYAPAR_WEBHOOK_SECRET");
  const provided = String(
    body.secret || body.webhook_secret || body.token || "",
  ).trim();
  if (secret) {
    if (provided !== secret) return json({ error: "Unauthorized" }, 401);
  } else if (!(await isPlatformFlagOn(supabase, "otp_dev_mode", { envFallbackKey: "OTP_DEV_MODE" }))) {
    return json({ error: "Vyapar webhook secret not configured" }, 503);
  }

  let txnId =
    normalizeVyaparTxnId(body.txn_id) ||
    normalizeVyaparTxnId(body.reference_id) ||
    normalizeVyaparTxnId(body.reference) ||
    extractTxnFromRemark(body.remark) ||
    extractTxnFromRemark(body.note) ||
    extractTxnFromRemark(body.description) ||
    extractTxnFromRemark(body.remarks) ||
    extractTxnFromRemark(body.narration);

  const amountPaise = parseVyaparAmountPaise(body);
  if (!amountPaise) {
    return json({ error: "amount or amount_paise required", processed: false }, 400);
  }

  if (!txnId) {
    const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: candidates } = await supabase
      .from("payment_intents")
      .select("txn_id, amount_paise")
      .eq("status", "pending")
      .eq("amount_paise", amountPaise)
      .gte("created_at", since);
    if (candidates?.length === 1) txnId = String(candidates[0].txn_id);
  }

  if (!txnId) {
    return json({
      processed: false,
      error: "Could not match txn_id — include TXN reference in payment remarks",
    }, 400);
  }

  const payerVpaRaw = body.payer_vpa || body.vpa || body.sender_vpa;
  const payerVpa = typeof payerVpaRaw === "string" && payerVpaRaw.includes("@")
    ? payerVpaRaw.trim().toLowerCase()
    : null;

  const marked = await markPaid(supabase, txnId, amountPaise, {
    verified_via: "vyapar_webhook",
    payer_vpa: payerVpa,
  });

  return json({
    processed: marked,
    verified: marked,
    txn_id: txnId,
    amount_paise: amountPaise,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const rawBody = await req.text();
  let body: Record<string, unknown> = {};
  try {
    body = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    body = {};
  }

  const signature =
    req.headers.get("x-razorpay-signature") ||
    req.headers.get("X-Razorpay-Signature");

  if (body.event && !body.action) {
    return handleWebhook(supabase, rawBody, body, signature);
  }

  const action = String(body.action || "check");

  if (action === "register") return handleRegister(supabase, body);
  if (action === "check") return handleCheck(supabase, body);
  if (action === "list_paid_for_user") {
    return handleListPaidForUser(supabase, supabaseUrl, req, body);
  }
  if (action === "cancel") {
    return handleCancel(supabase, supabaseUrl, req, body);
  }
  if (action === "webhook") {
    return handleWebhook(supabase, rawBody, body, signature);
  }
  if (action === "vyapar_notify") {
    return handleVyaparNotify(supabase, body);
  }
  if (action === "admin_mark_paid") {
    return handleAdminMarkPaid(supabase, body, req);
  }

  return json({ error: "Unknown action. Use register, check, cancel, webhook, vyapar_notify, or admin_mark_paid." }, 400);
});
