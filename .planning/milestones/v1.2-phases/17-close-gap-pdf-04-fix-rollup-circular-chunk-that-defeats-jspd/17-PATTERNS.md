---
phase: 17-close-gap-pdf-04-fix-rollup-circular-chunk-that-defeats-jspd
type: patterns
mapped: 2026-05-25
mapped_by: gsd-pattern-mapper
parent_context: 17-CONTEXT.md
---

# Phase 17: Close Gap PDF-04 + Tax Rounding — Pattern Map

**Mapped:** 2026-05-25
**Files analyzed:** 5 modified + 1 new = 6
**Analogs found:** 6 / 6 (all in-repo; this is a closure phase — every pattern already exists)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `vite.config.ts` (modify, ~5-line reorder) | build-config | build-time transform | **itself** (lines 89-101) | exact (in-place reorder) |
| `scripts/assert-no-static-pdf-import.mjs` (NEW) | build-tool / CI gate | post-build static scan | `scripts/assert-no-pdf-preload.mjs` + `scripts/assert-no-static-jspdf.mjs` | strong (two complementary analogs) |
| `package.json` (modify, 1-line `build` script append) | build-config | build pipeline wiring | **itself** line 8 (existing `&& node scripts/…` chain) | exact (in-place append) |
| `src/components/PrintQuoteModal.tsx` (modify, ~2-line) | component | request-response (memoized derivation) | `src/components/CostCalculator.tsx` lines 8 + 491-495 | exact (same helper, same hook pattern) |
| `.planning/REQUIREMENTS.md` (modify, 6 checkboxes) | doc | n/a | **itself** lines 45-54 + 150-160 | exact (tick `[ ]` → `[x]`) |
| `.planning/ROADMAP.md` (modify, 1 table row + 1 bullet) | doc | n/a | **itself** lines 36, 174 | exact (in-place edit) |

---

## Pattern Assignments

### 1. `vite.config.ts` (build-config, build-time transform)

**Analog:** itself — the `manualChunks` function is already 100% correct in **content**; only the **ordering** is wrong. Reorder, do not rewrite.

**Current state — `build.rollupOptions.output.manualChunks` (lines 89-101):**
```typescript
manualChunks(id) {
  if (id.includes('node_modules')) {
    if (id.includes('/react/') || id.includes('/react-dom/')) return 'react-vendor';
    if (id.includes('/dexie/') || id.includes('/dexie-react-hooks/')) return 'dexie-vendor';
    return 'vendor';
  }
  // Route all PDF dependencies to the lazily-loaded pdf chunk (Phase 16 D-01).
  // /jspdf/ and /jspdf-autotable/ match node_modules paths; /src/pdf/ matches the
  // generator module. Surrounding slashes prevent false matches on substrings.
  if (id.includes('/src/pdf/') || id.includes('/jspdf/') || id.includes('/jspdf-autotable/')) {
    return 'pdf';
  }
},
```

**Bug:** `/jspdf/` lives under `node_modules/`, so the outer `if (id.includes('node_modules'))` returns `'vendor'` BEFORE the PDF check ever fires. jsPDF lands in the always-loaded vendor chunk → marketing routes static-import it → lazy-loading is silently defeated.

**Target state after reorder (D-01):** PDF check FIRST, vendor check SECOND. The comment also needs a one-word update — `/jspdf/` and `/jspdf-autotable/` need to be acknowledged as `node_modules` paths that bypass the outer block intentionally.

```typescript
manualChunks(id) {
  // Route all PDF dependencies to the lazily-loaded pdf chunk (Phase 16 D-01, Phase 17 reorder).
  // CRITICAL ORDER: this check MUST come BEFORE the node_modules block —
  // jspdf + jspdf-autotable live under node_modules and would otherwise be
  // claimed by 'vendor' first, defeating the lazy-load goal (PDF-04).
  // /src/pdf/ matches the generator module. Surrounding slashes prevent
  // false matches on substrings.
  if (id.includes('/src/pdf/') || id.includes('/jspdf/') || id.includes('/jspdf-autotable/')) {
    return 'pdf';
  }
  if (id.includes('node_modules')) {
    if (id.includes('/react/') || id.includes('/react-dom/')) return 'react-vendor';
    if (id.includes('/dexie/') || id.includes('/dexie-react-hooks/')) return 'dexie-vendor';
    return 'vendor';
  }
},
```

