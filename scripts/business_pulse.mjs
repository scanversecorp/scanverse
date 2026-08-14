#!/usr/bin/env node
/** ScanV business pulse — run daily (cron / Cursor automation). No Mac mail access needed. */
import https from 'https';
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

const SB = process.env.SCANV_SB_URL || process.env.SB_URL || 'https://rwlwrmmqtedugcreweut.supabase.co';
const KEY = process.env.SCANV_SB_KEY || process.env.SB_KEY || 'sb_publishable_sx3krTi2ijpvn-K8wAQP6w_VFwH0vR3';
const PIN = process.env.ADMIN_HUB_PIN || process.env.SUPPORT_ADMIN_PIN || process.env.ADMIN_PIN || '';

if (!PIN) {
  console.error('Set ADMIN_HUB_PIN or SUPPORT_ADMIN_PIN env var');
  process.exit(1);
}

function post(body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: SB.replace('https://', '').split('/')[0],
      path: '/functions/v1/admin-hub',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        'x-admin-pin': PIN,
        'Content-Length': Buffer.byteLength(data),
      },
    }, (res) => {
      let b = '';
      res.on('data', (c) => { b += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(b)); } catch { resolve({ raw: b, status: res.statusCode }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

const r = await post({ action: 'get_business_command' });
if (r.error) {
  console.error('Pulse failed:', r.error);
  process.exit(1);
}

const s = r.summary || {};
console.log('=== ScanV Business Pulse ===');
console.log(new Date().toISOString());
console.log(`Overall readiness: ${s.overall_readiness_pct}%`);
console.log(`Catalog vendors: ${s.catalog_vendor_count} | Live partners: ${s.active_partners}`);
console.log(`Logistics follow-ups due: ${s.logistics_follow_up_due}`);
console.log('\nTop actions:');
for (const a of (r.action_queue || []).slice(0, 5)) {
  console.log(`  [P${a.priority}] ${a.label}: ${a.action}`);
  if (a.blocker) console.log(`         blocker: ${a.blocker}`);
}
console.log('\nCards needing vendors:');
for (const c of (r.cards || []).filter((x) => x.gap_vendors > 0).slice(0, 5)) {
  console.log(`  ${c.label}: gap ${c.gap_vendors} (${c.readiness_pct}% ready)`);
}
