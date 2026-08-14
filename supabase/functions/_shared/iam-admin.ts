/** IAM catalog and staff role management (admin-hub). */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { invalidateIamCache } from "./iam.ts";

export async function getIamCatalog(sb: SupabaseClient) {
  const [rolesRes, permsRes, mapRes, pinMapRes] = await Promise.all([
    sb.from("iam_roles").select("id, label, description, sort_order").order("sort_order"),
    sb.from("iam_permissions").select("id, label, domain, description").order("domain").order("id"),
    sb.from("iam_role_permissions").select("role_id, permission_id"),
    sb.from("iam_pin_role_map").select("pin_key, role_id, description").order("pin_key"),
  ]);

  if (rolesRes.error) throw new Error(rolesRes.error.message);
  if (permsRes.error) throw new Error(permsRes.error.message);
  if (mapRes.error) throw new Error(mapRes.error.message);
  if (pinMapRes.error) throw new Error(pinMapRes.error.message);

  const permissionsByRole: Record<string, string[]> = {};
  for (const row of mapRes.data || []) {
    const rid = String(row.role_id);
    if (!permissionsByRole[rid]) permissionsByRole[rid] = [];
    permissionsByRole[rid].push(String(row.permission_id));
  }

  return {
    roles: rolesRes.data || [],
    permissions: permsRes.data || [],
    permissions_by_role: permissionsByRole,
    pin_role_map: pinMapRes.data || [],
    pin_secrets: [
      { key: "ADMIN_HUB_PIN", label: "Admin hub / owner" },
      { key: "SUPPORT_ADMIN_PIN", label: "Support leader" },
      { key: "SUPPORT_AGENT_PIN", label: "Support agent desk" },
      { key: "PRICING_ADMIN_PIN", label: "Pricing admin" },
      { key: "VENDOR_ADMIN_PIN", label: "Vendor admin" },
    ],
  };
}

export async function listStaffUsers(sb: SupabaseClient) {
  const { data: staff, error } = await sb
    .from("staff_users")
    .select("id, email, display_name, active, auth_user_id, support_agent_id, notes, created_at, updated_at")
    .order("email");
  if (error) throw new Error(error.message);

  const ids = (staff || []).map((s) => s.id);
  let assignments: Array<{ staff_id: string; role_id: string }> = [];
  if (ids.length) {
    const { data: rows, error: aErr } = await sb
      .from("staff_role_assignments")
      .select("staff_id, role_id")
      .in("staff_id", ids);
    if (aErr) throw new Error(aErr.message);
    assignments = rows || [];
  }

  const rolesByStaff = new Map<string, string[]>();
  for (const a of assignments) {
    const list = rolesByStaff.get(a.staff_id) || [];
    list.push(a.role_id);
    rolesByStaff.set(a.staff_id, list);
  }

  return (staff || []).map((s) => ({
    ...s,
    role_ids: rolesByStaff.get(s.id) || [],
  }));
}

export async function upsertStaffUser(
  sb: SupabaseClient,
  body: Record<string, unknown>,
  grantedBy: string,
) {
  const email = String(body.email || "").trim().toLowerCase();
  const displayName = String(body.display_name || body.name || "").trim();
  if (!email || !email.includes("@")) return { error: "Valid email required" };
  if (!displayName) return { error: "display_name required" };

  const patch = {
    email,
    display_name: displayName,
    active: body.active !== false,
    notes: body.notes ? String(body.notes).slice(0, 2000) : null,
    support_agent_id: body.support_agent_id ? String(body.support_agent_id) : null,
  };

  const { data: existing } = await sb.from("staff_users").select("id").eq("email", email).maybeSingle();

  let staffId: string;
  if (existing) {
    const { data, error } = await sb.from("staff_users").update(patch).eq("id", existing.id).select("id").single();
    if (error) return { error: error.message };
    staffId = data.id;
  } else {
    const { data, error } = await sb.from("staff_users").insert(patch).select("id").single();
    if (error) return { error: error.message };
    staffId = data.id;
  }

  if (body.support_agent_id) {
    await sb.from("support_agents").update({ staff_user_id: staffId }).eq("id", String(body.support_agent_id));
  }

  const roleIds = Array.isArray(body.role_ids)
    ? body.role_ids.map((r) => String(r)).filter(Boolean)
    : [];

  if (body.role_ids !== undefined) {
    await sb.from("staff_role_assignments").delete().eq("staff_id", staffId);
    if (roleIds.length) {
      const rows = roleIds.map((role_id) => ({
        staff_id: staffId,
        role_id,
        granted_by: grantedBy,
      }));
      const { error: insErr } = await sb.from("staff_role_assignments").insert(rows);
      if (insErr) return { error: insErr.message };
    }
    invalidateIamCache();
  }

  const users = await listStaffUsers(sb);
  const user = users.find((u) => u.id === staffId);
  return { staff: user };
}

export async function assignStaffRoles(
  sb: SupabaseClient,
  body: Record<string, unknown>,
  grantedBy: string,
) {
  const staffId = String(body.staff_id || "").trim();
  if (!staffId) return { error: "staff_id required" };

  const roleIds = Array.isArray(body.role_ids)
    ? [...new Set(body.role_ids.map((r) => String(r)).filter(Boolean))]
    : null;
  if (!roleIds?.length) return { error: "role_ids array required" };

  const replace = body.replace !== false;
  if (replace) {
    await sb.from("staff_role_assignments").delete().eq("staff_id", staffId);
  }

  const rows = roleIds.map((role_id) => ({
    staff_id: staffId,
    role_id,
    granted_by: grantedBy,
  }));

  const { error } = await sb.from("staff_role_assignments").upsert(rows, {
    onConflict: "staff_id,role_id",
  });
  if (error) return { error: error.message };

  invalidateIamCache();
  const users = await listStaffUsers(sb);
  const user = users.find((u) => u.id === staffId);
  return { staff: user };
}
