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
 *   search_bookings  — { q?, status?, customer_id?, date_from?, date_to?, limit? }
 *   booking_detail   — { booking_id }
 *   update_booking   — { booking_id, patch: { status?, notes?, partner_id?, date?, time?, location_text? } }
 *   cancel_booking   — { booking_id, cancel_reason? }
 *   list_payments    — { q?, limit? }
 *   otp_delivery_reports — { today_only?, failed_only?, limit? }
 *   exec_stats       — executive dashboard KPIs + chart data (owner PIN only)
 *   exec_charts      — chart-only subset for refresh (owner PIN only)
 *   get_platform_settings — { keys? } dispatch_mode etc.
 *   get_go_live_config — switches + secret status (no values)
 *   update_go_live_switch — { key, enabled } owner PIN only
 *   update_go_live_check — { key, checked } manual checklist tick
 *   gps_status_report — { audience?, date_from?, date_to?, search?, status_filter? }
 *   pricing_2fa_status — { enrolled, owner_configured, owner_mobile_masked }
 *   pricing_2fa_reset_send — SMS/voice OTP to PRICING_2FA_RESET_MOBILE (exec PIN only)
 *   pricing_2fa_reset_confirm — { otp } clears pricing admin TOTP enrollment
 *
 * Auth: x-admin-pin header
 *   ADMIN_HUB_PIN | SUPPORT_ADMIN_PIN | PRICING_ADMIN_PIN | VENDOR_ADMIN_PIN
 *   exec_* actions require ADMIN_HUB_PIN | SUPPORT_ADMIN_PIN only
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  bookingDetailAdmin,
  cancelBookingAdmin,
  searchBookingsAdmin,
  updateBookingAdmin,
} from "../_shared/bookings-admin.ts";
import {
  listInvestmentRequests,
  respondInvestmentRequest,
} from "../_shared/investments-admin.ts";
import { gpsStatusReport, runDailyGpsCheck } from "../_shared/gps-status-admin.ts";
import {
  normalizeMobile,
  hashOtp,
  generateOtp,
  sendOtpDelivery,
} from "../_shared/notify.ts";
import {
  GO_LIVE_SWITCH_KEYS,
} from "../_shared/platform-settings.ts";
import {
  buildGoLiveConfig,
  updateGoLiveCheck,
} from "../_shared/go-live-config.ts";
import {
  EXEC_ONLY_SWITCH_KEYS,
  otpDeliveryVendorOpts,
} from "../_shared/vendor-providers.ts";

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
      app_version: "5.5.3",
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
  try {
    const bookings = await searchBookingsAdmin(sb, body);
    return json({ bookings });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Search failed";
    return json({ error: msg }, 500);
  }
}

async function bookingDetail(sb: ReturnType<typeof adminSb>, body: Record<string, unknown>) {
  const bookingId = String(body.booking_id || "").trim();
  if (!bookingId) return json({ error: "booking_id required" }, 400);
  try {
    const detail = await bookingDetailAdmin(sb, bookingId);
    return json(detail);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Not found";
    return json({ error: msg }, msg === "Booking not found" ? 404 : 500);
  }
}

async function updateBooking(sb: ReturnType<typeof adminSb>, body: Record<string, unknown>) {
  try {
    const booking = await updateBookingAdmin(sb, body);
    return json({ success: true, booking });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Update failed";
    return json({ error: msg }, 400);
  }
}

