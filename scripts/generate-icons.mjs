import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const publicDir = join(__dirname, '..', 'public');

// Create a simple icon programmatically
async function generateIcon(size, filename) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="#1e293b" rx="${size * 0.125}"/>
    <text x="${size/2}" y="${size * 0.55}" font-family="system-ui, -apple-system, sans-serif" font-size="${size * 0.4}" font-weight="bold" fill="#3b82f6" text-anchor="middle">3D</text>
    <text x="${size/2}" y="${size * 0.8}" font-family="system-ui, -apple-system, sans-serif" font-size="${size * 0.14}" fill="#94a3b8" text-anchor="middle">COST</text>
  </svg>`;

  await sharp(Buffer.from(svg))
    .png()
    .toFile(join(publicDir, filename));

  console.log(`Generated ${filename}`);
}

async function main() {
  await generateIcon(192, 'pwa-192x192.png');
  await generateIcon(512, 'pwa-512x512.png');
  await generateIcon(180, 'apple-touch-icon.png');
  await generateIcon(32, 'favicon-32x32.png');
  await generateIcon(16, 'favicon-16x16.png');
  console.log('All icons generated!');
}

main().catch(console.error);
