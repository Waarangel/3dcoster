#!/usr/bin/env node
// Generate the Tauri desktop icon set (.icns + .ico + PNG variants) from the
// brand SVG. Pipeline:
//   1. Render public/3DCosterLogoOnly.svg into a 1024×1024 transparent square PNG
//      (centered, natural aspect preserved — no distortion).
//   2. Hand that PNG to `tauri icon`, which generates the .icns / .ico / PNG
//      variants in src-tauri/icons/ that the bundler picks up at build time.
//   3. Prune outputs we don't ship — iOS/Android targets aren't enabled and
//      we don't publish to the Microsoft Store, so the Square*Logo.png +
//      mobile-platform dirs from `tauri icon` would just be dead weight.
//
// Run via: `node scripts/generate-tauri-icons.mjs`
// Re-run any time the brand SVG changes.

import sharp from 'sharp';
import { readFile, rm, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, '..');
const sourceSvg = join(repoRoot, 'public', '3DCosterLogoOnly.svg');
const iconsDir = join(repoRoot, 'src-tauri', 'icons');
const masterPng = join(os.tmpdir(), '3dcoster-tauri-master.png');

async function buildMasterPng() {
  const svgBuffer = await readFile(sourceSvg);
  await sharp(svgBuffer, { density: 1200 })
    .resize({
      width: 1024,
      height: 1024,
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(masterPng);
  console.log(`✓ master 1024×1024 PNG written to ${masterPng}`);
}

function runTauriIconCli() {
  console.log('Running `tauri icon` to produce platform variants…');
  execSync(`npx tauri icon ${JSON.stringify(masterPng)}`, {
    cwd: repoRoot,
    stdio: 'inherit',
  });
}

async function pruneUnusedOutputs() {
  // 3DCoster ships Windows .exe + macOS .dmg only. iOS / Android / Microsoft
  // Store assets the Tauri CLI emits by default are unused — drop them so the
  // src-tauri/icons/ directory stays a tight, intentional set that mirrors
  // tauri.conf.json's `bundle.icon` array.
  const unused = [
    'Square30x30Logo.png', 'Square44x44Logo.png', 'Square71x71Logo.png',
    'Square89x89Logo.png', 'Square107x107Logo.png', 'Square142x142Logo.png',
    'Square150x150Logo.png', 'Square284x284Logo.png', 'Square310x310Logo.png',
    'StoreLogo.png',
  ];
  for (const file of unused) {
    const p = join(iconsDir, file);
    if (existsSync(p)) {
      await unlink(p);
      console.log(`  pruned ${file}`);
    }
  }
  for (const dir of ['ios', 'android']) {
    const p = join(iconsDir, dir);
    if (existsSync(p)) {
      await rm(p, { recursive: true, force: true });
      console.log(`  pruned ${dir}/`);
    }
  }
}

async function main() {
  await buildMasterPng();
  runTauriIconCli();
  await pruneUnusedOutputs();
  console.log('\n✓ Tauri desktop icons regenerated from brand SVG.');
  console.log('  Next: tag a new v* release to ship them in the .dmg / .exe.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
