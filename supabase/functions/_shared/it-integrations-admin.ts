/** IT vendor integration registry — Admin IT Integrations tab. */

import { envConfigured, isPlatformFlagOn, type PlatformSb } from "./platform-settings.ts";
import { VENDOR_PROVIDER_DEFS } from "./vendor-providers.ts";

export type IntegrationSwitchState = "on" | "off" | "hold";

export type ItIntegrationRow = {
  id: string;
  vendor_name: string;
  contact_phone: string | null;
  portal_url: string | null;
  api_url: string | null;
  credential_key: string | null;
  credential_purpose: string | null;
  scanv_usage: string | null;
  switch_key: string | null;
  switch_state: IntegrationSwitchState;
  hold_until: string | null;
  sort_order: number;
  updated_at: string | null;
  updated_by: string | null;
};

export type ItIntegrationView = ItIntegrationRow & {
  credential_configured: boolean;
  effective_enabled: boolean;
  effective_label: string;
  hold_active: boolean;
};

function defaultOnForSwitchKey(switchKey: string | null): boolean {
  if (!switchKey) return true;
  const def = VENDOR_PROVIDER_DEFS.find((d) => d.key === switchKey);
  return def?.defaultOn ?? true;
}

export function integrationHoldActive(
  switchState: IntegrationSwitchState,
  holdUntil: string | null,
  now = Date.now(),
): boolean {
  if (switchState !== "hold" || !holdUntil) return false;
  const t = new Date(holdUntil).getTime();
  return !Number.isNaN(t) && t > now;
}

export function integrationEffectiveEnabled(
  row: Pick<ItIntegrationRow, "switch_state" | "hold_until" | "switch_key">,
  platformFlagOn: boolean,
  now = Date.now(),
): boolean {
  if (!row.switch_key) {
    if (row.switch_state === "off") return false;
    if (row.switch_state === "hold" && integrationHoldActive(row.switch_state, row.hold_until, now)) {
      return false;
    }
    return true;
  }
  if (row.switch_state === "off") return false;
  if (row.switch_state === "hold") {
    if (integrationHoldActive(row.switch_state, row.hold_until, now)) return false;
    return platformFlagOn;
  }
  return platformFlagOn;
}

function effectiveLabel(row: ItIntegrationRow, effective: boolean): string {
  if (!row.switch_key && row.switch_state === "on") return "Active";
  if (!row.switch_key && row.switch_state === "off") return "Off";
  if (row.switch_state === "hold" && integrationHoldActive(row.switch_state, row.hold_until)) {
    return `Hold until ${row.hold_until?.slice(0, 16).replace("T", " ") || "—"}`;
  }
  if (row.switch_state === "hold") return "Hold expired → ON";
  return effective ? "ON" : "OFF";
}

function credentialConfigured(key: string | null): boolean {
  if (!key?.trim()) return false;
  return key.split(/[,+]/).map((k) => k.trim()).filter(Boolean).every((k) => envConfigured(k));
}

async function syncSwitchKey(
  sb: PlatformSb,
  switchKey: string,
  switchState: IntegrationSwitchState,
  holdUntil: string | null,
  updatedBy: string,
): Promise<void> {
  let value = "1";
  if (switchState === "off") value = "0";
  if (switchState === "hold") value = "0";
  await sb.from("platform_settings").upsert({
    key: switchKey,
    value,
    updated_by: updatedBy,
  }, { onConflict: "key" });
  if (switchState === "hold" && holdUntil) {
    await sb.from("platform_settings").upsert({
      key: `${switchKey}_hold_until`,
      value: holdUntil,
      updated_by: updatedBy,
    }, { onConflict: "key" });
  } else {
    await sb.from("platform_settings").delete().eq("key", `${switchKey}_hold_until`);
  }
}

