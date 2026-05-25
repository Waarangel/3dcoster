---
phase: 17-close-gap-pdf-04-fix-rollup-circular-chunk-that-defeats-jspd
verified: 2026-05-25T13:30:00Z
status: passed
score: 10/10 must-haves verified
overrides_applied: 0
---

# Phase 17: Close Gap PDF-04 + Tax Rounding + v1.2 Doc Housekeeping — Verification Report

**Phase Goal:** Close the v1.2 milestone's one blocker (PDF-04 lazy-load defeated by Rollup chunk ordering) and one warning (tax rounding divergence between PrintQuoteModal and CostCalculator), plus housekeeping ticks for DUP-02 + PDF-01..PDF-05 + Phase 16 row in ROADMAP.

**Verified:** 2026-05-25T13:30:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | After `npm run build`, no non-pdf chunk in `dist/assets/` contains a STATIC import of the pdf chunk | VERIFIED | `grep -cE '(import\|from)\s*"\./pdf-' dist/assets/index-D23BnXF4.js` → 0; same grep against utils-D1RVnHRW.js → 0; all 6 marketing-page chunks + Header chunk → 0 each |
| 2 | The lazily-loaded pdf chunk is only referenced by `dist/assets/index-*.js`, and only via dynamic `import()` | VERIFIED | `grep -c 'import("\./pdf-' dist/assets/index-D23BnXF4.js` → 1 (dynamic import survives) |
| 3 | `dist/assets/utils-*.js` exists (the new Wave 1 extension chunk holding `src/utils/*` + `vite/preload-helper.js`) | VERIFIED | `ls dist/assets/utils-*.js` → `utils-D1RVnHRW.js` (33.47 KB / 10.91 KB gz) |
| 4 | `PrintQuoteModal.tsx` computes `taxAmount` via the canonical `calculateTax` helper (byte-identical rounding parity with `CostCalculator.tsx`) | VERIFIED | Line 6: `import { calculateTax } from '../utils/costCalc';` Line 199: `() => calculateTax(subtotal, resolvedTax.rate).taxAmount,` — same code path as `CostCalculator.tsx:493` (`() => calculateTax(sellingPrice, taxSource.rate)`) |
| 5 | `npm run build` exits 0 with all 8 gates green (including both `assert-no-pdf-preload.mjs` and the new `assert-no-static-pdf-import.mjs`) | VERIFIED | Full build run completed: 269 tests passed, gates printed: `✓ main chunk: 54.6 KB gzipped (under 300 KB)`, `✓ pdf chunk: no modulepreload link in dist/index.html`, `✓ pdf chunk: no static import from any non-pdf chunk in dist/assets/` |
| 6 | All 6 REQUIREMENTS.md checkboxes (DUP-02 + PDF-01..PDF-05) are ticked `[x]` | VERIFIED | `grep -c "^- \[x\] \*\*\(DUP-02\|PDF-0[1-5]\)\*\*" .planning/REQUIREMENTS.md` → 6; `grep -c "^- \[ \] \*\*\(DUP-02\|PDF-0[1-5]\)\*\*" .planning/REQUIREMENTS.md` → 0 |
| 7 | REQUIREMENTS.md Traceability table rows for PDF-01..PDF-05 all read `Complete` (DUP-02 already did from Phase 15) | VERIFIED | All 5 PDF rows + DUP-02 row read `Complete` in column 3 (lines 150, 156–160) |
| 8 | ROADMAP.md Phase 16 top-bullet reads `[x]` with `(completed 2026-05-23)` suffix | VERIFIED | Line 38: `- [x] **Phase 16: Printable PDF Quote** — Lazy-loaded jsPDF quote generation, CI modulePreload assertion, font strategy, 300 KB gate verification (completed 2026-05-23)` |
| 9 | ROADMAP.md Progress Table row for Phase 16 reads `12/12 \| Complete    \| 2026-05-23` (4 trailing spaces after `Complete` for column alignment) | VERIFIED | Line 205: `\| 16. Printable PDF Quote \| 12/12 \| Complete    \| 2026-05-23 \|` — matches column spacing of rows 200–204 |
| 10 | Scope discipline — D-07 (CUST/ETSY wording unchanged) and D-08 (no new VALIDATION.md for 13/15/15.1) honored | VERIFIED | `grep -c "CUST-01\|CUST-02\|ETSY-01" .planning/REQUIREMENTS.md` → 6 (unchanged); `13-VALIDATION.md` is pre-existing only; no `15-VALIDATION.md` or `15.1-VALIDATION.md` exist |

