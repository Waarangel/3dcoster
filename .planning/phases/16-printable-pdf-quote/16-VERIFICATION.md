---
phase: 16-printable-pdf-quote
verified: 2026-05-23T11:19:00Z
status: in-progress
score: 0/5 — automated chain green; awaiting human UAT
verified_by: automated + human-uat-pending
gaps: []
deferred: []
---

# Phase 16: Printable PDF Quote — Verification Report

**Phase Goal:** Users can generate a professional PDF quote from any saved job — client-side, lazy-loaded, with Unicode glyph support, region-aware tax labels, layered Notes/Terms, and a working Tauri native save dialog. Quote numbers auto-assign and persist per job.

**Automated chain run:** 2026-05-23T11:19:00Z
**Status:** AUTOMATED CHAIN GREEN — awaiting human UAT
**Human UAT:** Pending (Task 2 checkpoint)

---

## Automated Verification Chain

All commands run in agent worktree at commit `025f07a` (Phase 16 wave 3 complete).

| # | Command | Exit Code | Key Output |
|---|---------|-----------|------------|
| 1 | `npm run build` | **0** | All 7 build gates pass (lint-no-raw-html, assert-no-static-jspdf, vitest --coverage, tsc -b, vite build, assert-bundle-size, assert-no-pdf-preload). 13 test files, 181 tests passed. |
| 2 | `ls -lh dist/assets/` | 0 | `pdf-D3YXHD0a.js` (150K raw / **77.89 KB gz**); `index-D3AjJ3H_.js` (231K raw / **54.8 KB gz** — well under 300 KB gate) |
| 3 | `grep -c "^\s*'[a-z-]*': new Date(" src/features.ts` | 0 | **8** (7 prior + `pdf-quote` entry dated 2026-05-23) |
| 4 | `grep -rn "<NewBadge feature=\"pdf-quote\""` | 0 | **2 matches** — `src/components/CostCalculator.tsx:69` + `src/components/JobsManager.tsx:194` |
| 5 | `grep -rn "from 'jspdf'" src/` | 0 | **1 match** — `src/pdf/generateQuotePdf.ts:6` only (gate excludes `src/pdf/`) |
| 6 | `grep -rn "from 'jspdf-autotable'" src/` | 0 | **1 match** — `src/pdf/generateQuotePdf.ts:7` only |
| 7 | `grep -rn "await import('../pdf/generateQuotePdf')" src/` | 0 | **2 matches** — `src/components/CostCalculator.tsx:704` + `src/components/JobsManager.tsx:781` |
| 8 | `grep -rn "doc.html\|doc.autoTable" src/pdf/` | 0 | **0 matches** — no HTML injection vector, no v3 `doc.autoTable()` antipattern |
| 9 | `grep -rE "onPersistQuoteNumber\?:" src/components/` | 0 | **0 matches** — callback is REQUIRED (no `?:`) in both CostCalculator + JobsManager props |
| 10 | `vitest run` | **0** | **Test Files 13 passed (13) — Tests 181 passed (181)** — Duration 1.92s |

**Build gate chain order:** `lint-no-raw-html` → `assert-no-static-jspdf` → `vitest --coverage` → `tsc -b` → `vite build` → `assert-bundle-size` → `assert-no-pdf-preload`

---

## Static Audits

| Audit | Expected | Actual | Result |
|-------|----------|--------|--------|
| `features.ts` pdf-quote entry count | 8 entries | 8 entries | **PASS** |
| NewBadge `pdf-quote` JSX consumers | 2 (CostCalculator + JobsManager) | 2 | **PASS** |
| `from 'jspdf'` import locations | 1 (src/pdf/ only) | 1 — `generateQuotePdf.ts:6` | **PASS** |
| `from 'jspdf-autotable'` import locations | 1 (src/pdf/ only) | 1 — `generateQuotePdf.ts:7` | **PASS** |
| `await import('../pdf/generateQuotePdf')` call sites | 2 | 2 | **PASS** |
| `doc.html` antipattern count | 0 | 0 | **PASS** |
| `doc.autoTable` v3 antipattern count | 0 | 0 | **PASS** |
| `onPersistQuoteNumber?:` optional callback | 0 (must be REQUIRED) | 0 | **PASS** |

**Static audit gate: 8/8 PASS — CLEAR**

---

## Bundle Size

Build output from `npm run build` (vite build + assert-bundle-size):

