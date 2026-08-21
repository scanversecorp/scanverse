/** ScanV IAM — JWT staff auth + transitional PIN mapping to roles/permissions. */

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export type AuthMethod = "pin" | "jwt";

export type IamContext = {
  authenticated: true;
  auth_method: AuthMethod;
  staff_id: string | null;
  staff_email: string | null;
  display_name: string | null;
  roles: string[];
  permissions: string[];
  /** Legacy field for existing UI branches */
  legacy_role: "support_admin" | "support_agent" | null;
  pin_key: string | null;
};

type PinMatch = { pin_key: string; env_name: string };

const PIN_ENV_NAMES: Array<{ env_name: string; pin_key: string }> = [
  { env_name: "ADMIN_HUB_PIN", pin_key: "ADMIN_HUB_PIN" },
  { env_name: "EXEC_DASHBOARD_PIN", pin_key: "EXEC_DASHBOARD_PIN" },
  { env_name: "SUPPORT_ADMIN_PIN", pin_key: "SUPPORT_ADMIN_PIN" },
  { env_name: "PRICING_ADMIN_PIN", pin_key: "PRICING_ADMIN_PIN" },
  { env_name: "VENDOR_ADMIN_PIN", pin_key: "VENDOR_ADMIN_PIN" },
  { env_name: "SUPPORT_AGENT_PIN", pin_key: "SUPPORT_AGENT_PIN" },
];

/** Admin hub action → required permission */
export const HUB_ACTION_PERMISSIONS: Record<string, string> = {
  whoami: "hub.access",
  stats: "hub.stats",
  list_agents: "hub.agents",
  create_agent: "hub.agents",
  update_agent: "hub.agents",
  deactivate_agent: "hub.agents",
  search_bookings: "hub.bookings",
  booking_detail: "hub.bookings",
  update_booking: "hub.bookings",
  cancel_booking: "hub.bookings",
  list_payments: "hub.payments",
  list_pending_refunds: "hub.refunds",
  update_refund: "hub.refunds",
  refund_approval_send: "hub.refunds",
  refund_approval_confirm: "hub.refunds",
  issue_razorpay_refund: "hub.refunds",
  refund_approval_status: "hub.refunds",
  list_investments: "hub.investments",
  respond_investment: "hub.investments",
  otp_delivery_reports: "hub.otp",
  get_platform_settings: "hub.settings",
  update_platform_setting: "hub.settings",
  get_go_live_config: "hub.go_live.read",
  update_go_live_switch: "hub.go_live.switch",
  update_go_live_check: "hub.go_live.checklist",
  update_razorpay_route_ticket: "hub.go_live.ticket",
  gps_status_report: "hub.gps",
  run_daily_gps_check: "hub.gps",
  exec_stats: "hub.exec",
  exec_charts: "hub.exec",
  exec_pin_check: "hub.exec",
  pricing_2fa_status: "hub.pricing_2fa",
  pricing_2fa_reset_send: "hub.pricing_2fa",
  pricing_2fa_reset_confirm: "hub.pricing_2fa",
  get_admin_diagrams: "hub.diagrams",
  get_vendor_leads: "hub.vendor_leads",
  update_vendor_lead: "hub.vendor_leads",
  add_vendor_lead_to_scanv: "hub.vendor_leads",
  get_admin_url_index: "hub.index",
  search_dispatches: "hub.dispatch",
  dispatch_detail: "hub.dispatch",
  update_dispatch: "hub.dispatch",
  dispatch_control: "hub.dispatch",
  search_directory: "hub.directory",
  directory_detail: "hub.directory",
  update_profile: "hub.directory",
  set_profile_status: "hub.directory",
  delete_profile: "hub.directory",
  reset_profile_password: "hub.directory",
  list_vendors_brief: "hub.directory",
  get_iam_catalog: "hub.access",
  list_staff_users: "hub.iam",
  upsert_staff_user: "hub.iam",
  assign_staff_roles: "hub.iam",
  delete_staff_user: "hub.iam",
  get_logistics_pipeline: "hub.stats",
  get_it_integrations: "hub.go_live.read",
  update_it_integration: "hub.go_live.switch",
  update_logistics_partner: "hub.settings",
  list_external_trips: "hub.stats",
  quote_external_trip: "hub.dispatch",
  create_external_trip: "hub.dispatch",
  get_business_command: "hub.stats",
  update_card_business: "hub.settings",
  send_vendor_outreach: "hub.vendor_leads",
  send_strike_list_outreach: "hub.vendor_leads",
  get_social_dashboard: "hub.stats",
  run_app_health_check: "hub.stats",
  run_infra_health_check: "hub.stats",
  run_security_health_check: "hub.stats",
  run_smoke_test: "hub.stats",
  run_api_monitoring: "hub.stats",
  ops_dashboard_stats: "hub.stats",
  list_active_sessions: "hub.stats",
  update_social_content: "hub.settings",
  add_social_content: "hub.settings",
  update_social_config: "hub.settings",
  update_social_platform: "hub.settings",
  mark_social_everywhere: "hub.settings",
  list_service_schedules: "hub.settings",
  get_service_schedule: "hub.settings",
  update_service_schedule: "hub.settings",
  list_service_schedule_vendors: "hub.settings",
  update_service_schedule_vendors: "hub.settings",
  purge_test_data: "hub.purge_test",
  clean_cloud_test_data: "hub.purge_test",
  send_ops_email: "hub.purge_test",
};

