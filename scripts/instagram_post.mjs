#!/usr/bin/env node
/**
 * Post to @scanvapp via Instagram web (uses system Chrome session).
 * Run: node scripts/instagram_post.mjs [image-path] [caption-file]
 */
import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const imagePath = process.argv[2] || join(ROOT, 'docs/social/scanv-funny-insta-post-2026-08-19.png');
const captionPath = process.argv[3] || join(ROOT, 'docs/social/insta-post-funny-2026-08-19.txt');

if (!existsSync(imagePath)) {
  console.error('Image not found:', imagePath);
  process.exit(1);
}

const raw = readFileSync(captionPath, 'utf8');
const captionMatch = raw.match(/CAPTION\s*\n-+\s*\n([\s\S]*?)(?=\nPINNED|\n#|$)/);
const caption = captionMatch ? captionMatch[1].trim() : raw.trim();

const userDataDir = process.env.CHROME_USER_DATA || join(process.env.HOME, 'Library/Application Support/Google/Chrome');

console.log('Posting to @scanvapp…');
console.log('Image:', imagePath);
console.log('Caption preview:', caption.slice(0, 120) + '…\n');
console.log('Chrome profile:', userDataDir);

const context = await chromium.launchPersistentContext(userDataDir, {
  headless: false,
  channel: 'chrome',
  args: ['--profile-directory=Default'],
  viewport: { width: 1280, height: 900 },
});
const page = context.pages()[0] || await context.newPage();

try {
  await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);

  const loggedIn = await page.locator('a[href*="/scanvapp/"], span:has-text("scanvapp")').first().isVisible().catch(() => false)
    || !(await page.locator('input[name="username"]').isVisible().catch(() => false));

  if (!loggedIn) {
    console.error('Not logged in to Instagram. Log in manually in the opened browser, then re-run.');
    await page.waitForTimeout(120000);
    process.exit(1);
  }

  await page.locator('svg[aria-label="New post"], a[href="#"]:has-text("Create")').first().click({ timeout: 15000 }).catch(async () => {
    await page.getByRole('link', { name: 'New post' }).click();
  });
  await page.waitForTimeout(2000);

  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles(imagePath);
  await page.waitForTimeout(3000);

  for (const label of ['Next', 'Next', 'Share']) {
    const btn = page.getByRole('button', { name: label });
    if (await btn.isVisible({ timeout: 8000 }).catch(() => false)) {
      if (label === 'Share') {
        const textarea = page.locator('textarea, div[contenteditable="true"][role="textbox"]').first();
        if (await textarea.isVisible().catch(() => false)) {
          await textarea.fill(caption);
          await page.waitForTimeout(500);
        }
      }
      await btn.click();
      await page.waitForTimeout(2500);
    }
  }

  console.log('✓ Post shared (check Instagram profile to confirm).');
  await page.waitForTimeout(5000);
} catch (err) {
  console.error('Post failed:', err.message);
  console.error('Complete manually: New post → upload image → paste caption from', captionPath);
  await page.waitForTimeout(60000);
  process.exit(1);
} finally {
  await context.close();
}
