// scripts/assert-no-static-jspdf.mjs
// Phase 16 PDF-03 enforcement gate: scans src/**/*.{ts,tsx} for any static
// import of jspdf or jspdf-autotable. Exits 1 if found — prevents the
// lazy-loading invariant from silently regressing.
//
// Run BEFORE vitest/tsc/vite in the build chain (cheapest check first).
// Wired into package.json build script as the second step.
//
// EXCLUSION: src/pdf/ is explicitly excluded from scanning.
// src/pdf/ is the ONE allowed home for static `from 'jspdf'` /
// `from 'jspdf-autotable'` imports — it is the dynamic-import target and the
// only permitted static jspdf consumer. Every caller OUTSIDE src/pdf/ must use
// `await import('../pdf/generateQuotePdf')` dynamic import form.
// Without this exclusion, the gate would trip on its own allowed target file
// once plan 03 ships src/pdf/generateQuotePdf.ts.

import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const STATIC_IMPORT_REGEX = /from ['"]jspdf['"]|from ['"]jspdf-autotable['"]|import ['"]jspdf/;

function scanDir(dir) {
  const entries = readdirSync(dir);
  const violations = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry);

    // CRITICAL: exclude src/pdf/ from scanning — it is the allowed static jspdf consumer.
    // Guard applied uniformly to both directory recursion AND file reads.
    // Uses both slash variants to handle relative paths (src/pdf/) and absolute paths (/src/pdf/).
    if (fullPath.includes('/src/pdf/') || fullPath.includes('\\src\\pdf\\') ||
        fullPath.startsWith('src/pdf/') || fullPath.startsWith('src\\pdf\\')) continue;

    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      violations.push(...scanDir(fullPath));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      const content = readFileSync(fullPath, 'utf8');
      if (STATIC_IMPORT_REGEX.test(content)) {
        violations.push(fullPath);
      }
    }
  }
  return violations;
}

const violations = scanDir('src');
if (violations.length > 0) {
  console.error('assert-no-static-jspdf FAILED: static jspdf import detected in:');
  violations.forEach(f => console.error('  ' + f));
  console.error('  Use dynamic import(): await import(\'../pdf/generateQuotePdf\') instead.');
  process.exit(1);
}
console.log('✓ no static jspdf imports found in src/ (src/pdf/ excluded — that is the allowed consumer)');
