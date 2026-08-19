#!/usr/bin/env node
/**
 * Post-deploy validation for ScanV production.
 * Usage: node scripts/post-deploy-validate.mjs  (reads .env ADMIN_* pins)
 * Exit 0 = all checks passed; exit 1 = failures listed.
 */
import { readFileSync } from 'fs';

function loadDotEnv() {
  try {
    const raw = readFileSync(new URL('../.env', import.meta.url), 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!m || process.env[m[1]]) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      process.env[m[1]] = v;
    }
  } catch { /* no .env */ }
}
loadDotEnv();

const APP_URL = process.env.APP_URL || 'https://getscanv.com';
const SB_URL = process.env.SB_URL || 'https://rwlwrmmqtedugcreweut.supabase.co';
const SB_KEY = process.env.SB_KEY || 'sb_publishable_sx3krTi2ijpvn-K8wAQP6w_VFwH0vR3';
const ADMIN_PIN = process.env.ADMIN_PIN || process.env.ADMIN_HUB_PIN || process.env.SUPPORT_ADMIN_PIN || '';

const EXPECTED_VENDORS = [
  'twofactor', 'msg91', 'fast2sms', 'twilio', 'whatsapp', 'razorpay', 'vyapar_upi',
];
const EXPECTED_UPI = ['gpay', 'phonepe', 'paytm', 'navi', 'bhim', 'any'];
const EXPECTED_VENDOR_SWITCHES = [
  'vendor_enable_2factor', 'vendor_enable_msg91', 'vendor_enable_fast2sms', 'vendor_enable_twilio',
  'vendor_enable_whatsapp', 'vendor_enable_razorpay', 'vendor_enable_vyapar_upi',
  'vendor_enable_upi_gpay', 'vendor_enable_upi_phonepe', 'vendor_enable_upi_paytm',
  'vendor_enable_upi_navi', 'vendor_enable_upi_bhim', 'vendor_enable_upi_any',
];
const EXPECTED_DIAGRAM_SECTIONS = ['Architecture', 'Data flows', 'User journeys', 'Components'];
const EXPECTED_DIAGRAM_TOTAL = 31;

const failures = [];
const passes = [];

function pass(msg) { passes.push(msg); console.log('✓', msg); }
function fail(msg) { failures.push(msg); console.error('✗', msg); }

