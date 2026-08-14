#!/usr/bin/env node
/** Print ScanV week-1 social calendar — copy into Meta/TikTok/YouTube. */
import { readFileSync } from 'fs';

const APP = 'https://scanv-tau.vercel.app?utm_source=social&utm_medium=organic';
const HANDLE = '@scanvapp';

console.log('══════════════════════════════════════════');
console.log('  SCANV SOCIAL — WEEK 1 CALENDAR');
console.log(`  Handle: ${HANDLE} · Link: ${APP}`);
console.log('  Post only 9:30 AM – 7 PM IST');
console.log('══════════════════════════════════════════\n');

const week = readFileSync(new URL('../docs/social/first-week-posts.txt', import.meta.url), 'utf8');
console.log(week);

console.log('\n--- TODAY SHORT SCRIPT ---\n');
const shorts = readFileSync(new URL('../docs/social/shorts-scripts.txt', import.meta.url), 'utf8');
console.log(shorts.split('#1')[1]?.split('#2')[0] || shorts.slice(0, 500));

console.log('\nFull kit: docs/social/ · Setup: docs/SOCIAL-MEDIA-LAUNCH.md\n');
