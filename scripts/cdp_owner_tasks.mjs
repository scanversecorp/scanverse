#!/usr/bin/env node
/** Autonomous owner tasks via existing Chrome CDP session (port 9333). */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, appendFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CDP = 'http://127.0.0.1:9333';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const report = { at: new Date().toISOString(), tasks: {} };

async function getPage(browser) {
  const ctx = browser.contexts()[0];
  return ctx.pages()[0] || await ctx.newPage();
}

async function igPost(page) {
  const imagePath = join(ROOT, 'docs/social/scanv-funny-insta-post-2026-08-19.png');
  const raw = readFileSync(join(ROOT, 'docs/social/insta-post-funny-2026-08-19.txt'), 'utf8');
  const caption = raw.match(/CAPTION\s*\n-+\s*\n([\s\S]*?)(?=\nPINNED|\n#|$)/)?.[1]?.trim() || '';

  await page.goto('https://www.instagram.com/scanvapp/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await sleep(2000);

  const stats = await page.locator('header section ul li span').allTextContents().catch(() => []);
  const postCount = parseInt((stats[1] || stats[0] || '0').replace(/\D/g, ''), 10) || 0;
  report.tasks.igExistingPosts = postCount;

  // Skip if already posted today (>=1 post and profile loaded)
  if (postCount >= 1) {
    const grid = await page.locator('article a[href*="/p/"], main a[href*="/p/"]').count();
    if (grid >= 1) {
      report.tasks.igPost = 'skipped_maybe_already_posted';
      return;
    }
  }

  await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded' });
  await sleep(1500);

  if (await page.locator('input[name="username"]').isVisible().catch(() => false)) {
    report.tasks.igPost = 'blocked_not_logged_in';
    return;
  }

  const newPost = page.locator('svg[aria-label="New post"]').first();
  if (await newPost.isVisible({ timeout: 8000 }).catch(() => false)) await newPost.click();
  else await page.getByRole('link', { name: /Create|New post/i }).first().click({ timeout: 10000 });
  await sleep(1200);

  const postOpt = page.getByRole('link', { name: 'Post' }).or(page.locator('span').filter({ hasText: /^Post$/ }));
  if (await postOpt.first().isVisible().catch(() => false)) await postOpt.first().click();
  await sleep(2500);

  const selectBtn = page.getByText('Select from computer');
  if (await selectBtn.isVisible({ timeout: 10000 }).catch(() => false)) {
    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser', { timeout: 15000 }),
      selectBtn.click(),
    ]);
    await chooser.setFiles(imagePath);
  } else {
    await page.locator('input[type="file"]').first().setInputFiles(imagePath, { timeout: 15000 });
  }
  await sleep(4000);

  for (let i = 0; i < 2; i++) {
    const n = page.getByRole('button', { name: 'Next' });
    if (await n.isVisible().catch(() => false)) { await n.click(); await sleep(2000); }
  }

  const box = page.locator('textarea[aria-label*="caption"], div[contenteditable="true"]').first();
  if (await box.isVisible().catch(() => false)) await box.fill(caption);
  await page.getByRole('button', { name: 'Share' }).click({ timeout: 20000 });
  await sleep(5000);
  report.tasks.igPost = 'published';
}

async function igBio(page) {
  const bio = readFileSync(join(ROOT, 'docs/social/instagram-profile.txt'), 'utf8');
  const bioText = bio.match(/BIO \(copy as-is\)\n([\s\S]*?)\n\nHIGHLIGHTS/)?.[1]?.trim() || '';
  const link = 'https://getscanv.com?utm_source=instagram&utm_medium=bio';

  await page.goto('https://www.instagram.com/accounts/edit/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await sleep(2000);

  const bioBox = page.locator('textarea[name="biography"], textarea[aria-label*="Bio"]').first();
  if (!(await bioBox.isVisible({ timeout: 8000 }).catch(() => false))) {
    report.tasks.igBio = 'blocked_no_edit_form';
    return;
  }

  const current = await bioBox.inputValue().catch(() => '');
  if (current.includes('Coming soon') || current.includes('coming soon')) {
    await bioBox.fill(bioText);
    const linkBox = page.locator('input[name="external_url"], input[aria-label*="Website"]').first();
    if (await linkBox.isVisible().catch(() => false)) await linkBox.fill(link);
    const submit = page.getByRole('button', { name: /Submit|Save/i }).first();
    if (await submit.isVisible().catch(() => false)) {
      await submit.click();
      await sleep(2000);
      report.tasks.igBio = 'updated_removed_coming_soon';
    } else report.tasks.igBio = 'filled_no_save_button';
  } else {
    report.tasks.igBio = current.includes('Official app') ? 'already_ok' : 'no_coming_soon_found';
  }
}

async function twilio(page) {
  await page.goto('https://console.twilio.com/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await sleep(4000);
  const text = (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 3000);
  report.tasks.twilioUrl = page.url();
  report.tasks.twilioSnippet = text.slice(0, 800);

  if (/log in|sign in/i.test(text) && !/account/i.test(text)) {
    report.tasks.twilio = 'blocked_not_logged_in';
    return;
  }

  const startTrial = page.getByRole('button', { name: /Start SMS trial|Try SMS|Get started/i }).first();
  if (await startTrial.isVisible({ timeout: 5000 }).catch(() => false)) {
    await startTrial.click();
    await sleep(5000);
    report.tasks.twilio = 'clicked_start_sms_trial';
  } else if (/\+1\d{10}/.test(text)) {
    const num = text.match(/\+1\d{10}/)?.[0];
    report.tasks.twilioNumber = num;
    report.tasks.twilio = 'number_visible';
  } else {
    report.tasks.twilio = 'logged_in_check_console';
  }

  // Try to extract Account SID from page
  const sidMatch = text.match(/AC[a-f0-9]{32}/i);
  if (sidMatch) report.tasks.twilioAccountSid = sidMatch[0];
}

async function gsc(page) {
  await page.goto('https://search.google.com/search-console/sitemaps?resource_id=sc-domain%3Agetscanv.com', {
    waitUntil: 'domcontentloaded',
    timeout: 90000,
  });
  await sleep(3000);
  const text = (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 2000);
  report.tasks.gscUrl = page.url();
  report.tasks.gscSnippet = text.slice(0, 600);

  if (/sign in|Sign in/i.test(text)) {
    report.tasks.gsc = 'blocked_not_logged_in';
    return;
  }

  const addBtn = page.getByRole('button', { name: /Add a new sitemap|Submit/i }).first();
  const input = page.locator('input[aria-label*="sitemap"], input[placeholder*="sitemap"]').first();

  if (await input.isVisible({ timeout: 5000 }).catch(() => false)) {
    await input.fill('sitemap.xml');
    const submit = page.getByRole('button', { name: /Submit|Send/i }).first();
    if (await submit.isVisible().catch(() => false)) {
      await submit.click();
      await sleep(3000);
      report.tasks.gsc = 'sitemap_submitted';
      return;
    }
  }

  if (/sitemap\.xml/i.test(text)) {
    report.tasks.gsc = 'sitemap_already_listed';
  } else {
    report.tasks.gsc = 'logged_in_manual_submit_needed';
  }
}

async function main() {
  const browser = await chromium.connectOverCDP(CDP);
  const page = await getPage(browser);

  try { await igBio(page); } catch (e) { report.tasks.igBio = 'error:' + e.message; }
  try { await igPost(page); } catch (e) { report.tasks.igPost = 'error:' + e.message; }
  try { await twilio(page); } catch (e) { report.tasks.twilio = 'error:' + e.message; }
  try { await gsc(page); } catch (e) { report.tasks.gsc = 'error:' + e.message; }

  const out = join(ROOT, 'docs/social/cdp-owner-report.json');
  writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
