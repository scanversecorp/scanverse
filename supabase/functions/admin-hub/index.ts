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
 *   otp_delivery_reports — { today_only?, failed_only?, limit? }
 *   exec_stats       — executive dashboard KPIs + chart data (owner PIN only)
 *   exec_charts      — chart-only subset for refresh (owner PIN only)
 *
 * Auth: x-admin-pin header
 *   ADMIN_HUB_PIN | SUPPORT_ADMIN_PIN | PRICING_ADMIN_PIN | VENDOR_ADMIN_PIN
 *   exec_* actions require ADMIN_HUB_PIN | SUPPORT_ADMIN_PIN only
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

function resolveExecRole(req: Request): AdminRole {
  const pin = req.headers.get("x-admin-pin") || "";
  const pins = [
    Deno.env.get("ADMIN_HUB_PIN"),
    Deno.env.get("SUPPORT_ADMIN_PIN"),
  ].filter((p): p is string => !!p && p.length >= 6);
  if (pins.some((p) => pin === p)) return "support_admin";
  return null;
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function lastNDays(n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push(dayKey(d.toISOString()));
  }
  return out;
}

type PayRow = { amount?: number; amount_paise?: number; status?: string; created_at?: string; paid_at?: string; method?: string; gateway?: string; verified_via?: string };

function payAmountPaise(row: PayRow): number {
  if (row.amount_paise != null) return Number(row.amount_paise) || 0;
  return Number(row.amount) || 0;
}

function isSuccessPayment(row: PayRow): boolean {
  const s = (row.status || "").toLowerCase();
  return s === "success" || s === "paid";
}

function isFailedPayment(row: PayRow): boolean {
  const s = (row.status || "").toLowerCase();
  return s === "failed" || s === "expired";
}

function isPendingPayment(row: PayRow): boolean {
  const s = (row.status || "").toLowerCase();
  return s === "pending";
}

function paymentDay(row: PayRow): string {
  const ts = row.paid_at || row.created_at;
  return ts ? dayKey(ts) : "";
}

function aggregatePayments(rows: PayRow[]) {
  let success = 0, failed = 0, pending = 0, successPaise = 0;
  const methods: Record<string, number> = { upi: 0, razorpay: 0, other: 0 };
  for (const r of rows) {
    if (isSuccessPayment(r)) {
      success++;
      successPaise += payAmountPaise(r);
      const via = (r.verified_via || r.gateway || r.method || "").toLowerCase();
      if (via.includes("razorpay") || via.includes("razor")) methods.razorpay++;
      else if (via.includes("upi") || via.includes("vpa") || via === "upi") methods.upi++;
      else methods.other++;
    } else if (isFailedPayment(r)) failed++;
    else if (isPendingPayment(r)) pending++;
  }
  const totalAttempts = success + failed + pending;
  return {
    total: totalAttempts,
    success,
    failed,
    pending,
    success_paise: successPaise,
    avg_txn_paise: success ? Math.round(successPaise / success) : 0,
    methods,
  };
}

function revenueSince(rows: PayRow[], sinceIso: string): number {
  let sum = 0;
  for (const r of rows) {
    if (!isSuccessPayment(r)) continue;
    const ts = r.paid_at || r.created_at;
    if (ts && ts >= sinceIso) sum += payAmountPaise(r);
  }
  return sum;
}

function dailyPaymentTrend(rows: PayRow[], days = 14) {
  const keys = lastNDays(days);
  const trend: Record<string, { success: number; failed: number; revenue_paise: number }> = {};
  for (const k of keys) trend[k] = { success: 0, failed: 0, revenue_paise: 0 };
  for (const r of rows) {
    const k = paymentDay(r);
    if (!trend[k]) continue;
    if (isSuccessPayment(r)) {
      trend[k].success++;
      trend[k].revenue_paise += payAmountPaise(r);
    } else if (isFailedPayment(r)) {
      trend[k].failed++;
    }
  }
  return keys.map((date) => ({ date, ...trend[date] }));
}

