/**
 * ScanV Admin Hub API
 *
 * Actions (POST body):
 *   whoami           — verify PIN, return role
 *   stats            — dashboard counts
 *   list_agents      — all support_agents (admin only)
 *   create_agent     — { name, email?, phone?, role?, notes? }
 *   update_agent     — { id, name?, email?, phone?, role?, notes?, active? }
 *   deactivate_agent — { id }  sets active=false
 *   search_bookings  — { q?, status?, limit? }
 *   list_payments    — { q?, limit? }
 *
 * Auth: x-admin-pin header
 *   ADMIN_HUB_PIN | SUPPORT_ADMIN_PIN | PRICING_ADMIN_PIN | VENDOR_ADMIN_PIN
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-pin",
};

type AdminRole = "support_admin" | null;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function adminSb() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}

function resolveRole(req: Request): AdminRole {
  const pin = req.headers.get("x-admin-pin") || "";
  const pins = [
    Deno.env.get("ADMIN_HUB_PIN"),
    Deno.env.get("SUPPORT_ADMIN_PIN"),
    Deno.env.get("PRICING_ADMIN_PIN"),
    Deno.env.get("VENDOR_ADMIN_PIN"),
  ].filter((p): p is string => !!p && p.length >= 6);
  if (pins.some((p) => pin === p)) return "support_admin";
  return null;
}

function escIlike(q: string): string {
  return q.replace(/[%_\\]/g, "\\$&");
}

async function hubStats(sb: ReturnType<typeof adminSb>) {
  const [
    bookingsRes,
    paymentsRes,
    vendorsRes,
    dispatchRes,
    agentsRes,
    profilesRes,
  ] = await Promise.all([
    sb.from("bookings").select("id,total,status", { count: "exact", head: false }).limit(5000),
    sb.from("payments").select("amount,status").eq("status", "success"),
    sb.from("vendor_partners").select("id", { count: "exact", head: true }).eq("status", "active"),
    sb.from("booking_dispatch").select("id", { count: "exact", head: true }).in("status", ["pending", "dispatching"]),
    sb.from("support_agents").select("id", { count: "exact", head: true }).eq("active", true),
    sb.from("profiles").select("id", { count: "exact", head: true }),
  ]);

  const bookings = bookingsRes.data || [];
  const revenuePaise = (paymentsRes.data || []).reduce(
    (sum: number, p: { amount?: number }) => sum + (Number(p.amount) || 0),
    0,
  );
  const bookingRevenue = bookings.reduce(
    (sum: number, b: { total?: number }) => sum + (Number(b.total) || 0),
    0,
  );

  const byStatus: Record<string, number> = {};
  for (const b of bookings) {
    const s = (b as { status?: string }).status || "unknown";
    byStatus[s] = (byStatus[s] || 0) + 1;
  }

  return json({
    bookings_count: bookingsRes.count ?? bookings.length,
    bookings_by_status: byStatus,
    revenue_paise: revenuePaise,
    booking_total_paise: bookingRevenue,
    active_vendors: vendorsRes.count ?? 0,
    pending_dispatches: dispatchRes.count ?? 0,
    active_support_agents: agentsRes.count ?? 0,
    profiles_count: profilesRes.count ?? 0,
  });
}

async function listAgents(sb: ReturnType<typeof adminSb>) {
  const { data, error } = await sb
    .from("support_agents")
    .select("id,name,email,phone,role,active,notes,created_at,updated_at")
    .order("created_at", { ascending: false });
  if (error) return json({ error: error.message }, 500);
  return json({ agents: data || [] });
}

async function createAgent(sb: ReturnType<typeof adminSb>, body: Record<string, unknown>) {
  const name = String(body.name || "").trim();
  if (!name) return json({ error: "name required" }, 400);
  const role = String(body.role || "support_agent");
  if (!["support_agent", "support_admin"].includes(role)) {
    return json({ error: "role must be support_agent or support_admin" }, 400);
  }
  const row = {
    name,
    email: body.email ? String(body.email).trim() : null,
    phone: body.phone ? String(body.phone).trim() : null,
    role,
    notes: body.notes ? String(body.notes).trim() : null,
    active: body.active !== false,
  };
  const { data, error } = await sb.from("support_agents").insert(row).select().single();
  if (error) return json({ error: error.message }, 500);
  return json({ agent: data });
}

async function updateAgent(sb: ReturnType<typeof adminSb>, body: Record<string, unknown>) {
  const id = String(body.id || "");
  if (!id) return json({ error: "id required" }, 400);
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.name !== undefined) patch.name = String(body.name).trim();
  if (body.email !== undefined) patch.email = body.email ? String(body.email).trim() : null;
  if (body.phone !== undefined) patch.phone = body.phone ? String(body.phone).trim() : null;
  if (body.notes !== undefined) patch.notes = body.notes ? String(body.notes).trim() : null;
  if (body.role !== undefined) {
    const role = String(body.role);
    if (!["support_agent", "support_admin"].includes(role)) {
      return json({ error: "invalid role" }, 400);
    }
    patch.role = role;
  }
  if (body.active !== undefined) patch.active = !!body.active;
  if (body.is_active !== undefined) patch.active = !!body.is_active;

  const { data, error } = await sb
    .from("support_agents")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) return json({ error: error.message }, 500);
  return json({ agent: data });
}

async function deactivateAgent(sb: ReturnType<typeof adminSb>, body: Record<string, unknown>) {
  return updateAgent(sb, { id: body.id, active: false });
}

async function searchBookings(sb: ReturnType<typeof adminSb>, body: Record<string, unknown>) {
  const q = String(body.q || "").trim();
  const status = body.status ? String(body.status) : null;
  const limit = Math.min(Number(body.limit) || 50, 100);

  let query = sb
    .from("bookings")
    .select("id,customer_id,service_name,date,time,status,total,txn_id,paid_at,location_text,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status && status !== "all") query = query.eq("status", status);
  if (q) {
    const like = `%${escIlike(q)}%`;
    query = query.or(
      `id.ilike.${like},customer_id.ilike.${like},service_name.ilike.${like},txn_id.ilike.${like},location_text.ilike.${like}`,
    );
  }

  const { data, error } = await query;
  if (error) return json({ error: error.message }, 500);
  return json({ bookings: data || [] });
}

async function listPayments(sb: ReturnType<typeof adminSb>, body: Record<string, unknown>) {
  const q = String(body.q || "").trim();
  const limit = Math.min(Number(body.limit) || 50, 100);

  let query = sb
    .from("payment_intents")
    .select("id,txn_id,amount_paise,status,verified_via,paid_at,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (q) {
    const like = `%${escIlike(q)}%`;
    query = query.or(`txn_id.ilike.${like},id.ilike.${like}`);
  }

  const { data, error } = await query;
  if (error) return json({ error: error.message }, 500);
  return json({ payment_intents: data || [] });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const role = resolveRole(req);
  if (!role) {
    return json({ error: "Unauthorized" }, 401);
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const action = String(body.action || "");
  const sb = adminSb();

  if (action === "whoami") {
    return json({ role, admin: true });
  }

  if (action === "stats") {
    return hubStats(sb);
  }

  if (action === "list_agents") {
    return listAgents(sb);
  }

  if (action === "create_agent") {
    return createAgent(sb, body);
  }

  if (action === "update_agent") {
    return updateAgent(sb, body);
  }

  if (action === "deactivate_agent") {
    return deactivateAgent(sb, body);
  }

  if (action === "search_bookings") {
    return searchBookings(sb, body);
  }

  if (action === "list_payments") {
    return listPayments(sb, body);
  }

  return json({ error: "Unknown action" }, 400);
});
