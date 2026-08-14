/** IAM role power levels: 1 = lowest access, 6 = highest (ScanV Owner). */
export const IAM_ROLE_POWER = {
  support_agent: 1,
  pricing_admin: 2,
  vendor_admin: 3,
  support_admin: 4,
  hub_operator: 5,
  scanv_owner: 6,
};

export const IAM_POWER_MIN = 1;
export const IAM_POWER_MAX = 6;

export function rolePowerRank(roleId) {
  return IAM_ROLE_POWER[roleId] ?? null;
}

export function formatRoleWithRank(roleId, label) {
  const rank = rolePowerRank(roleId);
  const name = label || roleId;
  if (!rank) return name;
  return `#${rank} ${name}`;
}

export function sortRolesByPower(roles) {
  return [...roles].sort((a, b) => {
    const ra = rolePowerRank(a.id) ?? 99;
    const rb = rolePowerRank(b.id) ?? 99;
    return ra - rb;
  });
}

export function formatRoleIdsWithRank(roleIds) {
  return sortRolesByPower((roleIds || []).map((id) => ({ id })))
    .map(({ id }) => formatRoleWithRank(id, id))
    .join(', ');
}
