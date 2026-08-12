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
};

function parseYmd(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
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
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: IST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(d);
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

export async function gpsStatusReport(
  sb: SupabaseClient,
  body: Record<string, unknown>,
): Promise<{
  rows: GpsStatusRow[];
  days: string[];
  summary: { shared: number; unshared: number; total: number };
}> {
  const audience = String(body.audience || "all").toLowerCase() as Audience;
  const statusFilter = String(body.status_filter || "all").toLowerCase() as StatusFilter;
  const search = String(body.search || body.q || "").trim().toLowerCase();

  const todayIst = new Intl.DateTimeFormat("en-CA", {
    timeZone: IST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const defaultFrom = parseYmd(todayIst);
  defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 6);

  const dateFrom = String(body.date_from || formatYmd(defaultFrom)).slice(0, 10);
  const dateTo = String(body.date_to || todayIst).slice(0, 10);
  const days = dayRange(dateFrom, dateTo);
  if (!days.length) {
    return { rows: [], days: [], summary: { shared: 0, unshared: 0, total: 0 } };
  }

  const rangeStart = `${dateFrom}T00:00:00+05:30`;
  const rangeEnd = `${dateTo}T23:59:59.999+05:30`;

  type Ping = { lat: number; lng: number; at: string };
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
        userPings.set(key, { lat: Number(row.lat), lng: Number(row.lng), at });
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
        vendorPings.set(key, { lat: Number(row.lat), lng: Number(row.lng), at });
      }
    }
  }

  const rows: GpsStatusRow[] = [];

  if (audience === "all" || audience === "users") {
    const { data: profiles } = await sb
      .from("profiles")
      .select("id, first_name, last_name, phone, role")
      .in("role", ["customer", "candidate"])
      .order("created_at", { ascending: false })
      .limit(500);

    for (const p of profiles || []) {
      const name = displayName(p.first_name, p.last_name);
      const phone = p.phone || "—";
      if (!matchesSearch({ name, phone }, search)) continue;
      for (const day of days) {
        const ping = userPings.get(`${p.id}:${day}`);
        const status: "shared" | "unshared" = ping ? "shared" : "unshared";
        if (statusFilter !== "all" && statusFilter !== status) continue;
        rows.push({
          date: day,
          type: "user",
          id: p.id,
          name,
          phone,
          status,
          gps_at: ping?.at ?? null,
          lat: ping?.lat ?? null,
          lng: ping?.lng ?? null,
        });
      }
    }
  }

  if (audience === "all" || audience === "vendors") {
    const { data: vendors } = await sb
      .from("vendor_partners")
      .select("id, first_name, last_name, contact_name, business_name, phone, status")
      .order("created_at", { ascending: false })
      .limit(500);

    for (const v of vendors || []) {
      const name = displayName(v.first_name, v.last_name, v.contact_name)
        || v.business_name
        || "—";
      const phone = v.phone || "—";
      if (!matchesSearch({ name, phone }, search)) continue;
      for (const day of days) {
        const ping = vendorPings.get(`${v.id}:${day}`);
        const status: "shared" | "unshared" = ping ? "shared" : "unshared";
        if (statusFilter !== "all" && statusFilter !== status) continue;
        rows.push({
          date: day,
          type: "vendor",
          id: v.id,
          name,
          phone,
          status,
          gps_at: ping?.at ?? null,
          lat: ping?.lat ?? null,
          lng: ping?.lng ?? null,
        });
      }
    }
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
  };
}