let pinRoleCache: Map<string, string[]> | null = null;
let rolePermCache: Map<string, string[]> | null = null;
let cacheAt = 0;
const CACHE_MS = 60_000;

function matchPin(req: Request, headerName = "x-admin-pin"): PinMatch | null {
  const pin = req.headers.get(headerName) || req.headers.get("x-support-pin") || "";
  if (!pin) return null;
  for (const { env_name, pin_key } of PIN_ENV_NAMES) {
    const secret = Deno.env.get(env_name) || "";
    if (secret.length >= 6 && pin === secret) {
      return { pin_key, env_name };
    }
  }
  return null;
}

async function loadPinRoleMap(sb: SupabaseClient): Promise<Map<string, string[]>> {
  const now = Date.now();
  if (pinRoleCache && now - cacheAt < CACHE_MS) return pinRoleCache;

  const { data, error } = await sb.from("iam_pin_role_map").select("pin_key, role_id");
  if (error || !data?.length) {
    pinRoleCache = fallbackPinRoleMap();
    cacheAt = now;
    return pinRoleCache;
  }

  const map = new Map<string, string[]>();
  for (const row of data) {
    const key = String(row.pin_key);
    const list = map.get(key) || [];
    list.push(String(row.role_id));
    map.set(key, list);
  }
  pinRoleCache = map;
  cacheAt = now;
  return map;
}

function fallbackPinRoleMap(): Map<string, string[]> {
  return new Map([
    ["ADMIN_HUB_PIN", ["scanv_owner", "hub_operator"]],
    ["EXEC_DASHBOARD_PIN", ["exec_viewer"]],
    ["SUPPORT_ADMIN_PIN", ["scanv_owner", "hub_operator", "support_admin"]],
    ["PRICING_ADMIN_PIN", ["hub_operator", "pricing_admin"]],
    ["VENDOR_ADMIN_PIN", ["hub_operator", "vendor_admin"]],
    ["SUPPORT_AGENT_PIN", ["support_agent"]],
  ]);
}

async function loadRolePermissions(sb: SupabaseClient): Promise<Map<string, string[]>> {
  const now = Date.now();
  if (rolePermCache && now - cacheAt < CACHE_MS) return rolePermCache;

  const { data, error } = await sb
    .from("iam_role_permissions")
    .select("role_id, permission_id");
  if (error || !data?.length) {
    rolePermCache = new Map();
    cacheAt = now;
    return rolePermCache;
  }

  const map = new Map<string, string[]>();
  for (const row of data) {
    const roleId = String(row.role_id);
    const list = map.get(roleId) || [];
    list.push(String(row.permission_id));
    map.set(roleId, list);
  }
  rolePermCache = map;
  cacheAt = now;
  return map;
}

function unionPermissions(roleIds: string[], rolePermMap: Map<string, string[]>): string[] {
  const set = new Set<string>();
  for (const roleId of roleIds) {
    for (const p of rolePermMap.get(roleId) || []) set.add(p);
  }
  return [...set].sort();
}

