/** PIN-gated vendor lead catalog for Admin — data lives in vendor-leads-data.json only. */

import catalog from "./vendor-leads-data.json" with { type: "json" };

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

const serviceById = new Map(
  (catalog.services as ServiceRow[]).map((s) => [s.id, s]),
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

function enrichVendor(v: VendorRow) {
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
  };
}

export function getVendorLeads(body: Record<string, unknown>) {
  const q = String(body.q || "").trim().toLowerCase();
  const subCard = String(body.sub_card || "all").trim();
  const theme = String(body.theme || "all").trim();
  const serviceId = String(body.service_id || "all").trim();
  const confidence = String(body.confidence || "all").trim();
  const area = String(body.area || "").trim().toLowerCase();

  let vendors = (catalog.vendors as VendorRow[]).map(enrichVendor);

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
    vendors,
    stats: {
      total_vendors: (catalog.vendors as VendorRow[]).length,
      shown: vendors.length,
    },
  };
}
