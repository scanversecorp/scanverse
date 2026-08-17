#!/usr/bin/env node
/** Beauty & Repairs tiles — Unsplash (verified) + curated copies from existing ScanV assets. */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const PUBLIC = path.resolve(process.cwd(), 'public');

const UNSPLASH = {
  'home-models/beauty.png': 'photo-1522335789203-aabd1fc54bc9',
  'home-models/repairs.png': 'photo-1621905252507-b35492cc74b4',
  'services/beauty/haircut-women.png': 'photo-1560066984-138dadb4c035',
  'services/beauty/haircut-men.png': 'photo-1507003211169-0a1dd7228f2d',
  'services/beauty/beard-grooming.png': 'photo-1507003211169-0a1dd7228f2d',
  'services/beauty/mens-facial.png': 'photo-1522335789203-aabd1fc54bc9',
  'services/beauty/makeup.png': 'photo-1562322140-8baeececf3df',
  'services/beauty/threading.png': 'photo-1562322140-8baeececf3df',
  'services/repairs/electrician.png': 'photo-1621905252507-b35492cc74b4',
  'services/repairs/plumber.png': 'photo-1558618666-fcd25c85cd64',
  'services/repairs/carpenter.png': 'photo-1581094794329-c8112a89af12',
};

const COPY_FROM = {
  'services/beauty/mani-pedi.png': 'services/health/pharmacy.png',
  'services/beauty/facial.png': 'services/health/checkup.png',
  'services/beauty/massage.png': 'services/health/elder.png',
  'services/beauty/mehendi.png': 'services/food/festival.png',
  'services/repairs/ac-service.png': 'services/fan-clean.png',
  'services/repairs/washing-machine.png': 'services/delivery/parcel.png',
  'services/repairs/ro-purifier.png': 'services/health/lab.png',
  'services/repairs/geyser.png': 'services/kitchen-deep.png',
  'services/repairs/appliance-mount.png': 'services/four-wheeler/detailing.png',
};

async function downloadUnsplash(rel, photoId) {
  const url = `https://images.unsplash.com/${photoId}?auto=format&fit=crop&w=900&q=85`;
  const abs = path.join(PUBLIC, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`${rel}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await sharp(buf).rotate().resize(900, 600, { fit: 'cover', position: 'centre' }).png().toFile(abs);
  console.log(`✓ ${rel} (unsplash)`);
}

async function copyLocal(rel, srcRel, { position = 'centre', modulate } = {}) {
  const src = path.join(PUBLIC, srcRel);
  const abs = path.join(PUBLIC, rel);
  if (!fs.existsSync(src)) throw new Error(`Missing source ${srcRel}`);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  let pipe = sharp(src).rotate().resize(900, 600, { fit: 'cover', position });
  if (modulate) pipe = pipe.modulate(modulate);
  await pipe.png().toFile(abs);
  console.log(`✓ ${rel} (from ${srcRel})`);
}

async function main() {
  for (const [rel, id] of Object.entries(UNSPLASH)) {
    await downloadUnsplash(rel, id);
  }
  if (UNSPLASH['services/beauty/beard-grooming.png']) {
    const beardPath = path.join(PUBLIC, 'services/beauty/beard-grooming.png');
    const tmp = `${beardPath}.tmp.png`;
    await sharp(beardPath)
      .extract({ left: 120, top: 0, width: 660, height: 600 })
      .toFile(tmp);
    fs.renameSync(tmp, beardPath);
  }
  for (const [rel, src] of Object.entries(COPY_FROM)) {
    await copyLocal(rel, src, {
      position: rel.includes('geyser') ? 'right' : 'centre',
      modulate: rel.includes('repairs') ? { saturation: 1.05 } : undefined,
    });
  }
  console.log(`Done ${Object.keys(UNSPLASH).length + Object.keys(COPY_FROM).length} tiles`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