**Diff shape:** ~5 lines moved (the existing pdf-check block lifted above the vendor block), zero net added beyond a slightly expanded comment. The function returns `'pdf'` for any id matching `/src/pdf/`, `/jspdf/`, or `/jspdf-autotable/`; otherwise drops to `node_modules` classification; otherwise returns `undefined` (default chunk — preserves existing React.lazy route splits per Phase 11 D-03).

**Read first:** `vite.config.ts` lines 75-104 (the whole `build` block — includes `modulePreload: false` from Phase 16, which MUST be preserved unchanged).

---

### 2. `scripts/assert-no-static-pdf-import.mjs` (NEW build-tool, post-build static scan)

**Analogs (two complementary):**
- **Primary structure / messaging style:** `scripts/assert-no-pdf-preload.mjs` (the named sibling — same Phase 16 lineage, same "narrow regex scan + exit 1" shape)
- **Multi-file dist-asset scan / readdirSync loop:** `scripts/assert-bundle-size.mjs` (already iterates `dist/assets/*`, same Node-builtins-only constraint)

**Header / comment-banner pattern** (mirror `assert-no-pdf-preload.mjs` lines 1-9):
```javascript
// scripts/assert-no-static-pdf-import.mjs
// Phase 17 PDF-04 build-output enforcement gate: scans dist/assets/*.js
// (excluding index-*.js) for STATIC imports of the pdf chunk. Exits 1 if
// found — means a non-entry chunk statically imports pdf-*.js, defeating
// the dynamic-import lazy-load goal (Phase 16 D-01, repaired in Phase 17 D-01).
//
// Run AFTER vite build (needs dist/assets/). Wired into package.json build
// script as the last step, AFTER assert-no-pdf-preload.mjs (cheap modulepreload
// check fails fast on one file before the more expensive multi-file scan).
// Complements assert-no-pdf-preload.mjs (Phase 16 / PDF-04).
//
// ALLOWED: dist/assets/index-*.js is the SINGLE entry chunk and is the only
// file permitted to reference the pdf chunk, and only via dynamic import()
// (form: `import("./pdf-XXXX.js")` with parens — async). The static form
// `import"./pdf-XXXX.js"` (no parens) injected by Rollup into any non-index
// chunk is the regression this gate catches.
```

**Imports block pattern** (mirror `assert-bundle-size.mjs` lines 8-10 — multi-file scan, Node builtins only):
```javascript
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
```

**Constants / pattern block** (mirror `assert-bundle-size.mjs` line 12-14 and `assert-no-pdf-preload.mjs` line 24):
```javascript
const DIST_DIR = 'dist/assets';
const INDEX_CHUNK_PATTERN = /^index-[A-Za-z0-9_-]+\.js$/;        // the ONE allowed importer of pdf
const PDF_CHUNK_PATTERN = /^pdf-[A-Za-z0-9_-]+\.js$/;            // the lazy target itself (skip; it contains its own internal imports)
// FAIL pattern: STATIC import form — `import"./pdf-XXXX.js"` (no parens, no `await`).
// Dynamic form `import("./pdf-XXXX.js")` (parens — async) is OK and is what index-*.js uses.
const STATIC_PDF_IMPORT_REGEX = /import\s*["']\.\/pdf-[\w-]+\.js["']/;
```

**Directory-read + dist-missing failure pattern** (mirror `assert-bundle-size.mjs` lines 16-24):
```javascript
let entries;
try {
  entries = readdirSync(DIST_DIR);
} catch {
  console.error(`assert-no-static-pdf-import: ${DIST_DIR} not found. Did vite build run?`);
  process.exit(1);
}
```

**Scan loop pattern** (mirror `assert-no-static-jspdf.mjs` lines 22-45 — violation collection then batch report):
```javascript
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
```

**Success-line emoji convention** (mirror `assert-no-pdf-preload.mjs` line 32 and `assert-bundle-size.mjs` line 43): use the literal `✓` U+2713 prefix — both existing scripts use it; consistency matters.

**Diff shape:** ~50 lines of new file. Pure Node builtins (`fs`, `path`) — no npm install needed.

**Read first (in this order):**
1. `scripts/assert-no-pdf-preload.mjs` — header style, messaging tone, single-purpose narrow scope (32 lines)
2. `scripts/assert-bundle-size.mjs` — multi-file `dist/assets/` scan loop, readdirSync error handling (43 lines)
3. `scripts/assert-no-static-jspdf.mjs` — violation-collection + batch-report pattern (54 lines)

---

### 3. `package.json` (build-config, build pipeline wiring)

**Analog:** itself, line 8 — the existing `build` script is an `&&`-chained pipeline of `node scripts/*.mjs` calls. Append one more link in the chain.

