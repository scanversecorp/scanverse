#!/usr/bin/env node
/**
 * ScanV Social Pulse — today's posting queue from admin dashboard.
 * Run: node scripts/social_pulse.mjs
 * Cron: 9:30 AM IST daily (with business growth agent)
 */
import { adminHubPost, APP_URL } from './lib/scanv-admin.mjs';
import { isOutreachWindowOpen, outsideHoursMessage, outreachWindowLabel } from './lib/business-hours.mjs';

const r = await adminHubPost('get_social_dashboard');
if (r.error) {
  console.error('Social pulse failed:', r.error);
  console.error('Run migration 20260816000005_social_content_dashboard.sql if tables missing.');
  process.exit(1);
}

const cfg = r.config || {};
const s = r.summary || {};
const queue = r.today_queue || [];

console.log('═══════════════════════════════════════════════════');
console.log('  SCANV SOCIAL PULSE');
console.log('  ' + new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST');
console.log('  @' + (cfg.handle || 'scanvapp') + ' · Day ' + (cfg.today_day_number || '?'));
console.log('═══════════════════════════════════════════════════\n');

if (!isOutreachWindowOpen()) {
  console.log(outsideHoursMessage());
  console.log(`Queue ready — post during ${outreachWindowLabel()}.\n`);
}

console.log('SNAPSHOT');
console.log(`  Due today: ${s.due_today} | Posted: ${s.posted_today}/${s.total_today}`);
console.log(`  Week: ${s.week_posted}/${s.week_total} | Streak: ${s.streak_days} days`);
console.log(`  Videos pending: ${s.videos_pending} | Stories: ${s.stories_pending} | Emotional: ${s.emotional_pending}`);
console.log(`  Dashboard: ${APP_URL}/#admin?tab=social\n`);

if (!queue.length) {
  console.log('TODAY QUEUE: nothing scheduled (check week start date in dashboard)\n');
} else {
  console.log('TODAY QUEUE — post in this order\n');
  for (const item of queue) {
    const done = item.post_status === 'posted' ? '✓' : '○';
    const type = item.content_type.toUpperCase();
    console.log(`  ${done} [${type}] ${item.title}`);
    if (item.caption) console.log(`      Caption: ${item.caption.slice(0, 120)}${item.caption.length > 120 ? '…' : ''}`);
    if (item.format_notes) console.log(`      Format: ${item.format_notes}`);
    if (item.script_ref) console.log(`      Script: docs/social/shorts-scripts.txt ${item.script_ref}`);
    console.log('');
  }
}

const emotional = (r.emotional_stories || []).filter((i) => i.post_status !== 'posted' && i.effective_date === cfg.today);
if (emotional.length) {
  console.log('EMOTIONAL STORIES TODAY\n');
  for (const item of emotional) {
    console.log(`  • ${item.title}`);
    if (item.caption) console.log(`    ${item.caption.slice(0, 140)}`);
    console.log('');
  }
}

console.log('TOOLS');
console.log('  Meta Business Suite: https://business.facebook.com/');
console.log('  Copy kit: docs/social/ · node scripts/social_content_calendar.mjs');
console.log('═══════════════════════════════════════════════════\n');
