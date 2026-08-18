#!/usr/bin/env node
/**
 * Validate admin-url-index-data.json against url-route-manifest.json and src/App.js.
 * When adding a hash route, admin tab, or public path in App.js:
 *   1. Update supabase/functions/_shared/url-route-manifest.json
 *   2. Add the bookmark to supabase/functions/_shared/admin-url-index-data.json
 *   3. Run: npm run validate:url-index
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const appJs = readFileSync(join(root, 'src/App.js'), 'utf8');
const manifest = JSON.parse(readFileSync(join(root, 'supabase/functions/_shared/url-route-manifest.json'), 'utf8'));
const index = JSON.parse(readFileSync(join(root, 'supabase/functions/_shared/admin-url-index-data.json'), 'utf8'));

function parseAppJsRoutes(src) {
  const tabsBlock = src.match(/const ADMIN_TABS = \[([\s\S]*?)\n\];/);
  const adminTabs = tabsBlock
    ? [...tabsBlock[1].matchAll(/id:\s*['"]([^'"]+)['"]/g)].map((m) => m[1])
    : [];

  const hashRoutes = [...src.matchAll(/const\s+\w+_HASH\s*=\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);

  const legalMatch = src.match(/LEGAL_ROUTES = new Set\(\[([^\]]+)\]\)/);
  const legalPaths = legalMatch
    ? [...legalMatch[1].matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1])
    : [];

  const canonicalMatch = src.match(/const HASH_CANONICAL = \{([\s\S]*?)\};/);
  const hashAliases = {};
  if (canonicalMatch) {
    for (const m of canonicalMatch[1].matchAll(/['"]([^'"]+)['"]\s*:\s*\w+/g)) {
      hashAliases[m[1]] = true;
    }
  }

  return { adminTabs, hashRoutes: [...new Set(hashRoutes)], legalPaths, hashAliases: Object.keys(hashAliases) };
}

function collectIndexCoverage(sections) {
  const hashes = new Set();
  const adminTabs = new Set();
  const paths = new Set();

  for (const section of sections) {
    for (const item of section.items || []) {
      if (item.adminTab) adminTabs.add(item.adminTab);
      const url = item.url || '';
      const hashMatch = url.match(/#([^?]+)/);
      if (hashMatch) hashes.add(hashMatch[1]);
      try {
        const u = new URL(url);
        if (u.hostname.includes('getscanv.com')) {
          const path = u.pathname + (u.search || '');
          if (path === '/' && !u.search) paths.add('/');
          else if (path === '/' && u.search) paths.add('/' + u.search);
          else paths.add(path);
        }
      } catch { /* skip */ }
    }
  }
  return { hashes, adminTabs, paths };
}

function normPath(p) {
  if (!p || p === '/') return '/';
  return p.startsWith('/') ? p : `/${p}`;
}

function diffSets(label, expected, actual, { pathMode = false } = {}) {
  const exp = pathMode ? expected.map(normPath) : expected;
  const act = pathMode ? new Set([...actual].map(normPath)) : actual;
  const missing = exp.filter((x) => !act.has(x));
  const extra = [...act].filter((x) => !exp.includes(x));
  return { label, missing, extra, count: exp.length };
}

function main() {
  const app = parseAppJsRoutes(appJs);
  const idx = collectIndexCoverage(index);
  let failed = false;

  const checks = [
    diffSets('admin tabs (manifest)', manifest.adminTabs, idx.adminTabs),
    diffSets('admin tabs (App.js)', app.adminTabs, idx.adminTabs),
    diffSets('hash routes (manifest)', manifest.hashRoutes, idx.hashes),
    diffSets('hash routes (App.js)', app.hashRoutes, idx.hashes),
    diffSets('legal paths (manifest)', manifest.legalPaths, idx.paths, { pathMode: true }),
    diffSets('legal paths (App.js)', app.legalPaths, idx.paths, { pathMode: true }),
  ];

  console.log('URL index validation\n');

  for (const alias of Object.keys(manifest.hashAliases || {})) {
    if (!idx.hashes.has(alias)) {
      failed = true;
      console.error(`✗ hash alias missing from index: #${alias}`);
    }
  }

  for (const c of checks) {
    if (c.missing.length) {
      failed = true;
      console.error(`✗ ${c.label} missing from index:`, c.missing.join(', '));
    } else {
      console.log(`✓ ${c.label}: ${c.count} covered`);
    }
  }

  // App.js ↔ manifest drift
  const manifestVsApp = [
    diffSets('manifest vs App.js admin tabs', app.adminTabs, new Set(manifest.adminTabs)),
    diffSets('manifest vs App.js hash routes', app.hashRoutes, new Set(manifest.hashRoutes)),
    diffSets('manifest vs App.js legal paths', app.legalPaths, new Set(manifest.legalPaths)),
  ];
  for (const c of manifestVsApp) {
    if (c.missing.length || c.extra.length) {
      failed = true;
      if (c.missing.length) console.error(`✗ url-route-manifest.json missing (in App.js):`, c.missing.join(', '));
      if (c.extra.length) console.error(`✗ url-route-manifest.json stale (not in App.js):`, c.extra.join(', '));
    }
  }

  for (const asset of manifest.staticPaths || []) {
    if (!idx.paths.has(asset)) {
      failed = true;
      console.error(`✗ static path missing from index: ${asset}`);
    }
  }
  for (const pub of manifest.publicPaths || []) {
    if (!idx.paths.has(pub)) {
      failed = true;
      console.error(`✗ public path missing from index: ${pub}`);
    }
  }

  const total = index.reduce((n, s) => n + (s.items?.length || 0), 0);
  console.log(`\nIndex total: ${total} links across ${index.length} sections`);

  if (failed) {
    console.error('\nFix: update admin-url-index-data.json and url-route-manifest.json, then re-run.');
    process.exit(1);
  }
  console.log('\nAll routes indexed.');
}

main();
