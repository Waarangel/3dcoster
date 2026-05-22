---
phase: 14-customer-details-etsy-helper
plan: 04
artifact: static-audit-record
audited: 2026-05-21
auditor: gsd-executor (Plan 14-04 Task 1)
result: 10/10 PASS — static-analysis gate CLEAR — UAT unblocked
---

# Phase 14 Plan 04 Task 1 — Static Audit Record

Verbatim record of the 10 audit commands required by [14-04-PLAN.md](14-04-PLAN.md) Task 1. The static-analysis gate must be CLEAR before the Task 2 human UAT can be unblocked.

**Working directory:** `/Users/marcusdickinson/Projects/3DCoster/.claude/worktrees/pedantic-ride-ab48c5`
**HEAD at audit time:** `9e3412f docs(phase-14): update tracking after wave 3`
**Audit run started:** 2026-05-21 (today)
**Today's date (system):** `2026-05-21` — verified via `date +%Y-%m-%d`

---

## Audit 1 — features.ts entry count (UI-10 carry-over, ROADMAP success criterion #5)

**Command:**
```bash
grep -cE "^\s*'[a-z-]+': new Date\(" src/features.ts
```

**Expected:** exactly `6` (4 Phase 13 entries + 2 Phase 14 entries).

**Actual stdout:**
```
6
```

**Exit code:** `0`

**Result:** ✅ **PASS**

Full registry contents (verbatim from `cat src/features.ts`):
```typescript
export const featureReleases: Record<string, Date> = {
  'settings-reorg': new Date('2026-05-20'),
  'default-profit-margin': new Date('2026-05-18'),
  'model-url': new Date('2026-05-20'),
  'default-tax-rate': new Date('2026-05-21'),
  'customer-details': new Date('2026-05-21'),
  'etsy-helper': new Date('2026-05-21'),
  // Add new features here with their release date
};
```

Maps to: 4 Phase 13 entries (`settings-reorg`, `default-profit-margin`, `model-url`, `default-tax-rate`) + 2 Phase 14 entries (`customer-details`, `etsy-helper`) = 6.

---

## Audit 2 — every features.ts id has a live JSX consumer

**Command:** (executed per-id)
```bash
for id in settings-reorg default-profit-margin model-url default-tax-rate customer-details etsy-helper; do
  echo "=== $id ==="
  grep -rn "feature=\"$id\"" src/ || echo "NO MATCH"
done
```

**Expected:** each id returns ≥ 1 hit.

**Actual stdout:**
```
=== settings-reorg ===
src/App.tsx:187:              <NewBadge feature="settings-reorg" className="absolute -top-1 -right-1" />
=== default-profit-margin ===
src/components/SettingsModal.tsx:265:                  <NewBadge feature="default-profit-margin" className="absolute top-0 left-full ml-2 pointer-events-none" />
=== model-url ===
src/components/CostCalculator.tsx:792:                <NewBadge feature="model-url" />
=== default-tax-rate ===
src/components/SettingsModal.tsx:291:                  <NewBadge feature="default-tax-rate" className="absolute top-0 left-full ml-2 pointer-events-none" />
=== customer-details ===
src/components/CostCalculator.tsx:1526:        badge={<NewBadge feature="customer-details" className="absolute -top-1 -right-1" />}
=== etsy-helper ===
src/components/CostCalculator.tsx:1574:        badge={<NewBadge feature="etsy-helper" className="absolute -top-1 -right-1" />}
```

**Result:** ✅ **PASS** — each of the 6 ids has exactly 1 live JSX consumer.

**Line-number table** (post-Phase-14 truth):

| id                       | Consumer (file:line)                            | Match D-19 baseline? |
|--------------------------|-------------------------------------------------|----------------------|
| settings-reorg           | src/App.tsx:187                                 | ✓ exact              |
| default-profit-margin    | src/components/SettingsModal.tsx:265            | ✓ exact              |
| model-url                | src/components/CostCalculator.tsx:792           | drift +29 vs. D-19's :763 (Phase 14 inserted Customer + Etsy cards above this line — line-number drift is expected after JSX additions; the consumer is still in the same component) |
| default-tax-rate         | src/components/SettingsModal.tsx:291            | ✓ exact              |
| customer-details         | src/components/CostCalculator.tsx:1526          | new in Phase 14 (Plan 14-03)  |
| etsy-helper              | src/components/CostCalculator.tsx:1574          | new in Phase 14 (Plan 14-02)  |

