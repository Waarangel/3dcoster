// scripts/assert-no-static-three-import.mjs
// Phase 44-02 CONN-02 build-output enforcement gate: scans dist/assets/*.js
// (excluding the three chunk itself) for STATIC imports of the three chunk.
// Exits 1 if found — any static reference to three-*.js (side-effect, named,
// default, namespace, or re-export) defeats the dynamic-import lazy-load
// goal (same discipline as jsPDF — Phase 16/17 D-01, cloned here for `three`).
//
// Run AFTER vite build (needs dist/assets/). Wired into package.json build
// script as the LAST step, AFTER assert-no-static-pdf-import.mjs.
//
// ALLOWED: dynamic `import("./three-XXXX.js")` (parens — async). This is the
// only legitimate reference to the three chunk; it fires only when the
// STL/3MF worker/preview (added in 44-05) actually needs it.
//
// FORBIDDEN: any static form, anywhere outside the three chunk itself:
//   - `import"./three-XXX.js"`            (side-effect — Rollup hoist regression)
//   - `import{...}from"./three-XXX.js"`   (named — Rollup chunk-graph regression)
//   - `import x from"./three-XXX.js"`     (default)
//   - `import* as x from"./three-XXX.js"` (namespace)
//   - `export{...}from"./three-XXX.js"`   (re-export)
// All five forms write `import` or `from` immediately before the `"./three-*"`
// string literal; the regex below catches all of them.

import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const DIST_DIR = 'dist/assets';
const THREE_CHUNK_PATTERN = /^three-[A-Za-z0-9_-]+\.js$/;            // the lazy target itself (skip; it contains its own internal imports)
// FAIL pattern: any STATIC form referencing `./three-XXX.js`.
// Matches `import"./three-..."` (side-effect) and `from"./three-..."` (named/default/
// namespace/re-export). Does NOT match dynamic `import("./three-...")` because
// the `(` immediately following `import` doesn't match `\s*["']`.
const STATIC_THREE_IMPORT_REGEX = /(?:import|from)\s*["']\.\/three-[\w-]+\.js["']/;

let entries;
try {
  entries = readdirSync(DIST_DIR);
} catch {
  console.error(`assert-no-static-three-import: ${DIST_DIR} not found. Did vite build run?`);
  process.exit(1);
}

const violations = [];
for (const name of entries) {
  if (!name.endsWith('.js')) continue;
  if (THREE_CHUNK_PATTERN.test(name)) continue;   // skip three chunk itself
  const content = readFileSync(join(DIST_DIR, name), 'utf8');
  if (STATIC_THREE_IMPORT_REGEX.test(content)) {
    violations.push(name);
  }
}

if (violations.length > 0) {
  console.error('assert-no-static-three-import FAILED: chunk(s) statically import the three chunk:');
  violations.forEach(f => console.error('  ' + f));
  console.error('  This defeats lazy-loading — the three chunk (~150 KB+ gz) will be fetched eagerly.');
  console.error('  Check vite.config.ts manualChunks:');
  console.error('    - /src/utils/ must route to its own chunk (BEFORE the three check) so shared');
  console.error('      helpers (stlParser/meshWeightModel/unitsHeuristic) do not get claimed by the');
  console.error('      three chunk.');
  console.error('    - /three/ + /three-stdlib/ check must run BEFORE the node_modules block.');
  console.error('    - hoistTransitiveImports:false must stay set.');
  process.exit(1);
}
console.log('✓ three chunk: no static import from any non-three chunk in dist/assets/');
