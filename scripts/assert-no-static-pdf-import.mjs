// scripts/assert-no-static-pdf-import.mjs
// Phase 17 PDF-04 build-output enforcement gate: scans dist/assets/*.js
// (excluding index-*.js and pdf-*.js) for STATIC imports of the pdf chunk.
// Exits 1 if found — means a non-entry chunk statically imports pdf-*.js,
// defeating the dynamic-import lazy-load goal (Phase 16 D-01, repaired in
// Phase 17 D-01).
//
// Run AFTER vite build (needs dist/assets/). Wired into package.json build
// script as the LAST step, AFTER assert-no-pdf-preload.mjs (cheap modulepreload
// check fails fast on one file before the more expensive multi-file scan).
// Complements assert-no-pdf-preload.mjs (Phase 16 / PDF-04). Phase 17 D-02.
//
// ALLOWED: dist/assets/index-*.js is the SINGLE entry chunk and is the only
// file permitted to reference the pdf chunk, and only via dynamic import()
// (form: `import("./pdf-XXXX.js")` with parens — async). The static form
// `import"./pdf-XXXX.js"` (no parens) injected by Rollup into any non-index
// chunk is the regression this gate catches.

import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const DIST_DIR = 'dist/assets';
const INDEX_CHUNK_PATTERN = /^index-[A-Za-z0-9_-]+\.js$/;        // the ONE allowed importer of pdf
const PDF_CHUNK_PATTERN = /^pdf-[A-Za-z0-9_-]+\.js$/;            // the lazy target itself (skip; it contains its own internal imports)
// FAIL pattern: STATIC import form — `import"./pdf-XXXX.js"` (no parens, no `await`).
// Dynamic form `import("./pdf-XXXX.js")` (parens — async) is OK and is what index-*.js uses.
const STATIC_PDF_IMPORT_REGEX = /import\s*["']\.\/pdf-[\w-]+\.js["']/;

let entries;
try {
  entries = readdirSync(DIST_DIR);
} catch {
  console.error(`assert-no-static-pdf-import: ${DIST_DIR} not found. Did vite build run?`);
  process.exit(1);
}

const violations = [];
for (const name of entries) {
  if (!name.endsWith('.js')) continue;
  if (INDEX_CHUNK_PATTERN.test(name)) continue;   // index-*.js is the one allowed importer (dynamic only)
  if (PDF_CHUNK_PATTERN.test(name)) continue;     // skip pdf chunk itself
  const content = readFileSync(join(DIST_DIR, name), 'utf8');
  if (STATIC_PDF_IMPORT_REGEX.test(content)) {
    violations.push(name);
  }
}

if (violations.length > 0) {
  console.error('assert-no-static-pdf-import FAILED: non-entry chunk(s) statically import the pdf chunk:');
  violations.forEach(f => console.error('  ' + f));
  console.error('  This defeats lazy-loading — jspdf will be fetched on every page load.');
  console.error('  Check vite.config.ts — the /src/pdf/ + /jspdf/ + /jspdf-autotable/ check in manualChunks');
  console.error('  must run BEFORE the node_modules check (Phase 17 D-01).');
  process.exit(1);
}
console.log('✓ pdf chunk: no static import from non-entry chunks in dist/assets/');