| Chunk | Raw Size | Gzipped | Status |
|-------|----------|---------|--------|
| `dist/assets/index-D3AjJ3H_.js` (main) | 236.41 KB | **56.11 KB** | **PASS** (< 300 KB gate) |
| `dist/assets/pdf-D3YXHD0a.js` (lazy) | 154.01 KB | **77.89 KB** | **PASS** (lazy chunk, off main bundle) |
| `dist/assets/react-vendor-BjrgHrA8.js` | 190.94 KB | 59.94 KB | — |
| `dist/assets/vendor-D0PHvUlr.js` | 970.80 KB | 298.93 KB | — (vendor chunk, not gated) |
| `dist/assets/dexie-vendor-BqEUIn46.js` | 97.08 KB | 32.43 KB | — |

**`dist/index.html` modulepreload check:** No `modulepreload` links found — PDF chunk is purely lazy-loaded. Gate `assert-no-pdf-preload.mjs` exits 0. **PASS**

The build output from `assert-bundle-size.mjs` confirms: `✓ main chunk: 54.8 KB gzipped (under 300 KB) — index-D3AjJ3H_.js`

---

## Requirement Status (Preliminary — Automated Only)

| Requirement | Description | Automated Evidence | Status |
|-------------|-------------|-------------------|--------|
| **PDF-01** | "Generate PDF" button on CostCalculator + JobsManager; disabled when `sellingPrice <= 0` | CostCalculator.test.tsx: 4 tests for GeneratePdfButton disabled state (0 todos) — vitest 181 PASS | automated PASS / awaiting UAT |
| **PDF-02** | PDF byte stream starts `%PDF-`, contains expected section strings | generateQuotePdf.test.ts: 21 integration tests (magic bytes, customer block, tax rows, notes/terms, footer, glyph coverage) — vitest 181 PASS | automated PASS / awaiting UAT |
| **PDF-03** | No static `from 'jspdf'` / `from 'jspdf-autotable'` outside `src/pdf/` | `assert-no-static-jspdf.mjs` exits 0; grep audit confirms 1 match each (both `generateQuotePdf.ts`) | **automated PASS** |
| **PDF-04** | `dist/index.html` contains no `modulepreload` for pdf chunk | `assert-no-pdf-preload.mjs` exits 0; `grep modulepreload dist/index.html` → 0 matches | **automated PASS** |
| **PDF-05** | Main app chunk ≤ 300 KB gzipped | `assert-bundle-size.mjs` exits 0; main chunk 56.11 KB gz (well under gate) | **automated PASS** |

---

## Coverage Report

From `vitest run --coverage` (run as part of `npm run build`):

| File | Statements | Branches | Functions | Lines | Uncovered |
|------|-----------|---------|----------|-------|-----------|
| `costCalc.ts` | 97.82% (45/46) | 94.28% (33/35) | 100% (13/13) | 100% (41/41) | Lines 169-170 |

Note: coverage is reported only for `costCalc.ts` (the utility file explicitly included in coverage). The PDF generator module (`generateQuotePdf.ts`) is exercised by 21 integration tests but is not in the coverage include set (it is in `src/pdf/`, not `src/utils/`).

---

## Pending Human UAT

The following 7 UAT scenarios are PENDING human verification. After the user runs them and types "approved" (or a failure description), this section will be replaced by `## UAT Scenario Results`.

| # | Scenario | Key Verifications |
|---|----------|------------------|
| 1 | Web PDF — no customer, no tax (CostCalculator) | D-01 aesthetic, D-02 header, D-03 section order, D-04 collapsed row, D-07 0% tax row hidden |
| 2 | Web PDF — customer + EU tax + Notes/Terms (JobsManager accordion ONLY) | D-06 region-aware label (VAT), D-07 tax row shown, D-08 layered Notes + Terms, D-10 Unicode (€/ü/ç), D-11 filename slug |
| 3 | Web PDF — terms only, no notes | D-08 Notes subsection omitted, Terms present |
| 4 | Web PDF — neither notes nor terms | D-08 whole Notes/Terms area omitted, no gap before footer |
| 5 | Tauri desktop PDF + native save dialog | D-12 Tauri save plumbing, RESEARCH.md Pattern 8 cancel semantics |
| 6 | NewBadge non-regression (CostCalculator + JobsManager at 375px) | Absolute overlay only — no sibling push/wrap/shrink |
| 7 | Quote number lifecycle (assign once, reuse on 2nd gen) | D-05 lifetime counter, no re-increment |

**v1.2 Limitation — surfaced during UAT:** CostCalculator PDFs do NOT include a customer block. The CostCalculator surface has no Sale context. To verify the customer block + Unicode + EU tax combination, Scenario 2 MUST use the JobsManager accordion Generate PDF button (the only v1.2 surface that includes the customer block). This is a known and documented v1.2 design decision — see 16-04-SUMMARY.md and the code comment in `src/components/CostCalculator.tsx`.

---

*Automated chain run: 2026-05-23T11:19:00Z by gsd-executor (Plan 16-05 Task 1)*
*Phase: 16-printable-pdf-quote*