async function adminHub(action, payload = {}) {
  if (!ADMIN_PIN) throw new Error('ADMIN_PIN env required for admin checks');
  const res = await fetch(`${SB_URL}/functions/v1/admin-hub`, {
    method: 'POST',
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
      'x-admin-pin': ADMIN_PIN,
    },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function checkFrontendBundle() {
  const html = await (await fetch(APP_URL)).text();
  const mainMatch = html.match(/main\.([a-f0-9]+)\.js/);
  if (!mainMatch) return fail('Production index.html missing main.*.js bundle');
  const mainJs = mainMatch[0];
  pass(`Frontend bundle deployed: ${mainJs}`);

  const manifest = await (await fetch(`${APP_URL}/asset-manifest.json`)).json();
  const chunk = Object.keys(manifest.files || {}).find((k) => k.includes('.chunk.js') && !k.endsWith('.map'));
  if (chunk) pass(`Lazy chunk present: ${chunk}`);
  else fail('No lazy chunk in asset-manifest (AdminDiagramsTab may be inlined)');

  const mainSrc = await (await fetch(`${APP_URL}/static/js/${mainJs}`)).text();
  if (mainSrc.includes('AdminDiagramsTab')) pass('Main bundle references AdminDiagramsTab');
  else fail('Main bundle missing AdminDiagramsTab');
  if (mainSrc.includes('flowchart TB') || mainSrc.includes('sequenceDiagram')) {
    fail('Main bundle still embeds Mermaid diagram source (should be server-only)');
  } else {
    pass('Main bundle has no embedded Mermaid diagram data');
  }
  if (mainSrc.includes('github.com/scanversecorp/scanverse')) {
    fail('Main bundle may expose confidential admin URL catalog');
  } else {
    pass('Main bundle has no admin URL index catalog');
  }
  if (
    mainSrc.includes('list_service_schedules')
    && mainSrc.includes('AdminServiceSchedule')
    && mainSrc.includes('min_lead_minutes')
  ) {
    pass('Main bundle includes service schedule booking UI');
  } else {
    fail('Main bundle missing service schedule booking UI');
  }

  const docsRes = await fetch(`${APP_URL}/docs/architecture.html`);
  const docsBody = await docsRes.text();
  const blocked = docsBody.includes('Page not found') || docsBody.includes('not publicly available');
  if (blocked) pass('/docs/architecture.html blocked (serves not-found page)');
  else if (docsRes.status === 404) pass('/docs/architecture.html blocked (404)');
  else fail(`/docs/architecture.html may expose content (${docsRes.status})`);
}

async function checkPlatformConfig() {
  const res = await fetch(`${SB_URL}/functions/v1/platform-config`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
  });
  const data = await res.json();
  if (!data.vendors) return fail('platform-config missing vendors payload');

  for (const k of EXPECTED_VENDORS) {
    if (data.vendors[k] !== true) fail(`platform-config ${k} not ON (${data.vendors[k]})`);
    else pass(`platform-config ${k} ON`);
  }
  for (const k of EXPECTED_UPI) {
    if (data.vendors.upi?.[k] !== true) fail(`platform-config upi.${k} not ON`);
    else pass(`platform-config upi.${k} ON`);
  }
}

async function checkGoLiveSwitches() {
  const cfg = await adminHub('get_go_live_config');
  const p = cfg.progress || {};
  if (p.vendors?.total === 12 && p.vendors?.done === 12) {
    pass(`Go-Live vendors: ${p.vendors.done}/${p.vendors.total} recommended state`);
  } else {
    fail(`Go-Live vendors: ${p.vendors?.done}/${p.vendors?.total} (expected 12/12)`);
  }

  const vendorSection = (cfg.sections || []).find((s) => s.id === 'vendors');
  const switches = (vendorSection?.items || []).filter((i) => i.type === 'switch');
  if (switches.length !== 12) fail(`Vendor switch board count ${switches.length} (expected 12)`);
  else pass('Vendor switch board lists 12 providers');

  for (const key of EXPECTED_VENDOR_SWITCHES) {
    const row = switches.find((s) => s.setting === key);
    if (!row) fail(`Missing switch: ${key}`);
    else if (!row.enabled) fail(`${key} is OFF (production recommendation: on)`);
    else pass(`${key} ON`);
  }

  const runtime = (cfg.sections || []).find((s) => s.id === 'switches')?.items || [];
  const otpDev = runtime.find((s) => s.setting === 'otp_dev_mode');
  const dispatch = runtime.find((s) => s.setting === 'dispatch_open');
  if (otpDev?.enabled) fail('otp_dev_mode is ON (must be OFF in production)');
  else pass('otp_dev_mode OFF');
  if (dispatch?.enabled) fail('dispatch_open is ON (must be OFF in production)');
  else pass('dispatch_open OFF');
}

async function checkAdminUrlIndex() {
  const unauth = await fetch(`${SB_URL}/functions/v1/admin-hub`, {
    method: 'POST',
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'get_admin_url_index' }),
  });
  const unauthBody = await unauth.json();
  if (unauth.status === 401 || unauthBody.error === 'Unauthorized') {
    pass('get_admin_url_index blocked without PIN');
  } else {
    fail('get_admin_url_index allowed without PIN');
  }
  const data = await adminHub('get_admin_url_index');
  const total = (data.sections || []).reduce((n, s) => n + (s.items?.length || 0), 0);
  if (total >= 40) pass(`Admin URL index: ${total} links (PIN-gated)`);
  else fail(`Admin URL index: ${total} links (expected ~45)`);

  const { spawnSync } = await import('child_process');
  const v = spawnSync('node', ['scripts/validate-url-index.mjs'], { cwd: new URL('..', import.meta.url).pathname, encoding: 'utf8' });
  if (v.status === 0) pass('URL index covers all App.js routes');
  else fail(`URL index route coverage: ${(v.stderr || v.stdout || '').trim().split('\n').slice(-3).join(' ')}`);
}

