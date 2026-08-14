/** PIN-gated vendor lead catalog for Admin — research in JSON, onboarding state in DB. */

import catalog from "./vendor-leads-data.json" with { type: "json" };
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

type ServiceRow = {
  id: string;
  parent_card_id: string;
  parent_card_label: string;
  sub_card: string;
  theme: string;
  name: string;
  price_inr?: number;
};

type VendorRow = {
  id: string;
  business_name: string;
  contact_person: string;
  shop_office: string;
  address: {
    building: string;
    street: string;
    area: string;
    city: string;
    pin: string;
    state: string;
    full: string;
  };
  phones: string[];
  emails: string[];
  website: string;
  maps_name: string;
  services_offered: string;
  rating: string;
  hours: string;
  service_areas: string;
  source: string;
  notes: string;
  confidence: string;
  service_ids: string[];
};

export const ONBOARD_STATUSES = [
  "research",
  "contacted",
  "validating",
  "ready",
  "added",
  "rejected",
] as const;

export type OnboardStatus = (typeof ONBOARD_STATUSES)[number];

export type LeadOnboard = {
  onboard_status: OnboardStatus;
  phone_verified: boolean;
  name_verified: boolean;
  address_verified: boolean;
  aadhaar_verified: boolean;
  aadhaar_last4: string | null;
  validation_notes: string | null;
  vendor_partner_id: string | null;
  updated_by: string | null;
  updated_at: string | null;
  ready_to_add: boolean;
  validation_complete: boolean;
};

const DEFAULT_ONBOARD: LeadOnboard = {
  onboard_status: "research",
  phone_verified: false,
  name_verified: false,
  address_verified: false,
  aadhaar_verified: false,
  aadhaar_last4: null,
  validation_notes: null,
  vendor_partner_id: null,
  updated_by: null,
  updated_at: null,
  ready_to_add: false,
  validation_complete: false,
};

const serviceById = new Map(
  (catalog.services as ServiceRow[]).map((s) => [s.id, s]),
);

const vendorById = new Map(
  (catalog.vendors as VendorRow[]).map((v) => [v.id, v]),
);

function vendorHaystack(v: VendorRow): string {
  return [
    v.business_name,
    v.contact_person,
    v.shop_office,
    v.address.full,
    v.address.area,
    v.address.city,
    v.address.pin,
    v.phones.join(" "),
    v.emails.join(" "),
    v.services_offered,
    v.service_areas,
    v.maps_name,
    v.notes,
  ].join(" ").toLowerCase();
}

function enrichVendor(v: VendorRow, onboard: LeadOnboard) {
  const scanv_services = (v.service_ids || [])
    .map((id) => serviceById.get(id))
    .filter(Boolean) as ServiceRow[];
  const sub_cards = [...new Set(scanv_services.map((s) => s.sub_card))];
  const themes = [...new Set(scanv_services.map((s) => s.theme))];
  const parent_card_ids = [...new Set(scanv_services.map((s) => s.parent_card_id))];
  const parent_card_labels = [...new Set(scanv_services.map((s) => s.parent_card_label))];
  return {
    ...v,
    scanv_services,
    sub_cards,
    themes,
    parent_card_ids,
    parent_card_label: parent_card_labels.join(" · ") || "—",
    onboard,
  };
}

function normalizeMobile(phone: string): string | null {
  const d = String(phone || "").replace(/\D/g, "");
  if (d.length === 10) return d;
  if (d.length === 12 && d.startsWith("91")) return d.slice(2);
  if (d.length === 11 && d.startsWith("0")) return d.slice(1);
  return d.length >= 10 ? d.slice(-10) : null;
}

function leadHasMinimumData(v: VendorRow): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  const name = (v.contact_person || v.business_name || "").trim();
  if (!name) missing.push("name");
  if (!v.phones?.length) missing.push("phone");
  const addr = v.address || {};
  const hasStreet = Boolean((addr.street || addr.area || addr.full || "").trim());
  if (!hasStreet) missing.push("address");
  if (!(addr.city || "").trim()) missing.push("city");
  return { ok: missing.length === 0, missing };
}

function validationComplete(row: {
  phone_verified: boolean;
  name_verified: boolean;
  address_verified: boolean;
  aadhaar_verified: boolean;
}): boolean {
  return row.phone_verified && row.name_verified && row.address_verified && row.aadhaar_verified;
}

