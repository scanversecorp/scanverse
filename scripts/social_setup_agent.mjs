#!/usr/bin/env node
/**
 * ScanV Social Setup Agent — pre-fills everything agent can without OTP.
 * Run: node scripts/social_setup_agent.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const config = JSON.parse(readFileSync(join(ROOT, 'docs/social/scanv-social-config.json'), 'utf8'));

const prefill = `# Auto-filled by social_setup_agent.mjs — ${new Date().toISOString()}
# Add passwords after one-time OTP login. NEVER commit this file.

META_PAGE_NAME=ScanV
META_PAGE_USERNAME=scanvapp
META_PAGE_URL=https://www.facebook.com/scanvapp
META_BUSINESS_SUITE_URL=https://business.facebook.com/

INSTAGRAM_HANDLE=scanvapp
INSTAGRAM_URL=https://www.instagram.com/scanvapp

THREADS_HANDLE=scanvapp
THREADS_URL=https://www.threads.net/@scanvapp

YOUTUBE_CHANNEL_NAME=ScanV
YOUTUBE_HANDLE=scanvapp
YOUTUBE_URL=https://www.youtube.com/@scanvapp

TIKTOK_STATUS=BANNED_IN_INDIA_USE_REELS
TIKTOK_USERNAME=scanvapp

SCANV_BUSINESS_PHONE=9270194842
SCANV_BUSINESS_EMAIL=connect@dcoreglobal.com
SCANV_APP_URL=https://getscanv.com

SETUP_COMPLETED_DATE=
META_ADMIN_FB_PASSWORD=
INSTAGRAM_LOGIN_EMAIL=
GOOGLE_ACCOUNT_EMAIL=connect@dcoreglobal.com
GOOGLE_ACCOUNT_PASSWORD=
NOTES=Agent pre-filled public URLs. One OTP login per platform still required by Meta/Google.
`;

writeFileSync(join(ROOT, 'docs/social/credentials.env'), prefill);
console.log('✓ Wrote docs/social/credentials.env (public fields only)\n');

console.log('══════════════════════════════════════════');
console.log('  SCANV SOCIAL SETUP AGENT');
console.log('  India stack: FB · IG · Threads · YT · Shorts');
console.log('  TikTok: skipped (banned in India → use Reels)');
console.log('══════════════════════════════════════════\n');

console.log('PRE-FILLED');
console.log('  Config: docs/social/scanv-social-config.json');
console.log('  Bios: docs/social/*-profile.txt');
console.log('  Captions: docs/social/genz-week-posts.txt');
console.log('  Logo: docs/social/scanv-profile-picture.png');
console.log('  Dashboard DB: live captions in admin tab=social\n');

console.log('HARD LIMIT (not agent — platform OTP)');
console.log('  Meta + Google require SMS/email code on 9270194842 or connect@dcoreglobal.com');
console.log('  Agent cannot read your inbox or SIM — one 2-min phone tap when prompted\n');

try {
  execSync('node scripts/social_account_status.mjs', { cwd: ROOT, stdio: 'inherit' });
} catch { /* ok */ }

console.log('\nNEXT (single human tap when OTP pops up)');
for (const key of config.post_everywhere_daily) {
  const p = config.platforms[key] || config.platforms.youtube;
  if (p?.signup || p?.manage) console.log(`  • ${key}: ${p.signup || p.manage}`);
}
console.log('\nThen: node scripts/social_pulse.mjs → post → #admin?tab=social mark 5/5\n');
