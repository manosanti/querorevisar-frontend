// Generates optimized brand images (WebP at 2x of their display size) and the PWA icons
// (192/512/maskable, apple-touch-icon, favicon) from docs/reference/brand. F07.1.
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { colors } from '../packages/tokens/src/index.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const brand = (f: string) => join(root, 'docs', 'reference', 'brand', f);
const uiAssets = join(root, 'packages', 'ui', 'src', 'assets', 'brand');
const webBrand = join(root, 'apps', 'web', 'public', 'brand');
const webIcons = join(root, 'apps', 'web', 'public', 'icons');

for (const d of [uiAssets, webBrand, webIcons]) mkdirSync(d, { recursive: true });

const white = colors.white;

async function webp(src: string, out: string, size: { width?: number; height?: number }) {
  await sharp(brand(src))
    .resize({ ...size, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 86, effort: 6 })
    .toFile(out);
}

async function squareIcon(out: string, size: number, padding: number, background: string) {
  const inner = Math.round(size * (1 - padding * 2));
  const icon = await sharp(brand('icone.png'))
    .resize({ width: inner, height: inner, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: icon, gravity: 'center' }])
    .png({ compressionLevel: 9, palette: true, quality: 90, effort: 10 })
    .toFile(out);
}

// Vehicle illustrations: shown at up to 88px → 176px.
await webp('icone-carro.png', join(uiAssets, 'icone-carro.webp'), { width: 176 });
await webp('icone-moto.png', join(uiAssets, 'icone-moto.webp'), { width: 176 });
// Logos: 30px tall in the UI → 60px; app icon 84px on the login screen → 168px.
await webp('logo-horizontal.png', join(webBrand, 'logo-horizontal.webp'), { height: 60 });
await webp('logo-header-petroleo.png', join(webBrand, 'logo-header-petroleo.webp'), { height: 60 });
await webp('icone.png', join(webBrand, 'icone.webp'), { width: 168 });

await squareIcon(join(webIcons, 'icon-192.png'), 192, 0.04, white);
await squareIcon(join(webIcons, 'icon-512.png'), 512, 0.04, white);
// Maskable: keep the icon inside the 80% safe zone.
await squareIcon(join(webIcons, 'icon-maskable-512.png'), 512, 0.14, white);
await squareIcon(join(webIcons, 'apple-touch-icon.png'), 180, 0.06, white);
await squareIcon(join(webIcons, 'favicon-32.png'), 32, 0, white);

console.log('brand assets generated');