**Current `build` script (line 8):**
```json
"build": "node scripts/lint-no-raw-html.mjs && node scripts/assert-no-static-jspdf.mjs && vitest run --coverage && tsc -b && vite build && node scripts/assert-bundle-size.mjs && node scripts/assert-no-pdf-preload.mjs",
```

**Target — append the new gate AFTER `assert-no-pdf-preload.mjs`** (CONTEXT.md open question #1: cheap check fails fast before expensive scan):
```json
"build": "node scripts/lint-no-raw-html.mjs && node scripts/assert-no-static-jspdf.mjs && vitest run --coverage && tsc -b && vite build && node scripts/assert-bundle-size.mjs && node scripts/assert-no-pdf-preload.mjs && node scripts/assert-no-static-pdf-import.mjs",
```

**Diff shape:** Single-line replacement; append ` && node scripts/assert-no-static-pdf-import.mjs` to the existing chain. Surgical edit only — do not reformat the rest of `package.json`.

**Read first:** `package.json` lines 6-19 (the `scripts` block).

---

### 4. `src/components/PrintQuoteModal.tsx` (component, request-response / memoized derivation)

**Analog:** `src/components/CostCalculator.tsx` — already imports and uses `calculateTax` the same way; mirror byte-for-byte.

**Import pattern** (mirror `CostCalculator.tsx` line 8):
```typescript
import { calculateCost, calculateTax } from '../utils/costCalc';
```

In `PrintQuoteModal.tsx`, the existing imports (lines 1-6) do NOT include `costCalc`. Add a single new import line co-located with the other `../utils/*` imports (lines 4-5 already import from `../utils/taxResolution` and `../utils/currency`):

```typescript
// Insert AFTER line 5 (formatCurrency import) — keeps utils imports adjacent
import { calculateTax } from '../utils/costCalc';
```

**Helper signature reference** (`src/utils/costCalc.ts` lines 122-138 — DO NOT MODIFY):
```typescript
// Tax: Math.round(sellingPrice * ratePercent) / 100 — JS Math.round uses
// half-to-positive-infinity rounding (Math.round(0.5) === 1, Math.round(-0.5) === 0).
// sellingPrice <= 0 short-circuits to 0 so negative rounding semantics are unreachable.
// TAX-05 lock: tax applies to sellingPrice (not subtotal); see costCalc.test.ts order-of-operations guard.
export function calculateTax(
  sellingPrice: number,
  ratePercent: number,
): { taxAmount: number; ratePercent: number } {
  if (!Number.isFinite(ratePercent) || ratePercent <= 0) {
    return { taxAmount: 0, ratePercent: 0 };
  }
  if (!Number.isFinite(sellingPrice) || sellingPrice <= 0) {
    return { taxAmount: 0, ratePercent };
  }
  const taxAmount = Math.round(sellingPrice * ratePercent) / 100;
  return { taxAmount, ratePercent };
}
```

Note the return shape: `{ taxAmount, ratePercent }`. The replacement expression must destructure `.taxAmount`.

**useMemo call-site pattern** (mirror `CostCalculator.tsx` lines 491-495):
```typescript
// Phase 13: tax math (TAX-05 lock — applied to sellingPrice, NOT subtotal).
const tax = useMemo(
  () => calculateTax(sellingPrice, taxSource.rate),
  [sellingPrice, taxSource.rate]
);
```

**Current state — `PrintQuoteModal.tsx` lines 193-198 (the inline fork to replace):**
```typescript
const subtotal = job.sellingPrice;
// D-22: tax base is sellingPrice ONLY — shipping is NEVER in the base.
const taxAmount = useMemo(
  () => subtotal * (resolvedTax.rate / 100),
  [subtotal, resolvedTax.rate]
);
const total = subtotal + quoteShippingCost + taxAmount;
```

**Target state after D-03:**
```typescript
const subtotal = job.sellingPrice;
// D-22: tax base is sellingPrice ONLY — shipping is NEVER in the base.
// Phase 17 D-03: route through calculateTax helper for byte-identical rounding parity
// with CostCalculator.tsx (TAX-05 lock). Math.round(price * rate) / 100.
const taxAmount = useMemo(
  () => calculateTax(subtotal, resolvedTax.rate).taxAmount,
  [subtotal, resolvedTax.rate]
);
const total = subtotal + quoteShippingCost + taxAmount;
```

**Diff shape:** 1 new import line + 1 expression replacement on line 196 + 1 comment line. Approximately a 3-line diff. Variable name `taxAmount` and useMemo dep array are unchanged — downstream `total` arithmetic untouched.

**Read first:**
1. `src/components/PrintQuoteModal.tsx` lines 1-10 (imports), 182-204 (the tax/total block to repair)
2. `src/components/CostCalculator.tsx` line 8 (import) + lines 481-495 (the resolveTaxRate + calculateTax memo pair — exact pattern to mirror)
3. `src/utils/costCalc.ts` lines 122-138 (helper contract — return shape `.taxAmount`)

---

### 5. `.planning/REQUIREMENTS.md` (doc, 6 checkboxes)

**Analog:** itself. Tick `[ ]` → `[x]` on six existing lines. No content changes — only the inside-the-brackets character.

**Locations to edit (D-05):**

| Line | Current | Target | Notes |
|------|---------|--------|-------|
| 46 | `- [ ] **DUP-02**: ...` | `- [x] **DUP-02**: ...` | Phase 15 verified gap-free 2026-05-25 |
| 50 | `- [ ] **PDF-01**: ...` | `- [x] **PDF-01**: ...` | Phase 16 shipped |
| 51 | `- [ ] **PDF-02**: ...` | `- [x] **PDF-02**: ...` | Phase 16 shipped |
| 52 | `- [ ] **PDF-03**: ...` | `- [x] **PDF-03**: ...` | Phase 16 shipped (assert-no-static-jspdf.mjs locks it) |
| 53 | `- [ ] **PDF-04**: ...` | `- [x] **PDF-04**: ...` | **CRITICAL — only tick AFTER Phase 17 D-01 + D-02 land AND build verification passes** |
| 54 | `- [ ] **PDF-05**: ...` | `- [x] **PDF-05**: ...` | Phase 16 — bundle gate already passing |

**Status-summary-table rows (lines 150 + 156-160)** are already correct (`DUP-02 | Phase 15 | Complete`, `PDF-* | Phase 16 | Pending`) — but Pending → Complete should also flip on lines 156-160 once Phase 17 closes. Verify whether the planner wants to fold these table rows into D-05 or treat them as separate edits. CONTEXT.md D-05 names only the six checkbox lines explicitly; the table-row updates may be part of the same Edit but are not blockers.

**Diff shape:** 6 single-character edits (`[ ]` → `[x]`) co-located in a small range. Single tool call (Edit with multiple occurrences) or 6 sequential Edits.

**Read first:** `.planning/REQUIREMENTS.md` lines 40-60 (the DUP and PDF sections, contiguous).

---

### 6. `.planning/ROADMAP.md` (doc, 1 table row + 1 bullet flip)

**Analog:** itself. Two surgical edits at lines 36 and 174.

**Edit 1 — top-of-file bullet (line 36):**

Current:
```markdown
- [ ] **Phase 16: Printable PDF Quote** — Lazy-loaded jsPDF quote generation, CI modulePreload assertion, font strategy, 300 KB gate verification
```

Target (D-06):
```markdown
- [x] **Phase 16: Printable PDF Quote** — Lazy-loaded jsPDF quote generation, CI modulePreload assertion, font strategy, 300 KB gate verification (completed 2026-05-23)
```

**Edit 2 — Progress Table row (line 174):**

Current:
```markdown
| 16. Printable PDF Quote | 12/13 | In Progress|  |
```

Target (D-06 — 12/13 → 12/12 because Plan 16-05 was verification-only, not a substantive plan):
```markdown
| 16. Printable PDF Quote | 12/12 | Complete    | 2026-05-23 |
```

Note the spacing in the existing table (lines 169-173): `Complete    | YYYY-MM-DD` uses 4 trailing spaces after `Complete` for column alignment. Match the existing convention exactly — visual table alignment matters and mismatched whitespace is the most common avoidable churn.

**Diff shape:** 2 single-line edits. Surgical — do not touch any other ROADMAP.md content.

**Read first:** `.planning/ROADMAP.md` lines 30-40 (bullet list), lines 165-180 (Progress Table including the precedent rows for spacing reference).

---

## Shared Patterns

### Build-time enforcement script convention (applies to: new `assert-no-static-pdf-import.mjs`)

**Established by:** `scripts/assert-no-pdf-preload.mjs`, `scripts/assert-no-static-jspdf.mjs`, `scripts/assert-bundle-size.mjs`

| Convention | Where established | Apply to new script |
|------------|-------------------|---------------------|
| File header banner: 1-line title → purpose → wiring instructions → relationship to other gates | `assert-no-pdf-preload.mjs` lines 1-9 | Yes — mirror tone, name the phase + decision ID |
| Node-builtins-only (no devDeps to install) | All three existing | Yes — `fs` + `path` are sufficient |
| ES modules (`.mjs` extension; `import` not `require`) | All three existing | Yes |
| Single-purpose narrow scope (one regex, one check, fail loudly) | All three existing | Yes — CONTEXT.md D-02: "Two narrow scripts, two narrow names" |
| Success path: `console.log('✓ <one-line summary>')` | `assert-no-pdf-preload.mjs:32`, `assert-bundle-size.mjs:43` | Yes — use literal `✓` U+2713 |
| Failure path: `console.error('<scriptname> FAILED: ...')` → multi-line context → `process.exit(1)` | All three existing | Yes — include actionable fix instructions ("Check vite.config.ts — ...") |
| Missing-dist fallback: try/catch → `console.error('... Did vite build run?') → exit 1` | `assert-no-pdf-preload.mjs:14-20`, `assert-bundle-size.mjs:20-24` | Yes |
| Wiring: append to `package.json` `build` script as `&& node scripts/<name>.mjs` | `package.json` line 8 (current chain has 6 nodes) | Yes — append after `assert-no-pdf-preload.mjs` |

### `calculateTax` helper call pattern (applies to: PrintQuoteModal.tsx tax-fix)

**Established by:** `src/components/CostCalculator.tsx:8` (import) and `:491-495` (memoized call)

| Convention | Pattern |
|------------|---------|
| Import shape | `import { calculateTax } from '../utils/costCalc';` (named import, relative path) |
| Argument order | `calculateTax(sellingPrice, ratePercent)` — sellingPrice first, percent second |
| Return access | Destructure or property-access `.taxAmount` (number, already rounded) |
| Hook wrapping | `useMemo(() => calculateTax(price, rate).taxAmount, [price, rate])` — both args in dep array |
| Comment marker | Reference TAX-05 lock + the source phase (`Phase 13:` in CostCalculator, `Phase 17 D-03:` in the new PrintQuoteModal edit) |

### Doc-tick convention (applies to: REQUIREMENTS.md + ROADMAP.md housekeeping)

**Established by:** `.planning/REQUIREMENTS.md` and `.planning/ROADMAP.md` — both use `[ ]` / `[x]` GitHub-flavored markdown checkboxes; tables use pipe-aligned columns with trailing-space padding for visual alignment.

| Convention | Apply to |
|------------|----------|
| Tick is a single-character edit inside the brackets | D-05 (6 boxes), D-06 (1 bullet) |
| Preserve existing column whitespace exactly (4 trailing spaces after "Complete") | D-06 Progress Table row |
| Completion date format: `YYYY-MM-DD` matching VERIFICATION.md timestamp | D-06 → `2026-05-23` |
| Do NOT reflow surrounding content | Both files |

---

## No Analog Found

None. This is a closure phase — every file modified or created has an in-repo analog (the file itself, or a direct sibling). The planner does not need to fall back to RESEARCH.md for any of the six changes.

---

## Cross-Reference Map (for planner — wave structuring)

CONTEXT.md hints at a "1 plan with 4 tasks OR 2 plans across 2 waves (Wave 1 = code fixes; Wave 2 = housekeeping after code lands)" structure. The pattern map supports the 2-wave option cleanly:

**Wave 1 — code fixes (D-01, D-02, D-03):**
- `vite.config.ts` reorder (D-01) — required to make D-02 gate meaningful
- `scripts/assert-no-static-pdf-import.mjs` NEW + `package.json` wire (D-02) — must run AFTER D-01 lands to validate the fix
- `src/components/PrintQuoteModal.tsx` tax-helper switch (D-03) — independent of D-01/D-02; can land in same wave

**Wave 2 — housekeeping doc-ticks (D-05, D-06):**
- `.planning/REQUIREMENTS.md` 6 checkboxes
- `.planning/ROADMAP.md` 1 bullet + 1 table row

Wave 2 depends ONLY on Wave 1 build verification passing. No code touches; doc-only.

---

## Metadata

**Analog search scope:** `scripts/`, `src/components/`, `src/utils/`, `vite.config.ts`, `package.json`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`
**Files scanned:** 8 (3 build scripts, 2 source files, 1 helper, 2 planning docs)
**Pattern extraction date:** 2026-05-25
**Notes:** Every CONTEXT.md-named analog (`assert-no-pdf-preload.mjs`, `CostCalculator.tsx`, the `costCalc.ts` helper) was read in full and verified current. One additional analog (`assert-no-static-jspdf.mjs`, named in `package.json` but not in CONTEXT.md) was loaded because it is the closest precedent for the "violation collection then batch report" loop the new gate needs.