async function cancelBooking(sb: ReturnType<typeof adminSb>, body: Record<string, unknown>) {
  try {
    const result = await cancelBookingAdmin(sb, body, "admin-hub");
    return json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Cancel failed";
    return json({ error: msg }, 400);
  }
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

const DISPATCH_MODES = new Set(["both", "in_app", "external", "disabled"]);

async function getPlatformSettings(
  sb: ReturnType<typeof adminSb>,
  keys?: string[],
): Promise<Response> {
  let q = sb.from("platform_settings").select("key, value, description, updated_at, updated_by");
  if (keys?.length) q = q.in("key", keys);
  const { data, error } = await q.order("key");
  if (error) return json({ error: error.message }, 500);
  const settings: Record<string, string> = {};
  for (const row of data || []) {
    settings[String((row as { key: string }).key)] = String((row as { value: string }).value);
  }
  return json({
    settings,
    rows: data || [],
    dispatch_mode: settings.dispatch_mode || "both",
    dispatch_mode_options: [
      { value: "both", label: "In-app + SMS/call/WhatsApp backup", description: "Sequential in-app job offers to nearest partners one-by-one, plus SMS/call/WhatsApp backup for each offer." },
      { value: "in_app", label: "In-app only", description: "Partners accept/reject inside ScanV app only — no SMS/call/WhatsApp." },
      { value: "external", label: "External only (legacy)", description: "SMS, outbound call, and WhatsApp only — no in-app job cards." },
      { value: "disabled", label: "Dispatch disabled", description: "No automatic partner alerts after payment." },
    ],
  });
}

async function updatePlatformSetting(
  sb: ReturnType<typeof adminSb>,
  body: Record<string, unknown>,
): Promise<Response> {
  const key = String(body.key || "").trim();
  const value = String(body.value || "").trim().toLowerCase();
  if (!key) return json({ error: "key required" }, 400);
  if (key === "dispatch_mode" && !DISPATCH_MODES.has(value)) {
    return json({ error: "Invalid dispatch_mode — use both, in_app, external, or disabled" }, 400);
  }
  const { data, error } = await sb
    .from("platform_settings")
    .upsert({
      key,
      value,
      updated_by: body.updated_by ? String(body.updated_by) : "admin-hub",
    }, { onConflict: "key" })
    .select("key, value, description, updated_at, updated_by")
    .single();
  if (error) return json({ error: error.message }, 500);
  return json({ success: true, setting: data });
}

const PRICING_TOTP_SECRET_KEY = "pricing_admin_totp_secret";
const PRICING_TOTP_PENDING_KEY = "pricing_admin_totp_pending";
const PRICING_2FA_RESET_PURPOSE = "pricing_2fa_reset";

function ownerResetMobile(): string | null {
  const raw = Deno.env.get("PRICING_2FA_RESET_MOBILE")
    || Deno.env.get("ADMIN_OWNER_MOBILE")
    || "";
  return normalizeMobile(String(raw).trim());
}

function maskMobile10(mobile: string): string {
  const d = mobile.replace(/\D/g, "").slice(-10);
  return d.length === 10 ? `******${d.slice(-4)}` : "**********";
}

async function pricing2faStatus(sb: ReturnType<typeof adminSb>): Promise<Response> {
  const { data } = await sb.from("platform_settings").select("value").eq("key", PRICING_TOTP_SECRET_KEY).maybeSingle();
  const enrolled = !!String(data?.value || "").trim();
  const owner = ownerResetMobile();
  return json({
    enrolled,
    owner_configured: !!owner,
    owner_mobile_masked: owner ? maskMobile10(owner) : null,
  });
}

async function pricing2faResetSend(sb: ReturnType<typeof adminSb>): Promise<Response> {
  const owner = ownerResetMobile();
  if (!owner) {
    return json({
      error: "Set PRICING_2FA_RESET_MOBILE in Supabase secrets (owner phone for 2FA reset)",
    }, 503);
  }

  const { data: enrolledRow } = await sb.from("platform_settings").select("value").eq("key", PRICING_TOTP_SECRET_KEY).maybeSingle();
  if (!String(enrolledRow?.value || "").trim()) {
    return json({ error: "Pricing admin 2FA is not enrolled — nothing to reset" }, 400);
  }

  const otp = generateOtp();
  const otpHash = await hashOtp(otp);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const { error: insertErr } = await sb.from("vendor_otp").insert({
    mobile: owner,
    otp_hash: otpHash,
    purpose: PRICING_2FA_RESET_PURPOSE,
    expires_at: expiresAt,
  });
  if (insertErr) return json({ error: insertErr.message }, 500);

  const allowVoice = await isPlatformFlagOn(sb, "voice_otp_fallback", { defaultValue: true });
  const message = `ScanV Admin: pricing 2FA reset code ${otp}. Valid 10 min. Do not share.`;
  const vendorOpts = await otpDeliveryVendorOpts(sb, allowVoice);
  const delivery = await sendOtpDelivery(owner, otp, message, vendorOpts);

  if (delivery.ref) {
    await sb.from("vendor_otp")
      .update({ session_id: delivery.ref })
      .eq("mobile", owner)
      .eq("otp_hash", otpHash)
      .eq("purpose", PRICING_2FA_RESET_PURPOSE)
      .eq("verified", false);
  }

  const devMode = !delivery.ok && await isPlatformFlagOn(sb, "otp_dev_mode", { envFallbackKey: "OTP_DEV_MODE" });
  if (!delivery.ok && !devMode) {
    return json({ success: false, error: delivery.error || "Could not send reset OTP" }, 502);
  }

  return json({
    success: true,
    owner_mobile_masked: maskMobile10(owner),
    channel: delivery.channel || "sms",
    provider: delivery.provider || (devMode ? "dev" : undefined),
    ...(devMode ? { dev_otp: otp } : {}),
  });
}

async function pricing2faResetConfirm(
  sb: ReturnType<typeof adminSb>,
  body: Record<string, unknown>,
): Promise<Response> {
  const owner = ownerResetMobile();
  if (!owner) return json({ error: "Owner mobile not configured" }, 503);

  const confirmPhrase = String(body.confirm_phrase || "").trim();
  const phraseOk = confirmPhrase === "RESET PRICING 2FA";

  const otp = String(body.otp || "").replace(/\D/g, "");
  if (!phraseOk && otp.length !== 6) {
    return json({ error: "Enter 6-digit OTP or owner confirm phrase" }, 400);
  }

  if (!phraseOk) {
    const otpHash = await hashOtp(otp);
    const { data: row } = await sb
      .from("vendor_otp")
      .select("id")
      .eq("mobile", owner)
      .eq("otp_hash", otpHash)
      .eq("purpose", PRICING_2FA_RESET_PURPOSE)
      .eq("verified", false)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!row?.id) return json({ error: "Invalid or expired reset code" }, 401);
    await sb.from("vendor_otp").update({ verified: true }).eq("id", row.id);
  }

  await sb.from("platform_settings").delete().eq("key", PRICING_TOTP_SECRET_KEY);
  await sb.from("platform_settings").delete().eq("key", PRICING_TOTP_PENDING_KEY);

  return json({
    success: true,
    method: phraseOk ? "pin_confirm" : "sms_otp",
    message: "Pricing admin 2FA reset — open Pricing Admin and scan a new authenticator QR",
  });
}