**Score:** 10/10 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `vite.config.ts` | manualChunks reordered: utils check first, then pdf check, then node_modules; `hoistTransitiveImports: false` set | VERIFIED | Lines 75–137. Line 93: `hoistTransitiveImports: false`. Lines 118–120: utils chunk rule (Wave 1 extension). Lines 127–129: pdf id-prefix check. Lines 130–134: node_modules block. `build.modulePreload: false` preserved at line 79. |
| `scripts/assert-no-static-pdf-import.mjs` | NEW 56-line Node-builtins-only post-build gate scanning `dist/assets/*.js` (excluding pdf chunk) for `(import\|from)"./pdf-*"` regex | VERIFIED | File exists (68 lines incl. headers/comments). Uses only `fs.readdirSync`, `fs.readFileSync`, `path.join`. Regex `STATIC_PDF_IMPORT_REGEX = /(?:import\|from)\s*["']\.\/pdf-[\w-]+\.js["']/` matches static side-effect/named/default/namespace/re-export forms but NOT dynamic `import()` (parens). Script ran standalone and exited 0 with success line. |
| `package.json` | `build` script chain appends new gate after `assert-no-pdf-preload.mjs` | VERIFIED | Line 8: ends with `... && node scripts/assert-no-pdf-preload.mjs && node scripts/assert-no-static-pdf-import.mjs` |
| `src/components/PrintQuoteModal.tsx` | Adds `import { calculateTax } from '../utils/costCalc'` and uses `calculateTax(subtotal, resolvedTax.rate).taxAmount` in `taxAmount` useMemo | VERIFIED | Line 6: import added between `formatCurrency` and `Button` UI import. Lines 196–201: useMemo body swapped + Phase 17 D-03 comment added. Const name `taxAmount` and dep array `[subtotal, resolvedTax.rate]` unchanged. |
| `.planning/REQUIREMENTS.md` | 6 stale `[ ]` boxes ticked `[x]` (DUP-02 + PDF-01..PDF-05); Traceability table rows for PDF-01..PDF-05 flipped Pending → Complete | VERIFIED | 6 ticks present (grep count = 6, stale count = 0); all 5 PDF table rows read `Complete`; DUP-02 row was already `Complete` from Phase 15 close. |
| `.planning/ROADMAP.md` | Phase 16 top-bullet ticked `[x]` with completion date; Progress Table row finalized to `12/12 \| Complete    \| 2026-05-23` | VERIFIED | Bullet at line 38 ticked with `(completed 2026-05-23)` suffix. Progress Table row at line 205 matches exactly, including the 4 trailing spaces after `Complete` for column alignment. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `vite.config.ts` manualChunks | `dist/assets/pdf-*.js` chunk | Rollup chunk classification — pdf id-prefix check fires before node_modules catch-all | WIRED | Built bundle has `pdf-CGCE5ODn.js` (510.75 KB / 194.54 KB gz); contains jspdf + jspdf-autotable; no jspdf bytes leaked into `vendor-DEJm2EwI.js` |
| `vite.config.ts` manualChunks | `dist/assets/utils-*.js` chunk (Wave 1 extension) | utils id-prefix check fires BEFORE pdf check | WIRED | Built bundle has `utils-D1RVnHRW.js` (33.47 KB / 10.91 KB gz); contains shared `src/utils/*` symbols + `__vitePreload`; entry chunk imports from this chunk, not pdf |
| `package.json` build script | `scripts/assert-no-static-pdf-import.mjs` | `&&`-chained node invocation, post vite build | WIRED | Final step of 8-step build chain; `npm run build` printed `✓ pdf chunk: no static import from any non-pdf chunk in dist/assets/` |
| `src/components/PrintQuoteModal.tsx` | `src/utils/costCalc.ts` calculateTax | named ES import + useMemo call | WIRED | Import on line 6; useMemo on line 198–201 calls helper with correct argument order (`sellingPrice, ratePercent`) and accesses `.taxAmount` property; matches helper return shape `{ taxAmount: number; ratePercent: number }` |
| `src/components/CostCalculator.tsx` | `src/utils/costCalc.ts` calculateTax | named ES import + useMemo call (CANONICAL REFERENCE) | WIRED | Line 8 import, line 493 useMemo — same code path; both surfaces now compute byte-identical `taxAmount` for same `(sellingPrice, ratePercent)` inputs |
| `v1.2-MILESTONE-AUDIT.md` housekeeping | `.planning/REQUIREMENTS.md` DUP-02 + PDF-01..PDF-05 lines | single-character `[ ]` → `[x]` edits | WIRED | All 6 lines ticked; Traceability table rows flipped Pending → Complete; CUST-01/CUST-02/ETSY-01 wording untouched per D-07 |
| Phase 16 VERIFICATION.md verdict | `.planning/ROADMAP.md` Phase 16 bullet + Progress Table row | bullet `[ ]` → `[x] (completed 2026-05-23)` + row `12/13 \| In Progress` → `12/12 \| Complete    \| 2026-05-23` | WIRED | Both edits landed in commit `77fa55e`; spacing matches column convention of rows 200–204 |

