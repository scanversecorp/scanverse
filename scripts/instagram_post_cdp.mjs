#!/usr/bin/env node
import { chromium } from 'playwright';
import { readFileSync, existsSync, cpSync, mkdirSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const imagePath = join(ROOT, 'docs/social/scanv-funny-insta-post-2026-08-19.png');
const captionPath = join(ROOT, 'docs/social/insta-post-funny-2026-08-19.txt');
const profileDir = join('/tmp', 'scanv-ig-chrome-profile');
const chromeBin = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const cdpPort = 9333;

const raw = readFileSync(captionPath, 'utf8');
const caption = raw.match(/CAPTION\s*\n-+\s*\n([\s\S]*?)(?=\nPINNED|\n#|$)/)?.[1]?.trim() || '';
const pinnedComment = raw.match(/PINNED COMMENT\s*\n-+\s*\n([\s\S]*?)$/)?.[1]?.trim() || '';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ensureProfile() {
  if (existsSync(join(profileDir, 'Default'))) return;
  const src = join(process.env.HOME, 'Library/Application Support/Google/Chrome/Default');
  rmSync(profileDir, { recursive: true, force: true });
  mkdirSync(profileDir, { recursive: true });
  console.log('Copying Chrome session…');
  cpSync(src, join(profileDir, 'Default'), { recursive: true });
}

async function launchChrome() {
  try {
    const res = await fetch(`http://127.0.0.1:${cdpPort}/json/version`);
    if (res.ok) return;
  } catch { /* start fresh */ }
  spawn(chromeBin, [
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${profileDir}`,
    '--profile-directory=Default',
    '--no-first-run',
    'about:blank',
  ], { detached: true, stdio: 'ignore' }).unref();
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${cdpPort}/json/version`);
      if (res.ok) return;
    } catch { /* retry */ }
    await sleep(500);
  }
  throw new Error('Chrome CDP failed');
}

async function clickNewPost(page) {
  const tries = [
    () => page.locator('svg[aria-label="New post"]').first().click(),
    () => page.getByRole('link', { name: /New post|Create/i }).click(),
    () => page.locator('a[href="#"]').filter({ has: page.locator('svg[aria-label="New post"]') }).click(),
  ];
  for (const t of tries) {
    try {
      await t();
      return true;
    } catch { /* next */ }
  }
  return false;
}

async function post() {
  await ensureProfile();
  await launchChrome();
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${cdpPort}`);
  const context = browser.contexts()[0];
  const page = context.pages()[0] || await context.newPage();

  await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle', timeout: 90000 });
  await sleep(2000);

  const bodyText = await page.locator('body').innerText().catch(() => '');
  console.log('Page snippet:', bodyText.slice(0, 300).replace(/\n/g, ' | '));

  if (await page.locator('input[name="username"]').isVisible().catch(() => false)) {
    console.error('BLOCKED: Not logged in. Log in at instagram.com in Chrome, then re-run.');
    process.exit(2);
  }

  if (!(await clickNewPost(page))) throw new Error('New post button not found');
  await sleep(1000);
  const postItem = page.getByRole('link', { name: 'Post' }).or(page.getByText('Post', { exact: true }));
  if (await postItem.first().isVisible().catch(() => false)) await postItem.first().click();
  await sleep(2000);

  await page.locator('input[type="file"]').first().setInputFiles(imagePath);
  await sleep(4000);

  for (let i = 0; i < 2; i++) {
    const next = page.getByRole('button', { name: 'Next' });
    if (await next.isVisible({ timeout: 8000 }).catch(() => false)) {
      await next.click();
      await sleep(2000);
    }
  }

  const box = page.locator('textarea[aria-label*="caption"], div[contenteditable="true"][role="textbox"]').first();
  if (await box.isVisible({ timeout: 8000 }).catch(() => false)) {
    await box.fill(caption);
    await sleep(400);
  }

  await page.getByRole('button', { name: 'Share' }).click({ timeout: 15000 });
  await sleep(6000);

  await page.goto('https://www.instagram.com/scanvapp/', { waitUntil: 'networkidle' });
  const posts = await page.locator('header li span, header section ul li span').allTextContents();
  console.log('Profile stats:', posts.filter(Boolean).slice(0, 6).join(' | '));

  if (pinnedComment) {
    const link = page.locator('article a[href*="/p/"], main a[href*="/p/"]').first();
    if (await link.isVisible().catch(() => false)) {
      await link.click();
      await sleep(2500);
      const cbox = page.locator('textarea[aria-label*="comment"], textarea[placeholder*="comment"]').first();
      if (await cbox.isVisible().catch(() => false)) {
        await cbox.fill(pinnedComment);
        await page.keyboard.press('Enter');
        await sleep(1500);
        console.log('✓ Comment posted');
      }
    }
  }

  console.log('✓ LIVE: https://www.instagram.com/scanvapp/');
  await browser.close();
}

post().catch((e) => { console.error('Failed:', e.message); process.exit(1); });
