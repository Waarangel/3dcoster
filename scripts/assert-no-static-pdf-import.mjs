// scripts/assert-no-static-pdf-import.mjs
// Phase 17 PDF-04 build-output enforcement gate: scans dist/assets/*.js
// (excluding the pdf chunk itself) for STATIC imports of the pdf chunk.
// Exits 1 if found — any static reference to pdf-*.js (side-effect, named,
// default, namespace, or re-export) defeats the dynamic-import lazy-load
// goal (Phase 16 D-01, repaired in Phase 17 D-01 + Wave 1 extension).
//
// Run AFTER vite build (needs dist/assets/). Wired into package.json build
// script as the LAST step, AFTER assert-no-pdf-preload.mjs (cheap modulepreload
// check fails fast on one file before the more expensive multi-file scan).
// Complements assert-no-pdf-preload.mjs (Phase 16 / PDF-04). Phase 17 D-02.
//
// ALLOWED: dynamic `import("./pdf-XXXX.js")` (parens — async). This is the
// only legitimate reference to the pdf chunk; it fires only when the user
// clicks "Generate PDF" / "Print Quote". The entry chunk uses this form.
//
// FORBIDDEN: any static form, anywhere outside the pdf chunk itself:
//   - `import"./pdf-XXX.js"`            (side-effect — Rollup hoist regression)
//   - `import{...}from"./pdf-XXX.js"`   (named — Rollup chunk-graph regression)
//   - `import x from"./pdf-XXX.js"`     (default)
//   - `import* as x from"./pdf-XXX.js"` (namespace)
//   - `export{...}from"./pdf-XXX.js"`   (re-export)
// All five forms write `import` or `from` immediately before the `"./pdf-*"`
// string literal; the regex below catches all of them.

import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const DIST_DIR = 'dist/assets';
const PDF_CHUNK_PATTERN = /^pdf-[A-Za-z0-9_-]+\.js$/;            // the lazy target itself (skip; it contains its own internal imports)
// FAIL pattern: any STATIC form referencing `./pdf-XXX.js`.
// Matches `import"./pdf-..."` (side-effect) and `from"./pdf-..."` (named/default/
// namespace/re-export). Does NOT match dynamic `import("./pdf-...")` because
// the `(` immediately following `import` doesn't match `\s*["']`.
const STATIC_PDF_IMPORT_REGEX = /(?:import|from)\s*["']\.\/pdf-[\w-]+\.js["']/;

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
  if (PDF_CHUNK_PATTERN.test(name)) continue;     // skip pdf chunk itself
  const content = readFileSync(join(DIST_DIR, name), 'utf8');
  if (STATIC_PDF_IMPORT_REGEX.test(content)) {
    violations.push(name);
  }
}

if (violations.length > 0) {
  console.error('assert-no-static-pdf-import FAILED: chunk(s) statically import the pdf chunk:');
  violations.forEach(f => console.error('  ' + f));
  console.error('  This defeats lazy-loading — the pdf chunk (~200 KB gz) will be fetched eagerly.');
  console.error('  Check vite.config.ts manualChunks:');
  console.error('    - /src/utils/ must route to its own chunk (BEFORE the pdf check) so shared');
  console.error('      helpers do not get claimed by the pdf chunk (Phase 17 Wave 1 extension).');
  console.error('    - /src/pdf/ + /jspdf/ + /jspdf-autotable/ check must run BEFORE node_modules');
  console.error('      (Phase 17 D-01).');
  console.error('    - hoistTransitiveImports:false must stay set (Phase 17 D-01 supplement).');
  process.exit(1);
}
console.log('✓ pdf chunk: no static import from any non-pdf chunk in dist/assets/');
