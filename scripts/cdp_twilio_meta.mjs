#!/usr/bin/env node
/** Twilio + Meta Business Suite via Chrome CDP */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const report = { at: new Date().toISOString() };

async function main() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const page = browser.contexts()[0].pages()[0] || await browser.contexts()[0].newPage();

  // Twilio — wait for SPA
  await page.goto('https://console.twilio.com/us1/account/keys-credentials/api-keys', { waitUntil: 'networkidle', timeout: 120000 }).catch(() => {});
  await sleep(5000);
  report.twilio = {
    url: page.url(),
    title: await page.title(),
    text: (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 2500),
  };
  await page.screenshot({ path: join(ROOT, 'docs/social/twilio-console.png'), fullPage: false }).catch(() => {});

  const sid = report.twilio.text.match(/AC[a-f0-9]{32}/i)?.[0];
  if (sid) report.twilioAccountSid = sid;

  // Try messaging trial
  await page.goto('https://console.twilio.com/us1/develop/sms/try-it-out/send-an-sms', { waitUntil: 'networkidle', timeout: 120000 }).catch(() => {});
  await sleep(4000);
  report.twilioSms = {
    url: page.url(),
    text: (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 1500),
  };
  const phone = report.twilioSms.text.match(/\+1[\d\s()-]{10,}/)?.[0]?.replace(/\s/g, '');
  if (phone) report.twilioNumber = phone;

  // Meta Business Suite — create post
  const imagePath = join(ROOT, 'docs/social/scanv-funny-insta-post-2026-08-19.png');
  const raw = readFileSync(join(ROOT, 'docs/social/insta-post-funny-2026-08-19.txt'), 'utf8');
  const caption = raw.match(/CAPTION\s*\n-+\s*\n([\s\S]*?)(?=\nPINNED|\n#|$)/)?.[1]?.trim() || '';

  await page.goto('https://business.facebook.com/latest/composer/?asset_id=scanvapp', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await sleep(5000);
  report.mbs = { url: page.url(), text: (await page.locator('body').innerText().catch(() => '')).slice(0, 800) };

  const textbox = page.locator('[contenteditable="true"], textarea[placeholder*="Say"], div[role="textbox"]').first();
  if (await textbox.isVisible({ timeout: 10000 }).catch(() => false)) {
    await textbox.click();
    await textbox.fill(caption);
    await sleep(1000);
    const addPhoto = page.getByRole('button', { name: /Photo|Add photo|Image/i }).first();
    if (await addPhoto.isVisible().catch(() => false)) {
      const [chooser] = await Promise.all([
        page.waitForEvent('filechooser', { timeout: 15000 }).catch(() => null),
        addPhoto.click(),
      ]);
      if (chooser) await chooser.setFiles(imagePath);
    }
    const publish = page.getByRole('button', { name: /Publish|Post|Share/i }).first();
    if (await publish.isVisible({ timeout: 8000 }).catch(() => false)) {
      await publish.click();
      await sleep(5000);
      report.mbsPost = 'published';
    } else report.mbsPost = 'composer_open_no_publish';
  } else report.mbsPost = 'no_composer';

  // IG bio via business settings
  await page.goto('https://business.facebook.com/latest/settings/profiles', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await sleep(4000);
  report.mbsProfiles = (await page.locator('body').innerText().catch(() => '')).slice(0, 600);

  writeFileSync(join(ROOT, 'docs/social/cdp-owner-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