export async function resolveSwitchKeyEnabled(sb: PlatformSb, switchKey: string): Promise<boolean> {
  const { data: row } = await sb
    .from("it_integrations")
    .select("switch_state, hold_until, switch_key")
    .eq("switch_key", switchKey)
    .maybeSingle();
  const platformOn = await isPlatformFlagOn(sb, switchKey, {
    defaultValue: defaultOnForSwitchKey(switchKey),
  });
  if (!row) return platformOn;
  return integrationEffectiveEnabled(
    row as ItIntegrationRow,
    platformOn,
  );
}

export async function listItIntegrations(sb: PlatformSb): Promise<ItIntegrationView[]> {
  const { data, error } = await sb
    .from("it_integrations")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("vendor_name", { ascending: true });
  if (error) throw new Error(error.message);

  const rows = (data || []) as ItIntegrationRow[];
  const out: ItIntegrationView[] = [];

  for (const row of rows) {
    let platformOn = true;
    if (row.switch_key) {
      platformOn = await isPlatformFlagOn(sb, row.switch_key, {
        defaultValue: defaultOnForSwitchKey(row.switch_key),
      });
    }
    const holdActive = integrationHoldActive(row.switch_state, row.hold_until);
    const effective = integrationEffectiveEnabled(row, platformOn);
    out.push({
      ...row,
      credential_configured: credentialConfigured(row.credential_key),
      effective_enabled: effective,
      effective_label: effectiveLabel(row, effective),
      hold_active: holdActive,
    });
  }

  return out;
}

export async function updateItIntegration(
  sb: PlatformSb,
  id: string,
  patch: Record<string, unknown>,
  updatedBy: string,
): Promise<{ error?: string; integration?: ItIntegrationView }> {
  const { data: existing, error: loadErr } = await sb
    .from("it_integrations")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (loadErr) return { error: loadErr.message };
  if (!existing) return { error: "Integration not found" };

  const row = existing as ItIntegrationRow;
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    updated_by: updatedBy,
  };

  const textFields = [
    "vendor_name", "contact_phone", "portal_url", "api_url",
    "credential_key", "credential_purpose", "scanv_usage",
  ] as const;
  for (const f of textFields) {
    if (patch[f] !== undefined) updates[f] = String(patch[f] ?? "").trim() || null;
  }

  let switchState = row.switch_state;
  if (patch.switch_state !== undefined) {
    const st = String(patch.switch_state || "").trim().toLowerCase();
    if (!["on", "off", "hold"].includes(st)) return { error: "switch_state must be on, off, or hold" };
    switchState = st as IntegrationSwitchState;
    updates.switch_state = switchState;
  }

  let holdUntil = row.hold_until;
  if (patch.hold_until !== undefined) {
    const raw = String(patch.hold_until || "").trim();
    holdUntil = raw ? new Date(raw).toISOString() : null;
    updates.hold_until = holdUntil;
  }

  if (switchState === "hold" && !holdUntil) {
    return { error: "hold_until required when switch is HOLD" };
  }
  if (switchState !== "hold") {
    updates.hold_until = null;
    holdUntil = null;
  }

  const { error: updErr } = await sb.from("it_integrations").update(updates).eq("id", id);
  if (updErr) return { error: updErr.message };

  if (row.switch_key && (patch.switch_state !== undefined || patch.hold_until !== undefined)) {
    await syncSwitchKey(sb, row.switch_key, switchState, holdUntil, updatedBy);
  }

  const list = await listItIntegrations(sb);
  const integration = list.find((i) => i.id === id);
  return { integration };
}

export async function syncItIntegrationFromPlatformSwitch(
  sb: PlatformSb,
  switchKey: string,
  enabled: boolean,
  updatedBy: string,
): Promise<void> {
  const { data } = await sb
    .from("it_integrations")
    .select("id")
    .eq("switch_key", switchKey)
    .maybeSingle();
  if (!data?.id) return;
  await sb.from("it_integrations").update({
    switch_state: enabled ? "on" : "off",
    hold_until: null,
    updated_at: new Date().toISOString(),
    updated_by: updatedBy,
  }).eq("id", data.id);
}