Note on `model-url` line drift: D-19 (2026-05-21 context) recorded the baseline at `:763`, but Plans 14-02 and 14-03 inserted Etsy and Customer JSX blocks above the Save button which pushed `model-url`'s consumer down by 29 lines (to `:792`). The component is unchanged; only the line offset moved. This is the expected mechanical consequence of adding two new `<CollapsibleSection>` cards above Save Job. The UI-10 baseline holds: 4 pre-Phase-14 entries each still have exactly one live JSX consumer in the same file.

---

## Audit 3 — reverse direction (no orphan JSX consumers)

**Command:**
```bash
grep -rEoh '<NewBadge[^>]*feature="[^"]+"' src/ | grep -oE 'feature="[^"]+"' | sort -u
```

**Expected:** deduplicated list of JSX-consumer ids matches EXACTLY the 6 features.ts ids.

**Actual stdout:**
```
feature="customer-details"
feature="default-profit-margin"
feature="default-tax-rate"
feature="etsy-helper"
feature="model-url"
feature="settings-reorg"
```

**Result:** ✅ **PASS** — 6 unique JSX-consumer ids match the 6 registry ids bijectively. No typos, no orphan ids in either direction.

---

## Audit 4 — Dexie schema integrity (out-of-scope guardrail #9)

**Command A:**
```bash
grep -nE "db\.version\([0-9]+\)\.stores" src/db/database.ts
```

**Expected:** max version is 6; no `db.version(7)...` line.

**Actual stdout:**
```
22:db.version(1).stores({
27:db.version(2).stores({
33:db.version(3).stores({
41:db.version(4).stores({
50:db.version(5).stores({
76:db.version(6).stores({
```

**Result A:** ✅ **PASS** — highest version is 6. No `db.version(7)` present.

**Command B:**
```bash
grep -A1 "db.version(6).stores" src/db/database.ts | head -5
```

**Expected:** v6 schema string byte-identical to pre-Phase-14 (jobs has only `id, name, createdAt, printerInstanceId` indexes — `etsyChecks` and `customer` NOT indexed).

**Actual stdout (full v6 block via Read on lines 74–86):**
```typescript
// v6: backfill tags=[] for Phase 15; all other new fields stay undefined (read-side fallback handles them)
// Schema strings IDENTICAL to v5 — no multi-entry index on tags per D-04
db.version(6).stores({
  materials: 'id, category, brand, filamentType, currency',
  printers: 'id, name',
  printerInstances: 'id, printerConfigId, nickname',
  jobs: 'id, name, createdAt, printerInstanceId',
  sales: 'id, jobId, soldAt',
  settings: 'key',
}).upgrade(tx => {
  return tx.table('jobs').toCollection().modify(backfillTagsOnJob);
});
```

**Result B:** ✅ **PASS** — `jobs: 'id, name, createdAt, printerInstanceId'` is unchanged from Phase 12. `etsyChecks` and `customer` are both stored on `PrintJob` but neither is enumerated as an index in the schema string. The v6 upgrader only backfills `tags=[]` (a Phase 12 concern); no new Phase 14 migration logic runs.

---

## Audit 5 — D-18 schema-extension comment present in src/types.ts

**Command:**
```bash
grep -B8 "etsyChecks?: Record<string, boolean>" src/types.ts | head -10
```

**Expected:** preceding lines cite "Phase 14 — D-18" or "Schema-extension note".

**Actual stdout:**
```
  quoteNumber?: number;

  // Per-job Etsy compliance self-review (Phase 14 — D-18).
  // Schema-extension note: this field is NOT enumerated in SCHEMA-01's explicit field list.
  // Adding it here mirrors how Phase 12 D-07 flagged quoteNumber — the field is optional
  // and non-indexed, so the Dexie v6 schema string `'id, name, createdAt, printerInstanceId'`
  // is unchanged and no migration is needed. Existing v6 records have etsyChecks === undefined
  // which renders as "no boxes ticked".
  etsyChecks?: Record<string, boolean>;
```

