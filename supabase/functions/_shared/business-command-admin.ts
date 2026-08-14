/** Business command center — all-card revenue pipeline + vendor stats. */

import catalog from "./vendor-leads-data.json" with { type: "json" };
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { listLogisticsPipeline } from "./logistics-partners-admin.ts";
import { ONBOARD_STATUSES } from "./vendor-leads-admin.ts";

const PRIORITY_AREAS = ["wakad", "hinjewadi", "baner", "kalewadi", "akurdi", "pcm", "pimpri", "chinchwad"];

export const SCANV_BUSINESS_PHONE = "9270194842";

export function vendorOutreachMessage(businessName: string): string {
  const name = businessName.trim() || "partner";
  return [
    "नमस्कार / नमस्ते 🙏",
    "",
    "आम्ही ScanV · DCore — Wakad व PCMC मध्ये local services booking app.",
    "",
    `आम्ही verified customers च्या cleaning / home service bookings partners ला पाठवतो. ${name} सोबत partner करू इच्छितो.`,
    "",
    "• Launch वर listing fee नाही / कोई listing fee नहीं",
    "• Price तुमची / आपकी — तुम्ही / आप ठरवता",
    "• Booking + UPI payment — app वर",
    "",
    "सकाळ 10 — संध्याकाळ 7 (IST) दरम्यान 10 min call होईल का? 📞",
    "",
    `ScanV · DCore | ${SCANV_BUSINESS_PHONE}`,
  ].join("\n");
}

function areaScore(area: string, serviceAreas: string): number {
  const hay = `${area} ${serviceAreas}`.toLowerCase();
  for (let i = 0; i < PRIORITY_AREAS.length; i++) {
    if (hay.includes(PRIORITY_AREAS[i])) return PRIORITY_AREAS.length - i;
  }
  return 0;
}

function vendorPrimaryCard(vendorId: string): string | null {
  const serviceById = new Map(catalog.services.map((s: { id: string; parent_card_id: string }) => [s.id, s]));
  const v = (catalog.vendors as Array<{ id: string; service_ids: string[] }>).find((x) => x.id === vendorId);
  if (!v?.service_ids?.length) return null;
  const svc = serviceById.get(v.service_ids[0]);
  return svc?.parent_card_id || null;
}

function buildStrikeList(
  tracking: Array<{ lead_id: string; onboard_status: string }>,
) {
  const statusByLead = new Map(tracking.map((r) => [String(r.lead_id), String(r.onboard_status || "research")]));
  const vendors = (catalog.vendors as Array<{
    id: string;
    business_name: string;
    contact_person: string;
    phones: string[];
    address: { area: string; city: string };
    service_areas: string;
    confidence: string;
  }>).filter((v) => {
    const card = vendorPrimaryCard(v.id);
    if (card !== "household") return false;
    const st = statusByLead.get(v.id) || "research";
    if (st === "added" || st === "rejected") return false;
    return v.confidence === "high" && (v.phones?.length || 0) > 0;
  });

  vendors.sort((a, b) => {
    const sa = areaScore(a.address?.area || "", a.service_areas || "");
    const sb = areaScore(b.address?.area || "", b.service_areas || "");
    if (sb !== sa) return sb - sa;
    return a.business_name.localeCompare(b.business_name);
  });

  return vendors.slice(0, 8).map((v, i) => ({
    rank: i + 1,
    lead_id: v.id,
    business_name: v.business_name,
    contact_person: v.contact_person || null,
    phone: v.phones[0],
    area: v.address?.area || v.address?.city || "Pune",
    onboard_status: statusByLead.get(v.id) || "research",
    outreach_message: vendorOutreachMessage(v.business_name),
    admin_url: `https://scanv-tau.vercel.app/#admin?tab=vendor-leads`,
  }));
}

function buildLogisticsStrike(
  logistics: Array<{ id: string; name: string; outreach_status: string; follow_up_at: string | null; contact_email: string }>,
) {
  const now = new Date();
  return logistics
    .filter((p) =>
      p.follow_up_at &&
      new Date(String(p.follow_up_at)) <= now &&
      !["integrated", "declined", "contract"].includes(String(p.outreach_status))
    )
    .map((p) => ({
      partner_id: p.id,
      name: p.name,
      outreach_status: p.outreach_status,
      contact_email: p.contact_email,
      follow_up_template: "docs/email-followup-plain.txt",
      admin_url: "https://scanv-tau.vercel.app/#admin?tab=logistics",
    }));
}

type CardRow = {
  card_id: string;
  label: string;
  icon: string | null;
  revenue_priority: number;
  target_active_vendors: number;
  go_live_phase: string;
  next_action: string | null;
  blocker: string | null;
  notes: string | null;
  catalog_vendors: number;
  leads_added: number;
  leads_ready: number;
  leads_contacted: number;
  leads_validating: number;
  service_count: number;
  gap_vendors: number;
  readiness_pct: number;
};

