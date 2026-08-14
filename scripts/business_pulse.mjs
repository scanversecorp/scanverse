#!/usr/bin/env node
/** ScanV business pulse — run daily (cron / Cursor automation). No Mac mail access needed. */
import { adminHubPost } from './lib/scanv-admin.mjs';

const r = await adminHubPost('get_business_command');
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