### Data-Flow Trace (Level 4)

Phase 17 is a build-config + helper-substitution + doc-tick phase. The only "data flow" relevant to runtime is the tax math path (CostCalculator + PrintQuoteModal both call `calculateTax`) and the bundle-shape contract (verified above via direct grep against built dist). N/A for additional dynamic-data tracing.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| New CI gate exits 0 against fresh build | `node scripts/assert-no-static-pdf-import.mjs` | `✓ pdf chunk: no static import from any non-pdf chunk in dist/assets/` / exit 0 | PASS |
| Existing modulepreload gate still passes | `node scripts/assert-no-pdf-preload.mjs` | `✓ pdf chunk: no modulepreload link in dist/index.html` / exit 0 | PASS |
| Bundle size gate still passes | `node scripts/assert-bundle-size.mjs` | `✓ main chunk: 54.6 KB gzipped (under 300 KB) — index-D23BnXF4.js` / exit 0 | PASS |
| Entry chunk has 0 static refs to pdf | `grep -cE '(import\|from)\s*"\./pdf-' dist/assets/index-*.js` | 0 | PASS |
| Entry chunk has exactly 1 dynamic import of pdf | `grep -c 'import("\./pdf-' dist/assets/index-*.js` | 1 | PASS |
| Utils chunk has 0 static refs to pdf | `grep -cE '(import\|from)\s*"\./pdf-' dist/assets/utils-*.js` | 0 | PASS |
| 6 marketing-page chunks + Header — 0 static refs to pdf each | per-chunk grep loop | 7 chunks, all 0 | PASS |
| Full build pipeline exits 0 | `npm run build` | 8 gates green (lint, jspdf scan, 269 tests, tsc, vite build, bundle-size, pdf-preload, static-pdf-import) | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PDF-04 | 17-01, 17-02 | `vite.config.ts` sets `build.modulePreload: false`; CI assertion catches lazy-load regressions | SATISFIED | `modulePreload: false` preserved at line 79; new `assert-no-static-pdf-import.mjs` gate added + wired; 0 static refs to pdf chunk in any non-pdf chunk; ticked `[x]` in REQUIREMENTS.md |
| DUP-02 | 17-02 | Housekeeping tick — already satisfied by Phase 15, just needed checkbox update | SATISFIED | Ticked `[x]`; Traceability row read `Complete` from Phase 15 closure |
| PDF-01 | 17-02 | Housekeeping tick — already satisfied by Phase 16 | SATISFIED | Ticked `[x]`; Traceability row now reads `Complete` |
| PDF-02 | 17-02 | Housekeeping tick — already satisfied by Phase 16 | SATISFIED | Ticked `[x]`; Traceability row now reads `Complete` |
| PDF-03 | 17-02 | Housekeeping tick — already satisfied by Phase 16 | SATISFIED | Ticked `[x]`; Traceability row now reads `Complete` |
| PDF-05 | 17-02 | Housekeeping tick — already satisfied by Phase 16 | SATISFIED | Ticked `[x]`; Traceability row now reads `Complete`; bundle gate still passes (54.6 KB gz < 300 KB) |
| D-01..D-08 | 17-01, 17-02 | Phase 17 internal decisions (not REQUIREMENTS.md IDs) | SATISFIED | D-01: manualChunks reorder shipped; D-01 supplement: `hoistTransitiveImports: false` shipped; D-01 Wave 1 extension: utils chunk rule shipped; D-02: new gate + package.json wire shipped (regex broadened in Wave 1 extension); D-03: PrintQuoteModal calculateTax substitution shipped; D-04: no parity test (architectural fix); D-05: 6 REQUIREMENTS.md ticks shipped; D-06: ROADMAP.md bullet + Progress Table row shipped; D-07: CUST/ETSY wording untouched (count = 6, unchanged); D-08: no new VALIDATION.md created |