function vendorsByCard(): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  const serviceById = new Map(catalog.services.map((s: { id: string; parent_card_id: string }) => [s.id, s]));
  for (const v of catalog.vendors as Array<{ id: string; service_ids: string[] }>) {
    for (const sid of v.service_ids || []) {
      const svc = serviceById.get(sid);
      if (!svc) continue;
      const set = map.get(svc.parent_card_id) || new Set();
      set.add(v.id);
      map.set(svc.parent_card_id, set);
    }
  }
  return map;
}

function servicesByCard(): Map<string, number> {
  const map = new Map<string, number>();
  for (const s of catalog.services as Array<{ parent_card_id: string }>) {
    map.set(s.parent_card_id, (map.get(s.parent_card_id) || 0) + 1);
  }
  return map;
}

export async function getBusinessCommand(sb: SupabaseClient) {
  const [cardRows, trackingRows, partnerRows, logistics] = await Promise.all([
    sb.from("scanv_card_business").select("*").order("revenue_priority"),
    sb.from("vendor_lead_tracking").select("lead_id, onboard_status"),
    sb.from("vendor_partners").select("id, status, business_name"),
    listLogisticsPipeline(sb).catch(() => []),
  ]);

  if (cardRows.error) throw new Error(cardRows.error.message);

  const byCard = vendorsByCard();
  const svcCounts = servicesByCard();
  const tracking = trackingRows.data || [];

  const statusByCard = new Map<string, Record<string, number>>();
  for (const row of tracking) {
    const card = vendorPrimaryCard(String(row.lead_id));
    if (!card) continue;
    const bucket = statusByCard.get(card) || {};
    const st = String(row.onboard_status || "research");
    bucket[st] = (bucket[st] || 0) + 1;
    statusByCard.set(card, bucket);
  }

  const activePartners = (partnerRows.data || []).filter((p) => p.status === "active").length;
  const logisticsDue = logistics.filter((p) =>
    p.follow_up_at && new Date(String(p.follow_up_at)) <= new Date()
  ).length;

  const cards: CardRow[] = (cardRows.data || []).map((c) => {
    const cardId = String(c.card_id);
    const stats = statusByCard.get(cardId) || {};
    const catalogVendors = byCard.get(cardId)?.size || 0;
    const target = Number(c.target_active_vendors) || 5;
    const added = stats.added || 0;
    const gap = Math.max(0, target - added);
    const readiness = target > 0 ? Math.min(100, Math.round((added / target) * 100)) : 0;
    return {
      card_id: cardId,
      label: String(c.label),
      icon: c.icon ? String(c.icon) : null,
      revenue_priority: Number(c.revenue_priority) || 50,
      target_active_vendors: target,
      go_live_phase: String(c.go_live_phase),
      next_action: c.next_action ? String(c.next_action) : null,
      blocker: c.blocker ? String(c.blocker) : null,
      notes: c.notes ? String(c.notes) : null,
      catalog_vendors: catalogVendors,
      leads_added: added,
      leads_ready: stats.ready || 0,
      leads_contacted: stats.contacted || 0,
      leads_validating: stats.validating || 0,
      service_count: svcCounts.get(cardId) || 0,
      gap_vendors: gap,
      readiness_pct: readiness,
    };
  });

  const actionQueue = cards
    .filter((c) => c.gap_vendors > 0 || c.go_live_phase !== "live")
    .sort((a, b) => a.revenue_priority - b.revenue_priority)
    .slice(0, 12)
    .map((c) => ({
      card_id: c.card_id,
      label: c.label,
      priority: c.revenue_priority,
      action: c.next_action || `Close ${c.gap_vendors} vendor gap`,
      blocker: c.blocker,
      admin_tab: c.card_id === "delivery" ? "logistics" : "vendor-leads",
    }));

  const overallReadiness = cards.length
    ? Math.round(cards.reduce((s, c) => s + c.readiness_pct, 0) / cards.length)
    : 0;

  return {
    cards,
    action_queue: actionQueue,
    strike_list: {
      vendors: buildStrikeList(tracking),
      logistics: buildLogisticsStrike(logistics),
      generated_at: new Date().toISOString(),
    },
    summary: {
      card_count: cards.length,
      overall_readiness_pct: overallReadiness,
      catalog_vendor_count: catalog.meta?.vendor_count || catalog.vendors.length,
      active_partners: activePartners,
      logistics_partners: logistics.length,
      logistics_follow_up_due: logisticsDue,
      onboard_statuses: ONBOARD_STATUSES,
    },
    logistics_pipeline: logistics,
  };
}

export async function updateCardBusiness(sb: SupabaseClient, body: Record<string, unknown>) {
  const cardId = String(body.card_id || "").trim();
  if (!cardId) return { error: "card_id required" };

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of ["go_live_phase", "next_action", "blocker", "notes", "target_active_vendors", "revenue_priority"]) {
    if (body[key] !== undefined) patch[key] = body[key];
  }

  const { data, error } = await sb
    .from("scanv_card_business")
    .update(patch)
    .eq("card_id", cardId)
    .select("*")
    .single();
  if (error) return { error: error.message };
  return { card: data };
}
