/**
 * Generates app icons and brand crops from the source artwork at the repo root
 * (Icon.png = app icon, Logo.jpeg = full lockup). Run after changing the artwork:
 *
 *   npm run icons
 */
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pub = path.join(root, 'apps/web/public');
const appDir = path.join(root, 'apps/web/src/app');
mkdirSync(path.join(pub, 'icons'), { recursive: true });
mkdirSync(path.join(pub, 'brand'), { recursive: true });

/** Bounding box of pixels matching `test` within an optional region. */
async function bbox(file, test, region) {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const [x0, y0, x1, y1] = region ?? [0, 0, info.width, info.height];
  let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * info.width + x) * 3;
      if (test(data[i], data[i + 1], data[i + 2])) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

const isGold = (r, g, b) => r > 170 && g > 120 && b < 140 && r - b > 60;
const isInk = (r, g, b) => Math.max(r, g, b) > 40;

const ICON = path.join(root, 'Icon.png');
const LOGO = path.join(root, 'Logo.jpeg');

// 1. The round emblem (gold ring + gem + road), cut to a clean circle on transparency.
const ring = await bbox(ICON, isGold);
const side = Math.max(ring.width, ring.height) + 2;
const emblemBox = {
  left: Math.round(ring.left + ring.width / 2 - side / 2),
  top: Math.round(ring.top + ring.height / 2 - side / 2),
  width: side,
  height: side,
};
const circle = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${side}" height="${side}"><circle cx="${side / 2}" cy="${side / 2}" r="${side / 2 - 1}" fill="#fff"/></svg>`,
);
const emblemBuf = await sharp(ICON)
  .extract(emblemBox)
  .ensureAlpha()
  .composite([{ input: circle, blend: 'dest-in' }])
  .png()
  .toBuffer();

await sharp(emblemBuf).resize(256, 256).png().toFile(path.join(pub, 'brand/emblem.png'));

// 2. App icons: emblem on true black. "any" icons fill ~88%, maskable icons stay in the 80% safe zone.
async function onBlack(size, scale, file) {
  const inner = Math.round(size * scale);
  const img = await sharp(emblemBuf).resize(inner, inner).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: '#000000' } })
    .composite([{ input: img, gravity: 'center' }])
    .png()
    .toFile(file);
}
await onBlack(192, 0.88, path.join(pub, 'icons/icon-192.png'));
await onBlack(512, 0.88, path.join(pub, 'icons/icon-512.png'));
await onBlack(512, 0.66, path.join(pub, 'icons/maskable-512.png'));
await onBlack(180, 0.78, path.join(appDir, 'apple-icon.png'));
await onBlack(64, 0.96, path.join(appDir, 'icon.png'));

// 3. Wordmark lockup (emblem-O + NYX) without the tagline, for headers on black.
const lockup = await bbox(LOGO, isInk, [80, 340, 960, 590]);
const lockPad = 6;
await sharp(LOGO)
  .extract({
    left: lockup.left - lockPad,
    top: lockup.top - lockPad,
    width: lockup.width + lockPad * 2,
    height: lockup.height + lockPad * 2,
  })
  .resize({ width: 480 })
  .png()
  .toFile(path.join(pub, 'brand/wordmark.png'));

// 4. Social preview: the full logo.
await sharp(LOGO).resize(1200, 630, { fit: 'contain', background: '#000000' }).jpeg({ quality: 86 }).toFile(path.join(appDir, 'opengraph-image.jpg'));

// 5. Alert badge for the Android status bar: only its alpha channel is shown, so the gold
//    ring and road become a white silhouette (masked at full size, then scaled down smoothly).
{
  const { data, info } = await sharp(emblemBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const mask = Buffer.alloc(info.width * info.height * 4);
  const c = info.width / 2;
  for (let i = 0; i < info.width * info.height; i++) {
    const [r, g, b, a] = [data[i * 4], data[i * 4 + 1], data[i * 4 + 2], data[i * 4 + 3]];
    const x = i % info.width;
    const y = Math.floor(i / info.width);
    // The ring, and the road in the lower half; the gold facet top-left would read as a smudge.
    const onRing = Math.hypot(x - c, y - c) > c * 0.86;
    mask.fill(255, i * 4, i * 4 + 3);
    mask[i * 4 + 3] = a > 0 && isGold(r, g, b) && (onRing || y > info.height * 0.45) ? 255 : 0;
  }
  await sharp(mask, { raw: { width: info.width, height: info.height, channels: 4 } })
    .resize(96, 96)
    .png()
    .toFile(path.join(pub, 'icons/badge-96.png'));
}

console.log('ring', ring, '→ emblem', emblemBox);
console.log('lockup', lockup);
console.log('Icons written to apps/web/public/icons, apps/web/public/brand and apps/web/src/app');
