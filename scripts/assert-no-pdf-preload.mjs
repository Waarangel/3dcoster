// scripts/assert-no-pdf-preload.mjs
// Phase 16 PDF-04 enforcement gate: reads dist/index.html (post-build artifact)
// and verifies it contains no modulepreload link referencing the pdf chunk.
// Exits 1 if a modulepreload link for the pdf chunk is found — means jsPDF would
// be pre-fetched on page load, defeating the lazy-loading goal.
//
// Run AFTER vite build (needs dist/index.html). Wired into package.json build
// script as the last step, after assert-bundle-size.mjs.
// Complements assert-bundle-size.mjs (PDF-04 / Phase 16).

import { readFileSync } from 'fs';

const HTML_FILE = 'dist/index.html';
let html;
try {
  html = readFileSync(HTML_FILE, 'utf8');
} catch {
  console.error(`assert-no-pdf-preload: ${HTML_FILE} not found. Did vite build run?`);
  process.exit(1);
}

// Match <link rel="modulepreload" ...> tags referencing the pdf chunk.
// The named manualChunks entry gives the chunk a filename starting with "pdf".
const PRELOAD_PATTERN = /modulepreload[^>]*href="[^"]*pdf[^"]*"/i;

if (PRELOAD_PATTERN.test(html)) {
  console.error('assert-no-pdf-preload FAILED: dist/index.html contains a modulepreload link for the pdf chunk.');
  console.error('  This means jsPDF will be pre-fetched on page load, defeating the lazy-loading goal.');
  console.error('  Check vite.config.ts — build.modulePreload should be false (or { resolveDependencies: () => [] }).');
  process.exit(1);
}
console.log('✓ pdf chunk: no modulepreload link in dist/index.html');
