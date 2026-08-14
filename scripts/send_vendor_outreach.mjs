#!/usr/bin/env node
/** Autonomous vendor outreach via ScanV MSG91 WhatsApp — no Mac access needed. */
import { adminHubPost } from './lib/scanv-admin.mjs';
import { isOutreachWindowOpen, outsideHoursMessage } from './lib/business-hours.mjs';

if (!isOutreachWindowOpen()) {
  console.error(outsideHoursMessage());
  process.exit(0);
}

const limit = Number(process.argv[2] || 5);
const r = await adminHubPost('send_strike_list_outreach', { limit });

if (r.error && !r.results) {
  console.error('Outreach agent failed:', r.error);
  if (r.configured === false) {
    console.error('\nFallback: bash scripts/open-vendor-whatsapp-links.sh');
  }
  process.exit(1);
}

console.log(`ScanV outreach agent: ${r.sent}/${(r.results || []).length} sent\n`);
for (const row of r.results || []) {
  console.log(row.ok ? '✓' : '✗', row.business_name, row.phone);
  if (row.error) console.log('   ', row.error);
}
