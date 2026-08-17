#!/usr/bin/env node
/** Copy original ScanV brand logo (no QR overlay) to all app/PWA assets. */
import { copyFileSync, existsSync } from 'fs';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(ROOT, 'public');
const DOCS_SOCIAL = join(ROOT, 'docs', 'social');
const BASE = join(PUBLIC, 'scanv-brand-logo-base.png');

if (!existsSync(BASE)) {
  console.error('Missing', BASE);
  process.exit(1);
}

const SIZES = [
  { out: join(PUBLIC, 'scanv-brand-logo.png') },
  { out: join(PUBLIC, 'scanv-logo-sm.png'), size: 320 },
  { out: join(PUBLIC, 'logo192.png'), size: 192 },
  { out: join(PUBLIC, 'logo512.png'), size: 512 },
  { out: join(PUBLIC, 'apple-touch-icon.png'), size: 180 },
  { out: join(DOCS_SOCIAL, 'scanv-profile-picture.png'), size: 512 },
];

const py = `
from PIL import Image
import sys, json
base = Image.open(sys.argv[1]).convert('RGBA')
for spec in json.loads(sys.argv[2]):
    img = base.copy()
    if spec.get('size'):
        img = img.resize((spec['size'], spec['size']), Image.Resampling.LANCZOS)
    img.save(spec['out'], 'PNG')
print('ok', len(json.loads(sys.argv[2])))
`;

execFileSync('python3', ['-c', py, BASE, JSON.stringify(SIZES)], { stdio: 'inherit' });

execFileSync('sips', ['-z', '32', '32', join(PUBLIC, 'scanv-logo-sm.png'), '--out', join(PUBLIC, 'favicon-32.png')], { stdio: 'inherit' });
execFileSync('python3', ['-c', `
from PIL import Image
Image.open('${join(PUBLIC, 'favicon-32.png')}').convert('RGBA').save('${join(PUBLIC, 'favicon.ico')}', format='ICO', sizes=[(32,32)])
`], { stdio: 'inherit' });

console.log('Original logo assets written (no QR overlay).');