async function fetchExecData(sb: ReturnType<typeof adminSb>) {
  const since30 = isoDaysAgo(30);
  const since14 = isoDaysAgo(14);
  const since7 = isoDaysAgo(7);
  const since1 = isoDaysAgo(1);
  const since24h = new Date(Date.now() - 86400000).toISOString();

  const [
    paymentsRes,
    intentsRes,
    profilesRes,
    profilesRecentRes,
    bookingsRes,
    bookingsRecentRes,
    dispatchRes,
    ticketsRes,
    agentsRes,
    vendorsRes,
    tableCounts,
  ] = await Promise.all([
    sb.from("payments").select("amount,status,method,gateway,created_at,paid_at"),
    sb.from("payment_intents").select("amount_paise,status,verified_via,created_at,paid_at"),
    sb.from("profiles").select("id,mobile_verified,created_at"),
    sb.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", since7),
    sb.from("bookings").select("id,status,total,customer_id,created_at"),
    sb.from("bookings").select("id,status,created_at").gte("created_at", since30),
    sb.from("booking_dispatch").select("status"),
    sb.from("support_tickets").select("id,status,category,assigned_agent_id,created_at,updated_at,resolved_at"),
    sb.from("support_agents").select("id,name,role,active"),
    sb.from("vendor_partners").select("id", { count: "exact", head: true }),
    Promise.all([
      sb.from("profiles").select("id", { count: "exact", head: true }),
      sb.from("bookings").select("id", { count: "exact", head: true }),
      sb.from("payments").select("id", { count: "exact", head: true }),
      sb.from("support_tickets").select("id", { count: "exact", head: true }),
      sb.from("vendor_partners").select("id", { count: "exact", head: true }),
    ]),
  ]);

  const paymentRows: PayRow[] = [
    ...(paymentsRes.data || []).map((p: PayRow) => ({ ...p, amount_paise: p.amount })),
    ...(intentsRes.data || []),
  ];

  const payAgg = aggregatePayments(paymentRows);
  const todayStart = isoDaysAgo(0);

  const profiles = profilesRes.data || [];
  const mobileVerified = profiles.filter((p: { mobile_verified?: boolean }) => p.mobile_verified).length;
  const signupsToday = profiles.filter((p: { created_at?: string }) => p.created_at && p.created_at >= todayStart).length;
  const signups7d = profilesRecentRes.count ?? profiles.filter((p: { created_at?: string }) => p.created_at && p.created_at >= since7).length;

  const bookings = bookingsRes.data || [];
  const bookingsByStatus: Record<string, number> = {};
  for (const b of bookings) {
    const s = (b as { status?: string }).status || "unknown";
    bookingsByStatus[s] = (bookingsByStatus[s] || 0) + 1;
  }
  const bookingsToday = bookings.filter((b: { created_at?: string }) => b.created_at && b.created_at >= todayStart).length;
  const bookingsWeek = bookings.filter((b: { created_at?: string }) => b.created_at && b.created_at >= since7).length;

  const activeCustomerIds = new Set(
    (bookingsRecentRes.data || []).map((b: { customer_id?: string }) => b.customer_id).filter(Boolean),
  );

  const dispatch = dispatchRes.data || [];
  const dispatchByStatus: Record<string, number> = {};
  for (const d of dispatch) {
    const s = (d as { status?: string }).status || "unknown";
    dispatchByStatus[s] = (dispatchByStatus[s] || 0) + 1;
  }

  const tickets = ticketsRes.data || [];
  const openStatuses = new Set(["new", "in_progress", "pending_customer"]);
  const ticketsByStatus: Record<string, number> = {};
  const ticketsByCategory: Record<string, number> = {};
  let ticketsToday = 0, tickets7d = 0, tickets30d = 0;
  for (const t of tickets) {
    const row = t as { status?: string; category?: string; created_at?: string };
    const st = row.status || "unknown";
    ticketsByStatus[st] = (ticketsByStatus[st] || 0) + 1;
    const cat = row.category || "other";
    ticketsByCategory[cat] = (ticketsByCategory[cat] || 0) + 1;
    if (row.created_at) {
      if (row.created_at >= todayStart) ticketsToday++;
      if (row.created_at >= since7) tickets7d++;
      if (row.created_at >= since30) tickets30d++;
    }
  }
  const openTickets = tickets.filter((t: { status?: string }) => openStatuses.has(t.status || "")).length;

  const resolvedTickets = tickets.filter((t: { resolved_at?: string }) => t.resolved_at);
  let avgResolutionHours: number | null = null;
  if (resolvedTickets.length) {
    const totalMs = resolvedTickets.reduce((sum: number, t: { resolved_at?: string; created_at?: string }) => {
      return sum + (new Date(t.resolved_at!).getTime() - new Date(t.created_at!).getTime());
    }, 0);
    avgResolutionHours = Math.round((totalMs / resolvedTickets.length / 3600000) * 10) / 10;
  }

  const agents = agentsRes.data || [];
  const agentMap = new Map(agents.map((a: { id: string; name: string; role: string; active: boolean }) => [a.id, a]));
  const workload: Record<string, { open: number; total: number }> = {};
  for (const t of tickets) {
    const aid = (t as { assigned_agent_id?: string }).assigned_agent_id;
    if (!aid) continue;
    if (!workload[aid]) workload[aid] = { open: 0, total: 0 };
    workload[aid].total++;
    if (openStatuses.has((t as { status?: string }).status || "")) workload[aid].open++;
  }
  const agentWorkload = Object.entries(workload).map(([id, w]) => {
    const a = agentMap.get(id) as { name?: string; role?: string; active?: boolean } | undefined;
    return { agent_id: id, name: a?.name || "Unknown", role: a?.role || "support_agent", active: a?.active ?? false, open: w.open, total: w.total };
  }).sort((x, y) => y.open - x.open);

  const agentsByRole = { support_agent: 0, support_admin: 0 };
  let agentsActive = 0, agentsInactive = 0;
  for (const a of agents) {
    const row = a as { role?: string; active?: boolean };
    if (row.role === "support_admin") agentsByRole.support_admin++;
    else agentsByRole.support_agent++;
    if (row.active) agentsActive++;
    else agentsInactive++;
  }

  const adminActivity7d = tickets.filter((t: { updated_at?: string; created_at?: string }) => {
    const u = (t as { updated_at?: string }).updated_at;
    return u && u >= since7 && u !== (t as { created_at?: string }).created_at;
  }).length;

  const activity24h =
    (bookingsRes.data || []).filter((b: { created_at?: string }) => b.created_at && b.created_at >= since24h).length +
    tickets.filter((t: { created_at?: string }) => t.created_at && t.created_at >= since24h).length +
    paymentRows.filter((p) => (p.created_at && p.created_at >= since24h) || (p.paid_at && p.paid_at >= since24h)).length;

  const [profilesCount, bookingsCount, paymentsCount, ticketsCount, vendorsCount] = tableCounts.map((r) => r.count ?? 0);

  const trendRows = paymentRows.filter((p) => {
    const ts = p.paid_at || p.created_at;
    return ts && ts >= since14;
  });

  return {
    generated_at: new Date().toISOString(),
    kpis: {
      revenue_today_paise: revenueSince(paymentRows, todayStart),
      revenue_7d_paise: revenueSince(paymentRows, since7),
      revenue_30d_paise: revenueSince(paymentRows, since30),
      payments_success: payAgg.success,
      payments_failed: payAgg.failed,
      payments_pending: payAgg.pending,
      avg_txn_paise: payAgg.avg_txn_paise,
      active_users_30d: activeCustomerIds.size,
      profiles_total: profiles.length,
      mobile_verified: mobileVerified,
      signups_today: signupsToday,
      signups_7d: signups7d,
      open_tickets: openTickets,
      pending_dispatch: (dispatchByStatus.pending || 0) + (dispatchByStatus.dispatching || 0),
      bookings_today: bookingsToday,
      activity_index_24h: activity24h,
    },
    payments: {
      ...payAgg,
      revenue_today_paise: revenueSince(paymentRows, todayStart),
      revenue_7d_paise: revenueSince(paymentRows, since7),
      revenue_30d_paise: revenueSince(paymentRows, since30),
      daily_trend: dailyPaymentTrend(trendRows, 14),
    },
    bookings: {
      total: bookings.length,
      by_status: bookingsByStatus,
      today: bookingsToday,
      week: bookingsWeek,
    },
    dispatch: {
      by_status: dispatchByStatus,
      pending: dispatchByStatus.pending || 0,
      assigned: dispatchByStatus.assigned || 0,
      exhausted: dispatchByStatus.exhausted || 0,
    },
    users: {
      total: profiles.length,
      mobile_verified: mobileVerified,
      signups_today: signupsToday,
      signups_7d: signups7d,
      active_30d: activeCustomerIds.size,
      signup_trend: lastNDays(14).map((date) => ({
        date,
        count: profiles.filter((p: { created_at?: string }) => p.created_at && dayKey(p.created_at) === date).length,
      })),
    },
    support: {
      total: tickets.length,
      open: openTickets,
      by_status: ticketsByStatus,
      by_category: ticketsByCategory,
      created_today: ticketsToday,
      created_7d: tickets7d,
      created_30d: tickets30d,
      avg_resolution_hours: avgResolutionHours,
      agent_workload: agentWorkload,
      open_queue: tickets.filter((t: { assigned_agent_id?: string | null; status?: string }) =>
        !t.assigned_agent_id && openStatuses.has(t.status || "")
      ).length,
    },
    admin: {
      agents_active: agentsActive,
      agents_inactive: agentsInactive,
      agents_by_role: agentsByRole,
      pin_modules: [
        "admin-hub (#admin)",
        "exec-dashboard (#exec)",
        "pricing-admin",
        "customer-support",
        "vendor-admin",
      ],
      activity_updates_7d: adminActivity7d,
    },
    infra: {
      app_version: "5.5.2",
      supabase_project: "rwlwrmmqtedugcreweut",
      edge_functions: 11,
      migrations: 14,
      latest_migration: "20260812000014_payer_vpa",
      table_counts: {
        profiles: profilesCount,
        bookings: bookingsCount,
        payments: paymentsCount,
        support_tickets: ticketsCount,
        vendor_partners: vendorsCount,
      },
      links: {
        supabase: "https://supabase.com/dashboard/project/rwlwrmmqtedugcreweut",
        vercel: "https://vercel.com/dashboard",
        github: "https://github.com",
        edge_functions: "https://supabase.com/dashboard/project/rwlwrmmqtedugcreweut/functions",
      },
      load_index_24h: activity24h,
    },
  };
}

