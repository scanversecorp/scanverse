/** Load .env + docs/social/credentials.env into process.env (no overwrite). */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

export function loadSocialEnv() {
  for (const rel of ['.env', 'docs/social/credentials.env']) {
    try {
      const raw = readFileSync(join(ROOT, rel), 'utf8');
      for (const line of raw.split('\n')) {
        const t = line.trim();
        if (!t || t.startsWith('#')) continue;
        const m = t.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
        if (!m || process.env[m[1]]) continue;
        let v = m[2].trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        if (v) process.env[m[1]] = v;
      }
    } catch { /* optional file */ }
  }
}