All requirements declared in PLAN frontmatter accounted for. No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `scripts/assert-no-static-pdf-import.mjs` | 13, 18-22, 31 | Comment text contains literal `XXX` substrings (e.g., `pdf-XXXX.js`, `pdf-XXX.js`) | Info (false positive) | These are placeholder examples in documentation comments showing allowed/forbidden import forms (`import"./pdf-XXX.js"` etc.), NOT debt markers. The script is a finished, working CI gate — no real TODO/FIXME. Verified by reading context. |

No real debt markers (`TBD`, `FIXME`, `TODO`, `HACK`, `PLACEHOLDER`) found in any file modified by Phase 17. No empty implementations, no console.log-only handlers, no hardcoded empty data.

### Probe Execution

This phase has no formal `scripts/*/tests/probe-*.sh` style probes. The closest equivalents are the post-build CI gates, which were executed and passed:

| Probe (CI gate) | Command | Result | Status |
|-----------------|---------|--------|--------|
| `scripts/assert-no-static-pdf-import.mjs` | `node scripts/assert-no-static-pdf-import.mjs` | `✓ pdf chunk: no static import from any non-pdf chunk in dist/assets/` / exit 0 | PASS |
| `scripts/assert-no-pdf-preload.mjs` | `node scripts/assert-no-pdf-preload.mjs` | `✓ pdf chunk: no modulepreload link in dist/index.html` / exit 0 | PASS |
| `scripts/assert-bundle-size.mjs` | `node scripts/assert-bundle-size.mjs` | `✓ main chunk: 54.6 KB gzipped (under 300 KB) — index-D23BnXF4.js` / exit 0 | PASS |
| Full build chain | `npm run build` | 8 steps green, 269 tests passed, 3 PDF/bundle gates printed `✓` | PASS |

### Human Verification Required

None. All must-haves verifiable programmatically via grep/file checks/build invocation. The PDF-04 fix is bundle-shape (verifiable in built dist), the tax math fix is helper substitution (verifiable in source), and the doc ticks are character-level edits (verifiable via grep).

The audit-related "PDF lazy-load defeated for marketing-page visitors" runtime symptom would normally require a browser network-tab spot-check, but the static analysis of the built bundle (0 static refs to pdf chunk in any non-pdf chunk + 1 dynamic import in entry chunk) is the architectural contract that the runtime behavior follows from. The CI gate now prevents regressions of this class going forward.

### Gaps Summary

None. Phase 17 goal fully achieved:

1. **PDF-04 lazy-load blocker CLOSED** — `vite.config.ts` reorder + `hoistTransitiveImports: false` + Wave 1 extension utils chunk rule + broadened CI gate all shipped. Built bundle has 0 static references to pdf chunk in any chunk except the pdf chunk itself, 1 dynamic `import()` in entry chunk. The Phase 16 D-01 contract ("jspdf must load only via dynamic `import()` from the user's Generate PDF click") is now actually enforced at build time.
2. **Tax rounding warning CLOSED** — `PrintQuoteModal.tsx` routes `taxAmount` through the canonical `calculateTax` helper. Byte-identical with `CostCalculator.tsx` for the same `(sellingPrice, ratePercent)` inputs. Pre-fix divergence `3.8987` → post-fix `3.90` for `sellingPrice=29.99, rate=13`.
3. **Doc housekeeping CLOSED** — 6 stale REQUIREMENTS.md checkboxes ticked, 5 Traceability rows flipped Pending → Complete, ROADMAP.md Phase 16 bullet + Progress Table row finalized to `12/12 | Complete | 2026-05-23` with exact column spacing.
4. **Scope discipline HELD** — no code files outside the 4 listed in 17-01 PLAN.md were modified; no CUST-01/CUST-02/ETSY-01 wording revisions (D-07 deferred); no new VALIDATION.md created for 13/15/15.1 (D-08 deferred); no package installs.

The v1.2 milestone is now ready for `/gsd:audit-milestone v1.2` re-run + `/gsd:complete-milestone v1.2`.

---

*Verified: 2026-05-25T13:30:00Z*
*Verifier: Claude (gsd-verifier)*
