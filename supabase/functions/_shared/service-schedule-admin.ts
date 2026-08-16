/** Admin — service schedule input file CRUD */

const DEFAULT_WINDOWS = [
  { day: 0, start: "09:00", end: "19:00" },
  { day: 1, start: "09:00", end: "19:00" },
  { day: 2, start: "09:00", end: "19:00" },
  { day: 3, start: "09:00", end: "19:00" },
  { day: 4, start: "09:00", end: "19:00" },
  { day: 5, start: "09:00", end: "19:00" },
  { day: 6, start: "09:00", end: "19:00" },
];

function normalizeWindows(raw: unknown) {
  if (!Array.isArray(raw)) return DEFAULT_WINDOWS;
  return raw
    .map((w: Record<string, unknown>) => ({
      day: Number(w.day),
      start: String(w.start || "09:00").slice(0, 5),
      end: String(w.end || "19:00").slice(0, 5),
    }))
    .filter((w) => w.day >= 0 && w.day <= 6);
}

function normalizeRow(row: Record<string, unknown> | null, serviceId: string, parentId?: string | null) {
  if (!row) {
    return {
      service_id: serviceId,
      parent_id: parentId || null,
      min_lead_minutes: 30,
      slot_minutes: 30,
      enforce_schedule: true,
      allow_outside_schedule: false,
      windows: DEFAULT_WINDOWS,
      notes: "",
    };
  }
  return {
    service_id: row.service_id,
    parent_id: row.parent_id || parentId || null,
    min_lead_minutes: Number(row.min_lead_minutes ?? 30),
    slot_minutes: Number(row.slot_minutes ?? 30),
    enforce_schedule: row.enforce_schedule !== false,
    allow_outside_schedule: !!row.allow_outside_schedule,
    windows: normalizeWindows(row.windows),
    notes: String(row.notes || ""),
    updated_at: row.updated_at || null,
  };
}

export async function listServiceSchedulesAdmin(sb: ReturnType<typeof import("https://esm.sh/@supabase/supabase-js@2.49.1").createClient>) {
  const { data: pricing, error: pErr } = await sb
    .from("service_pricing")
    .select("service_id, parent_id, service_name, is_category, sort_order")
    .eq("is_category", false)
    .order("sort_order", { ascending: true });
  if (pErr) throw pErr;

  const parentIds = [...new Set((pricing || []).map((p) => p.parent_id).filter(Boolean))];
  const { data: parents } = parentIds.length
    ? await sb.from("service_pricing").select("service_id, service_name").in("service_id", parentIds)
    : { data: [] as { service_id: string; service_name: string }[] };
  const parentNames = new Map((parents || []).map((p) => [p.service_id, p.service_name]));

  const { data: rows, error } = await sb.from("service_schedules").select("*");
  if (error) throw error;
  const byId = new Map((rows || []).map((r) => [r.service_id, r]));

  const services = (pricing || []).map((p) => ({
    ...normalizeRow(byId.get(p.service_id) || null, p.service_id, p.parent_id),
    service_name: p.service_name || p.service_id,
    parent_name: parentNames.get(p.parent_id) || p.parent_id || "Other",
  }));

  return { services, count: services.length };
}

export async function getServiceScheduleAdmin(sb: ReturnType<typeof import("https://esm.sh/@supabase/supabase-js@2.49.1").createClient>, serviceId: string) {
  if (!serviceId) throw new Error("service_id required");
  const { data: meta } = await sb
    .from("service_pricing")
    .select("service_id, parent_id, service_name")
    .eq("service_id", serviceId)
    .maybeSingle();

  const { data, error } = await sb.from("service_schedules").select("*").eq("service_id", serviceId).maybeSingle();
  if (error) throw error;

  return {
    schedule: normalizeRow(data || null, serviceId, meta?.parent_id),
    service_name: meta?.service_name || serviceId,
  };
}

export async function updateServiceScheduleAdmin(
  sb: ReturnType<typeof import("https://esm.sh/@supabase/supabase-js@2.49.1").createClient>,
  payload: Record<string, unknown>,
  updatedBy?: string,
) {
  const serviceId = String(payload.service_id || "");
  if (!serviceId) throw new Error("service_id required");

  const { data: meta } = await sb
    .from("service_pricing")
    .select("parent_id")
    .eq("service_id", serviceId)
    .maybeSingle();

  const patch = {
    service_id: serviceId,
    parent_id: meta?.parent_id || null,
    min_lead_minutes: Math.max(0, Number(payload.min_lead_minutes ?? 30)),
    slot_minutes: Math.min(240, Math.max(5, Number(payload.slot_minutes ?? 30))),
    enforce_schedule: payload.enforce_schedule !== false,
    allow_outside_schedule: !!payload.allow_outside_schedule,
    windows: normalizeWindows(payload.windows),
    notes: String(payload.notes || "").slice(0, 2000),
    updated_at: new Date().toISOString(),
    updated_by: updatedBy || "admin",
  };

  const { data, error } = await sb.from("service_schedules").upsert(patch, { onConflict: "service_id" }).select("*").single();
  if (error) throw error;
  return { schedule: normalizeRow(data, serviceId, meta?.parent_id) };
}
