#!/usr/bin/env node
/**
 * Regenerate public/sitemap.xml from url-route-manifest.json
 * Usage: node scripts/generate-sitemap.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const manifest = JSON.parse(
  readFileSync(join(root, 'supabase/functions/_shared/url-route-manifest.json'), 'utf8'),
);

const BASE = 'https://getscanv.com';
const today = new Date().toISOString().slice(0, 10);

const entries = [
  { loc: `${BASE}/`, priority: '1.0', changefreq: 'daily' },
  { loc: `${BASE}/scanv-brand.html`, priority: '0.95', changefreq: 'weekly' },
  ...(manifest.legalPaths || []).map((p) => ({
    loc: `${BASE}/${p}`,
    priority: '0.6',
    changefreq: 'monthly',
  })),
];

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    (e) => `  <url>
    <loc>${e.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${e.changefreq}</changefreq>
    <priority>${e.priority}</priority>
  </url>`,
  )
  .join('\n')}
</urlset>
`;

const out = join(root, 'public/sitemap.xml');
writeFileSync(out, xml);
console.log(`Wrote ${out} (${entries.length} URLs)`);
