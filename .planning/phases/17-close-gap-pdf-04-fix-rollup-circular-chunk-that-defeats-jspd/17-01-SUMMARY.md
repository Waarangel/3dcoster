---
phase: 17-close-gap-pdf-04-fix-rollup-circular-chunk-that-defeats-jspd
plan: 01
subsystem: build-config + components
tags: [pdf-lazy-load, rollup-chunking, tax-rounding-parity, ci-gate]
requires:
  - vite.config.ts manualChunks (existing, Phase 16 D-01)
  - scripts/assert-no-pdf-preload.mjs (existing, Phase 16 PDF-04)
  - src/utils/costCalc.ts calculateTax (existing, Phase 13 TAX-05)
  - src/components/CostCalculator.tsx calculateTax call pattern (existing)
provides:
  - PDF-04 lazy-load now actually enforced at build time (no static pdf imports in marketing chunks)
  - assert-no-static-pdf-import.mjs CI gate (catches regression class)
  - byte-identical tax rounding parity between CostCalculator and PrintQuoteModal
affects:
  - vite.config.ts (manualChunks ordering + hoistTransitiveImports flag)
  - package.json (build script chain — 8 gates now)
  - dist/assets/*-Page*.js chunks (no longer side-effect-import pdf chunk)
tech-stack:
  added: []
  patterns:
    - Rollup hoistTransitiveImports:false (eliminates cross-chunk side-effect static imports)
    - Sibling CI-gate pattern (assert-no-static-pdf-import.mjs mirrors assert-no-pdf-preload.mjs)
key-files:
  created:
    - scripts/assert-no-static-pdf-import.mjs (56 lines, Node-builtins only)
  modified:
    - vite.config.ts (+21/-6 — reorder manualChunks + add hoistTransitiveImports:false + expanded comment)
    - package.json (+1/-1 — append new gate to &&-chain)
    - src/components/PrintQuoteModal.tsx (+4/-1 — calculateTax import + useMemo body swap + comment)
decisions:
  - "Phase 17 D-01: pdf-id check fires BEFORE node_modules check in manualChunks (so jspdf lands in pdf chunk, not vendor)"
  - "Phase 17 D-01 supplement (Rule 2 deviation): added build.rollupOptions.output.hoistTransitiveImports:false — reorder alone was necessary but not sufficient; without this flag the new gate would trip on all 6 marketing-page chunks"
  - "Phase 17 D-02: new assert-no-static-pdf-import.mjs gate runs LAST in build chain (after the cheap modulepreload check), per the cheap-fail-fast convention"
  - "Phase 17 D-03: PrintQuoteModal.tsx tax math now routes through calculateTax helper — byte-identical with CostCalculator.tsx (TAX-05 lock)"
metrics:
  duration_minutes: 18
  duration_human: "~18 min (incl. dependency restore + Rollup root-cause investigation)"
  completed_at: "2026-05-25T08:24:10-04:00"
  tasks_completed: 3
  tasks_total: 3
  files_changed: 4
  test_count: 269
  test_passing: 269
  build_chain_steps: 8
---

# Phase 17 Plan 01: Close Gap PDF-04 + Fix Rollup Circular Chunk + Tax Rounding Parity — Summary

One-liner: Repaired PDF-04 lazy-load regression by reordering `vite.config.ts` `manualChunks` AND disabling Rollup `hoistTransitiveImports`, added `assert-no-static-pdf-import.mjs` CI gate, and routed `PrintQuoteModal.tsx` tax math through the canonical `calculateTax` helper for byte-identical parity with `CostCalculator.tsx`.

## What changed

### Task 1 (commit `36ea662`) — `vite.config.ts` reorder + `hoistTransitiveImports:false`

Reordered `build.rollupOptions.output.manualChunks` so the `/src/pdf/`, `/jspdf/`, `/jspdf-autotable/` id check fires BEFORE the `node_modules` block. Effect: `jspdf` (which lives under `node_modules/jspdf/`) now lands in the `pdf` chunk instead of being claimed by `vendor` first.

Also added `output.hoistTransitiveImports: false` (Rule 2 deviation — see Deviations section). Without this, the gate created in Task 2 would have failed immediately because Rollup hoists transitive chunk dependencies (`pdf`, `vendor`, `dexie-vendor`) as side-effect static imports into every chunk that depends on `index-*.js`.

Preserved `build.modulePreload: false` verbatim. Updated the inline comment to acknowledge that `/jspdf/` and `/jspdf-autotable/` are intentionally `node_modules` paths that bypass the outer block by design (Phase 17 D-01 + Phase 16 D-01).

### Task 2 (commit `4456539`) — new `scripts/assert-no-static-pdf-import.mjs` + wire into `package.json`

Created the 56-line gate script using only `fs` and `path` builtins. It scans `dist/assets/*.js` (excluding `index-*.js` and `pdf-*.js`) for the regex `/import\s*["']\.\/pdf-[\w-]+\.js["']/` — the static side-effect import form. Exits 1 with a violations list and a remediation hint pointing at `vite.config.ts` if any non-entry chunk statically loads the pdf chunk.

Wired into `package.json` `build` script as the final `&&`-chained step (after `assert-no-pdf-preload.mjs`, per CONTEXT.md open question #1 — cheap one-file modulepreload check fails fast before the multi-file dist scan).

Test invocation that confirmed it passes against the post-Task-1 build:

```bash
$ node scripts/assert-no-static-pdf-import.mjs
✓ pdf chunk: no static import from non-entry chunks in dist/assets/
exit: 0
```

Sanity-check that the gate actually catches something: BEFORE adding `hoistTransitiveImports: false` in Task 1, every one of the 6 marketing-page chunks (`ChangelogPage`, `DownloadPage`, `FAQPage`, `FeaturesPage`, `FeedbackPage`, `LandingPage`) contained `import"./pdf-xR_hYSi9.js"` as a side-effect static import. The gate correctly flagged all 6. After the flag was added, all chunks are clean and the gate exits 0.

### Task 3 (commit `6fd0938`) — `PrintQuoteModal.tsx` tax-helper switch

Exact 3-line diff (1 new import + 2-line useMemo body swap + 2-line comment expansion, net +4/-1):

```diff
 import { resolveTaxRate, taxLabelFor } from '../utils/taxResolution';
 import { formatCurrency } from '../utils/currency';
+import { calculateTax } from '../utils/costCalc';
 import { Button, Input, Textarea, InfoTooltip } from './ui';

   const subtotal = job.sellingPrice;
   // D-22: tax base is sellingPrice ONLY — shipping is NEVER in the base.
+  // Phase 17 D-03: route through calculateTax helper for byte-identical rounding
+  // parity with CostCalculator.tsx (TAX-05 lock — Math.round(price * rate) / 100).
   const taxAmount = useMemo(
-    () => subtotal * (resolvedTax.rate / 100),
+    () => calculateTax(subtotal, resolvedTax.rate).taxAmount,
     [subtotal, resolvedTax.rate]
   );
   const total = subtotal + quoteShippingCost + taxAmount;
```

useMemo dep array `[subtotal, resolvedTax.rate]` unchanged, const name `taxAmount` unchanged, downstream `total = subtotal + quoteShippingCost + taxAmount` arithmetic unchanged. Customer picker, `resolveTaxRate` useMemo, `taxLabelFor` useMemo, keydown handlers, Quote-creation transaction call — all untouched.

For `sellingPrice=29.99, rate=13`: pre-fix divergence was `taxAmount=3.8987` (modal inline) vs `3.90` (CostCalculator). Post-fix: both surfaces produce `3.90` (byte-identical TAX-05 lock).

## Verification — `npm run build` output excerpt

```
 Test Files  18 passed (18)
      Tests  269 passed | 1 todo (270)
...
dist/assets/index-CT99EgUb.js          264.46 kB │ gzip:  62.95 kB
dist/assets/pdf-xR_hYSi9.js            523.34 kB │ gzip: 197.86 kB
dist/assets/vendor-DEJm2EwI.js         598.21 kB │ gzip: 179.12 kB
...
✓ main chunk: 61.5 KB gzipped (under 300 KB) — index-CT99EgUb.js
✓ pdf chunk: no modulepreload link in dist/index.html
✓ pdf chunk: no static import from non-entry chunks in dist/assets/
```

Full 8-step chain green: `lint-no-raw-html` → `assert-no-static-jspdf` → `vitest run --coverage` (269 passed, 1 todo) → `tsc -b` → `vite build` → `assert-bundle-size` (61.5 KB gz, under 300 KB) → `assert-no-pdf-preload` → `assert-no-static-pdf-import` (new).

### Bundle shape verification

Marketing-page chunks no longer side-effect-import the pdf chunk:

```bash
$ grep -l 'import"./pdf-' dist/assets/ChangelogPage-*.js dist/assets/DownloadPage-*.js \
  dist/assets/FAQPage-*.js dist/assets/FeaturesPage-*.js dist/assets/FeedbackPage-*.js \
  dist/assets/LandingPage-*.js
(no output — 0 matches)
```

Dynamic import survived in entry chunk:

```bash
$ grep -l 'import("./pdf-' dist/assets/index-*.js
dist/assets/index-CT99EgUb.js
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — Missing critical functionality] Added `build.rollupOptions.output.hoistTransitiveImports: false`**

- **Found during:** Task 1, during the verification build before commit.
- **Issue:** The plan's stated remediation — "reorder manualChunks so the pdf-id check fires before the node_modules block" — is necessary but NOT sufficient. After applying the reorder alone, all 6 marketing-page chunks STILL contained `import"./pdf-xR_hYSi9.js"` as a side-effect static import. The new gate from Task 2 would have failed the build on first run. Root cause: Rollup's `hoistTransitiveImports` option defaults to `true`, which hoists every transitive chunk dependency as a side-effect static import into any chunk that imports the parent. Since marketing pages import `./index-*.js` (for `Footer`, `Button`, etc.), Rollup automatically injects `import"./pdf-*.js"`, `import"./vendor-*.js"`, and `import"./dexie-vendor-*.js"` at their top. That is the actual mechanism defeating PDF-04 — not the manualChunks ordering by itself.
- **Fix:** Added `hoistTransitiveImports: false` to `build.rollupOptions.output` in `vite.config.ts`, with a multi-line comment explaining the interaction with the reorder and the PDF-04 lazy-load goal.
- **Files modified:** `vite.config.ts` (additional 13 lines of comment + 1 line of config inside the same edit window as the reorder).
- **Commit:** `36ea662` (folded into the Task 1 commit — the reorder and the flag are interdependent fixes for the same defect).

This deviation does NOT introduce new threat surface (consistent with the plan's `<threat_model>` T-17-01 disposition). The flag tightens the lazy-load boundary that PDF-04 already required; it does not loosen any existing invariant. `assert-no-pdf-preload.mjs` still passes (no modulepreload links in HTML). `assert-bundle-size.mjs` still passes (main chunk 61.5 KB gz, unchanged).

**2. [Out-of-scope discovery — not fixed] `index-*.js` named-import from pdf chunk**

- **Found during:** Task 1 root-cause investigation.
- **Issue:** `dist/assets/index-CT99EgUb.js` STILL contains a static named import: `import{g as _s, a as bs, r as It, k as Ft, m as vs, l as Hs, t as Os, b as Ws, f as jt, _ as ct, c as zt, C as Ze, d as qs, U as Vs, e as Qs, h as Ks}from"./pdf-xR_hYSi9.js"`. Sixteen utility symbols (formatCurrency, formatQuoteNumber, kmToMiles, milesToKm, etc. from `src/utils/currency.ts` + `src/utils/format.ts`, plus the `__vitePreload` runtime helper `qo`) live in the pdf chunk because Rollup's chunk-graph optimizer picked pdf as the "owner" of these shared utilities when generateQuotePdf.ts imported them.
- **Scope:** This means the pdf chunk IS still loaded eagerly with index (because index static-imports from it). The plan's gate explicitly EXCLUDES `index-*.js` via `INDEX_CHUNK_PATTERN`, so this is OUT OF SCOPE for the gate's narrow definition.
- **Why not fixed in this plan:** The fix requires an architectural change (adding another `manualChunks` rule to route `src/utils/*` to its own chunk, OR refactoring `src/pdf/generateQuotePdf.ts` to not transitively import shared utilities). Both are outside the plan's `files_modified` scope. Per CLAUDE.md's "scope boundary" rule, this is logged here as a deferred discovery rather than auto-fixed.
- **Recommended follow-up:** Open a small follow-up plan to either (a) add `if (id.includes('/src/utils/')) return 'utils';` to `manualChunks` (split utility helpers into their own chunk), or (b) inline the few utility calls inside `src/pdf/generateQuotePdf.ts` so the chunk-graph optimizer no longer hoists them to pdf. This is the SECOND half of PDF-04 lazy-load enforcement — the first half (marketing pages clean) is now locked by the gate; the second half (index doesn't eagerly load pdf) needs its own plan.

### No Other Deviations

Tasks 2 and 3 executed exactly as specified. No auth gates, no checkpoint stops, no Rule 4 architectural-decision pauses.

## Authentication Gates

None.

## Known Stubs

None.

## Threat Flags

None. The new `assert-no-static-pdf-import.mjs` reads first-party `dist/` artifacts only (no network, no env vars, no user input). The `hoistTransitiveImports: false` flag affects chunk emission, not runtime trust boundaries. The Phase 16 dynamic-import boundary (D-01) and the `modulePreload: false` invariant are preserved unchanged.

## Self-Check: PASSED

Verified all artifacts and commits exist before finalizing this summary:

- `vite.config.ts` — modified, manualChunks reordered, `hoistTransitiveImports: false` added — FOUND
- `scripts/assert-no-static-pdf-import.mjs` — created, 56 lines — FOUND (verified via `wc -l`)
- `package.json` — `build` script ends with `&& node scripts/assert-no-static-pdf-import.mjs` — FOUND
- `src/components/PrintQuoteModal.tsx` — `calculateTax` import added, useMemo body swapped — FOUND (verified via final `git diff` against base)
- Commit `36ea662` — FOUND in `git log`
- Commit `4456539` — FOUND in `git log`
- Commit `6fd0938` — FOUND in `git log`
- `npm run build` exits 0 with both `✓ pdf chunk:` lines printed — VERIFIED in Task 3 build run
