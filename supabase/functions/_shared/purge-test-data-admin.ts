/** Pre-launch wipe: customer/partner profiles + bookings + auth @scanv.app users. */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const PURGE_CONFIRM = "PURGE_TEST_DATA";

type Counts = Record<string, number>;

async function countTable(sb: SupabaseClient, table: string, filter?: { col: string; val: string }) {
  let q = sb.from(table).select("*", { count: "exact", head: true });
  if (filter) q = q.eq(filter.col, filter.val);
  const { count, error } = await q;
  if (error) throw new Error(`${table}: ${error.message}`);
  return count ?? 0;
}

async function deleteAll(sb: SupabaseClient, table: string): Promise<number> {
  const { count } = await sb.from(table).select("*", { count: "exact", head: true });
  if (!count) return 0;

  const attempts = [
    () => sb.from(table).delete().gte("created_at", "1970-01-01"),
    () => sb.from(table).delete().gte("check_date", "1970-01-01"),
    () => sb.from(table).delete().gte("scanned_at", "1970-01-01"),
    () => sb.from(table).delete().neq("id", "__purge_impossible__"),
    () => sb.from(table).delete().not("id", "is", null),
  ];

  for (const run of attempts) {
    const { error } = await run();
    if (!error) return count;
    if (!/column|does not exist|Could not find/i.test(error.message)) {
      throw new Error(`${table}: ${error.message}`);
    }
  }
  throw new Error(`${table}: could not delete rows`);
}

async function deleteProfiles(sb: SupabaseClient): Promise<number> {
  const { data: keep } = await sb.from("profiles").select("id").eq("role", "admin");
  const keepIds = new Set((keep || []).map((r) => r.id));
  let total = 0;

  const { data: byRole, error } = await sb
    .from("profiles")
    .delete()
    .in("role", ["customer", "partner", "candidate"])
    .select("id");
  if (error) throw new Error(`profiles: ${error.message}`);
  total += byRole?.length ?? 0;

  const { data: custRows } = await sb.from("profiles").select("id,role").like("id", "cust_%");
  const orphanIds = (custRows || [])
    .filter((r) => !keepIds.has(r.id) && r.role !== "admin")
    .map((r) => r.id);
  if (orphanIds.length) {
    const { data: removed, error: oErr } = await sb.from("profiles").delete().in("id", orphanIds).select("id");
    if (oErr) throw new Error(`profiles orphan: ${oErr.message}`);
    total += removed?.length ?? 0;
  }

  const { data: partRows } = await sb.from("profiles").select("id,role").like("id", "part_%");
  const partIds = (partRows || [])
    .filter((r) => !keepIds.has(r.id) && r.role !== "admin")
    .map((r) => r.id)
    .filter((id) => !orphanIds.includes(id));
  if (partIds.length) {
    const { data: removed, error: pErr } = await sb.from("profiles").delete().in("id", partIds).select("id");
    if (pErr) throw new Error(`profiles partner: ${pErr.message}`);
    total += removed?.length ?? 0;
  }

  return total;
}

async function deleteAuthScanvUsers(
  supabaseUrl: string,
  serviceKey: string,
  sb: SupabaseClient,
): Promise<number> {
  let removed = 0;
  const perPage = 1000;
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage });
    if (error) break;
    const users = data.users || [];
    for (const u of users) {
      const email = (u.email || "").toLowerCase();
      if (!email.endsWith("@scanv.app")) continue;
      const { error: delErr } = await sb.auth.admin.deleteUser(u.id);
      if (!delErr) removed++;
    }
    if (users.length < perPage) break;
  }

  if (removed === 0) {
    const res = await fetch(
      `${supabaseUrl}/auth/v1/admin/users?page=1&per_page=1000`,
      {
        headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
      },
    );
    if (res.ok) {
      const payload = await res.json().catch(() => ({})) as { users?: Array<{ id: string; email?: string }> };
      for (const u of payload.users || []) {
        if (!(u.email || "").toLowerCase().endsWith("@scanv.app")) continue;
        const { error: delErr } = await sb.auth.admin.deleteUser(u.id);
        if (!delErr) removed++;
      }
    }
  }
  return removed;
}

export async function previewPurgeTestData(sb: SupabaseClient) {
  const tables = [
    "booking_dispatch_attempts",
    "booking_dispatch",
    "vendor_live_locations",
    "vendor_gps_history",
    "external_logistics_trips",
    "booking_cancellations",
    "payments",
    "payment_intents",
    "bookings",
    "service_requests",
    "training_requests",
    "support_tickets",
    "investment_requests",
    "user_locations",
    "vendor_partner_services",
    "vendor_ekyc_sessions",
    "vendor_partners",
    "vendor_otp",
    "wa_verifications",
    "qr_scans",
    "visitor_sessions",
    "gps_daily_status",
  ];
  const counts: Counts = {};
  for (const t of tables) {
    try {
      counts[t] = await countTable(sb, t);
    } catch {
      counts[t] = -1;
    }
  }
  const { count: profileCount } = await sb
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .in("role", ["customer", "partner", "candidate"]);
  counts.profiles_customer_partner = profileCount ?? 0;
  const { count: adminCount } = await sb
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("role", "admin");
  counts.profiles_admin_kept = adminCount ?? 0;
  return counts;
}

export async function purgeTestDataAdmin(
  sb: SupabaseClient,
  body: Record<string, unknown>,
  supabaseUrl: string,
  serviceKey: string,
) {
  const dryRun = body.dry_run !== false && body.confirm_execute !== true;
  const confirm = String(body.confirm || "").trim();
  if (!dryRun && confirm !== PURGE_CONFIRM) {
    return {
      error: `Set confirm_execute: true and confirm: "${PURGE_CONFIRM}" to run live purge`,
    };
  }

  const preview = await previewPurgeTestData(sb);
  if (dryRun) {
    return {
      dry_run: true,
      preview,
      message: "Dry run only — pass confirm_execute: true and confirm to delete",
    };
  }

  const deleted: Counts = {};
  const order = [
    "booking_dispatch_attempts",
    "booking_dispatch",
    "vendor_live_locations",
    "vendor_gps_history",
    "external_logistics_trips",
    "booking_cancellations",
    "payments",
    "payment_intents",
    "bookings",
    "service_requests",
    "training_requests",
    "support_tickets",
    "investment_requests",
    "user_locations",
    "vendor_partner_services",
    "vendor_ekyc_sessions",
    "vendor_partners",
    "vendor_otp",
    "wa_verifications",
    "qr_scans",
    "visitor_sessions",
    "gps_daily_status",
  ];

  for (const table of order) {
    try {
      deleted[table] = await deleteAll(sb, table);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/does not exist|Could not find/i.test(msg)) {
        deleted[table] = 0;
      } else {
        return { error: msg, deleted, preview };
      }
    }
  }

  try {
    await sb.from("vendor_lead_tracking").update({ vendor_partner_id: null }).not("vendor_partner_id", "is", null);
  } catch { /* optional table */ }

  try {
    deleted.profiles = await deleteProfiles(sb);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: msg, deleted, preview };
  }

  try {
    deleted.auth_scanv_users = await deleteAuthScanvUsers(supabaseUrl, serviceKey, sb);
  } catch (e) {
    deleted.auth_scanv_users = 0;
    deleted.auth_error = e instanceof Error ? e.message : String(e);
  }

  return {
    success: true,
    dry_run: false,
    preview,
    deleted,
    message: "Pre-launch test data purged. Admin profiles, pricing, social, and vendor leads catalog preserved.",
  };
}
