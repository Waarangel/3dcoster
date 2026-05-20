// scripts/assert-bundle-size.mjs
// Build-time gate: reads the largest dist/assets/index-*.js, gzips it
// in-memory, and fails the build if it exceeds 300 KB. Keeps the main
// app chunk under the PERF-01 budget.
//
// Wired into package.json `build` AFTER `vite build` per Phase 11
// (PERF-01 / D-09). Minimal Node built-ins; no npm install required.
import { readdirSync, readFileSync } from 'fs';
import { gzipSync } from 'zlib';
import { join } from 'path';

const DIST_DIR = 'dist/assets';
const MAX_GZIPPED_BYTES = 307200; // 300 KB — PERF-01 / D-11; bumping requires explicit decision trail
const MAIN_CHUNK_PATTERN = /^index-[A-Za-z0-9_-]+\.js$/;

const candidates = readdirSync(DIST_DIR)
  .filter(name => MAIN_CHUNK_PATTERN.test(name))
  .map(name => ({ name, path: join(DIST_DIR, name) }));

if (candidates.length === 0) {
  console.error(`assert-bundle-size: no files matching ${MAIN_CHUNK_PATTERN} found in ${DIST_DIR}/`);
  console.error('Did `vite build` run successfully?');
  process.exit(1);
}

let largest = null;
for (const { name, path } of candidates) {
  const buf = readFileSync(path);
  const gzipped = gzipSync(buf).length;
  if (!largest || gzipped > largest.gzipped) {
    largest = { name, gzipped };
  }
}

const actualKB = (largest.gzipped / 1024).toFixed(1);
if (largest.gzipped > MAX_GZIPPED_BYTES) {
  const overKB = ((largest.gzipped - MAX_GZIPPED_BYTES) / 1024).toFixed(1);
  console.error(`assert-bundle-size FAILED: ${largest.name} is ${actualKB} KB gzipped (over by ${overKB} KB).`);
  console.error(`  Budget: ${MAX_GZIPPED_BYTES / 1024} KB (PERF-01).`);
  console.error('  Run `npm run analyze` to inspect what grew, then either trim the bundle or update the budget with a decision trail.');
  process.exit(1);
}
console.log(`✓ main chunk: ${actualKB} KB gzipped (under 300 KB) — ${largest.name}`);
