#!/usr/bin/env node
/**
 * ScanV — daily @scanvapp Instagram post via Meta Graph API.
 *
 * Run manually:  node scripts/instagram_daily_post.mjs
 * Dry run:        node scripts/instagram_daily_post.mjs --dry-run
 * GitHub Action:  10:00 AM IST daily (04:30 UTC)
 *
 * Requires: META_PAGE_ACCESS_TOKEN + META_IG_USER_ID (or META_PAGE_ID)
 * Setup: docs/social/AUTOMATION.md
 */
import { loadSocialEnv } from './lib/load-social-env.mjs';
import { getDailyPostWithAdmin, resolveImageUrl } from './lib/social-daily-content.mjs';
import { publishInstagramPhoto, resolveIgUserId } from './lib/meta-instagram.mjs';
import { adminHubPost, APP_URL } from './lib/scanv-admin.mjs';

loadSocialEnv();

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const FORCE = args.has('--force');

const accessToken = process.env.META_PAGE_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN;
const appUrl = process.env.APP_URL || APP_URL;

function istLabel() {
  return new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
}

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  SCANV INSTAGRAM DAILY POST — @scanvapp');
  console.log('  ' + istLabel() + ' IST');
  console.log('  Mode: ' + (DRY_RUN ? 'DRY RUN' : 'LIVE'));
  console.log('═══════════════════════════════════════════════════\n');

  let post;
  try {
    post = await getDailyPostWithAdmin(adminHubPost);
  } catch {
    const { getDailyPost } = await import('./lib/social-daily-content.mjs');
    post = { ...getDailyPost(), source: 'local_rotation' };
  }

  const imageUrl = resolveImageUrl(post.image, appUrl);

  console.log('Content source:', post.source);
  console.log('Title:', post.title);
  console.log('Cycle day:', post.cycleDay + '/' + post.cycleLength);
  console.log('Image URL:', imageUrl);
  console.log('\nCaption:\n' + '─'.repeat(50));
  console.log(post.caption);
  console.log('─'.repeat(50) + '\n');

  if (DRY_RUN) {
    console.log('Dry run — no API call. Remove --dry-run to publish.');
    return;
  }

  if (!accessToken) {
    console.error('❌ Missing META_PAGE_ACCESS_TOKEN');
    console.error('   Add GitHub secret or docs/social/credentials.env');
    console.error('   Setup: docs/social/AUTOMATION.md');
    process.exit(1);
  }

  let igUserId;
  try {
    igUserId = await resolveIgUserId({ accessToken });
  } catch (e) {
    console.error('❌', e.message);
    process.exit(1);
  }

  console.log('IG User ID:', igUserId);
  console.log('Publishing…\n');

  try {
    const result = await publishInstagramPhoto({
      igUserId,
      accessToken,
      imageUrl,
      caption: post.caption,
    });
    console.log('✅ Posted to @scanvapp');
    console.log('   Media ID:', result.mediaId);
    console.log('   Profile: https://www.instagram.com/scanvapp/');
  } catch (e) {
    console.error('❌ Post failed:', e.message);
    if (e.graph) console.error('   Graph error:', JSON.stringify(e.graph, null, 2));
    process.exit(1);
  }
}

main();