const REFUND_STATUSES = new Set([
  "refund_pending",
  "processing",
  "completed",
  "rejected",
]);

async function listPendingRefunds(
  sb: ReturnType<typeof adminSb>,
  body: Record<string, unknown>,
): Promise<Response> {
  const statusFilter = String(body.status || "open");
  let query = sb
    .from("booking_cancellations")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(Math.min(Number(body.limit) || 100, 200));

  if (statusFilter === "open") {
    query = query.in("refund_status", ["refund_pending", "processing"]);
  } else if (statusFilter !== "all" && REFUND_STATUSES.has(statusFilter)) {
    query = query.eq("refund_status", statusFilter);
  }

  const { data, error } = await query;
  if (error) return json({ error: error.message }, 500);

  const rows = data || [];
  const bookingIds = [...new Set(rows.map((r: { booking_id: string }) => r.booking_id))];
  const customerIds = [...new Set(rows.map((r: { customer_id: string }) => r.customer_id))];

  const [{ data: bookings }, { data: profiles }] = await Promise.all([
    bookingIds.length
      ? sb.from("bookings").select("id, service_name, date, time, customer_name").in("id", bookingIds)
      : Promise.resolve({ data: [] }),
    customerIds.length
      ? sb.from("profiles").select("id, first_name, last_name, phone, email").in("id", customerIds)
      : Promise.resolve({ data: [] }),
  ]);

  const bookingById = Object.fromEntries((bookings || []).map((b: { id: string }) => [b.id, b]));
  const profileById = Object.fromEntries((profiles || []).map((p: { id: string }) => [p.id, p]));
  const now = Date.now();

  const enriched = rows.map((row: Record<string, unknown>) => ({
    ...row,
    booking: bookingById[String(row.booking_id)] || null,
    customer: profileById[String(row.customer_id)] || null,
    overdue: row.refund_due_by
      ? new Date(String(row.refund_due_by)).getTime() < now &&
        row.refund_status !== "completed" &&
        row.refund_status !== "rejected"
      : false,
  }));

  return json({
    cancellations: enriched,
    count: enriched.length,
    open_count: enriched.filter((r: { refund_status: string }) =>
      r.refund_status === "refund_pending" || r.refund_status === "processing"
    ).length,
  });
}

