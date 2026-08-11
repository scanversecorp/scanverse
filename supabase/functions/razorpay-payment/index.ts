/**
 * ScanV Razorpay payment verification
 *
 * Actions (JSON body):
 *   register — { txn_id, amount_paise, user_id? } → { success, txn_id, payment_link_url? }
 *   check    — { txn_id, amount_paise? } → { verified, status, amount_ok?, paid_at?, mode? }
 *   webhook  — Razorpay webhook payload (no action field) OR manual test
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-razorpay-signature",
};

const INTENT_TTL_MS = 30 * 60 * 1000;
const APP_URL = Deno.env.get("APP_URL") || "https://scanv-tau.vercel.app";

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

async function markPaid(
  supabase: ReturnType<typeof createClient>,
  txnId: string,
  paidAmountPaise: number,
  opts: {
    razorpay_payment_id?: string;
    razorpay_payment_link_id?: string;
    verified_via: string;
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
};

async function checkRazorpayApi(
  txnId: string,
  expectedPaise: number,
): Promise<RazorpayCheckResult> {
  const auth = razorpayAuth();
  if (!auth) return { paid: false };

  try {
    const linkRes = await fetch(
      `https://api.razorpay.com/v1/payment_links/?reference_id=${encodeURIComponent(txnId)}`,
      { headers: { Authorization: auth } },
    );
    if (linkRes.ok) {
      const linkData = await linkRes.json();
      const items = linkData.payment_links || linkData.items || [];
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
          return {
            paid: true,
            paidAmountPaise: paidPaise,
            linkId: String(link.id || ""),
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
          return {
            paid: true,
            paidAmountPaise: paidPaise,
            paymentId: String(p.id || ""),
          };
        }
      }
    }
  } catch (e) {
    console.error("Razorpay API check failed:", e);
  }
  return { paid: false };
}

async function createPaymentLink(
  txnId: string,
  amountPaise: number,
): Promise<{ url: string; id: string } | null> {
  const auth = razorpayAuth();
  if (!auth) return null;

  try {
    const existing = await fetch(
      `https://api.razorpay.com/v1/payment_links/?reference_id=${encodeURIComponent(txnId)}`,
      { headers: { Authorization: auth } },
    );
    if (existing.ok) {
      const existingData = await existing.json();
      const items = existingData.payment_links || existingData.items || [];
      for (const link of items) {
        if (
          link.status !== "cancelled" &&
          link.status !== "expired" &&
          Number(link.amount) === amountPaise
        ) {
          const url = link.short_url || link.url;
          if (url) return { url: String(url), id: String(link.id || "") };
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
        reference_id: txnId,
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
      return null;
    }

    const link = await res.json();
    const url = link.short_url || link.url;
    if (!url) return null;
    return { url: String(url), id: String(link.id || "") };
  } catch (e) {
    console.error("createPaymentLink error:", e);
    return null;
  }
}

async function handleRegister(
  supabase: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
): Promise<Response> {
  const txnId = String(body.txn_id || "");
  const amountPaise = Number(body.amount_paise);
  const userId = body.user_id ? String(body.user_id) : null;

  if (!txnId.startsWith("TXN-") || !Number.isFinite(amountPaise) || amountPaise <= 0) {
    return json({ error: "Invalid txn_id or amount_paise" }, 400);
  }

  const expiresAt = new Date(Date.now() + INTENT_TTL_MS).toISOString();

  const { data: existing } = await supabase
    .from("payment_intents")
    .select("status, amount_paise, razorpay_payment_link_id")
    .eq("txn_id", txnId)
    .maybeSingle();

  if (existing?.status === "paid") {
    return json({ success: true, txn_id: txnId, already_paid: true });
  }

  if (existing && existing.amount_paise !== amountPaise && existing.status === "pending") {
    return json({
      error: "Amount mismatch for existing intent",
      expected_paise: existing.amount_paise,
    }, 409);
  }

  const { error } = await supabase.from("payment_intents").upsert(
    {
      txn_id: txnId,
      amount_paise: amountPaise,
      user_id: userId,
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

  const link = await createPaymentLink(txnId, amountPaise);
  if (link) {
    paymentLinkUrl = link.url;
    paymentLinkId = link.id;
    await supabase
      .from("payment_intents")
      .update({ razorpay_payment_link_id: link.id })
      .eq("txn_id", txnId)
      .eq("status", "pending");
  }

  return json({
    success: true,
    txn_id: txnId,
    amount_paise: amountPaise,
    payment_link_url: paymentLinkUrl,
    payment_link_id: paymentLinkId,
    razorpay_configured: Boolean(razorpayAuth()),
  });
}

async function handleCheck(
  supabase: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
): Promise<Response> {
  const txnId = String(body.txn_id || "");
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
    return json({
      verified: true,
      status: "paid",
      amount_ok: true,
      amount_paise: expectedPaise,
      paid_at: row.paid_at,
      mode: row.verified_via || "webhook",
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
    });
    if (marked) {
      return json({
        verified: true,
        status: "paid",
        amount_ok: true,
        amount_paise: expectedPaise,
        paid_amount_paise: apiResult.paidAmountPaise,
        mode: "api",
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

async function handleWebhook(
  supabase: ReturnType<typeof createClient>,
  rawBody: string,
  body: Record<string, unknown>,
  signature: string | null,
): Promise<Response> {
  const sigOk = await verifyRazorpaySignature(rawBody, signature);
  if (!sigOk && Deno.env.get("RAZORPAY_WEBHOOK_SECRET")) {
    return json({ error: "Invalid signature" }, 401);
  }

  const event = String(body.event || "");
  const paidEvents = [
    "payment.captured",
    "payment_link.paid",
    "order.paid",
  ];

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

  const marked = await markPaid(supabase, txnId, paidAmountPaise, {
    verified_via: "webhook",
    razorpay_payment_id: String(payment.id || ""),
    razorpay_payment_link_id: String(paymentLink.id || ""),
  });

  return json({
    received: true,
    processed: marked,
    txn_id: txnId,
    event,
    amount_ok: marked,
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
  if (action === "webhook") {
    return handleWebhook(supabase, rawBody, body, signature);
  }

  return json({ error: "Unknown action. Use register, check, or webhook." }, 400);
});
