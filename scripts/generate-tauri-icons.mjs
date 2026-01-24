import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const iconsDir = join(__dirname, '..', 'src-tauri', 'icons');

// Create a simple icon programmatically
async function generateIcon(size, filename) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="#1e293b" rx="${size * 0.125}"/>
    <text x="${size/2}" y="${size * 0.55}" font-family="system-ui, -apple-system, sans-serif" font-size="${size * 0.4}" font-weight="bold" fill="#3b82f6" text-anchor="middle">3D</text>
    <text x="${size/2}" y="${size * 0.8}" font-family="system-ui, -apple-system, sans-serif" font-size="${size * 0.14}" fill="#94a3b8" text-anchor="middle">COST</text>
  </svg>`;

  await sharp(Buffer.from(svg))
    .png()
    .toFile(join(iconsDir, filename));

  console.log(`Generated ${filename}`);
}

async function main() {
  // Generate PNG icons at various sizes
  await generateIcon(32, '32x32.png');
  await generateIcon(128, '128x128.png');
  await generateIcon(256, '128x128@2x.png');

  // For macOS .icns, we need to generate a 512x512 and let the build process handle it
  // For now, we'll create a 512x512 as a base
  await generateIcon(512, 'icon.png');

  // Generate Windows .ico (we'll use a 256x256 PNG as base)
  // Sharp can't create .ico directly, but Tauri can use PNG
  await generateIcon(256, 'icon.ico.png');

  console.log('All Tauri icons generated!');
  console.log('Note: For production, convert icon.png to icon.icns (macOS) and icon.ico (Windows)');
}

main().catch(console.error);
