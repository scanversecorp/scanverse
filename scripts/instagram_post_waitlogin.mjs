#!/usr/bin/env node
/** Semi-auto IG post: opens browser, waits for login, then posts. */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const imagePath = join(ROOT, 'docs/social/scanv-funny-insta-post-2026-08-19.png');
const captionPath = join(ROOT, 'docs/social/insta-post-funny-2026-08-19.txt');
const profile = join('/tmp', 'scanv-ig-playwright');

const raw = readFileSync(captionPath, 'utf8');
const caption = raw.match(/CAPTION\s*\n-+\s*\n([\s\S]*?)(?=\nPINNED|\n#|$)/)?.[1]?.trim() || '';
const pinned = raw.match(/PINNED COMMENT\s*\n-+\s*\n([\s\S]*?)$/)?.[1]?.trim() || '';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const context = await chromium.launchPersistentContext(profile, {
  headless: false,
  channel: 'chrome',
  viewport: { width: 1280, height: 900 },
});
const page = context.pages()[0] || await context.newPage();

console.log('→ Log in as @scanvapp if prompted (90s max)…');
await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded' });

for (let i = 0; i < 90; i++) {
  const loginVisible = await page.locator('input[name="username"]').isVisible().catch(() => false);
  const homeVisible = await page.locator('svg[aria-label="New post"], svg[aria-label="Home"]').first().isVisible().catch(() => false);
  if (!loginVisible && homeVisible) break;
  await sleep(1000);
}

const loginStill = await page.locator('input[name="username"]').isVisible().catch(() => false);
if (loginStill) {
  await page.screenshot({ path: join(ROOT, 'docs/social/ig-debug-login.png') });
  console.error('Login timeout — screenshot: docs/social/ig-debug-login.png');
  await sleep(60000);
  process.exit(2);
}

console.log('→ Creating post…');
const newPost = page.locator('svg[aria-label="New post"]').first();
if (await newPost.isVisible({ timeout: 5000 }).catch(() => false)) {
  await newPost.click();
} else {
  await page.getByRole('link', { name: /New post|Create/i }).first().click({ timeout: 15000 });
}
await sleep(1200);
const postOpt = page.getByRole('link', { name: 'Post' }).or(page.locator('span').filter({ hasText: /^Post$/ }));
if (await postOpt.first().isVisible().catch(() => false)) await postOpt.first().click();
await sleep(2500);

const dialog = page.locator('[role="dialog"]');
const selectBtn = page.getByText('Select from computer');
try {
  if (await selectBtn.isVisible({ timeout: 8000 }).catch(() => false)) {
    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser', { timeout: 10000 }),
      selectBtn.click(),
    ]);
    await chooser.setFiles(imagePath);
  } else {
    await page.locator('input[type="file"]').first().setInputFiles(imagePath, { timeout: 15000 });
  }
} catch (err) {
  await page.screenshot({ path: join(ROOT, 'docs/social/ig-debug-fail.png') }).catch(() => {});
  console.error('Fail body:', (await page.locator('body').innerText().catch(() => '')).slice(0, 400));
  throw err;
}
await sleep(4000);

for (const _ of [0, 1]) {
  const n = page.getByRole('button', { name: 'Next' });
  if (await n.isVisible().catch(() => false)) { await n.click(); await sleep(2000); }
}

const box = page.locator('textarea[aria-label*="caption"], div[contenteditable="true"]').first();
if (await box.isVisible().catch(() => false)) await box.fill(caption);
await page.getByRole('button', { name: 'Share' }).click();
await sleep(6000);

await page.goto('https://www.instagram.com/scanvapp/');
const count = await page.locator('header section ul li span').first().textContent().catch(() => '?');
console.log('✓ Posted. Profile posts:', count?.trim(), '— https://www.instagram.com/scanvapp/');

if (pinned) {
  await page.locator('a[href*="/p/"]').first().click().catch(() => {});
  await sleep(2000);
  const c = page.locator('textarea[aria-label*="comment"]').first();
  if (await c.isVisible().catch(() => false)) { await c.fill(pinned); await page.keyboard.press('Enter'); }
}

await context.close();
