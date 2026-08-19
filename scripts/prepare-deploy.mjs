#!/usr/bin/env node
/**
 * Runs before every production build (Vercel + local npm run build).
 * - Bumps package.json version with deploy timestamp
 * - Writes public/package.json + public/version.json (copied into build/ by CRA)
 * - Sets REACT_APP_TS / REACT_APP_VERSION for the bundle
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const pkgPath = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const now = new Date().toISOString();
const buildTs = String(Date.now());
const baseMatch = String(pkg.version || '0.0.0').match(/^(\d+\.\d+\.\d+)/);
const base = baseMatch ? baseMatch[1] : '0.0.0';
const deployVersion = `${base}.${buildTs}`;
const isDeploy = process.env.VERCEL === '1' || process.env.CI === 'true';
const isMajor =
  process.env.SCANV_MAJOR_DEPLOY === '1'
  || /\[major\]/i.test(process.env.VERCEL_GIT_COMMIT_MESSAGE || '');

const deployPkg = {
  ...pkg,
  version: deployVersion,
  _built: now,
  _deployed: isDeploy ? now : (pkg._deployed || now),
};

// Persist bumped version on deploy environments (Vercel/CI workspace)
fs.writeFileSync(pkgPath, JSON.stringify(deployPkg, null, 2) + '\n');

const publicDir = path.join(root, 'public');
fs.mkdirSync(publicDir, { recursive: true });

fs.writeFileSync(
  path.join(publicDir, 'package.json'),
  JSON.stringify(deployPkg, null, 2) + '\n',
);

fs.writeFileSync(
  path.join(publicDir, 'version.json'),
  JSON.stringify(
    {
      name: deployPkg.name,
      version: deployVersion,
      builtAt: now,
      deployedAt: deployPkg._deployed,
      major: isMajor,
    },
    null,
    2,
  ) + '\n',
);

fs.writeFileSync(
  path.join(root, '.env.production.local'),
  `REACT_APP_TS=${buildTs}\nREACT_APP_VERSION=${deployVersion}\n`,
);

console.log('[prepare-deploy]', deployPkg.name, deployVersion, now, isDeploy ? '(deploy)' : '(local build)', isMajor ? '[MAJOR]' : '');
