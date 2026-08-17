#!/usr/bin/env node
/** Beauty & Repairs tiles — verified Unsplash stock (no cross-category copies). */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const PUBLIC = path.resolve(process.cwd(), 'public');

const UNSPLASH = {
  'home-models/beauty.png': 'photo-1522335789203-aabd1fc54bc9',
  'home-models/repairs.png': 'photo-1621905252507-b35492cc74b4',
  'services/beauty/haircut-women.png': 'photo-1734111719430-fe4a3973f8af',
  'services/beauty/haircut-men.png': 'photo-1507003211169-0a1dd7228f2d',
  'services/beauty/beard-grooming.png': 'photo-1507003211169-0a1dd7228f2d',
  'services/beauty/mens-facial.png': 'photo-1507679799987-c73779587ccf',
  'services/beauty/makeup.png': 'photo-1562322140-8baeececf3df',
  'services/beauty/threading.png': 'photo-1562322140-8baeececf3df',
  'services/beauty/mani-pedi.png': 'photo-1632345031435-8727f6897d53',
  'services/beauty/facial.png': 'photo-1731514771613-991a02407132',
  'services/beauty/massage.png': 'photo-1775133263816-8b2a1c5d13e8',
  'services/beauty/mehendi.png': 'photo-1767607740740-25ef7ca4342b',
  'services/repairs/electrician.png': 'photo-1621905252507-b35492cc74b4',
  'services/repairs/plumber.png': 'photo-1628767719221-fdf36470b997',
  'services/repairs/carpenter.png': 'photo-1683115099089-363badefcc25',
  'services/repairs/ac-service.png': 'photo-1545649311-24d0ac00ae82',
  'services/repairs/washing-machine.png': 'photo-1696546761269-a8f9d2b80512',
  'services/repairs/ro-purifier.png': 'photo-1548839140-29a749e1cf4d',
  'services/repairs/geyser.png': 'photo-1594233078955-e1f73a02ebb2',
  'services/repairs/appliance-mount.png': 'photo-1737737219608-3f3cb84a2269',
};

async function downloadUnsplash(rel, photoId) {
  const url = `https://images.unsplash.com/${photoId}?auto=format&fit=crop&w=900&q=85`;
  const abs = path.join(PUBLIC, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`${rel}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await sharp(buf).rotate().resize(900, 600, { fit: 'cover', position: 'centre' }).png().toFile(abs);
  const webpPath = abs.replace(/\.png$/i, '.webp');
  await sharp(abs).rotate().resize({ width: 640, withoutEnlargement: true }).webp({ quality: 82 }).toFile(webpPath);
  console.log(`✓ ${rel} (+ webp)`);
}

async function main() {
  for (const [rel, id] of Object.entries(UNSPLASH)) {
    await downloadUnsplash(rel, id);
  }
  const beardPath = path.join(PUBLIC, 'services/beauty/beard-grooming.png');
  const tmp = `${beardPath}.tmp.png`;
  await sharp(beardPath)
    .extract({ left: 120, top: 0, width: 660, height: 600 })
    .toFile(tmp);
  fs.renameSync(tmp, beardPath);
  console.log(`Done ${Object.keys(UNSPLASH).length} tiles`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