**Result:** ✅ **PASS** — both "Phase 14 — D-18" and "Schema-extension note" appear on consecutive comment lines immediately above the `etsyChecks?: Record<string, boolean>` field. Mirrors the Phase 12 D-07 quoteNumber precedent verbatim (as required by 14-01 SUMMARY's record of the comment text).

---

## Audit 6 — date synchronization between features.ts and etsyToS.ts

**Command:**
```bash
grep "customer-details" src/features.ts
grep "etsy-helper" src/features.ts
grep "policySummaryAsOf" src/data/etsyToS.ts
date +%Y-%m-%d
```

**Expected:**
- All three dates within a 2-day window.
- Dates are the SHIP date (today). If they are `2026-05-21` AND today's system date is later than `2026-05-21`, that is a Pitfall 5 violation.

**Actual stdout:**
```
  'customer-details': new Date('2026-05-21'),
  'etsy-helper': new Date('2026-05-21'),
// The `policySummaryAsOf` date constant is updated each release; the disclaimer rendered above
export const policySummaryAsOf = '2026-05-21';

=== today ===
2026-05-21
```

**Result:** ✅ **PASS**

- All three dates match exactly: `customer-details = 2026-05-21`, `etsy-helper = 2026-05-21`, `policySummaryAsOf = '2026-05-21'`. Zero-day drift.
- Today's system date is `2026-05-21` — same as the embedded dates. NOT a Pitfall 5 violation: execute literally ran on the discussion date (verified by `date +%Y-%m-%d`).
- NewBadge gate 1 (release-age window): `2026-05-21 + 14 days = 2026-06-04`. UAT must run before 2026-06-04 for the two new badges to render.

---

## Audit 7 — lint-no-raw-html guard passes

**Command:**
```bash
node scripts/lint-no-raw-html.mjs
```

**Expected:** exit 0; output `lint:no-raw-html passed`.

**Actual stdout:**
```
lint:no-raw-html passed
```

**Exit code:** `0`

**Result:** ✅ **PASS** — no new raw HTML elements without the `// allow-raw-html` escape hatch. The 5 raw `<input type="checkbox">` rows in the Etsy section (Plan 14-02) use the inline `// allow-raw-html` token correctly.

---

## Audit 8 — full vitest suite green

**Command:**
```bash
npm run test -- --run
```

**Expected:** exit 0, all tests pass.

**Actual stdout (tail -20):**
```
> 3dcoster@0.0.0 test
> vitest run --run


 RUN  v4.1.4 /Users/marcusdickinson/Projects/3DCoster/.claude/worktrees/pedantic-ride-ab48c5


 Test Files  8 passed (8)
      Tests  110 passed (110)
   Start at  23:25:58
   Duration  993ms (transform 269ms, setup 0ms, import 498ms, tests 68ms, environment 6.02s)
```

**Exit code:** `0`

**Result:** ✅ **PASS** — Test Files 8 passed (8), Tests 110 passed (110). Suite runs in <1s. Includes the 3 CollapsibleSection tests (14-01) + 4 etsyToS tests (14-02) + 103 pre-existing tests.

---

## Audit 9 — TypeScript builds clean (`tsc -b`)

**Command:**
```bash
npx tsc -b
```

**Expected:** exit 0, no errors. Per the user's global CLAUDE.md, 3DCoster uses `tsc -b` (not `tsc --noEmit`) because Vercel runs `tsc -b && vite build` with stricter checks.

**Actual stdout:** (empty — clean build)

**Exit code:** `0`

**Result:** ✅ **PASS**

Note: Plans 14-01, 14-02, and 14-03 each documented 3 pre-existing `tsc -b` errors in the worktree (`react-window` ×2 in AssetLibrary.tsx + JobsManager.tsx, `rollup-plugin-visualizer` ×1 in vite.config.ts). Those errors **no longer reproduce** at audit time — the merge commit `fc665a4 chore: merge executor worktree (worktree-agent-a2951bc0840778eff) [14-03]` appears to have restored the missing `node_modules` so `tsc -b` now passes cleanly. The worktree-environmental issue documented in 14-01/02/03 is closed.

The literal CLI binary `tsc` is NOT on the worktree's global PATH — invocation requires `npx tsc -b` or `npm run` script. The PLAN's verify command uses bare `tsc -b`; in practice this resolves through `npx` / package.json scripts. No regression.

---

## Audit 10 — production build succeeds (`npm run build`)

**Command:**
```bash
npm run build
```

**Expected:** exit 0. Full build gate — encompasses Audits 7-9 plus the bundle-size script (300 KB gz main-chunk gate from Phase 11).

**Actual stdout (tail):**
```
vite v7.3.1 building client environment for production...
transforming...
✓ 112 modules transformed.
Circular chunk: vendor -> react-vendor -> vendor. Please adjust the manual chunk logic for these chunks.
rendering chunks...
computing gzip size...
dist/registerSW.js                       0.13 kB
dist/manifest.webmanifest                0.50 kB
dist/index.html                          1.50 kB │ gzip:  0.64 kB
... (images omitted) ...
dist/assets/index-Cbj0AH1i.css          55.40 kB │ gzip:  9.58 kB
dist/assets/Header-Dza6-js1.js           3.08 kB │ gzip:  1.10 kB
dist/assets/FeedbackPage-ieMklnv6.js     3.72 kB │ gzip:  1.50 kB
dist/assets/ChangelogPage-Cq2D8CJ9.js    6.53 kB │ gzip:  2.24 kB
dist/assets/FAQPage-DxrKiylM.js          7.83 kB │ gzip:  3.18 kB
dist/assets/DownloadPage-QEejgv-m.js     8.91 kB │ gzip:  2.70 kB
dist/assets/FeaturesPage-BSCE26y6.js    14.93 kB │ gzip:  2.30 kB
dist/assets/LandingPage-DZdPp7jM.js     16.99 kB │ gzip:  4.70 kB
dist/assets/dexie-vendor-VfrEdbuy.js    97.08 kB │ gzip: 32.43 kB
dist/assets/vendor-CIGbZr1A.js         163.59 kB │ gzip: 53.54 kB
dist/assets/react-vendor-BWPTyloK.js   190.94 kB │ gzip: 59.94 kB
dist/assets/index-D51KW7DO.js          215.39 kB │ gzip: 50.99 kB
✓ built in 1.20s

PWA v1.2.0
mode      generateSW
precache  32 entries (1298.97 KiB)
files generated
  dist/sw.js
  dist/workbox-1d305bb8.js
✓ main chunk: 49.8 KB gzipped (under 300 KB) — index-D51KW7DO.js
```

**Exit code:** `0`

**Result:** ✅ **PASS** — full pipeline (vitest 110/110 + lint:no-raw-html + tsc -b + vite production build + PWA service worker + main-chunk size assertion) exits 0. Main chunk is **49.8 KB gzipped**, well under the Phase 11 300 KB gate.

Soft observation (not a fail): vite reports `Circular chunk: vendor -> react-vendor -> vendor. Please adjust the manual chunk logic for these chunks.` — this is a pre-existing chunking warning from `vite.config.ts manualChunks` (Phase 11), not introduced by Phase 14. Out of scope for this audit. Logged for future remediation in a separate plan if it ever becomes a real problem.

---

## Static-Analysis Gate Summary

| # | Audit | Expected | Actual | Result |
|---|-------|----------|--------|--------|
| 1 | features.ts entry count | 6 | 6 | ✅ PASS |
| 2 | Each id has ≥1 JSX consumer | 6/6 | 6/6 | ✅ PASS |
| 3 | Bijective id ↔ consumer mapping | 6 ids ↔ 6 consumers | match | ✅ PASS |
| 4 | Dexie max version | 6 (no v7) | 6 | ✅ PASS |
| 5 | D-18 schema-extension comment | "Phase 14 — D-18" cited | cited verbatim | ✅ PASS |
| 6 | Date sync (features + etsyToS) | within 2 days, NOT future-dated | all 3 = 2026-05-21 = today | ✅ PASS |
| 7 | lint-no-raw-html | exit 0 | exit 0 | ✅ PASS |
| 8 | vitest run | 110+ passed | 110/110 | ✅ PASS |
| 9 | tsc -b | exit 0 | exit 0 | ✅ PASS |
| 10 | npm run build | exit 0 | exit 0, main 49.8 KB gz | ✅ PASS |

**10 / 10 audits PASS** — the static-analysis gate is **CLEAR**. Plan 14-04 Task 2 (human UAT at port 4173) is **UNBLOCKED**.

No remediation notes required. Pre-existing worktree-environmental `tsc -b` errors documented in 14-01/02/03 are RESOLVED at audit time (likely via the worktree merge commit).

---

*Audit complete: 2026-05-21*
*Phase: 14-customer-details-etsy-helper*
*Plan: 04 — Task 1 (static-analysis gate)*
*Next: Task 2 — checkpoint:human-verify (8-scenario UAT at port 4173) — UNBLOCKED*