async function updateRefund(
  sb: ReturnType<typeof adminSb>,
  body: Record<string, unknown>,
): Promise<Response> {
  const cancellationId = String(body.cancellation_id || "");
  const newStatus = String(body.refund_status || "");
  const processNote = body.process_note != null
    ? String(body.process_note).trim()
    : null;

  if (!cancellationId) return json({ error: "cancellation_id required" }, 400);
  if (!REFUND_STATUSES.has(newStatus)) {
    return json({ error: "Invalid refund_status" }, 400);
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

  const patch: Record<string, unknown> = {
    refund_status: newStatus,
    ...(processNote ? { process_note: processNote } : {}),
  };
  if (newStatus === "completed" || newStatus === "rejected") {
    patch.processed_by = "admin-hub";
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

async function getGoLiveConfig(sb: ReturnType<typeof adminSb>): Promise<Response> {
  const payload = await buildGoLiveConfig(sb);
  return json(payload);
}

async function updateGoLiveSwitch(
  sb: ReturnType<typeof adminSb>,
  body: Record<string, unknown>,
  req: Request,
): Promise<Response> {
  const key = String(body.key || "").trim();
  if (!GO_LIVE_SWITCH_KEYS.has(key)) {
    return json({ error: "Invalid switch key" }, 400);
  }
  if (EXEC_ONLY_SWITCH_KEYS.has(key) && !resolveExecRole(req)) {
    return json({ error: "Owner PIN (ADMIN_HUB_PIN or SUPPORT_ADMIN_PIN) required for this switch" }, 403);
  }
  const enabled = body.enabled === true || body.enabled === 1 || body.enabled === "1";
  return updatePlatformSetting(sb, {
    key,
    value: enabled ? "1" : "0",
    updated_by: "admin-go-live-ui",
  });
}

async function updateGoLiveCheckAction(
  sb: ReturnType<typeof adminSb>,
  body: Record<string, unknown>,
): Promise<Response> {
  const key = String(body.key || "").trim();
  const checked = body.checked === true || body.checked === 1 || body.checked === "1";
  const result = await updateGoLiveCheck(sb, key, checked);
  if (result.error) return json({ error: result.error }, 400);
  return json({ success: true, key, checked });
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

  if (action === "booking_detail") {
    return bookingDetail(sb, body);
  }

  if (action === "update_booking") {
    return updateBooking(sb, body);
  }

  if (action === "cancel_booking") {
    return cancelBooking(sb, body);
  }

  if (action === "list_payments") {
    return listPayments(sb, body);
  }

  if (action === "list_pending_refunds") {
    return listPendingRefunds(sb, body);
  }

  if (action === "update_refund") {
    return updateRefund(sb, body);
  }

  if (action === "list_investments") {
    try {
      const requests = await listInvestmentRequests(sb, body);
      return json({ requests, count: requests.length });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "List failed";
      return json({ error: msg }, 500);
    }
  }

  if (action === "respond_investment") {
    try {
      const request = await respondInvestmentRequest(sb, body, "admin");
      return json({ success: true, request });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Respond failed";
      return json({ error: msg }, 400);
    }
  }

  if (action === "otp_delivery_reports") {
    return otpDeliveryReports(sb, body);
  }

  if (action === "get_platform_settings") {
    const keys = Array.isArray(body.keys)
      ? body.keys.map((k) => String(k))
      : undefined;
    return getPlatformSettings(sb, keys);
  }

  if (action === "update_platform_setting") {
    return updatePlatformSetting(sb, body);
  }

  if (action === "get_go_live_config") {
    return getGoLiveConfig(sb);
  }

  if (action === "update_go_live_switch") {
    return updateGoLiveSwitch(sb, body, req);
  }

  if (action === "update_go_live_check") {
    return updateGoLiveCheckAction(sb, body);
  }

  if (action === "gps_status_report") {
    try {
      const result = await gpsStatusReport(sb, body);
      return json(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "GPS report failed";
      return json({ error: msg }, 500);
    }
  }

  if (action === "run_daily_gps_check") {
    try {
      const result = await runDailyGpsCheck(sb, body);
      return json({ success: true, ...result });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Daily GPS check failed";
      return json({ error: msg }, 500);
    }
  }

  if (action === "exec_stats" || action === "exec_charts") {
    const execRole = resolveExecRole(req);
    if (!execRole) {
      return json({ error: "Executive dashboard requires ADMIN_HUB_PIN or SUPPORT_ADMIN_PIN" }, 403);
    }
    if (action === "exec_stats") return execStats(sb);
    return execCharts(sb);
  }

  if (action === "pricing_2fa_status" || action === "pricing_2fa_reset_send" || action === "pricing_2fa_reset_confirm") {
    const execRole = resolveExecRole(req);
    if (!execRole) {
      return json({ error: "Reset pricing 2FA requires ADMIN_HUB_PIN or SUPPORT_ADMIN_PIN" }, 403);
    }
    if (action === "pricing_2fa_status") return pricing2faStatus(sb);
    if (action === "pricing_2fa_reset_send") return pricing2faResetSend(sb);
    return pricing2faResetConfirm(sb, body);
  }

  return json({ error: "Unknown action" }, 400);
});