function rowToOnboard(
  row: Record<string, unknown> | null | undefined,
  vendor: VendorRow,
): LeadOnboard {
  if (!row) {
    const base = { ...DEFAULT_ONBOARD };
    base.ready_to_add = leadHasMinimumData(vendor).ok && false;
    return base;
  }
  const flags = {
    phone_verified: row.phone_verified === true,
    name_verified: row.name_verified === true,
    address_verified: row.address_verified === true,
    aadhaar_verified: row.aadhaar_verified === true,
  };
  const complete = validationComplete(flags);
  const min = leadHasMinimumData(vendor);
  return {
    onboard_status: (ONBOARD_STATUSES.includes(row.onboard_status as OnboardStatus)
      ? row.onboard_status
      : "research") as OnboardStatus,
    ...flags,
    aadhaar_last4: row.aadhaar_last4 ? String(row.aadhaar_last4) : null,
    validation_notes: row.validation_notes ? String(row.validation_notes) : null,
    vendor_partner_id: row.vendor_partner_id ? String(row.vendor_partner_id) : null,
    updated_by: row.updated_by ? String(row.updated_by) : null,
    updated_at: row.updated_at ? String(row.updated_at) : null,
    validation_complete: complete,
    ready_to_add: complete && min.ok && row.onboard_status !== "added",
  };
}

async function loadTrackingMap(sb: SupabaseClient) {
  const { data, error } = await sb.from("vendor_lead_tracking").select("*");
  if (error) throw new Error(error.message);
  return new Map((data || []).map((r) => [String(r.lead_id), r]));
}

export async function getVendorLeads(
  sb: SupabaseClient,
  body: Record<string, unknown>,
) {
  const q = String(body.q || "").trim().toLowerCase();
  const subCard = String(body.sub_card || "all").trim();
  const theme = String(body.theme || "all").trim();
  const serviceId = String(body.service_id || "all").trim();
  const confidence = String(body.confidence || "all").trim();
  const area = String(body.area || "").trim().toLowerCase();

  const trackingById = await loadTrackingMap(sb);

  let vendors = (catalog.vendors as VendorRow[]).map((v) =>
    enrichVendor(v, rowToOnboard(trackingById.get(v.id), v)),
  );

  if (subCard && subCard !== "all") {
    vendors = vendors.filter((v) => v.sub_cards.includes(subCard));
  }
  if (theme && theme !== "all") {
    vendors = vendors.filter((v) => v.themes.includes(theme));
  }
  if (serviceId && serviceId !== "all") {
    vendors = vendors.filter((v) => v.service_ids.includes(serviceId));
  }
  if (confidence && confidence !== "all") {
    vendors = vendors.filter((v) => v.confidence === confidence);
  }
  if (area) {
    vendors = vendors.filter((v) => vendorHaystack(v).includes(area));
  }
  if (q) {
    vendors = vendors.filter((v) => vendorHaystack(v).includes(q));
  }

  vendors.sort((a, b) => a.business_name.localeCompare(b.business_name));

  return {
    meta: catalog.meta,
    cards: catalog.cards,
    services: catalog.services,
    onboard_statuses: ONBOARD_STATUSES,
    vendors,
    stats: {
      total_vendors: (catalog.vendors as VendorRow[]).length,
      shown: vendors.length,
    },
  };
}

export async function updateVendorLead(
  sb: SupabaseClient,
  body: Record<string, unknown>,
  updatedBy: string,
): Promise<{ error?: string; onboard?: LeadOnboard }> {
  const leadId = String(body.lead_id || "").trim();
  if (!leadId) return { error: "lead_id required" };

  const vendor = vendorById.get(leadId);
  if (!vendor) return { error: "Unknown lead" };

  const patch: Record<string, unknown> = { lead_id: leadId, updated_by: updatedBy };

  if (body.onboard_status !== undefined) {
    const status = String(body.onboard_status || "").trim().toLowerCase();
    if (!ONBOARD_STATUSES.includes(status as OnboardStatus)) {
      return { error: "Invalid onboard_status" };
    }
    patch.onboard_status = status;
  }
  if (body.phone_verified !== undefined) patch.phone_verified = body.phone_verified === true;
  if (body.name_verified !== undefined) patch.name_verified = body.name_verified === true;
  if (body.address_verified !== undefined) patch.address_verified = body.address_verified === true;
  if (body.aadhaar_verified !== undefined) patch.aadhaar_verified = body.aadhaar_verified === true;
  if (body.validation_notes !== undefined) {
    patch.validation_notes = String(body.validation_notes || "").slice(0, 4000);
  }
  if (body.aadhaar_last4 !== undefined) {
    const last4 = String(body.aadhaar_last4 || "").replace(/\D/g, "").slice(-4);
    patch.aadhaar_last4 = last4.length === 4 ? last4 : null;
  }

  const mutableKeys = Object.keys(patch).filter((k) => k !== "lead_id" && k !== "updated_by");
  if (!mutableKeys.length) return { error: "Nothing to update" };

  const { data, error } = await sb
    .from("vendor_lead_tracking")
    .upsert(patch, { onConflict: "lead_id" })
    .select("*")
    .single();

  if (error) return { error: error.message };
  return { onboard: rowToOnboard(data, vendor) };
}

