#!/usr/bin/env node
/**
 * ScanV Social Pulse — daily post everywhere checklist (5 platforms).
 * Run: node scripts/social_pulse.mjs
 * Cron: 9:30 AM IST daily
 */
import { adminHubPost, APP_URL } from './lib/scanv-admin.mjs';
import { isOutreachWindowOpen, outsideHoursMessage, outreachWindowLabel } from './lib/business-hours.mjs';

const r = await adminHubPost('get_social_dashboard');
if (r.error) {
  console.error('Social pulse failed:', r.error);
  console.error('Run migrations 20260816000005 + 000006 if tables/columns missing.');
  process.exit(1);
}

const cfg = r.config || {};
const s = r.summary || {};
const bundle = r.today_everywhere;
const video = r.today_video_everywhere;
const platforms = r.everywhere_platforms || [];
const progress = r.everywhere_progress || {};
const queue = (r.today_queue || []).filter((i) => !i.is_daily_everywhere);
const ps = bundle?.platform_status || {};

console.log('═══════════════════════════════════════════════════');
console.log('  SCANV SOCIAL PULSE — POST EVERYWHERE (India)');
console.log('  FB · IG · Threads · YouTube · Shorts (TikTok banned IN)');
console.log('  ' + new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST');
console.log('  @' + (cfg.handle || 'scanvapp') + ' · Day ' + (cfg.today_day_number || '?') +
  (cfg.calendar_week > 1 ? ' week ' + cfg.calendar_week : ''));
console.log('═══════════════════════════════════════════════════\n');

if (!isOutreachWindowOpen()) {
  console.log(outsideHoursMessage());
  console.log(`Post during ${outreachWindowLabel()}.\n`);
}

console.log('EVERYWHERE PROGRESS: ' + (progress.posted || 0) + '/5 platforms · streak ' + (s.streak_days || 0) + ' days');
console.log('Dashboard: ' + APP_URL + '/#admin?tab=social\n');

if (!bundle) {
  console.log('No daily bundle — set week start date in admin social tab.\n');
} else {
  console.log('TODAY CAPTION (copy → paste on all 5)\n');
  console.log('─'.repeat(50));
  console.log(bundle.caption || bundle.title);
  console.log('─'.repeat(50));
  if (video) console.log('\n+ VIDEO: ' + video.title + (video.format_notes ? ' · ' + video.format_notes : ''));
  console.log('\nPOST EVERYWHERE CHECKLIST\n');
  for (const p of platforms) {
    const done = ps[p.id]?.posted;
    console.log('  ' + (done ? '✓' : '○') + ' ' + p.label.padEnd(16) + p.studio);
  }
  console.log('');
}

if (queue.length) {
  console.log('ALSO TODAY (Stories · emotional · extras)\n');
  for (const item of queue) {
    const done = item.post_status === 'posted' ? '✓' : '○';
    console.log('  ' + done + ' [' + item.content_type + '] ' + item.title);
    if (item.caption) console.log('      ' + item.caption.slice(0, 100) + (item.caption.length > 100 ? '…' : ''));
  }
  console.log('');
}

console.log('PLATFORMS (India daily)');
console.log('  1. Facebook + Instagram → https://business.facebook.com/');
console.log('  2. Threads              → https://www.threads.net/');
console.log('  3. YouTube + Shorts     → https://studio.youtube.com/');
console.log('  TikTok: banned in India — use Reels instead');
console.log('  Setup: node scripts/social_setup_agent.mjs');
console.log('═══════════════════════════════════════════════════\n');
