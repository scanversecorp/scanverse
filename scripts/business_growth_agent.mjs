#!/usr/bin/env node
/**
 * ScanV Business Growth Agent — daily strike list, no Mac/Zoho needed.
 * Run: node scripts/business_growth_agent.mjs
 * Cron: 9:00 AM IST daily (see Cursor automation)
 */
import { adminHubPost, APP_URL, whatsAppUrl } from './lib/scanv-admin.mjs';
import { isOutreachWindowOpen, outsideHoursMessage, outreachWindowLabel } from './lib/business-hours.mjs';

const r = await adminHubPost('get_business_command');
if (r.error) {
  console.error('Business agent failed:', r.error);
  process.exit(1);
}

if (!isOutreachWindowOpen()) {
  console.log(outsideHoursMessage());
  console.log(`Strike list queued — run again during ${outreachWindowLabel()}.`);
}

const s = r.summary || {};
const strike = r.strike_list || {};
const queue = r.action_queue || [];

console.log('═══════════════════════════════════════════════════');
console.log('  SCANV BUSINESS GROWTH AGENT');
console.log('  ' + new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST');
console.log('═══════════════════════════════════════════════════\n');

console.log('SNAPSHOT');
console.log(`  Readiness: ${s.overall_readiness_pct}% | Live partners: ${s.active_partners}`);
console.log(`  Catalog vendors: ${s.catalog_vendor_count} | Logistics due: ${s.logistics_follow_up_due}`);
console.log(`  Admin: ${APP_URL}/#admin?tab=business\n`);

console.log('TODAY STRIKE LIST — HOUSEHOLD (call / WhatsApp these first)\n');
const vendors = strike.vendors || [];
if (!vendors.length) {
  console.log('  (no household leads in queue — check vendor catalog)\n');
} else {
  for (const v of vendors.slice(0, 5)) {
    const wa = whatsAppUrl(v.phone, v.outreach_message);
    console.log(`  #${v.rank} ${v.business_name} (${v.area})`);
    console.log(`      Phone: ${v.phone} | Status: ${v.onboard_status}`);
    if (v.contact_person) console.log(`      Contact: ${v.contact_person}`);
    console.log(`      Script: ${v.outreach_message}`);
    if (wa) console.log(`      WhatsApp: ${wa}`);
    console.log('');
  }
}

const logistics = strike.logistics || [];
if (logistics.length) {
  console.log('LOGISTICS FOLLOW-UPS DUE (send from connect@dcoreglobal.com)\n');
  for (const p of logistics) {
    console.log(`  • ${p.name} → ${p.contact_email}`);
    console.log(`    Template: ${p.follow_up_template}`);
    console.log(`    Admin: ${p.admin_url}\n`);
  }
} else {
  console.log('LOGISTICS: no follow-ups due today.\n');
}

console.log('CARD PRIORITY QUEUE\n');
for (const a of queue.slice(0, 5)) {
  console.log(`  [P${a.priority}] ${a.label}`);
  console.log(`      ${a.action}`);
  if (a.blocker) console.log(`      Blocker: ${a.blocker}`);
  console.log('');
}

console.log('NEXT HUMAN-ONLY (you)');
console.log('  • Forward any 3PL reply → agent wires sandbox API same day');
console.log('  • Sign partner / fund Razorpay wallet when first booking lands');
console.log('═══════════════════════════════════════════════════\n');