export async function addVendorLeadToScanV(
  sb: SupabaseClient,
  body: Record<string, unknown>,
  updatedBy: string,
): Promise<{ error?: string; vendor_id?: string; onboard?: LeadOnboard }> {
  const leadId = String(body.lead_id || "").trim();
  if (!leadId) return { error: "lead_id required" };

  const vendor = vendorById.get(leadId);
  if (!vendor) return { error: "Unknown lead" };

  const { data: existingTrack } = await sb
    .from("vendor_lead_tracking")
    .select("*")
    .eq("lead_id", leadId)
    .maybeSingle();

  const onboard = rowToOnboard(existingTrack, vendor);

  if (onboard.vendor_partner_id && onboard.onboard_status === "added") {
    return {
      error: "Already added to ScanV",
      vendor_id: onboard.vendor_partner_id,
      onboard,
    };
  }

  if (!onboard.validation_complete) {
    return {
      error: "Validate phone, name, address, and Aadhaar before adding to ScanV",
      onboard,
    };
  }

  const min = leadHasMinimumData(vendor);
  if (!min.ok) {
    return { error: `Lead missing: ${min.missing.join(", ")}`, onboard };
  }

  const mobile = normalizeMobile(vendor.phones[0]);
  if (!mobile) return { error: "Valid 10-digit phone required", onboard };

  const contactName = (vendor.contact_person || vendor.business_name).trim();
  const shopOrFlat = (vendor.shop_office || vendor.address.building || vendor.address.area || "Office").trim();
  const streetName = (vendor.address.street || vendor.address.area || vendor.address.full || "—").trim();
  const city = (vendor.address.city || "Pune").trim();
  const pincode = (vendor.address.pin || "411057").trim();
  const state = (vendor.address.state || "Maharashtra").trim();

  const services = (vendor.service_ids || [])
    .map((sid) => {
      const svc = serviceById.get(sid);
      return svc ? { service_id: sid, category_id: svc.parent_card_id } : null;
    })
    .filter(Boolean) as Array<{ service_id: string; category_id: string }>;

  const vendorPayload = {
    business_name: vendor.business_name.trim(),
    contact_name: contactName,
    phone: mobile,
    phone_verified: true,
    email: vendor.emails?.[0] ? String(vendor.emails[0]).trim() : null,
    shop_or_flat: shopOrFlat,
    building_name: vendor.address.building ? String(vendor.address.building).trim() : null,
    street_name: streetName,
    village: vendor.address.area ? String(vendor.address.area).trim() : null,
    city,
    pincode,
    state,
    country: "India",
    country_code: "IN",
    aadhaar_verified: true,
    aadhaar_last4: onboard.aadhaar_last4,
    status: "pending",
    notes: [
      "Added from vendor leads desk",
      vendor.notes ? `Research: ${vendor.notes}` : "",
      onboard.validation_notes ? `Validation: ${onboard.validation_notes}` : "",
    ].filter(Boolean).join(" · ").slice(0, 2000),
  };

  const { data: phoneHit } = await sb
    .from("vendor_partners")
    .select("id, status")
    .eq("phone", mobile)
    .maybeSingle();

  let vendorId: string;
  if (phoneHit) {
    if (phoneHit.status === "active" || phoneHit.status === "pending") {
      return { error: "Phone already registered as partner", onboard };
    }
    const { data: updated, error: updErr } = await sb
      .from("vendor_partners")
      .update({ ...vendorPayload, offboarded_at: null })
      .eq("id", phoneHit.id)
      .select("id")
      .single();
    if (updErr) return { error: updErr.message, onboard };
    vendorId = updated.id;
  } else {
    const { data: inserted, error: insErr } = await sb
      .from("vendor_partners")
      .insert(vendorPayload)
      .select("id")
      .single();
    if (insErr) return { error: insErr.message, onboard };
    vendorId = inserted.id;
  }

  if (services.length) {
    const rows = services.map((s) => ({
      vendor_id: vendorId,
      service_id: s.service_id,
      category_id: s.category_id,
      is_active: false,
    }));
    await sb.from("vendor_partner_services").upsert(rows, {
      onConflict: "vendor_id,service_id",
    });
  }

  const { data: trackRow, error: trackErr } = await sb
    .from("vendor_lead_tracking")
    .upsert({
      lead_id: leadId,
      onboard_status: "added",
      phone_verified: true,
      name_verified: true,
      address_verified: true,
      aadhaar_verified: true,
      aadhaar_last4: onboard.aadhaar_last4,
      validation_notes: onboard.validation_notes,
      vendor_partner_id: vendorId,
      updated_by: updatedBy,
    }, { onConflict: "lead_id" })
    .select("*")
    .single();

  if (trackErr) return { error: trackErr.message, vendor_id: vendorId, onboard };

  return {
    vendor_id: vendorId,
    onboard: rowToOnboard(trackRow, vendor),
  };
}
