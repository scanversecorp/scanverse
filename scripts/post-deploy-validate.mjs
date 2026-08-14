#!/usr/bin/env node
/**
 * Post-deploy validation for ScanV production.
 * Usage: ADMIN_PIN=yourpin node scripts/post-deploy-validate.mjs
 * Exit 0 = all checks passed; exit 1 = failures listed.
 */
const APP_URL = process.env.APP_URL || 'https://scanv-tau.vercel.app';
const SB_URL = process.env.SB_URL || 'https://rwlwrmmqtedugcreweut.supabase.co';
const SB_KEY = process.env.SB_KEY || 'sb_publishable_sx3krTi2ijpvn-K8wAQP6w_VFwH0vR3';
const ADMIN_PIN = process.env.ADMIN_PIN || '';

const EXPECTED_VENDORS = [
  'twofactor', 'msg91', 'twilio', 'whatsapp', 'razorpay', 'vyapar_upi',
];
const EXPECTED_UPI = ['gpay', 'phonepe', 'paytm', 'navi', 'bhim', 'any'];
const EXPECTED_VENDOR_SWITCHES = [
  'vendor_enable_2factor', 'vendor_enable_msg91', 'vendor_enable_twilio',
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
  if (mainSrc.includes('github.com/scanversecorp/scanverse') || mainSrc.includes('get_admin_url_index')) {
    fail('Main bundle may expose confidential admin URL catalog');
  } else {
    pass('Main bundle has no admin URL index catalog');
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

async function main() {
  console.log(`\nScanV post-deploy validation → ${APP_URL}\n`);
  await checkFrontendBundle();
  await checkPlatformConfig();
  if (ADMIN_PIN) {
    await checkGoLiveSwitches();
    await checkDiagrams();
    await checkAdminUrlIndex();
  } else {
    console.warn('\n⚠ Set ADMIN_PIN to validate Go-Live switch board and diagram catalog.\n');
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
