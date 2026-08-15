#!/usr/bin/env node
/**
 * Purge pre-launch test profiles, bookings, vendors, and @scanv.app auth users.
 *
 * Dry run (default):
 *   ADMIN_HUB_PIN=xxx node scripts/purge_test_profiles.mjs
 *
 * Live purge:
 *   ADMIN_HUB_PIN=xxx node scripts/purge_test_profiles.mjs --execute
 */
import { adminHubPost } from './lib/scanv-admin.mjs';

const execute = process.argv.includes('--execute');

const r = await adminHubPost('purge_test_data', {
  dry_run: !execute,
  confirm_execute: execute,
  confirm: execute ? 'PURGE_TEST_DATA' : undefined,
});

if (r.error) {
  console.error('Purge failed:', r.error);
  if (r.deleted) console.error('Partial deleted:', r.deleted);
  process.exit(1);
}

console.log('═══════════════════════════════════════════════════');
console.log(execute ? '  PURGE COMPLETE' : '  PURGE PREVIEW (dry run)');
console.log('═══════════════════════════════════════════════════\n');

const counts = execute ? r.deleted : r.preview;
if (counts) {
  for (const [k, v] of Object.entries(counts).sort()) {
    console.log(`  ${String(v).padStart(6)}  ${k}`);
  }
}

console.log('\n' + (r.message || ''));
if (!execute) {
  console.log('\nRun with --execute to delete (requires ADMIN_HUB_PIN or SUPPORT_ADMIN_PIN).');
}
console.log('');
