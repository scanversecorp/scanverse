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

const PROFILE_LIFECYCLE = new Set(["active", "paused"]);

function digits10(value: unknown): string {
  return String(value || "").replace(/\D/g, "").slice(-10);
}

function profileAuthEmailsFor(profile: Record<string, unknown>): string[] {
  const emails = new Set<string>();
  const d10 = digits10(profile.phone) || (String(profile.id || "").startsWith("cust_")
    ? digits10(String(profile.id).slice(5))
    : "");
  if (d10.length === 10) {
    emails.add(`${d10}@scanv.app`);
    emails.add(`91${d10}@scanv.app`);
    emails.add(`+91${d10}@scanv.app`);
  }
  if (profile.email) emails.add(String(profile.email).toLowerCase());
  return [...emails];
}

async function deleteAuthUsersByEmail(
  sb: ReturnType<typeof createClient>,
  emails: string[],
) {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const deleted: string[] = [];
  for (const email of emails) {
    const target = email.toLowerCase();
    let userId: string | null = null;
    if (url && key) {
      const res = await fetch(
        `${url}/auth/v1/admin/users?filter=${encodeURIComponent(email)}&page=1&per_page=50`,
        { headers: { Authorization: `Bearer ${key}`, apikey: key } },
      );
      if (res.ok) {
        const payload = await res.json().catch(() => ({}));
        const users = (payload as { users?: Array<{ id: string; email?: string }> }).users || [];
        const match = users.find((u) => (u.email || "").toLowerCase() === target);
        if (match?.id) userId = match.id;
      }
    }
    if (!userId) {
      for (let page = 1; page <= 5; page++) {
        const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) break;
        const match = (data.users || []).find((u) => (u.email || "").toLowerCase() === target);
        if (match?.id) { userId = match.id; break; }
        if (!data.users?.length || data.users.length < 1000) break;
      }
    }
    if (!userId) continue;
    const { error } = await sb.auth.admin.deleteUser(userId);
    if (!error) deleted.push(email);
  }
  return deleted;
}

export async function setProfileStatusAdmin(
  sb: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
) {
  const profileId = String(body.profile_id || "").trim();
  const status = String(body.status || "").trim().toLowerCase();
  if (!profileId) throw new Error("profile_id required");
  if (!PROFILE_LIFECYCLE.has(status)) throw new Error("status must be active or paused");

  const { data: existing, error: loadErr } = await sb
    .from("profiles")
    .select("id, role, status")
    .eq("id", profileId)
    .maybeSingle();
  if (loadErr) throw new Error(loadErr.message);
  if (!existing) throw new Error("Profile not found");
  if (existing.role === "admin") throw new Error("Cannot change status of an admin profile");

  const { data, error } = await sb
    .from("profiles")
    .update({ status })
    .eq("id", profileId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteProfileAdmin(
  sb: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
) {
  const profileId = String(body.profile_id || "").trim();
  if (!profileId) throw new Error("profile_id required");

  const { data: profile, error: loadErr } = await sb
    .from("profiles")
    .select("id, role, phone, email")
    .eq("id", profileId)
    .maybeSingle();
  if (loadErr) throw new Error(loadErr.message);
  if (!profile) throw new Error("Profile not found");
  if (profile.role === "admin") throw new Error("Cannot delete an admin profile");

  const d10 = digits10(profile.phone) || (profileId.startsWith("cust_") ? digits10(profileId.slice(5)) : "");
  const mobiles = d10.length === 10
    ? [...new Set([`+91${d10}`, `91${d10}`, d10, profile.phone].filter(Boolean))]
    : [profile.phone].filter(Boolean);

  if (mobiles.length) {
    await sb.from("wa_verifications").delete().in("mobile", mobiles);
  }
  if (d10.length === 10) {
    await sb.from("student_cloud").delete().eq("mobile_e164", `+91${d10}`);
    await sb.from("student_cloud").delete().eq("mobile", d10);
  }
  await sb.from("user_locations").delete().eq("user_id", profileId);

  const { error: delErr } = await sb.from("profiles").delete().eq("id", profileId);
  if (delErr) throw new Error(delErr.message);

  const authDeleted = await deleteAuthUsersByEmail(sb, profileAuthEmailsFor(profile));
  return { deleted: true, profile_id: profileId, auth_deleted: authDeleted.length };
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