async function execStats(sb: ReturnType<typeof adminSb>) {
  const data = await fetchExecData(sb);
  return json(data);
}

async function execCharts(sb: ReturnType<typeof adminSb>) {
  const data = await fetchExecData(sb);
  return json({
    generated_at: data.generated_at,
    payments: {
      success: data.payments.success,
      failed: data.payments.failed,
      pending: data.payments.pending,
      methods: data.payments.methods,
      daily_trend: data.payments.daily_trend,
    },
    bookings: { by_status: data.bookings.by_status },
    support: {
      by_category: data.support.by_category,
      by_status: data.support.by_status,
      agent_workload: data.support.agent_workload,
    },
    users: { signup_trend: data.users.signup_trend },
  });
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
    ticketsRes,
  ] = await Promise.all([
    sb.from("bookings").select("id,total,status", { count: "exact", head: false }).limit(5000),
    sb.from("payments").select("amount,status").eq("status", "success"),
    sb.from("vendor_partners").select("id", { count: "exact", head: true }).eq("status", "active"),
    sb.from("booking_dispatch").select("id", { count: "exact", head: true }).in("status", ["pending", "dispatching"]),
    sb.from("support_agents").select("id", { count: "exact", head: true }).eq("active", true),
    sb.from("profiles").select("id", { count: "exact", head: true }),
    sb.from("support_tickets").select("id,status,created_at,resolved_at"),
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

  const tickets = ticketsRes.data || [];
  const openTicketStatuses = new Set(["new", "in_progress", "pending_customer"]);
  const openTickets = tickets.filter((t: { status?: string }) => openTicketStatuses.has(t.status || "")).length;
  const ticketsByStatus: Record<string, number> = {};
  for (const t of tickets) {
    const s = (t as { status?: string }).status || "unknown";
    ticketsByStatus[s] = (ticketsByStatus[s] || 0) + 1;
  }
  const resolvedTickets = tickets.filter((t: { resolved_at?: string }) => t.resolved_at);
  let avgTicketResolutionHours: number | null = null;
  if (resolvedTickets.length) {
    const totalMs = resolvedTickets.reduce((sum: number, t: { resolved_at?: string; created_at?: string }) => {
      return sum + (new Date(t.resolved_at!).getTime() - new Date(t.created_at!).getTime());
    }, 0);
    avgTicketResolutionHours = Math.round((totalMs / resolvedTickets.length / 3600000) * 10) / 10;
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
    tickets_count: tickets.length,
    open_tickets: openTickets,
    tickets_by_status: ticketsByStatus,
    avg_ticket_resolution_hours: avgTicketResolutionHours,
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
    .select("id,txn_id,amount_paise,status,verified_via,paid_at,created_at,payer_vpa")
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

function isoTodayStart(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

async function otpDeliveryReports(sb: ReturnType<typeof adminSb>, body: Record<string, unknown>) {
  const todayOnly = !!body.today_only;
  const failedOnly = !!body.failed_only;
  const limit = Math.min(Number(body.limit) || 100, 500);

  let query = sb
    .from("otp_delivery_reports")
    .select("id,provider,session_id,mobile,status,raw_status,otp_context,vendor_otp_id,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (todayOnly) query = query.gte("created_at", isoTodayStart());
  if (failedOnly) query = query.eq("status", "failed");

  const { data, error } = await query;
  if (error) return json({ error: error.message }, 500);

  const rows = data || [];
  const stats = { delivered: 0, failed: 0, pending: 0, unknown: 0, total: rows.length };
  for (const r of rows) {
    const s = (r as { status?: string }).status || "unknown";
    if (s in stats && s !== "total") (stats as Record<string, number>)[s]++;
  }

  return json({ reports: rows, stats });
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

  if (action === "otp_delivery_reports") {
    return otpDeliveryReports(sb, body);
  }

  if (action === "exec_stats" || action === "exec_charts") {
    const execRole = resolveExecRole(req);
    if (!execRole) {
      return json({ error: "Executive dashboard requires ADMIN_HUB_PIN or SUPPORT_ADMIN_PIN" }, 403);
    }
    if (action === "exec_stats") return execStats(sb);
    return execCharts(sb);
  }

  return json({ error: "Unknown action" }, 400);
});
