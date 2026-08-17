import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

function escIlike(q: string): string {
  return q.replace(/[%_\\]/g, "\\$&");
}

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

export async function searchDirectoryAdmin(
  sb: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
) {
  const q = String(body.q || "").trim();
  const kind = String(body.kind || "all").toLowerCase();
  const status = body.status ? String(body.status) : null;
  const limit = Math.min(Number(body.limit) || 50, 100);

  if (q.length === 1) throw new Error("Query must be at least 2 characters");

  const like = q ? `%${escIlike(q)}%` : null;
  const results: Array<Record<string, unknown>> = [];

  if (kind === "all" || kind === "users" || kind === "customers") {
    const d = digitsOnly(q);
    let query = sb
      .from("profiles")
      .select("id,name,first_name,last_name,phone,email,city,role,status,created_at")
      .limit(limit)
      .order("created_at", { ascending: false });
    if (status && status !== "all") query = query.eq("status", status);
    if (like) {
      const parts = [
        `name.ilike.${like}`,
        `first_name.ilike.${like}`,
        `last_name.ilike.${like}`,
        `email.ilike.${like}`,
        `city.ilike.${like}`,
      ];
      if (d.length >= 6) parts.push(`phone.ilike.%${d}%`);
      else parts.push(`phone.ilike.${like}`);
      if (q.startsWith("cust_") || q.startsWith("part_")) parts.push(`id.ilike.${like}`);
      query = query.or(parts.join(","));
    }
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    for (const p of data || []) {
      results.push({
        kind: p.role === "partner" ? "partner_profile" : "customer",
        id: p.id,
        label: p.name || `${p.first_name || ""} ${p.last_name || ""}`.trim() || p.id,
        phone: p.phone,
        city: p.city,
        status: p.status,
        role: p.role,
        created_at: p.created_at,
      });
    }
  }

  if (kind === "all" || kind === "vendors") {
    let query = sb
      .from("vendor_partners")
      .select("id,business_name,contact_name,first_name,last_name,phone,city,status,profile_id,created_at")
      .limit(limit)
      .order("created_at", { ascending: false });
    if (status && status !== "all") query = query.eq("status", status);
    if (like) {
      query = query.or(
        `business_name.ilike.${like},contact_name.ilike.${like},first_name.ilike.${like},last_name.ilike.${like},phone.ilike.${like},city.ilike.${like},email.ilike.${like}`,
      );
    }
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    for (const v of data || []) {
      results.push({
        kind: "vendor",
        id: v.id,
        profile_id: v.profile_id,
        label: v.business_name || v.contact_name,
        phone: v.phone,
        city: v.city,
        status: v.status,
        created_at: v.created_at,
      });
    }
  }

  results.sort((a, b) =>
    String(b.created_at || "").localeCompare(String(a.created_at || ""))
  );
  return results.slice(0, limit);
}

export async function directoryDetailAdmin(
  sb: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
) {
  const profileId = String(body.profile_id || "").trim();
  const vendorId = String(body.vendor_id || "").trim();
  if (!profileId && !vendorId) throw new Error("profile_id or vendor_id required");

  let profile = null;
  let vendor = null;

  if (vendorId) {
    const { data: v, error } = await sb
      .from("vendor_partners")
      .select("*, vendor_partner_services(service_id, category_id, is_active)")
      .eq("id", vendorId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!v) throw new Error("Vendor not found");
    vendor = v;
    if (v.profile_id) {
      const { data: p } = await sb.from("profiles").select("*").eq("id", v.profile_id).maybeSingle();
      profile = p;
    }
  } else if (profileId) {
    const { data: p, error } = await sb.from("profiles").select("*").eq("id", profileId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!p) throw new Error("Profile not found");
    profile = p;
    const { data: v } = await sb
      .from("vendor_partners")
      .select("*, vendor_partner_services(service_id, category_id, is_active)")
      .eq("profile_id", profileId)
      .maybeSingle();
    vendor = v;
  }

  const custId = profile?.id || vendor?.profile_id;
  let bookings: unknown[] = [];
  let dispatchesAsCustomer: unknown[] = [];
  if (custId) {
    const { data: bk } = await sb
      .from("bookings")
      .select("*")
      .eq("customer_id", custId)
      .order("created_at", { ascending: false })
      .limit(40);
    bookings = bk || [];
    const bookingIds = bookings.map((b: { id: string }) => b.id);
    if (bookingIds.length) {
      const { data: disp } = await sb
        .from("booking_dispatch")
        .select("*, booking_dispatch_attempts(*)")
        .in("booking_id", bookingIds)
        .order("created_at", { ascending: false });
      dispatchesAsCustomer = disp || [];
    }
  }

  let dispatchesAsVendor: unknown[] = [];
  if (vendor?.id) {
    const { data: disp } = await sb
      .from("booking_dispatch")
      .select("*, booking_dispatch_attempts(*)")
      .eq("assigned_vendor_id", vendor.id)
      .order("created_at", { ascending: false })
      .limit(40);
    dispatchesAsVendor = disp || [];
  }

  return {
    profile,
    vendor,
    bookings,
    dispatches_as_customer: dispatchesAsCustomer,
    dispatches_as_vendor: dispatchesAsVendor,
  };
}

export async function updateProfileAdmin(
  sb: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
) {
  const profileId = String(body.profile_id || "").trim();
  if (!profileId) throw new Error("profile_id required");

  const patch = body.patch as Record<string, unknown> | undefined;
  if (!patch || typeof patch !== "object") throw new Error("patch object required");

  const allowed = [
    "first_name", "last_name", "name", "phone", "email", "address", "village",
    "city", "pincode", "status", "age", "gender", "upi_id", "notes", "role",
  ];
  const row: Record<string, unknown> = {};
  for (const k of allowed) {
    if (patch[k] !== undefined) row[k] = patch[k];
  }
  if (row.first_name !== undefined || row.last_name !== undefined) {
    const fn = String(row.first_name ?? patch.first_name ?? "");
    const ln = String(row.last_name ?? patch.last_name ?? "");
    row.name = `${fn} ${ln}`.trim();
  }
  if (!Object.keys(row).length) throw new Error("No valid fields to update");

  const { data, error } = await sb
    .from("profiles")
    .update(row)
    .eq("id", profileId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function listVendorsBriefAdmin(
  sb: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
) {
  const status = String(body.status || "active");
  const limit = Math.min(Number(body.limit) || 100, 200);
  let query = sb
    .from("vendor_partners")
    .select("id,business_name,phone,city,status,profile_id")
    .order("business_name", { ascending: true })
    .limit(limit);
  if (status && status !== "all") query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}
