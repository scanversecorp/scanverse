#!/usr/bin/env node
/**
 * Toggle ScanV customer maintenance page (Go-Live → maintenance_mode switch).
 *
 * Usage:
 *   node scripts/maintenance-mode.mjs on|off|status
 *
 * Requires ADMIN_HUB_PIN (or SUPPORT_ADMIN_PIN) in .env — same as other ops scripts.
 * If admin-hub is down, use the SQL in Go-Live → Reference URLs.
 */
import { adminHubPost } from './lib/scanv-admin.mjs';

const cmd = (process.argv[2] || 'status').toLowerCase();

function findMaintenanceSwitch(cfg) {
  const sec = (cfg?.sections || []).find((s) => s.id === 'switches');
  return sec?.items?.find((i) => i.setting === 'maintenance_mode') || null;
}

async function status() {
  const cfg = await adminHubPost('get_go_live_config');
  if (cfg?.error) throw new Error(cfg.error);
  const sw = findMaintenanceSwitch(cfg);
  const on = !!sw?.enabled;
  console.log(`maintenance_mode: ${on ? 'ON  (customers see maintenance page)' : 'OFF (site live)'}`);
  if (on) {
    console.log('Ops bypass still works: #admin #exec #vendor-admin #pricing-admin #customer-support #otp-delivery-report');
  }
  return on;
}

async function setEnabled(on) {
  const res = await adminHubPost('update_go_live_switch', { key: 'maintenance_mode', enabled: on });
  if (res?.error) throw new Error(res.error);
  console.log(`✓ maintenance_mode → ${on ? 'ON' : 'OFF'}`);
  if (on) {
    console.log('Public PWA now shows the funny maintenance page.');
  } else {
    console.log('Public site is live again at https://getscanv.com');
  }
}

async function main() {
  if (cmd === 'status') {
    await status();
    return;
  }
  if (cmd === 'on' || cmd === '1' || cmd === 'enable') {
    await setEnabled(true);
    return;
  }
  if (cmd === 'off' || cmd === '0' || cmd === 'disable') {
    await setEnabled(false);
    return;
  }
  console.error('Usage: node scripts/maintenance-mode.mjs on|off|status');
  console.error('\nSQL fallback (admin-hub unreachable):');
  console.error("  UPDATE platform_settings SET value = '0', updated_by = 'sql' WHERE key = 'maintenance_mode';");
  process.exit(1);
}

main().catch((e) => {
  console.error('✗', e.message || e);
  console.error('\nIf admin-hub failed, use Supabase SQL Editor:');
  console.error("  UPDATE platform_settings SET value = '1', updated_by = 'sql' WHERE key = 'maintenance_mode';  -- ON");
  console.error("  UPDATE platform_settings SET value = '0', updated_by = 'sql' WHERE key = 'maintenance_mode';  -- OFF");
  process.exit(1);
});
