#!/usr/bin/env node
/**
 * Resize + WebP encode PNGs under public/ for mobile performance.
 * Keeps optimized PNG fallback (max width 640) and adds .webp sibling.
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const PUBLIC = path.resolve(process.cwd(), 'public');
const MAX_WIDTH = 640;
const WEBP_QUALITY = 82;
const PNG_QUALITY = 80;

const dirs = ['services', 'home-models'];

async function optimizeFile(absPath) {
  const ext = path.extname(absPath).toLowerCase();
  if (ext !== '.png') return null;

  const before = fs.statSync(absPath).size;
  const webpPath = absPath.replace(/\.png$/i, '.webp');

  const pipeline = sharp(absPath).rotate().resize({
    width: MAX_WIDTH,
    height: MAX_WIDTH,
    fit: 'inside',
    withoutEnlargement: true,
  });

  const pngBuf = await pipeline.clone().png({ quality: PNG_QUALITY, compressionLevel: 9, effort: 10 }).toBuffer();
  const webpBuf = await sharp(absPath).rotate().resize({
    width: MAX_WIDTH,
    height: MAX_WIDTH,
    fit: 'inside',
    withoutEnlargement: true,
  }).webp({ quality: WEBP_QUALITY }).toBuffer();

  fs.writeFileSync(absPath, pngBuf);
  fs.writeFileSync(webpPath, webpBuf);

  const after = pngBuf.length + webpBuf.length;
  return { rel: path.relative(PUBLIC, absPath), before, after, webpKb: Math.round(webpBuf.length / 1024) };
}

async function main() {
  const results = [];
  for (const dir of dirs) {
    const root = path.join(PUBLIC, dir);
    if (!fs.existsSync(root)) continue;
    const walk = (d) => {
      for (const name of fs.readdirSync(d)) {
        const p = path.join(d, name);
        if (fs.statSync(p).isDirectory()) walk(p);
        else if (/\.png$/i.test(name)) results.push(p);
      }
    };
    walk(root);
  }

  let totalBefore = 0;
  let totalAfter = 0;
  const rows = [];

  for (const file of results.sort()) {
    const r = await optimizeFile(file);
    if (!r) continue;
    totalBefore += r.before;
    totalAfter += r.after;
    rows.push(r);
  }

  console.log(`Optimized ${rows.length} PNGs (max ${MAX_WIDTH}px + WebP q${WEBP_QUALITY})`);
  console.log(`Before: ${(totalBefore / 1024 / 1024).toFixed(1)} MB → After (PNG+WebP): ${(totalAfter / 1024 / 1024).toFixed(1)} MB`);
  rows.slice(0, 5).forEach(r => console.log(`  ${r.rel} → webp ~${r.webpKb}KB`));
  if (rows.length > 5) console.log(`  … and ${rows.length - 5} more`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
