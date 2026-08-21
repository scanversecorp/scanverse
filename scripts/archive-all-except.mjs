#!/usr/bin/env node
/**
 * Archive (soft-delete) all customer/partner profiles and offboard vendors,
 * except keep_mobile (default 8484850288) and admin accounts.
 *
 * Dry run (default):
 *   node scripts/archive-all-except.mjs
 *
 * Live archive:
 *   node scripts/archive-all-except.mjs --execute
 *
 * Custom keep mobile:
 *   node scripts/archive-all-except.mjs --execute --mobile=8484850288
 */
import { adminHubPost } from './lib/scanv-admin.mjs';

const execute = process.argv.includes('--execute');
const mobileArg = process.argv.find((a) => a.startsWith('--mobile='));
const keepMobile = mobileArg ? mobileArg.split('=')[1] : '8484850288';

const r = await adminHubPost('archive_all_except', {
  dry_run: !execute,
  confirm_execute: execute,
  confirm: execute ? 'ARCHIVE_ALL_EXCEPT' : undefined,
  keep_mobile: keepMobile,
});

if (r.error) {
  console.error('Archive failed:', r.error);
  process.exit(1);
}

console.log('═══════════════════════════════════════════════════');
console.log(execute ? '  ARCHIVE COMPLETE' : '  ARCHIVE PREVIEW (dry run)');
console.log('═══════════════════════════════════════════════════\n');

const stats = execute ? r : r.preview;
if (stats) {
  console.log(`  Keep mobile:     ${stats.keep_mobile || keepMobile}`);
  console.log(`  Profiles:        ${stats.profiles_archived ?? '—'} archived`);
  console.log(`  Vendors:         ${stats.vendors_offboarded ?? '—'} offboarded`);
  if (stats.auth_deleted != null) console.log(`  Auth revoked:    ${stats.auth_deleted}`);
  if (stats.kept_profile_ids?.length) {
    console.log(`  Kept profiles:   ${stats.kept_profile_ids.join(', ')}`);
  }
}

if (r.sample_profile_ids?.length) {
  console.log('\n  Sample profile IDs to archive:');
  for (const id of r.sample_profile_ids) console.log(`    · ${id}`);
}
if (r.sample_vendor_ids?.length) {
  console.log('\n  Sample vendor IDs to offboard:');
  for (const id of r.sample_vendor_ids) console.log(`    · ${id}`);
}

console.log('\n' + (r.message || ''));
if (!execute) {
  console.log('\nRun with --execute to archive (requires ADMIN_HUB_PIN in .env).');
}
console.log('');
