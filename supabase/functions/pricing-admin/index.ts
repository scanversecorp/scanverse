/**
 * ScanV confidential pricing admin API
 * GET  — list all pricing rows (requires x-pricing-pin + x-pricing-totp when 2FA enrolled)
 * POST — upsert rows, 2FA enroll/verify (requires x-pricing-pin)
 *
 * Two-factor: TOTP (Microsoft Authenticator, Google Authenticator, Authy, etc.)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  generateTotpSecret,
  otpAuthUri,
  verifyTotp,
} from "../_shared/totp.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-pricing-pin, x-pricing-totp, x-pricing-session",
};

const TOTP_SECRET_KEY = "pricing_admin_totp_secret";
const TOTP_PENDING_KEY = "pricing_admin_totp_pending";
const TOTP_ISSUER = "ScanV Pricing Admin";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

async function sessionHmacKey(): Promise<CryptoKey> {
  const material = Deno.env.get("PRICING_ADMIN_PIN") || "scanv-pricing-session";
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(material),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function b64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function createPricingSession(): Promise<{ token: string; exp: number }> {
  const exp = Date.now() + SESSION_TTL_MS;
  const nonce = crypto.randomUUID();
  const payload = `${exp}.${nonce}`;
  const key = await sessionHmacKey();
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return { token: `${payload}.${b64url(new Uint8Array(sig))}`, exp };
}

async function verifyPricingSession(token: string): Promise<boolean> {
  if (!token) return false;
  const lastDot = token.lastIndexOf(".");
  if (lastDot <= 0) return false;
  const payload = token.slice(0, lastDot);
  const sigPart = token.slice(lastDot + 1);
  const exp = Number(payload.split(".")[0]);
  if (!exp || Date.now() > exp) return false;
  try {
    const key = await sessionHmacKey();
    const sig = b64urlDecode(sigPart);
    return await crypto.subtle.verify("HMAC", key, sig, new TextEncoder().encode(payload));
  } catch {
    return false;
  }
}

async function issueSessionResponse(extra: Record<string, unknown> = {}) {
  const session = await createPricingSession();
  return json({ ...extra, session_token: session.token, session_exp: session.exp });
}

const PARENT_IDS = new Set([
  "legal", "cloud", "vip", "health", "property", "household",
  "delivery", "food", "two-wheeler", "four-wheeler",
]);

const PARENT_CARD_TITLES: Record<string, string> = {
  legal: "Legal & Consulting",
  cloud: "AI, Cloud & Data Center",
  vip: "VIP Concierge",
  health: "Health at Home",
  property: "Property & Rentals",
  household: "Cleaning & Home Help",
  delivery: "Courier & Deliveries",
  food: "Food & Restaurants & Bars",
  "two-wheeler": "Bike Care",
  "four-wheeler": "Car Care",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function checkPin(req: Request): boolean {
  const pin = req.headers.get("x-pricing-pin") || "";
  const expected = Deno.env.get("PRICING_ADMIN_PIN") || "";
  return expected.length >= 6 && pin === expected;
}

function adminSb() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}

async function getSetting(sb: ReturnType<typeof adminSb>, key: string): Promise<string | null> {
  const { data } = await sb.from("platform_settings").select("value").eq("key", key).maybeSingle();
  return data?.value ? String(data.value) : null;
}

async function setSetting(sb: ReturnType<typeof adminSb>, key: string, value: string, description?: string) {
  const { error } = await sb.from("platform_settings").upsert({
    key,
    value,
    description: description || null,
    updated_by: "pricing-admin",
  }, { onConflict: "key" });
  if (error) throw new Error(error.message);
}

async function deleteSetting(sb: ReturnType<typeof adminSb>, key: string) {
  await sb.from("platform_settings").delete().eq("key", key);
}

async function getEnrolledTotpSecret(sb: ReturnType<typeof adminSb>): Promise<string | null> {
  const dbSecret = await getSetting(sb, TOTP_SECRET_KEY);
  if (dbSecret?.trim()) return dbSecret.trim();
  const envSecret = Deno.env.get("PRICING_TOTP_SECRET")?.trim();
  return envSecret || null;
}

function totpCodeFrom(req: Request, body: Record<string, unknown>): string {
  return String(body.code || req.headers.get("x-pricing-totp") || "").replace(/\D/g, "");
}

async function checkTotpCode(
  secret: string,
  code: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!code || code.length !== 6) return { ok: false, error: "Authenticator code required" };
  const valid = await verifyTotp(secret.trim(), code, 2);
  if (!valid) return { ok: false, error: "Invalid authenticator code — try the next code" };
  return { ok: true };
}

async function checkTotp(
  req: Request,
  sb: ReturnType<typeof adminSb>,
  body: Record<string, unknown> = {},
): Promise<{ ok: boolean; enrolled: boolean; error?: string }> {
  const secret = await getEnrolledTotpSecret(sb);
  if (!secret) return { ok: true, enrolled: false };
  const code = totpCodeFrom(req, body);
  const result = await checkTotpCode(secret, code);
  if (!result.ok) return { ok: false, enrolled: true, error: result.error };
  return { ok: true, enrolled: true };
}

async function checkAuth(req: Request, sb: ReturnType<typeof adminSb>): Promise<Response | null> {
  if (!checkPin(req)) return json({ error: "Unauthorized" }, 401);
  const secret = await getEnrolledTotpSecret(sb);
  if (!secret) return null;

  const session = req.headers.get("x-pricing-session") || "";
  if (await verifyPricingSession(session)) return null;

  const totp = await checkTotp(req, sb);
  if (!totp.ok) return json({ error: totp.error, totp_required: totp.enrolled }, 401);
  return null;
}

function splitAmounts(newPaise: number, partnerPct: number) {
  const pct = Math.min(100, Math.max(0, partnerPct));
  const partner = Math.round(newPaise * (pct / 100));
  const scanv = newPaise - partner;
  return {
    partner_amount_paise: partner,
    partner_pct: pct,
    scanv_amount_paise: scanv,
    scanv_pct: Math.round((100 - pct) * 100) / 100,
  };
}

function slugifyId(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function normalizeServiceStatus(r: Record<string, unknown>): "active" | "inactive" | "paused" {
  const raw = String(r.service_status || "").trim().toLowerCase();
  if (raw === "active" || raw === "inactive" || raw === "paused") return raw;
  return r.active === false ? "inactive" : "active";
}

function normalizeRow(r: Record<string, unknown>) {
  const serviceId = String(r.service_id || "").trim();
  if (!serviceId) throw new Error("service_id required");

  const isCategory = Boolean(r.is_category) || PARENT_IDS.has(serviceId);
  const parentId = isCategory
    ? null
    : (r.parent_id ? String(r.parent_id) : null);

  if (!isCategory && parentId && !PARENT_IDS.has(parentId)) {
    throw new Error(`Invalid parent_id: ${parentId}`);
  }

  const newAmt = Number(r.new_amount_paise) || 0;
  if (newAmt <= 0) throw new Error(`new_amount_paise must be > 0 for ${serviceId}`);

  const currentAmt = Number(r.current_amount_paise) || Math.round(newAmt / 0.75);
  const partnerPct = Number(r.partner_pct ?? 70);
  const split = splitAmounts(newAmt, partnerPct);
  const serviceStatus = normalizeServiceStatus(r);
  const card = String(r.card || "");
  const serviceName = String(r.service_name || "").trim();

  if (!isCategory && parentId) {
    const parentTitle = PARENT_CARD_TITLES[parentId] || card;
    if (serviceName === parentTitle || serviceName === card) {
      throw new Error(
        `Sub-service name must differ from category card "${parentTitle}" — use the specific service name (e.g. Lawyer Consultation)`,
      );
    }
  }

  return {
    service_id: serviceId,
    card,
    sub_card: String(r.sub_card || "—"),
    service_name: serviceName,
    sub_service_name: r.sub_service_name ? String(r.sub_service_name) : null,
    current_amount_paise: currentAmt,
    new_amount_paise: newAmt,
    top_rated: Number(r.top_rated) === 1 ? 1 : 0,
    parent_id: parentId,
    theme: String(r.theme || "default"),
    unit: String(r.unit || "visit"),
    icon: String(r.icon || "✨"),
    sort_order: Number(r.sort_order) || 0,
    service_status: serviceStatus,
    active: serviceStatus === "active",
    is_category: isCategory,
    ...split,
    updated_at: new Date().toISOString(),
  };
}

async function handleTotpAction(
  sb: ReturnType<typeof adminSb>,
  action: string,
  body: Record<string, unknown>,
  req: Request,
) {
  if (!checkPin(req)) return json({ error: "Unauthorized" }, 401);

  if (action === "totp_status") {
    const secret = await getEnrolledTotpSecret(sb);
    const pending = await getSetting(sb, TOTP_PENDING_KEY);
    return json({ enrolled: !!secret, pending: !!pending });
  }

  if (action === "totp_enroll") {
    const existing = await getEnrolledTotpSecret(sb);
    if (existing) return json({ error: "Two-factor already enrolled" }, 400);
    const secret = generateTotpSecret();
    await setSetting(sb, TOTP_PENDING_KEY, secret, "Pending TOTP enrollment for pricing admin");
    const uri = otpAuthUri(secret, TOTP_ISSUER, "pricing-admin");
    return json({ secret, otpauth_uri: uri, issuer: TOTP_ISSUER });
  }

  if (action === "totp_confirm") {
    const pending = await getSetting(sb, TOTP_PENDING_KEY);
    if (!pending) return json({ error: "No pending enrollment — start again" }, 400);
    const code = totpCodeFrom(req, body);
    const result = await checkTotpCode(pending, code);
    if (!result.ok) return json({ error: result.error || "Invalid code — check Microsoft Authenticator and try again" }, 401);
    await setSetting(sb, TOTP_SECRET_KEY, pending, "TOTP secret for pricing admin 2FA");
    await deleteSetting(sb, TOTP_PENDING_KEY);
    return issueSessionResponse({ success: true, enrolled: true });
  }

  if (action === "totp_verify") {
    const enrolledSecret = await getEnrolledTotpSecret(sb);
    if (!enrolledSecret) return json({ success: true, enrolled: false });
    const code = totpCodeFrom(req, body);
    const result = await checkTotpCode(enrolledSecret, code);
    if (!result.ok) return json({ error: result.error }, 401);
    return issueSessionResponse({ success: true, enrolled: true });
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const sb = adminSb();
  let postBody: Record<string, unknown> | null = null;
  if (req.method === "POST") {
    try {
      postBody = await req.json();
    } catch {
      postBody = {};
    }
    const action = String(postBody?.action || "");
    if (action.startsWith("totp_")) {
      const res = await handleTotpAction(sb, action, postBody || {}, req);
      if (res) return res;
    }
  }

  const authErr = await checkAuth(req, sb);
  if (authErr) return authErr;

  if (req.method === "GET") {
    const { data, error } = await sb
      .from("service_pricing")
      .select("*")
      .order("card")
      .order("sort_order")
      .order("sub_card")
      .order("service_name");
    if (error) return json({ error: error.message }, 500);
    return json({ rows: data || [] });
  }

  if (req.method === "POST") {
    const body = postBody || {};
    const typedBody = body as {
      rows?: Record<string, unknown>[];
      create?: Record<string, unknown>;
      remove?: string;
      action?: string;
    };

    if (typedBody.remove) {
      const serviceId = String(typedBody.remove).trim();
      if (!serviceId) return json({ error: "remove requires service_id" }, 400);
      const { data, error } = await sb
        .from("service_pricing")
        .update({ service_status: "inactive", active: false, updated_at: new Date().toISOString() })
        .eq("service_id", serviceId)
        .select();
      if (error) return json({ error: error.message }, 500);
      if (!data?.length) return json({ error: "Service not found" }, 404);
      return json({ success: true, removed: serviceId, rows: data });
    }

    let rawRows = typedBody.rows;
    if ((!rawRows || !rawRows.length) && typedBody.create) {
      const c = typedBody.create;
      const name = String(c.service_name || "").trim();
      const parentId = c.parent_id ? String(c.parent_id) : null;
      const isCategory = Boolean(c.is_category);
      let serviceId = String(c.service_id || "").trim();
      if (!serviceId) {
        const prefix = isCategory ? "" : (parentId ? `${parentId.split("-")[0]}-` : "");
        serviceId = slugifyId(prefix + name);
      }
      if (!serviceId) return json({ error: "Could not derive service_id" }, 400);

      const newPaise = Math.round((Number(c.new_amount_rupees) || 0) * 100);
      rawRows = [{
        service_id: serviceId,
        card: c.card || c.parent_card || "",
        sub_card: c.sub_card || "—",
        service_name: name,
        sub_service_name: c.sub_service_name || null,
        new_amount_paise: newPaise,
        current_amount_paise: c.current_amount_rupees != null
          ? Math.round(Number(c.current_amount_rupees) * 100)
          : Math.round(newPaise / 0.75),
        partner_pct: c.partner_pct ?? 70,
        top_rated: c.top_rated ?? 0,
        parent_id: parentId,
        theme: c.theme || "default",
        unit: c.unit || "visit",
        icon: c.icon || "✨",
        sort_order: c.sort_order ?? 999,
        is_category: isCategory,
        service_status: c.service_status || "active",
        active: (c.service_status || "active") === "active",
      }];
    }

    if (!Array.isArray(rawRows) || !rawRows.length) {
      return json({ error: "rows array or create object required" }, 400);
    }

    let upserts;
    try {
      upserts = rawRows.map((r) => normalizeRow(r));
    } catch (e) {
      return json({ error: (e as Error).message }, 400);
    }

    for (const row of upserts) {
      if (!row.card || !row.service_name) {
        return json({ error: "card and service_name required" }, 400);
      }
    }

    const { data, error } = await sb
      .from("service_pricing")
      .upsert(upserts, { onConflict: "service_id" })
      .select();

    if (error) return json({ error: error.message }, 500);
    return json({ success: true, rows: data, count: data?.length || 0 });
  }

  return json({ error: "Method not allowed" }, 405);
});