function deriveLegacyRole(roles: string[]): IamContext["legacy_role"] {
  if (roles.includes("scanv_owner") || roles.includes("hub_operator") || roles.includes("support_admin")) {
    return "support_admin";
  }
  if (roles.includes("support_agent")) return "support_agent";
  return null;
}

function bearerToken(req: Request): string | null {
  const auth = req.headers.get("Authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

async function resolveJwtContext(
  req: Request,
  sb: SupabaseClient,
  rolePermMap: Map<string, string[]>,
): Promise<IamContext | null> {
  const token = bearerToken(req);
  if (!token) return null;

  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (anonKey && token === anonKey) return null;

  const url = Deno.env.get("SUPABASE_URL")!;
  const userClient = createClient(url, anonKey || token, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: userData, error: userErr } = await userClient.auth.getUser(token);
  if (userErr || !userData?.user?.email) return null;

  const email = userData.user.email.toLowerCase();
  const { data: staff } = await sb
    .from("staff_users")
    .select("id, email, display_name, active, auth_user_id")
    .eq("email", email)
    .maybeSingle();

  if (!staff || !staff.active) return null;

  if (!staff.auth_user_id) {
    await sb.from("staff_users").update({ auth_user_id: userData.user.id }).eq("id", staff.id);
  }

  const { data: assignments } = await sb
    .from("staff_role_assignments")
    .select("role_id")
    .eq("staff_id", staff.id);

  const roles = [...new Set((assignments || []).map((a) => String(a.role_id)))];
  if (!roles.length) return null;

  const permissions = unionPermissions(roles, rolePermMap);
  return {
    authenticated: true,
    auth_method: "jwt",
    staff_id: staff.id,
    staff_email: staff.email,
    display_name: staff.display_name,
    roles,
    permissions,
    legacy_role: deriveLegacyRole(roles),
    pin_key: null,
  };
}

async function resolvePinContext(
  req: Request,
  sb: SupabaseClient,
  headerName?: string,
): Promise<IamContext | null> {
  const hit = matchPin(req, headerName);
  if (!hit) return null;

  const pinRoleMap = await loadPinRoleMap(sb);
  const rolePermMap = await loadRolePermissions(sb);
  const roles = [...new Set(pinRoleMap.get(hit.pin_key) || [])];
  if (!roles.length) return null;

  const permissions = unionPermissions(roles, rolePermMap);
  return {
    authenticated: true,
    auth_method: "pin",
    staff_id: null,
    staff_email: null,
    display_name: null,
    roles,
    permissions,
    legacy_role: deriveLegacyRole(roles),
    pin_key: hit.pin_key,
  };
}

export async function resolveIamContext(
  req: Request,
  sb: SupabaseClient,
  opts?: { headerName?: string; preferJwt?: boolean },
): Promise<IamContext | null> {
  await loadRolePermissions(sb);

  if (opts?.preferJwt !== false) {
    const rolePermMap = rolePermCache || new Map();
    const jwtCtx = await resolveJwtContext(req, sb, rolePermMap);
    if (jwtCtx) return jwtCtx;
  }

  return resolvePinContext(req, sb, opts?.headerName);
}

export function hasPermission(ctx: IamContext, permission: string): boolean {
  if (ctx.permissions.includes(permission)) return true;
  const parts = permission.split(".");
  for (let i = parts.length - 1; i > 0; i--) {
    const wildcard = `${parts.slice(0, i).join(".")}.*`;
    if (ctx.permissions.includes(wildcard)) return true;
  }
  return false;
}

export function hasRole(ctx: IamContext, roleId: string): boolean {
  return ctx.roles.includes(roleId);
}

export function requireHubPermission(ctx: IamContext, action: string): string | null {
  const perm = HUB_ACTION_PERMISSIONS[action];
  if (!perm) return null;
  if (!hasPermission(ctx, perm)) return perm;
  return null;
}

export function iamWhoamiPayload(ctx: IamContext) {
  return {
    role: ctx.legacy_role,
    admin: ctx.legacy_role === "support_admin",
    auth_method: ctx.auth_method,
    pin_key: ctx.pin_key,
    staff_id: ctx.staff_id,
    staff_email: ctx.staff_email,
    display_name: ctx.display_name,
    roles: ctx.roles,
    permissions: ctx.permissions,
  };
}

export function invalidateIamCache() {
  pinRoleCache = null;
  rolePermCache = null;
  cacheAt = 0;
}
