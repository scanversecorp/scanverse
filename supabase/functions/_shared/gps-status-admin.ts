import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const IST = "Asia/Kolkata";
const MAX_DAYS = 31;

type Audience = "all" | "users" | "vendors";
type StatusFilter = "all" | "shared" | "unshared";

export type GpsStatusRow = {
  date: string;
  type: "user" | "vendor";
  id: string;
  name: string;
  phone: string;
  status: "shared" | "unshared";
  gps_at: string | null;
  lat: number | null;
  lng: number | null;
  source: string | null;
};

type Ping = { lat: number; lng: number; at: string; source: string };

function parseYmd(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function todayIstYmd(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: IST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function dayRange(from: string, to: string): string[] {
  const start = parseYmd(from);
  const end = parseYmd(to);
  if (start > end) return [];
  const days: string[] = [];
  const cur = new Date(start);
  while (cur <= end && days.length < MAX_DAYS) {
    days.push(formatYmd(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return days;
}

function istDayKey(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: IST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function hasCoords(lat: unknown, lng: unknown): boolean {
  return lat != null && lng != null && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
}

function displayName(first?: string | null, last?: string | null, fallback?: string | null): string {
  const n = `${first || ""} ${last || ""}`.trim();
  return n || fallback || "—";
}

function matchesSearch(row: { name: string; phone: string }, q: string): boolean {
  if (!q) return true;
  const hay = `${row.name} ${row.phone}`.toLowerCase();
  return hay.includes(q);
}

async function loadHistoryPings(
  sb: SupabaseClient,
  audience: Audience,
  rangeStart: string,
  rangeEnd: string,
): Promise<{ userPings: Map<string, Ping>; vendorPings: Map<string, Ping> }> {
  const userPings = new Map<string, Ping>();
  const vendorPings = new Map<string, Ping>();

  if (audience === "all" || audience === "users") {
    const { data: locs } = await sb
      .from("user_locations")
      .select("user_id, lat, lng, consent_at, created_at")
      .gte("consent_at", rangeStart)
      .lte("consent_at", rangeEnd);
    for (const row of locs || []) {
      const uid = String(row.user_id);
      const at = String(row.consent_at || row.created_at);
      const key = `${uid}:${istDayKey(at)}`;
      const existing = userPings.get(key);
      if (!existing || at > existing.at) {
        userPings.set(key, {
          lat: Number(row.lat),
          lng: Number(row.lng),
          at,
          source: "user_locations",
        });
      }
    }
  }

  if (audience === "all" || audience === "vendors") {
    const { data: hist } = await sb
      .from("vendor_gps_history")
      .select("vendor_id, lat, lng, recorded_at")
      .gte("recorded_at", rangeStart)
      .lte("recorded_at", rangeEnd);
    for (const row of hist || []) {
      const vid = String(row.vendor_id);
      const at = String(row.recorded_at);
      const key = `${vid}:${istDayKey(at)}`;
      const existing = vendorPings.get(key);
      if (!existing || at > existing.at) {
        vendorPings.set(key, {
          lat: Number(row.lat),
          lng: Number(row.lng),
          at,
          source: "vendor_gps_history",
        });
      }
    }
  }

  return { userPings, vendorPings };
}

/** Run daily GPS status check for each entity × day and persist to gps_daily_status. */
export async function runDailyGpsCheck(
  sb: SupabaseClient,
  body: Record<string, unknown>,
): Promise<{ checks_written: number; users_checked: number; vendors_checked: number; days: string[] }> {
  const audience = String(body.audience || "all").toLowerCase() as Audience;
  const todayIst = todayIstYmd();
  const defaultFrom = parseYmd(todayIst);
  defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 6);

  const dateFrom = String(body.date_from || formatYmd(defaultFrom)).slice(0, 10);
  const dateTo = String(body.date_to || todayIst).slice(0, 10);
  const days = dayRange(dateFrom, dateTo);
  if (!days.length) {
    return { checks_written: 0, users_checked: 0, vendors_checked: 0, days: [] };
  }

  const rangeStart = `${dateFrom}T00:00:00+05:30`;
  const rangeEnd = `${dateTo}T23:59:59.999+05:30`;
  const { userPings, vendorPings } = await loadHistoryPings(sb, audience, rangeStart, rangeEnd);
  const now = new Date().toISOString();
  const upserts: Array<Record<string, unknown>> = [];
  let usersChecked = 0;
  let vendorsChecked = 0;

  if (audience === "all" || audience === "users") {
    const { data: profiles } = await sb
      .from("profiles")
      .select("id, last_lat, last_lng, updated_at")
      .in("role", ["customer", "candidate"])
      .limit(500);

    for (const p of profiles || []) {
      usersChecked += 1;
      const currentPing = hasCoords(p.last_lat, p.last_lng)
        ? {
          lat: Number(p.last_lat),
          lng: Number(p.last_lng),
          at: String(p.updated_at || now),
          source: "profile_snapshot",
        }
        : null;

      for (const day of days) {
        const hist = userPings.get(`${p.id}:${day}`);
        let ping: Ping | null = hist || null;
        if (!ping && day === todayIst && currentPing) {
          ping = currentPing;
        }
        upserts.push({
          entity_type: "user",
          entity_id: p.id,
          check_date: day,
          status: ping ? "shared" : "unshared",
          lat: ping?.lat ?? null,
          lng: ping?.lng ?? null,
          gps_at: ping?.at ?? null,
          source: ping?.source ?? "daily_check",
          checked_at: now,
        });
      }
    }
  }

  if (audience === "all" || audience === "vendors") {
    const { data: vendors } = await sb
      .from("vendor_partners")
      .select("id, gps_lat, gps_lng, address_lat, address_lng, updated_at, status")
      .neq("status", "offboarded")
      .limit(500);

    for (const v of vendors || []) {
      vendorsChecked += 1;
      const lat = v.gps_lat ?? v.address_lat;
      const lng = v.gps_lng ?? v.address_lng;
      const currentPing = hasCoords(lat, lng)
        ? {
          lat: Number(lat),
          lng: Number(lng),
          at: String(v.updated_at || now),
          source: "vendor_snapshot",
        }
        : null;

      for (const day of days) {
        const hist = vendorPings.get(`${v.id}:${day}`);
        let ping: Ping | null = hist || null;
        if (!ping && day === todayIst && currentPing) {
          ping = currentPing;
        }
        upserts.push({
          entity_type: "vendor",
          entity_id: v.id,
          check_date: day,
          status: ping ? "shared" : "unshared",
          lat: ping?.lat ?? null,
          lng: ping?.lng ?? null,
          gps_at: ping?.at ?? null,
          source: ping?.source ?? "daily_check",
          checked_at: now,
        });
      }
    }
  }

  let checksWritten = 0;
  for (let i = 0; i < upserts.length; i += 100) {
    const chunk = upserts.slice(i, i + 100);
    const { error } = await sb.from("gps_daily_status").upsert(chunk, {
      onConflict: "entity_type,entity_id,check_date",
    });
    if (error) throw error;
    checksWritten += chunk.length;
  }

  return { checks_written: checksWritten, users_checked: usersChecked, vendors_checked: vendorsChecked, days };
}

export async function gpsStatusReport(
  sb: SupabaseClient,
  body: Record<string, unknown>,
): Promise<{
  rows: GpsStatusRow[];
  days: string[];
  summary: { shared: number; unshared: number; total: number };
  check: { checks_written: number; users_checked: number; vendors_checked: number };
}> {
  const audience = String(body.audience || "all").toLowerCase() as Audience;
  const statusFilter = String(body.status_filter || "all").toLowerCase() as StatusFilter;
  const search = String(body.search || body.q || "").trim().toLowerCase();
  const skipCheck = body.skip_check === true;

  const todayIst = todayIstYmd();
  const defaultFrom = parseYmd(todayIst);
  defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 6);

  const dateFrom = String(body.date_from || formatYmd(defaultFrom)).slice(0, 10);
  const dateTo = String(body.date_to || todayIst).slice(0, 10);
  const days = dayRange(dateFrom, dateTo);

  const check = skipCheck
    ? { checks_written: 0, users_checked: 0, vendors_checked: 0, days }
    : await runDailyGpsCheck(sb, { audience, date_from: dateFrom, date_to: dateTo });

  if (!days.length) {
    return {
      rows: [],
      days: [],
      summary: { shared: 0, unshared: 0, total: 0 },
      check: { checks_written: check.checks_written, users_checked: check.users_checked, vendors_checked: check.vendors_checked },
    };
  }

  let statusQuery = sb
    .from("gps_daily_status")
    .select("entity_type, entity_id, check_date, status, lat, lng, gps_at, source")
    .gte("check_date", dateFrom)
    .lte("check_date", dateTo);

  if (audience === "users") statusQuery = statusQuery.eq("entity_type", "user");
  if (audience === "vendors") statusQuery = statusQuery.eq("entity_type", "vendor");

  const { data: statuses, error: statusErr } = await statusQuery;
  if (statusErr) throw statusErr;

  const nameMap = new Map<string, { name: string; phone: string }>();

  if (audience === "all" || audience === "users") {
    const { data: profiles } = await sb
      .from("profiles")
      .select("id, first_name, last_name, phone")
      .in("role", ["customer", "candidate"]);
    for (const p of profiles || []) {
      nameMap.set(`user:${p.id}`, {
        name: displayName(p.first_name, p.last_name),
        phone: p.phone || "—",
      });
    }
  }

  if (audience === "all" || audience === "vendors") {
    const { data: vendors } = await sb
      .from("vendor_partners")
      .select("id, first_name, last_name, contact_name, business_name, phone");
    for (const v of vendors || []) {
      nameMap.set(`vendor:${v.id}`, {
        name: displayName(v.first_name, v.last_name, v.contact_name) || v.business_name || "—",
        phone: v.phone || "—",
      });
    }
  }

  const rows: GpsStatusRow[] = [];

  for (const s of statuses || []) {
    const type = s.entity_type as "user" | "vendor";
    const meta = nameMap.get(`${type}:${s.entity_id}`);
    if (!meta) continue;
    if (!matchesSearch(meta, search)) continue;
    const status = s.status as "shared" | "unshared";
    if (statusFilter !== "all" && statusFilter !== status) continue;

    rows.push({
      date: String(s.check_date),
      type,
      id: String(s.entity_id),
      name: meta.name,
      phone: meta.phone,
      status,
      gps_at: s.gps_at ? String(s.gps_at) : null,
      lat: s.lat != null ? Number(s.lat) : null,
      lng: s.lng != null ? Number(s.lng) : null,
      source: s.source ? String(s.source) : null,
    });
  }

  rows.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    return a.name.localeCompare(b.name);
  });

  const shared = rows.filter((r) => r.status === "shared").length;
  const unshared = rows.filter((r) => r.status === "unshared").length;

  return {
    rows,
    days,
    summary: { shared, unshared, total: rows.length },
    check: {
      checks_written: check.checks_written,
      users_checked: check.users_checked,
      vendors_checked: check.vendors_checked,
    },
  };
}
