/**
 * ScanV Customer Support API
 *
 * Actions (POST body):
 *   search  — { q, field? }  search profiles by mobile/name/address/city/email
 *   detail  — { profile_id } full customer view
 *   update  — { profile_id, profile?, booking? }  admin only
 *
 * Auth: x-support-pin header
 *   SUPPORT_AGENT_PIN  → read-only (search, detail)
 *   SUPPORT_ADMIN_PIN  → read + update
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-support-pin",
};

type SupportRole = "support_agent" | "support_admin" | null;

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

function resolveRole(req: Request): SupportRole {
  const pin = req.headers.get("x-support-pin") || "";
  const adminPin = Deno.env.get("SUPPORT_ADMIN_PIN") || "";
  const agentPin = Deno.env.get("SUPPORT_AGENT_PIN") || "";
  if (adminPin.length >= 6 && pin === adminPin) return "support_admin";
  if (agentPin.length >= 6 && pin === agentPin) return "support_agent";
  // Fallback: pricing/vendor admin PIN for leaders
  const leaderPin = Deno.env.get("PRICING_ADMIN_PIN") || Deno.env.get("VENDOR_ADMIN_PIN") || "";
  if (leaderPin.length >= 6 && pin === leaderPin) return "support_admin";
  return null;
}

function escIlike(q: string): string {
  return q.replace(/[%_\\]/g, "\\$&");
}

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

async function searchProfiles(sb: ReturnType<typeof adminSb>, q: string, field?: string) {
  const term = (q || "").trim();
  if (!term || term.length < 2) {
    return json({ error: "Query must be at least 2 characters" }, 400);
  }

  const like = `%${escIlike(term)}%`;
  const cols =
    "id,name,first_name,last_name,phone,email,address,village,city,pincode,mobile_verified,created_at,last_lat,last_lng,device_type,os_name,browser,role,status";

  let query = sb.from("profiles").select(cols).limit(50);

  if (field === "mobile" || field === "phone") {
    const d = digitsOnly(term);
    if (d.length >= 6) {
      query = query.or(`phone.ilike.%${d}%,phone.ilike.%${term}%`);
    } else {
      query = query.ilike("phone", like);
    }
  } else if (field === "name") {
    query = query.or(
      `name.ilike.${like},first_name.ilike.${like},last_name.ilike.${like}`,
    );
  } else if (field === "address") {
    query = query.or(`address.ilike.${like},village.ilike.${like}`);
  } else if (field === "city") {
    query = query.ilike("city", like);
  } else if (field === "email") {
    query = query.ilike("email", like);
  } else if (field === "pincode") {
    query = query.ilike("pincode", like);
  } else {
    const d = digitsOnly(term);
    const parts = [
      `name.ilike.${like}`,
      `first_name.ilike.${like}`,
      `last_name.ilike.${like}`,
      `address.ilike.${like}`,
      `village.ilike.${like}`,
      `city.ilike.${like}`,
      `email.ilike.${like}`,
      `pincode.ilike.${like}`,
    ];
    if (d.length >= 6) parts.push(`phone.ilike.%${d}%`);
    else parts.push(`phone.ilike.${like}`);
    query = query.or(parts.join(","));
  }

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) return json({ error: error.message }, 500);
  return json({ results: data || [], count: data?.length || 0 });
}

async function customerDetail(sb: ReturnType<typeof adminSb>, profileId: string) {
  if (!profileId) return json({ error: "profile_id required" }, 400);

  const { data: profile, error: pErr } = await sb
    .from("profiles")
    .select("*")
    .eq("id", profileId)
    .maybeSingle();
  if (pErr) return json({ error: pErr.message }, 500);
  if (!profile) return json({ error: "Customer not found" }, 404);

  const phoneDigits = digitsOnly(profile.phone || "");
  const phoneVariants = [
    profile.phone,
    phoneDigits.length >= 10 ? `+91${phoneDigits.slice(-10)}` : null,
    phoneDigits.length >= 10 ? phoneDigits.slice(-10) : null,
  ].filter(Boolean) as string[];

  const [
    bookingsRes,
    paymentsRes,
    serviceReqRes,
    qrScansRes,
    visitorRes,
  ] = await Promise.all([
    sb.from("bookings").select("*").eq("customer_id", profileId).order("created_at", { ascending: false }),
    sb.from("payments").select("*").eq("user_id", profileId).order("created_at", { ascending: false }),
    sb.from("service_requests").select("*").eq("customer_id", profileId).order("created_at", { ascending: false }),
    phoneVariants.length
      ? sb.from("qr_scans").select("*").or(
        phoneVariants.map((p) => `mobile.ilike.%${escIlike(p)}%`).join(","),
      ).order("scanned_at", { ascending: false }).limit(20)
      : Promise.resolve({ data: [], error: null }),
    profile.ip_address
      ? sb.from("visitor_sessions").select("*").eq("ip_address", profile.ip_address).order("created_at", { ascending: false }).limit(10)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const txnIds = [
    ...(bookingsRes.data || []).map((b: { txn_id?: string }) => b.txn_id).filter(Boolean),
    ...(paymentsRes.data || []).map((p: { txn_id?: string }) => p.txn_id).filter(Boolean),
  ] as string[];

  let paymentIntents: unknown[] = [];
  if (txnIds.length) {
    const { data: intents } = await sb
      .from("payment_intents")
      .select("*")
      .in("txn_id", [...new Set(txnIds)])
      .order("created_at", { ascending: false });
    paymentIntents = intents || [];
  }

  const device = {
    device_type: profile.device_type,
    os_name: profile.os_name,
    browser: profile.browser,
    timezone: profile.timezone,
    language: profile.language,
    ip_address: profile.ip_address,
    last_lat: profile.last_lat,
    last_lng: profile.last_lng,
  };

  return json({
    profile,
    device,
    bookings: bookingsRes.data || [],
    payments: paymentsRes.data || [],
    payment_intents: paymentIntents,
    service_requests: serviceReqRes.data || [],
    qr_scans: qrScansRes.data || [],
    visitor_sessions: visitorRes.data || [],
  });
}

async function adminUpdate(
  sb: ReturnType<typeof adminSb>,
  body: Record<string, unknown>,
) {
  const profileId = String(body.profile_id || "");
  if (!profileId) return json({ error: "profile_id required" }, 400);

  const updated: Record<string, unknown> = {};

  const profilePatch = body.profile as Record<string, unknown> | undefined;
  if (profilePatch && typeof profilePatch === "object") {
    const allowed = [
      "first_name", "last_name", "name", "phone", "email", "address", "village",
      "city", "pincode", "status", "age", "gender", "upi_id", "notes",
    ];
    const row: Record<string, unknown> = {};
    for (const k of allowed) {
      if (profilePatch[k] !== undefined) row[k] = profilePatch[k];
    }
    if (row.first_name !== undefined || row.last_name !== undefined) {
      const fn = String(row.first_name ?? profilePatch.first_name ?? "");
      const ln = String(row.last_name ?? profilePatch.last_name ?? "");
      row.name = `${fn} ${ln}`.trim();
    }
    if (Object.keys(row).length) {
      const { data, error } = await sb
        .from("profiles")
        .update(row)
        .eq("id", profileId)
        .select()
        .single();
      if (error) return json({ error: error.message }, 500);
      updated.profile = data;
    }
  }

  const bookingPatch = body.booking as Record<string, unknown> | undefined;
  if (bookingPatch?.id && typeof bookingPatch === "object") {
    const allowed = ["status", "notes", "date", "time", "location_text"];
    const row: Record<string, unknown> = {};
    for (const k of allowed) {
      if (bookingPatch[k] !== undefined) row[k] = bookingPatch[k];
    }
    if (Object.keys(row).length) {
      const { data, error } = await sb
        .from("bookings")
        .update(row)
        .eq("id", bookingPatch.id)
        .eq("customer_id", profileId)
        .select()
        .single();
      if (error) return json({ error: error.message }, 500);
      updated.booking = data;
    }
  }

  if (!Object.keys(updated).length) {
    return json({ error: "Nothing to update — provide profile or booking fields" }, 400);
  }

  return json({ success: true, updated });
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

  if (action === "search") {
    return searchProfiles(sb, String(body.q || ""), body.field ? String(body.field) : undefined);
  }

  if (action === "detail") {
    return customerDetail(sb, String(body.profile_id || ""));
  }

  if (action === "update") {
    if (role !== "support_admin") {
      return json({ error: "Admin PIN required for updates" }, 403);
    }
    return adminUpdate(sb, body);
  }

  if (action === "whoami") {
    return json({ role, read_only: role === "support_agent" });
  }

  return json({ error: "Unknown action" }, 400);
});
