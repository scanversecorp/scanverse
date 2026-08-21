#!/usr/bin/env node
/**
 * Remove pre-launch cloud / SGR test rows (bookings, payment_intents, student_cloud).
 * Cutoff default: Aug 22 2026 00:00 IST.
 *
 * Dry run (default):
 *   node scripts/clean-cloud-test-data.mjs
 *
 * Live cleanup:
 *   node scripts/clean-cloud-test-data.mjs --execute
 */
import { adminHubPost } from './lib/scanv-admin.mjs';

const execute = process.argv.includes('--execute');

const r = await adminHubPost('clean_cloud_test_data', {
  dry_run: !execute,
  confirm_execute: execute,
  confirm: execute ? 'CLEAN_CLOUD_TEST_DATA' : undefined,
});

if (r.error) {
  console.error('Cloud cleanup failed:', r.error);
  process.exit(1);
}

console.log('═══════════════════════════════════════════════════');
console.log(execute ? '  CLOUD TEST CLEANUP COMPLETE' : '  CLOUD TEST CLEANUP PREVIEW (dry run)');
console.log('═══════════════════════════════════════════════════\n');

console.log(`  Cutoff (UTC):    ${r.cutoff || '2026-08-21T18:30:00.000Z'}`);

const counts = execute ? r.deleted : r.counts;
if (counts) {
  console.log('\n  Rows:');
  for (const [k, v] of Object.entries(counts)) {
    console.log(`    ${k.padEnd(28)} ${v}`);
  }
}

if (r.bookings?.length) {
  console.log('\n  Bookings:');
  for (const b of r.bookings) {
    console.log(`    · ${b.id}  ${b.service_id}  ${b.status}  ${b.txn_id || '—'}`);
  }
}

if (r.payment_intents?.length) {
  console.log('\n  Payment intents:');
  for (const p of r.payment_intents) {
    console.log(`    · ${p.txn_id}  ${p.service_id}  ${p.status}  ₹${(p.amount_paise / 100).toFixed(2)}`);
  }
}

if (r.student_cloud?.length) {
  console.log('\n  Student Cloud:');
  for (const s of r.student_cloud) {
    console.log(`    · ${s.id}  ${s.mobile_e164 || '—'}  ${s.course_id}  ${s.status}`);
  }
}

console.log('\n' + (r.message || ''));
if (!execute) {
  console.log('\nRun with --execute to delete (requires ADMIN_HUB_PIN in .env).');
}
console.log('');
