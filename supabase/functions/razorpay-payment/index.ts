/**
 * ScanV Razorpay payment verification
 *
 * Actions (JSON body):
 *   register — { txn_id, amount_paise, user_id? } → { success, txn_id }
 *   check    — { txn_id } → { verified, status, paid_at?, mode? }
 *   webhook  — Razorpay webhook payload (no action field) OR manual test
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-razorpay-signature",
};

const INTENT_TTL_MS = 30 * 60 * 1000;

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

async function markPaid(
  supabase: ReturnType<typeof createClient>,
  txnId: string,
  opts: {
    razorpay_payment_id?: string;
    razorpay_payment_link_id?: string;
    verified_via: string;
  },
): Promise<boolean> {
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

async function checkRazorpayApi(txnId: string): Promise<boolean> {
  const auth = razorpayAuth();
  if (!auth) return false;

  try {
    const linkRes = await fetch(
      `https://api.razorpay.com/v1/payment_links/?reference_id=${encodeURIComponent(txnId)}`,
      { headers: { Authorization: auth } },
    );
    if (linkRes.ok) {
      const linkData = await linkRes.json();
      const items = linkData.payment_links || linkData.items || [];
      for (const link of items) {
        if (link.status === "paid" || link.amount_paid >= link.amount) {
          return true;
        }
      }
    }

    // Fallback: search recent payments by description / notes containing txn id
    const payRes = await fetch(
      `https://api.razorpay.com/v1/payments?count=20`,
      { headers: { Authorization: auth } },
    );
    if (payRes.ok) {
      const payData = await payRes.json();
      const items = payData.items || [];
      for (const p of items) {
        if (p.status !== "captured" && p.status !== "authorized") continue;
        const notes = p.notes || {};
        const desc = String(p.description || "");
        if (
          notes.txn_id === txnId ||
          notes.reference_id === txnId ||
          desc.includes(txnId)
        ) {
          return true;
        }
      }
    }
  } catch (e) {
    console.error("Razorpay API check failed:", e);
  }
  return false;
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
    .select("status")
    .eq("txn_id", txnId)
    .maybeSingle();

  if (existing?.status === "paid") {
    return json({ success: true, txn_id: txnId, already_paid: true });
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

  if (error) {
    // Row may already exist — treat as success for idempotent register
    if (!error.message.includes("duplicate")) {
      return json({ error: error.message }, 500);
    }
  }

  return json({ success: true, txn_id: txnId });
}

async function handleCheck(
  supabase: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
): Promise<Response> {
  const txnId = String(body.txn_id || "");
  if (!txnId) return json({ error: "txn_id required" }, 400);

  const { data: row } = await supabase
    .from("payment_intents")
    .select("*")
    .eq("txn_id", txnId)
    .maybeSingle();

  if (!row) {
    return json({ verified: false, status: "unknown" });
  }

  if (row.status === "paid") {
    return json({
      verified: true,
      status: "paid",
      paid_at: row.paid_at,
      mode: row.verified_via || "webhook",
    });
  }

  if (row.status === "expired" || row.status === "failed") {
    return json({ verified: false, status: row.status });
  }

  const expired = row.expires_at && new Date(row.expires_at) < new Date();
  if (expired) {
    await supabase
      .from("payment_intents")
      .update({ status: "expired" })
      .eq("txn_id", txnId)
      .eq("status", "pending");
    return json({ verified: false, status: "expired" });
  }

  // Poll Razorpay API when credentials configured
  const apiPaid = await checkRazorpayApi(txnId);
  if (apiPaid) {
    await markPaid(supabase, txnId, { verified_via: "api" });
    return json({ verified: true, status: "paid", mode: "api" });
  }

  return json({ verified: false, status: "pending" });
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

  const pl = body.payload as Record<string, unknown> | undefined;
  const payment =
    (pl?.payment as { entity?: Record<string, unknown> })?.entity || {};
  const paymentLink =
    (pl?.payment_link as { entity?: Record<string, unknown> })?.entity || {};

  const marked = await markPaid(supabase, txnId, {
    verified_via: "webhook",
    razorpay_payment_id: String(payment.id || ""),
    razorpay_payment_link_id: String(paymentLink.id || ""),
  });

  return json({ received: true, processed: marked, txn_id: txnId, event });
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

  // Razorpay provider webhook (no action field, has event)
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
