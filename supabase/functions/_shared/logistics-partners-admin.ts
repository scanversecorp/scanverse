/** Logistics partner outreach pipeline + external trip registry (admin-hub). */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export async function listLogisticsPipeline(sb: SupabaseClient) {
  const { data, error } = await sb
    .from("logistics_partner_pipeline")
    .select("*")
    .order("priority");
  if (error) throw new Error(error.message);
  return data || [];
}

export async function updateLogisticsPartner(
  sb: SupabaseClient,
  body: Record<string, unknown>,
) {
  const id = String(body.id || "").trim();
  if (!id) return { error: "id required" };

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const fields = [
    "api_status", "outreach_status", "notes", "contact_email", "website",
    "priority", "pune_coverage", "sent_at", "follow_up_at", "last_reply_at",
  ] as const;

  for (const key of fields) {
    if (body[key] !== undefined) patch[key] = body[key];
  }

  const { data, error } = await sb
    .from("logistics_partner_pipeline")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) return { error: error.message };
  return { partner: data };
}

export async function listExternalTrips(sb: SupabaseClient, body: Record<string, unknown>) {
  const limit = Math.min(Number(body.limit) || 30, 100);
  let q = sb
    .from("external_logistics_trips")
    .select("id, booking_id, provider, external_order_id, external_status, driver_name, driver_phone, last_lat, last_lng, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (body.provider) q = q.eq("provider", String(body.provider));
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data || [];
}
