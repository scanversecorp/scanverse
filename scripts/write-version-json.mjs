#!/usr/bin/env node
/** Writes public/version.json from package.json — polled by clients for auto-refresh. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = pkg.version || '0.0.0';
const builtAt = new Date().toISOString();
const payload = { version, builtAt };

for (const dir of ['public', 'build']) {
  const target = path.join(root, dir);
  if (dir === 'build' && !fs.existsSync(target)) continue;
  fs.mkdirSync(target, { recursive: true });
  fs.writeFileSync(path.join(target, 'version.json'), JSON.stringify(payload, null, 2) + '\n');
}

console.log('[write-version-json]', version, builtAt);
