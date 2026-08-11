/**
 * ScanV confidential pricing admin API
 * GET  — list all pricing rows (requires x-pricing-pin)
 * POST — upsert rows { rows: [...] } (requires x-pricing-pin)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-pricing-pin",
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
      .order("sub_card")
      .order("service_name");
    if (error) return json({ error: error.message }, 500);
    return json({ rows: data || [] });
  }

  if (req.method === "POST") {
    let body: { rows?: Record<string, unknown>[] };
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }

    const rows = body.rows;
    if (!Array.isArray(rows) || !rows.length) {
      return json({ error: "rows array required" }, 400);
    }

    const upserts = rows.map((r) => {
      const newAmt = Number(r.new_amount_paise) || 0;
      const partnerPct = Number(r.partner_pct ?? 70);
      const split = splitAmounts(newAmt, partnerPct);
      return {
        service_id: String(r.service_id),
        card: String(r.card || ""),
        sub_card: String(r.sub_card || "—"),
        service_name: String(r.service_name || ""),
        sub_service_name: r.sub_service_name ? String(r.sub_service_name) : null,
        current_amount_paise: Number(r.current_amount_paise) || newAmt,
        new_amount_paise: newAmt,
        ...split,
        updated_at: new Date().toISOString(),
      };
    });

    const { data, error } = await sb
      .from("service_pricing")
      .upsert(upserts, { onConflict: "service_id" })
      .select();

    if (error) return json({ error: error.message }, 500);
    return json({ success: true, rows: data, count: data?.length || 0 });
  }

  return json({ error: "Method not allowed" }, 405);
});