async function checkDiagrams() {
  const data = await adminHub('get_admin_diagrams');
  const sections = data.sections || [];
  const total = sections.reduce((n, s) => n + (s.diagrams?.length || 0), 0);
  if (total !== EXPECTED_DIAGRAM_TOTAL) {
    fail(`Diagram catalog: ${total} (expected ${EXPECTED_DIAGRAM_TOTAL})`);
  } else {
    pass(`Diagram catalog: ${total} diagrams`);
  }
  for (const label of EXPECTED_DIAGRAM_SECTIONS) {
    const sec = sections.find((s) => s.label === label);
    if (!sec?.diagrams?.length) fail(`Diagram section missing: ${label}`);
    else pass(`Diagram section "${label}": ${sec.diagrams.length}`);
  }
}

async function checkBusinessCommand() {
  const data = await adminHub('get_business_command');
  const cards = data.cards || [];
  if (cards.length !== 12) fail(`Business HQ: ${cards.length} cards (expected 12)`);
  else pass(`Business HQ: ${cards.length} card pipelines`);
  if (typeof data.summary?.overall_readiness_pct !== 'number') fail('Business HQ: missing readiness summary');
  else pass(`Business HQ readiness: ${data.summary.overall_readiness_pct}%`);
}

async function checkServiceSchedulesPublic() {
  const res = await fetch(`${SB_URL}/rest/v1/service_schedules?select=service_id&limit=1`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
  });
  if (!res.ok) return fail(`service_schedules REST read failed (${res.status})`);
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length < 1) fail('service_schedules table empty or unreadable');
  else pass(`service_schedules REST: ${rows.length}+ row(s) readable`);

  for (const action of ['list_service_schedules', 'get_service_schedule', 'update_service_schedule', 'list_service_schedule_vendors', 'update_service_schedule_vendors']) {
    const hub = await fetch(`${SB_URL}/functions/v1/admin-hub`, {
      method: 'POST',
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, service_id: 'hh-kitchen' }),
    });
    const body = await hub.json();
    if (body.error === 'Unknown action') fail(`${action} returns Unknown action (admin-hub not deployed)`);
    else if (body.error === 'Unauthorized') pass(`${action} routed (PIN required)`);
    else fail(`${action} unexpected response: ${JSON.stringify(body).slice(0, 80)}`);
  }
}

async function checkServiceSchedulesAdmin() {
  const list = await adminHub('list_service_schedules');
  const rows = list.schedules || list.items || [];
  if (!rows.length) fail('list_service_schedules returned no rows');
  else pass(`list_service_schedules: ${rows.length} service(s)`);

  const sid = rows[0].service_id;
  const one = await adminHub('get_service_schedule', { service_id: sid });
  if (!one.schedule && !one.service_id) fail(`get_service_schedule missing payload for ${sid}`);
  else pass(`get_service_schedule: ${sid} (${one.schedule?.windows?.length ?? one.windows?.length ?? '?'} windows)`);
}

async function main() {
  console.log(`\nScanV post-deploy validation → ${APP_URL}\n`);
  await checkFrontendBundle();
  await checkPlatformConfig();
  await checkServiceSchedulesPublic();
  if (ADMIN_PIN) {
    await checkGoLiveSwitches();
    await checkDiagrams();
    await checkAdminUrlIndex();
    await checkBusinessCommand();
    await checkServiceSchedulesAdmin();
  } else {
    console.warn('\n⚠ Set ADMIN_PIN (or ADMIN_HUB_PIN in .env) to validate admin APIs.\n');
  }
  console.log(`\n${passes.length} passed, ${failures.length} failed\n`);
  if (failures.length) {
    failures.forEach((f) => console.error('  -', f));
    process.exit(1);
  }
  console.log('All checks passed.\n');
}

main().catch((e) => {
  fail(e.message || String(e));
  process.exit(1);
});
