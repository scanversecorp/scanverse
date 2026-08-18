#!/usr/bin/env node
/** Bake app QR into ScanV logo PNGs — scan logo → opens ScanV app. */
import QRCode from 'qrcode';
import { execFileSync } from 'child_process';
import { copyFileSync, existsSync, unlinkSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(ROOT, 'public');
const DOCS_SOCIAL = join(ROOT, 'docs', 'social');
const APP_URL = process.env.APP_URL || 'https://getscanv.com';
/** Printable standee PNG — must match SCANV_QR_URL in src/App.js */
const PRINT_QR_URL = `${APP_URL}/?qr=1&utm_source=qr&utm_medium=print`;
/** Logo badge on brand assets — separate analytics bucket */
const LOGO_QR_URL = `${APP_URL}?utm_source=logo&utm_medium=qr`;

const BASE = join(PUBLIC, 'scanv-brand-logo-base.png');
if (!existsSync(BASE)) {
  copyFileSync(join(PUBLIC, 'scanv-brand-logo.png'), BASE);
}

const APP_QR = { qrScale: 0.25, qrYShift: 0.28, qrXShift: 0.02 };

const TARGETS = [
  { src: BASE, out: join(PUBLIC, 'scanv-brand-logo.png'), ...APP_QR },
  { src: BASE, out: join(PUBLIC, 'scanv-logo-sm.png'), size: 256, ...APP_QR },
  { src: BASE, out: join(PUBLIC, 'logo192.png'), size: 192, ...APP_QR },
  { src: BASE, out: join(PUBLIC, 'logo512.png'), size: 512, ...APP_QR },
  { src: BASE, out: join(PUBLIC, 'apple-touch-icon.png'), size: 180, ...APP_QR },
  { src: BASE, out: join(DOCS_SOCIAL, 'scanv-profile-picture.png'), size: 512, ...APP_QR },
];

const qrPath = join(PUBLIC, '.logo-qr-temp.png');
await QRCode.toFile(qrPath, LOGO_QR_URL, {
  errorCorrectionLevel: 'H',
  margin: 2,
  width: 640,
  color: { dark: '#121212', light: '#ffffff' },
});

await QRCode.toFile(join(PUBLIC, 'scanv-qr.png'), PRINT_QR_URL, {
  errorCorrectionLevel: 'H',
  margin: 2,
  width: 512,
  color: { dark: '#121212', light: '#ffffff' },
});

const py = `
from PIL import Image, ImageDraw
import sys, json
qr = Image.open(sys.argv[1]).convert('RGBA')
specs = json.loads(sys.argv[2])
for spec in specs:
    img = Image.open(spec['src']).convert('RGBA')
    if spec.get('size'):
        img = img.resize((spec['size'], spec['size']), Image.Resampling.LANCZOS)
    w, h = img.size
    scale = spec['qrScale']
    qw = max(48, int(w * scale))
    q = qr.resize((qw, qw), Image.Resampling.LANCZOS)
    pad = max(4, int(w * 0.025))
    badge = Image.new('RGBA', (qw + pad * 2, qw + pad * 2), (255, 255, 255, 255))
    draw = ImageDraw.Draw(badge)
    draw.rounded_rectangle([0, 0, badge.size[0]-1, badge.size[1]-1], radius=max(4, pad), outline='#d63a56', width=max(2, pad//2))
    badge.paste(q, (pad, pad), q)
    x = w - badge.size[0] - pad - int(w * spec.get('qrXShift', 0))
    y = h - badge.size[1] - pad - int(h * spec.get('qrYShift', 0))
    img.paste(badge, (x, y), badge)
    img.save(spec['out'], 'PNG')
print('ok', len(specs))
`;

execFileSync('python3', ['-c', py, qrPath, JSON.stringify(TARGETS)], { stdio: 'inherit' });
unlinkSync(qrPath);

execFileSync('sips', ['-z', '32', '32', join(PUBLIC, 'scanv-logo-sm.png'), '--out', join(PUBLIC, 'favicon-32.png')], { stdio: 'inherit' });

execFileSync('python3', ['-c', `
from PIL import Image
Image.open('${join(PUBLIC, 'favicon-32.png')}').convert('RGBA').save('${join(PUBLIC, 'favicon.ico')}', format='ICO', sizes=[(32,32)])
`], { stdio: 'inherit' });

console.log('ScanV logo + QR ready');
console.log('  Print QR (scanv-qr.png) →', PRINT_QR_URL);
console.log('  Logo badge QR →', LOGO_QR_URL);
console.log('  Assets: scanv-brand-logo.png, scanv-logo-sm.png, logo512.png, scanv-qr.png, social profile');
