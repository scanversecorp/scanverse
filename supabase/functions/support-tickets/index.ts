/**
 * ScanV Support Tickets API
 *
 * Public actions (no PIN):
 *   create — submit report form
 *   track  — { ticket_number, mobile } minimal status lookup (no agent timeline)
 *
 * Agent actions (x-support-pin or leader PIN):
 *   search, detail, update_status, add_comment, resolve, stats, list_agents
 *
 * Admin hub (x-admin-pin): same agent actions + stats
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  corsHeaders,
  json,
  sendSms,
  sendEmail,
  ticketClosureMessage,
  normalizeMobile,
} from "../_shared/notify.ts";

type AgentRole = "support_agent" | "support_admin" | null;

function adminSb() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

function resolveAgentRole(req: Request): AgentRole {
  const pin = req.headers.get("x-support-pin") || req.headers.get("x-admin-pin") || "";
  const adminPin = Deno.env.get("SUPPORT_ADMIN_PIN") || "";
  const agentPin = Deno.env.get("SUPPORT_AGENT_PIN") || "";
  if (adminPin.length >= 6 && pin === adminPin) return "support_admin";
  if (agentPin.length >= 6 && pin === agentPin) return "support_agent";
  const leaderPins = [
    Deno.env.get("ADMIN_HUB_PIN"),
    Deno.env.get("PRICING_ADMIN_PIN"),
    Deno.env.get("VENDOR_ADMIN_PIN"),
  ].filter((p): p is string => !!p && p.length >= 6);
  if (leaderPins.some((p) => pin === p)) return "support_admin";
  return null;
}

function escIlike(q: string): string {
  return q.replace(/[%_\\]/g, "\\$&");
}

function generateTicketNumber(): string {
  return `TKT-${Date.now()}`;
}

function mobileMatches(stored: string, provided: string): boolean {
  const a = digitsOnly(stored);
  const b = digitsOnly(provided);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.slice(-10) === b.slice(-10)) return true;
  // last-4 verification for track
  if (b.length === 4 && a.slice(-4) === b) return true;
  return false;
}

async function addComment(
  sb: ReturnType<typeof adminSb>,
  ticketId: string,
  authorType: string,
  authorName: string | null,
  body: string,
  isInternal = false,
) {
  const { error } = await sb.from("support_ticket_comments").insert({
    ticket_id: ticketId,
    author_type: authorType,
    author_name: authorName,
    body,
    is_internal: isInternal,
  });
  if (error) throw new Error(error.message);
}

async function createTicket(sb: ReturnType<typeof adminSb>, body: Record<string, unknown>) {
  const name = String(body.reporter_name || body.name || "").trim();
  const mobile = String(body.reporter_mobile || body.mobile || "").trim();
  const subject = String(body.subject || "").trim();
  const description = String(body.description || "").trim();
  const category = String(body.category || "other");

  if (!name || !mobile || !subject || !description) {
    return json({ error: "name, mobile, subject, and description are required" }, 400);
  }
  if (!["booking", "payment", "service", "other"].includes(category)) {
    return json({ error: "invalid category" }, 400);
  }

  const normMobile = normalizeMobile(mobile) || mobile;
  const ticketNumber = generateTicketNumber();

  // Link profile if exists
  let customerId: string | null = null;
  const phone10 = digitsOnly(normMobile).slice(-10);
  if (phone10.length === 10) {
    const { data: profiles } = await sb
      .from("profiles")
      .select("id")
      .or(`phone.ilike.%${phone10}%,phone.ilike.%${escIlike(normMobile)}%`)
      .limit(1);
    customerId = profiles?.[0]?.id || null;
  }

  const row = {
    ticket_number: ticketNumber,
    customer_id: customerId,
    reporter_name: name,
    reporter_mobile: normMobile,
    reporter_email: body.reporter_email ? String(body.reporter_email).trim() : null,
    category,
    subject,
    description,
    status: "new",
    priority: String(body.priority || "medium"),
    booking_id: body.booking_id || null,
    txn_id: body.txn_id ? String(body.txn_id).trim() : null,
  };

  const { data: ticket, error } = await sb.from("support_tickets").insert(row).select().single();
  if (error) return json({ error: error.message }, 500);

  await addComment(
    sb,
    ticket.id,
    "system",
    "ScanV",
    `Ticket ${ticketNumber} created. Category: ${category}.`,
  );

  return json({
    success: true,
    ticket_number: ticketNumber,
    ticket,
    track_url: `https://scanv-tau.vercel.app/#track-ticket?id=${ticketNumber}`,
  });
}

async function trackTicket(sb: ReturnType<typeof adminSb>, body: Record<string, unknown>) {
  const ticketNumber = String(body.ticket_number || body.ticket || "").trim().toUpperCase();
  const mobile = String(body.mobile || body.reporter_mobile || "").trim();

  if (!ticketNumber || !mobile) {
    return json({ error: "ticket_number and mobile required" }, 400);
  }

  const { data: ticket, error } = await sb
    .from("support_tickets")
    .select("*, support_agents(name)")
    .eq("ticket_number", ticketNumber)
    .maybeSingle();

  if (error) return json({ error: error.message }, 500);
  if (!ticket) return json({ error: "Ticket not found" }, 404);
  if (!mobileMatches(ticket.reporter_mobile, mobile)) {
    return json({ error: "Mobile number does not match this ticket" }, 403);
  }

  // Customer-facing lookup: status, subject, last update only — no agent timeline
  const closed = ticket.status === "resolved" || ticket.status === "closed";
  return json({
    ticket: {
      ticket_number: ticket.ticket_number,
      status: ticket.status,
      subject: ticket.subject,
      updated_at: ticket.updated_at,
      created_at: ticket.created_at,
      closure_note: closed && ticket.closure_note ? ticket.closure_note : null,
    },
  });
}

async function searchTickets(sb: ReturnType<typeof adminSb>, body: Record<string, unknown>) {
  const q = String(body.q || "").trim();
  const status = String(body.status || "all");
  const limit = Math.min(Number(body.limit) || 50, 100);

  let query = sb
    .from("support_tickets")
    .select("*, support_agents(name)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status !== "all") query = query.eq("status", status);

  if (q) {
    const like = `%${escIlike(q)}%`;
    const d = digitsOnly(q);
    if (q.toUpperCase().startsWith("TKT-")) {
      query = query.eq("ticket_number", q.toUpperCase());
    } else if (d.length >= 4) {
      query = query.or(
        `ticket_number.ilike.${like},reporter_name.ilike.${like},subject.ilike.${like},reporter_mobile.ilike.%${d}%,txn_id.ilike.${like}`,
      );
    } else {
      query = query.or(
        `ticket_number.ilike.${like},reporter_name.ilike.${like},subject.ilike.${like},txn_id.ilike.${like}`,
      );
    }
  }

  const { data, error } = await query;
  if (error) return json({ error: error.message }, 500);

  const tickets = (data || []).map((t: Record<string, unknown> & { support_agents?: { name?: string } }) => ({
    ...t,
    assigned_agent_name: t.support_agents?.name || null,
    support_agents: undefined,
  }));

  return json({ tickets, count: tickets.length });
}

async function ticketDetail(sb: ReturnType<typeof adminSb>, body: Record<string, unknown>) {
  const id = String(body.id || "");
  const ticketNumber = String(body.ticket_number || "").trim().toUpperCase();

  if (!id && !ticketNumber) return json({ error: "id or ticket_number required" }, 400);

  let query = sb.from("support_tickets").select("*, support_agents(name)");
  query = id ? query.eq("id", id) : query.eq("ticket_number", ticketNumber);

  const { data: ticket, error } = await query.maybeSingle();
  if (error) return json({ error: error.message }, 500);
  if (!ticket) return json({ error: "Ticket not found" }, 404);

  const { data: comments } = await sb
    .from("support_ticket_comments")
    .select("*")
    .eq("ticket_id", ticket.id)
    .order("created_at", { ascending: true });

  return json({
    ticket: {
      ...ticket,
      assigned_agent_name: ticket.support_agents?.name || null,
      support_agents: undefined,
    },
    comments: comments || [],
  });
}

async function updateStatus(sb: ReturnType<typeof adminSb>, body: Record<string, unknown>, agentName: string) {
  const id = String(body.id || "");
  const status = String(body.status || "");
  const priority = body.priority !== undefined ? String(body.priority) : undefined;
  const assignedAgentId = body.assigned_agent_id !== undefined ? body.assigned_agent_id : undefined;

  if (!id || !status) return json({ error: "id and status required" }, 400);

  const validStatuses = ["new", "in_progress", "pending_customer", "resolved", "closed", "cancelled"];
  if (!validStatuses.includes(status)) return json({ error: "invalid status" }, 400);

  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (priority) patch.priority = priority;
  if (assignedAgentId !== undefined) patch.assigned_agent_id = assignedAgentId || null;
  if (status === "resolved") patch.resolved_at = new Date().toISOString();
  if (status === "closed") patch.closed_at = new Date().toISOString();

  const { data: ticket, error } = await sb
    .from("support_tickets")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) return json({ error: error.message }, 500);

  await addComment(
    sb,
    id,
    "agent",
    agentName,
    `Status changed to **${status.replace(/_/g, " ")}**${priority ? ` · Priority: ${priority}` : ""}.`,
  );

  return json({ success: true, ticket });
}

async function addAgentComment(
  sb: ReturnType<typeof adminSb>,
  body: Record<string, unknown>,
  agentName: string,
) {
  const id = String(body.id || body.ticket_id || "");
  const commentBody = String(body.body || body.comment || "").trim();
  const isInternal = body.is_internal === true || body.is_internal === "true";
  if (!id || !commentBody) return json({ error: "id and body required" }, 400);

  await addComment(sb, id, "agent", agentName, commentBody, isInternal);

  await sb.from("support_tickets").update({ updated_at: new Date().toISOString() }).eq("id", id);

  return json({ success: true });
}

async function listAgents(sb: ReturnType<typeof adminSb>) {
  const { data, error } = await sb
    .from("support_agents")
    .select("id, name, email, role, active")
    .eq("active", true)
    .order("name");
  if (error) return json({ error: error.message }, 500);
  return json({ agents: data || [] });
}

async function resolveTicket(
  sb: ReturnType<typeof adminSb>,
  body: Record<string, unknown>,
  agentName: string,
  role: AgentRole,
) {
  if (role !== "support_admin" && role !== "support_agent") {
    return json({ error: "Agent PIN required" }, 403);
  }

  const id = String(body.id || "");
  const closureNote = String(body.closure_note || "").trim();
  const notifySms = body.notify_sms === true || body.notify_sms === "true";
  const notifyEmail = body.notify_email === true || body.notify_email === "true";

  if (!id || !closureNote) return json({ error: "id and closure_note required" }, 400);

  const { data: ticket, error } = await sb
    .from("support_tickets")
    .update({
      status: "resolved",
      closure_note: closureNote,
      notify_on_close: notifySms || notifyEmail,
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return json({ error: error.message }, 500);

  await addComment(
    sb,
    id,
    "agent",
    agentName,
    `Ticket resolved.\n\n${closureNote}`,
  );

  const notifications: Record<string, unknown> = {};

  if (notifySms && ticket.reporter_mobile) {
    const msg = ticketClosureMessage(ticket.ticket_number, ticket.subject, closureNote);
    notifications.sms = await sendSms(ticket.reporter_mobile, msg);
  }

  if (notifyEmail && ticket.reporter_email) {
    const subject = `ScanV Support — ${ticket.ticket_number} resolved`;
    const bodyText = ticketClosureMessage(ticket.ticket_number, ticket.subject, closureNote);
    notifications.email = await sendEmail(ticket.reporter_email, subject, bodyText);
  }

  return json({ success: true, ticket, notifications });
}

async function ticketStats(sb: ReturnType<typeof adminSb>) {
  const { data: tickets, error } = await sb
    .from("support_tickets")
    .select("id,status,created_at,resolved_at");

  if (error) return json({ error: error.message }, 500);

  const openStatuses = new Set(["new", "in_progress", "pending_customer"]);
  const open = (tickets || []).filter((t) => openStatuses.has(t.status)).length;
  const resolved = (tickets || []).filter((t) => t.status === "resolved" || t.status === "closed").length;

  const resolvedWithTime = (tickets || []).filter((t) => t.resolved_at && t.created_at);
  let avgResolutionHours: number | null = null;
  if (resolvedWithTime.length) {
    const totalMs = resolvedWithTime.reduce((sum, t) => {
      return sum + (new Date(t.resolved_at!).getTime() - new Date(t.created_at).getTime());
    }, 0);
    avgResolutionHours = Math.round((totalMs / resolvedWithTime.length / 3600000) * 10) / 10;
  }

  const byStatus: Record<string, number> = {};
  for (const t of tickets || []) {
    byStatus[t.status] = (byStatus[t.status] || 0) + 1;
  }

  return json({
    total: tickets?.length || 0,
    open,
    resolved,
    by_status: byStatus,
    avg_resolution_hours: avgResolutionHours,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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
  const agentRole = resolveAgentRole(req);
  const agentName = String(body.agent_name || "Support Agent");

  const publicActions = new Set(["create", "track"]);
  if (!publicActions.has(action) && !agentRole) {
    return json({ error: "Unauthorized — agent PIN required" }, 401);
  }

  if (action === "create") return createTicket(sb, body);
  if (action === "track") return trackTicket(sb, body);
  if (action === "search") return searchTickets(sb, body);
  if (action === "detail") return ticketDetail(sb, body);
  if (action === "update_status") return updateStatus(sb, body, agentName);
  if (action === "add_comment") return addAgentComment(sb, body, agentName);
  if (action === "resolve") return resolveTicket(sb, body, agentName, agentRole);
  if (action === "stats") return ticketStats(sb);
  if (action === "list_agents") return listAgents(sb);

  return json({ error: "Unknown action" }, 400);
});
