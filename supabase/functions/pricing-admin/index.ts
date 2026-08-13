/**
 * ScanV confidential pricing admin API
 * GET  — list all pricing rows (requires x-pricing-pin)
 * POST — upsert rows { rows: [...] } (requires x-pricing-pin)
 *
 * service_pricing is the single source of truth; triggers sync
 * service_prices_public (customer app) and public.services (bookings FK).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-pricing-pin",
};

const PARENT_IDS = new Set([
  "legal", "cloud", "vip", "health", "property", "household",
  "delivery", "food", "two-wheeler", "four-wheeler",
]);

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

function normalizeServiceStatus(r: Record<string, unknown>): 'active' | 'inactive' | 'paused' {
  const raw = String(r.service_status || '').trim().toLowerCase();
  if (raw === 'active' || raw === 'inactive' || raw === 'paused') return raw;
  return r.active === false ? 'inactive' : 'active';
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

  return {
    service_id: serviceId,
    card: String(r.card || ""),
    sub_card: String(r.sub_card || "—"),
    service_name: String(r.service_name || ""),
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
    active: serviceStatus === 'active',
    is_category: isCategory,
    ...split,
    updated_at: new Date().toISOString(),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!checkPin(req)) {
    return json({ error: "Unauthorized" }, 401);
  }

  const sb = adminSb();

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
    let body: {
      rows?: Record<string, unknown>[];
      create?: Record<string, unknown>;
      remove?: string;
    };
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }

    if (body.remove) {
      const serviceId = String(body.remove).trim();
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

    let rawRows = body.rows;
    if ((!rawRows || !rawRows.length) && body.create) {
      const c = body.create;
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
