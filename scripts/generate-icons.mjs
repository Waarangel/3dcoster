import sharp from 'sharp';
import { copyFile, readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Generate favicon + apple-touch-icon + PWA icons from public/3DCosterLogoOnly.svg.
// Source SVG is 371×418 (natural aspect, taller than wide). For each target size
// we render to a square transparent canvas using `fit: 'contain'` so the brand
// shape sits centered without distortion — iOS rounded-square masks and Android
// adaptive-icon safe-zones land on the centered shape, not on stretched pixels.

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const publicDir = join(__dirname, '..', 'public');
const sourceSvg = join(publicDir, '3DCosterLogoOnly.svg');

const TARGETS = [
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'pwa-192x192.png', size: 192 },
  { name: 'pwa-512x512.png', size: 512 },
];

async function generateIcon(svgBuffer, size, filename) {
  // Pick a render density that yields ~4× supersampling at the target size, so
  // the downsample to the final PNG stays crisp. Floor at 96dpi (sharp default).
  const density = Math.max(96, Math.ceil((size / 371) * 96 * 4));

  await sharp(svgBuffer, { density })
    .resize({
      width: size,
      height: size,
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(join(publicDir, filename));

  console.log(`✓ ${filename} (${size}×${size})`);
}

async function main() {
  const svgBuffer = await readFile(sourceSvg);

  for (const { name, size } of TARGETS) {
    await generateIcon(svgBuffer, size, name);
  }

  // pwa-*.svg files are referenced by vite-plugin-pwa's includeAssets and act
  // as transparent fallbacks. Copy the brand SVG so the names continue to
  // resolve to the actual logo (the previous values were placeholder mini-SVGs).
  for (const svgName of ['pwa-192x192.svg', 'pwa-512x512.svg']) {
    await copyFile(sourceSvg, join(publicDir, svgName));
    console.log(`✓ ${svgName} (copy of source SVG)`);
  }

  console.log('\nAll public-facing icons regenerated from 3DCosterLogoOnly.svg.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
