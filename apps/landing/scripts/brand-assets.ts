// Generates the static brand files in public/ from src/assets/brand (run: pnpm --filter @qr/landing assets).
// Output is committed: og.png (1200×630), favicon.ico (32×32), favicon-32.png, apple-touch-icon.png (180×180).
// Colors are sampled from the brand images themselves, so no color literal lives here.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const brand = (name: string) => fileURLToPath(new URL(`../src/assets/brand/${name}`, import.meta.url));
const out = (name: string) => fileURLToPath(new URL(`../public/${name}`, import.meta.url));

type Rgb = { r: number; g: number; b: number };

async function sample(file: string, points: Array<[number, number]>): Promise<Rgb> {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const acc = { r: 0, g: 0, b: 0 };
  for (const [x, y] of points) {
    const i = (y * info.width + x) * info.channels;
    acc.r += data[i] ?? 0;
    acc.g += data[i + 1] ?? 0;
    acc.b += data[i + 2] ?? 0;
  }
  const n = points.length;
  return { r: Math.round(acc.r / n), g: Math.round(acc.g / n), b: Math.round(acc.b / n) };
}

/** Open Graph image: the white logo (without the phone edge at the bottom of the source) on its own teal. */
async function ogImage(): Promise<void> {
  const src = brand('logo-branca-fundo-petroleo.png');
  // Background sampled right around the logo (the source teal is darker there than at its corners).
  const bg = await sample(src, [
    [80, 120],
    [705, 120],
    [400, 38],
    [400, 200],
    [95, 60],
    [700, 190],
  ]);
  // Logo content spans x 109–685, y 59–181 in the 768×238 source; keep a margin and fade its edges
  // so the source's slightly different teal blends into the canvas.
  const box = { left: 60, top: 20, width: 676, height: 200 };
  const inset = 26;
  const mask = await sharp({
    create: {
      width: box.width - inset * 2,
      height: box.height - inset * 2,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .extend({ top: inset, bottom: inset, left: inset, right: inset, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .blur(9)
    .png()
    .toBuffer();
  const faded = await sharp(src)
    .extract(box)
    .ensureAlpha()
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer();
  const logo = await sharp(faded).resize({ width: 880, kernel: 'lanczos3' }).png().toBuffer();
  const meta = await sharp(logo).metadata();
  await sharp({ create: { width: 1200, height: 630, channels: 3, background: bg } })
    .composite([
      {
        input: logo,
        left: Math.round((1200 - (meta.width ?? 0)) / 2),
        top: Math.round((630 - (meta.height ?? 0)) / 2),
      },
    ])
    .png({ compressionLevel: 9 })
    .toFile(out('og.png'));
}

/** Square app icon on its own teal, so iOS rounding and dark tabs look right. */
async function squareIcon(size: number): Promise<Buffer> {
  const src = brand('icone.png');
  const teal = await sample(src, [
    [126, 14],
    [126, 232],
    [14, 123],
    [238, 123],
  ]);
  return sharp(src)
    .resize({ width: size, height: size, fit: 'contain', background: { ...teal, alpha: 0 } })
    .flatten({ background: teal })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/** ICO container with a single embedded PNG (supported by every current browser). */
function ico(png: Buffer, size: number): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size >= 256 ? 0 : size, 0);
  entry.writeUInt8(size >= 256 ? 0 : size, 1);
  entry.writeUInt8(0, 2);
  entry.writeUInt8(0, 3);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(header.length + entry.length, 12);
  return Buffer.concat([header, entry, png]);
}

await ogImage();
const icon32 = await squareIcon(32);
writeFileSync(out('favicon-32.png'), icon32);
writeFileSync(out('favicon.ico'), ico(icon32, 32));
writeFileSync(out('apple-touch-icon.png'), await squareIcon(180));
console.log('brand assets written to public/');
