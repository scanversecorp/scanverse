#!/usr/bin/env node
/**
 * Export all public tables via `supabase db query --linked` (works without Docker/pg_dump).
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const stamp = process.argv[2] || new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outDir = path.join(root, 'backups', `scanv-full-${stamp}`, 'data-json');
fs.mkdirSync(outDir, { recursive: true });

const SKIP = new Set(['_deploy_tmp']);

function dbQuery(sql, { retries = 2 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const r = spawnSync('npx', ['supabase', 'db', 'query', '--linked', sql], {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: 50 * 1024 * 1024,
      });
      const text = (r.stdout || '').trim();
      if (!text.startsWith('{')) {
        throw new Error(`exit=${r.status} stdout=${text.slice(0, 300)} stderr=${(r.stderr || '').slice(0, 200)}`);
      }
      const payload = JSON.parse(text);
      return payload.rows || [];
    } catch (e) {
      lastErr = e;
      if (attempt < retries) spawnSync('sleep', ['2']);
    }
  }
  throw lastErr;
}

console.log('Listing public tables…');
const tables = dbQuery(`
  SELECT tablename AS t FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
`).map((r) => r.t);

const summary = [];
for (const table of tables) {
  const safe = table.replace(/[^a-z0-9_]/gi, '_');
  if (SKIP.has(table)) {
    summary.push({ table, rows: 0, skipped: 'internal' });
    console.log(`  ${table.padEnd(36)} skipped`);
    continue;
  }
  try {
    const countRow = dbQuery(`SELECT count(*)::int AS n FROM public."${table}"`);
    const n = countRow[0]?.n ?? 0;
    let rows = [];
    if (n > 0) {
      rows = dbQuery(`SELECT row_to_json(t.*) AS row FROM public."${table}" t`);
      rows = rows.map((r) => r.row);
    }
    fs.writeFileSync(path.join(outDir, `${safe}.json`), JSON.stringify(rows, null, 2) + '\n');
    summary.push({ table, rows: n, exported: rows.length });
    console.log(`  ${table.padEnd(36)} ${String(n).padStart(6)} rows`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    summary.push({ table, rows: 0, error: msg.slice(0, 120) });
    console.log(`  ${table.padEnd(36)} ERROR`);
  }
}

fs.writeFileSync(path.join(outDir, '_export-summary.json'), JSON.stringify({
  exported_at: new Date().toISOString(),
  method: 'supabase db query --linked',
  tables: summary,
  total_rows: summary.reduce((a, t) => a + (t.rows || 0), 0),
}, null, 2) + '\n');

console.log(`\nData export → ${outDir}`);
