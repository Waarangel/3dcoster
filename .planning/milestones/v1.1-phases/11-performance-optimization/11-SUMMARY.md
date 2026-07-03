---
phase: 11-performance-optimization
status: complete
milestone: v1.1
requirements:
  - PERF-01
  - PERF-02
tags:
  - vendor-chunking
  - virtualization
  - react-window
  - bundle-gate
plans_completed: 6
metrics:
  duration: "~50 min across 6 plans"
  completed_date: "2026-05-20"
  main_chunk_gzipped_kb: 45.0
  headroom_kb: 255
ships_with: v1.2
new_badge: false
---

# Phase 11: Performance Optimization Summary

## 1. Phase Goal & Outcome

**ROADMAP Phase 11 goal (verbatim):**

> Vite produces explicit vendor chunks that keep the main app bundle under 300 KB gzipped; jobs and asset lists use virtualization for lists exceeding 100 items and remain smooth under 4× CPU throttle

**Success criteria — all four passed:**

1. ✓ **`vite.config.ts` defines `build.rollupOptions.output.manualChunks` splitting React runtime and Dexie into separate vendor chunks** — Plan 02 wired the 3-tier `manualChunks` function (`react-vendor`, `dexie-vendor`, `vendor`). Confirmed by `dist/assets/react-vendor-*.js`, `dist/assets/dexie-vendor-*.js`, `dist/assets/vendor-*.js` all emitting.
2. ✓ **Main app chunk under 300 KB gzipped** — measured at **45.0 KB gzipped** (`index-*.js`), with 255 KB of headroom. Plan 03's `scripts/assert-bundle-size.mjs` hard-gates this on every `npm run build` (PERF-01 build-time enforcement).
3. ✓ **Jobs list and asset library use virtualization when item count exceeds 100; scrolling a 500-item test list under 4× CPU slowdown produces no dropped frames** — Plan 04 virtualized JobsManager above 100 jobs via react-window v2 `<List>` + `useDynamicRowHeight`; Plan 05 virtualized AssetLibrary's three call sites above 50 items/page. Plan 06 manual UAT confirmed smooth scroll under 4× CPU throttle in DevTools (PERF-02).
4. ✓ **Lists with fewer than 100 items render identically to pre-Phase-11** — JobsManager `<=100` path renders `<JobCard>` directly through `<div className="space-y-3">` (byte-for-byte preserved). AssetLibrary `<=50/page` path renders `paginatedAssets.map(...)` exactly as before. The default `itemsPerPage = 10` means typical users never trigger virtualization.

## 2. What Shipped

- **Plan 01** — Installed `react-window@2.2.7` (runtime dep, ^2 per D-05) and `rollup-plugin-visualizer@5.14.0` (devDep, ^5 per D-10 — NOT bumped). Added `scripts.analyze` running `vite build --mode analyze`. Package-legitimacy checkpoint (T-11-SC) signed off by orchestrator on 2026-05-20 — both packages verified canonical (`brianvaughn/react-window`, `btd/rollup-plugin-visualizer`).
- **Plan 02** — Switched `vite.config.ts` to functional `defineConfig(({ mode }) => ({...}))` and added `build.rollupOptions.output.manualChunks` with 3-tier branching: React/react-dom → `react-vendor`, Dexie/dexie-react-hooks → `dexie-vendor`, everything else from node_modules → `vendor`. Visualizer is opt-in only — gated on `mode === 'analyze'` via spread-empty-array plugin entry, so default Vercel deploys pay zero analyzer cost. 4 pre-existing route lazy chunks (LandingPage / FeaturesPage / DownloadPage / FAQPage) preserved per D-03.
- **Plan 03** — Created `scripts/assert-bundle-size.mjs` (38 lines, Node built-ins only — `fs`, `zlib`, `path`). Reads the largest `dist/assets/index-*.js`, gzips it in-memory, and exits 1 if it exceeds 307200 bytes (300 KB). Appended LAST in `scripts.build` chain (5 commands: `lint-html → vitest+coverage → tsc → vite build → assert-bundle-size`). Negative test verified with `crypto.randomBytes()` (high-entropy noise — `Buffer.alloc(N, 'x')` compresses to near-zero and produces a misleading green).
- **Plan 04** — Virtualized JobsManager above 100 jobs using react-window v2 `<List>` + `useDynamicRowHeight({ defaultRowHeight: 88, key: selectedJobId ?? '' })`. Selection toggles invalidate the cache via the `key` arg — the v2 `DynamicRowHeight` object has **no `.reset()` method** (verified against `node_modules/react-window/dist/react-window.d.ts`), so `key` is the only v2-idiomatic invalidation path. This was the **design Q2 resolution**. Plain `JobCard` + thin `JobRow` adapter pattern keeps the small-list branch (`<=100`) byte-identical to pre-edit.
- **Plan 05** — Virtualized AssetLibrary's three `paginatedAssets.map(...)` call sites (mobile cards, printer table, materials table) above 50 items/page. **Design Q1 resolved by replacing the two desktop `<table>` blocks with `<div>`-based grids** (`grid grid-cols-7` for printer, `grid grid-cols-6` for materials) carrying ARIA `role="row"` / `role="columnheader"` / `role="cell"`. The iteration-1 `tagName="tbody"` + `<colgroup>` approach was rejected as structurally broken — `<col>` widths don't apply once react-window forces `display:block` on `<tbody>` for absolute row positioning. Six new sub-components (3 plain Row + 3 RowComponentProps adapters) follow the JobsManager 11-04 pattern.
- **Plan 06** — Ran the manual UAT (500-job scroll under 4× CPU throttle in DevTools Performance tab, expand/collapse correctness on 3 sampled jobs, AssetLibrary at 100/page including the 20% notes+tags clipping check) — user reply: **approved, all UAT items passed, no clipping observed at numeric `rowHeight={56}`**. Wrote this phase SUMMARY. **Design Q3 resolution = DevTools console snippets embedded HERE (section 4), no `scripts/seed-test-jobs.mjs` checked in** — keeps the seed ephemeral, matches CONTEXT.md "Specifics" exactly.

## 3. Decisions Honored

| ID | Decision | Disposition |
|----|----------|-------------|
| D-01 | `build.rollupOptions.output.manualChunks` in `vite.config.ts` → 3 named chunks (`react-vendor`, `dexie-vendor`, `vendor`); function-style for clarity | ✓ honored (Plan 02) |
| D-02 | No granular per-library chunking — 3 chunks is the caching/HTTP sweet spot | ✓ honored (Plan 02); reconsider only if main chunk grows past 250 KB gzipped |
| D-03 | Preserve route-level code-splitting (LandingPage, FeaturesPage, DownloadPage, FAQPage stay separate dynamic-import chunks) | ✓ honored (Plan 02) — all 4 route chunks emit |
| D-04 | Target metric: main app chunk < 300 KB gzipped | ✓ honored — measured at 45.0 KB (255 KB headroom) |
| D-05 | `react-window@^2` runtime dep (chosen over `@tanstack/react-virtual` for smaller bundle footprint) | ✓ honored (Plan 01) — resolved to 2.2.7 |
| D-06 | JobsManager: virtualize `jobs.map(...)` when `jobs.length > 100`; below 100, render flat list as today | ✓ honored (Plan 04) |
| D-07 | AssetLibrary: pagination stays primary UX; virtualize within-page list when `effectiveItemsPerPage > 50`; all three call sites virtualized when triggered | ✓ honored (Plan 05) |
| D-08 | Bias toward fixed sizing; fall back to dynamic only if visual breakage | ↻ refined — JobsManager required `useDynamicRowHeight` from the start due to bimodal collapsed (88px) / expanded (~400px) cards; AssetLibrary uses fixed `rowHeight={280}` for mobile cards and fixed `rowHeight={56}` for table rows (no breakage observed in UAT) |
| D-09 | `scripts/assert-bundle-size.mjs` reads `dist/assets/index-*.js`, gzips in-memory, exits 1 if > 307200 bytes; runs AFTER `vite build` | ✓ honored (Plan 03) — order locked at the END of the 5-command chain |
| D-10 | `rollup-plugin-visualizer` as devDep, `scripts.analyze` opt-in only, NOT in default build chain | ✓ honored (Plan 01 + Plan 02); orchestrator-approved retention at ^5 (not bumped to ^7) |
| D-11 | 300 KB gzipped threshold hard-locked; bumping requires explicit decision trail | ✓ honored (Plan 03) — inline `MAX_GZIPPED_BYTES = 307200; // 300 KB — PERF-01 / D-11; bumping requires explicit decision trail` for git-blame traceability |
| D-12 | Bundle-size verification automated via D-09's build gate | ✓ honored (Plan 03) — fails fast and visibly on every `npm run build` |
| D-13 | Virtualization smoothness verified manually for v1.1 — 500-item Jobs fixture, DevTools 4× CPU throttle, no dropped frames; document procedure in SUMMARY | ✓ honored (Plan 06) — UAT passed; full procedure embedded in section 4 below |

## 4. How to Repeat the UAT

The DevTools console snippets below are the **design Q3 resolution**: no `scripts/seed-test-jobs.mjs` is checked into the repo because Dexie is browser-only and the seed should be ephemeral. Future maintainers paste these verbatim into the running app's DevTools console to reproduce the UAT.

**Snippets target the verified Dexie tables from `src/db/database.ts`:** `db.jobs` (for `PrintJob`) and `db.materials` (the `materials` table holds ALL assets, including `category: 'printer'`). The `db` object is imported from `'/src/db/database.ts'` (NOT `/src/db.ts` — that path does not exist).

### Setup

1. `npm run dev` (port 4173 — kill any other dev servers first per `.claude/CLAUDE.md`)
2. Open `http://localhost:4173` in a Chromium-based browser (Chrome / Edge / Brave)
3. Open DevTools (F12), Console tab
4. Paste the **seed-500-jobs** snippet and press Enter — adds 500 fake jobs to Dexie's `jobs` table
5. Paste the **seed-200-printers** snippet — adds 200 fake printer assets to Dexie's `materials` table (with 20% carrying notes+tags per W3)
6. Refresh the page

### Seed snippet: jobs (paste verbatim into DevTools console)

The `PrintJob` field set is derived from `src/types.ts:139-175`. Cross-check the snippet against the live interface in `src/types.ts` BEFORE running — if `PrintJob` has acquired new required fields, update the snippet accordingly.

```
(async () => {
  const { db } = await import('/src/db/database.ts');
  const now = Date.now();
  const jobs = Array.from({ length: 500 }, (_, i) => ({
    id: `uat-${now}-${i}`,
    name: `UAT Job ${i + 1}`,
    createdAt: new Date(),
    updatedAt: new Date(),
    filaments: [{ filamentId: '', grams: 50 + (i % 100) }],
    printTimeHours: 1 + (i % 8),
    printerInstanceId: '',
    modelCost: 0,
    prepTimeMinutes: 5,
    postProcessingMinutes: 10,
    materialsUsed: [],
    failureRate: 0.05,
    costPerUnit: 5 + (i % 20),
    sellingPrice: 15 + (i % 30),
    copiesSold: i % 5,
  }));
  await db.jobs.bulkAdd(jobs);
  console.log(`Seeded 500 UAT jobs. Prefix: uat-${now}`);
})();
```

### Seed snippet: printer assets, 20% with notes+tags (paste verbatim into DevTools console)

The `PrinterAsset` field set is derived from `src/types.ts:39-75`. 20% of seeded entries carry `notes` (multi-line) AND `tags` (3-tag array) — the W3 clipping fixture for Plan 05's numeric `rowHeight={56}`. Note: the snippet uses `db.materials.bulkAdd(...)` because the `materials` table holds ALL assets in this schema (including `category: 'printer'`) — there is no separate assets table.

```
(async () => {
  const { db } = await import('/src/db/database.ts');
  const now = Date.now();
  const assets = Array.from({ length: 200 }, (_, i) => {
    const carriesNotes = i % 5 === 0; // 20% subset
    return {
      id: `uat-asset-${now}-${i}`,
      name: `UAT Printer ${i + 1}`,
      category: 'printer',
      brand: `Brand ${i % 10}`,
      currency: 'USD',
      purchasePrice: 500 + i * 5,
      expectedLifespanHours: 5000,
      wattage: 100 + (i % 50),
      nozzleCost: 5 + (i % 10),
      nozzleLifespanCm3: 1000,
      ...(carriesNotes ? {
        notes: `Long note line 1 for UAT printer ${i + 1}.\nLine 2 — extra info that may wrap vertically.\nLine 3 — clipping test content.`,
        tags: ['fdm', 'enclosed', 'multi-color'],
      } : {}),
    };
  });
  await db.materials.bulkAdd(assets);
  console.log(`Seeded 200 UAT printer assets (40 with notes+tags). Prefix: uat-asset-${now}`);
})();
```

### UAT procedure — JobsManager (PERF-02)

7. DevTools → Performance tab → gear icon → set "CPU" to "4× slowdown"
8. Click the red "Record" circle
9. Scroll the Jobs list from top to bottom and back to top (about 5 seconds)
10. Stop the recording
11. In the Performance flame chart, look at the "Frames" track at the top — green (≤16.7ms), yellow, or red
12. **Pass criterion:** no red frames; ideally ≥95% green. Yellow tolerated if rare and the perception is smooth.
13. Click 3 different jobs (top / middle / bottom). Each card must expand without overlapping neighbours; re-click collapses cleanly.
14. Reset CPU throttle to "No throttling".

### UAT procedure — AssetLibrary

15. Refresh, switch to Asset Library, set items-per-page to "100". Confirm:
    - 100 rows render
    - Scrolling is smooth (visual judgement sufficient at 100 rows)
    - Printer table div-grid column alignment matches across header and rows
    - 20% notes+tags rows: check whether `rowHeight={56}` clips (informs T-11-CLIP2 follow-up)
    - Sort header clicks re-order rows correctly
    - Edit on any row opens the edit form for THAT row's asset (closure correctness)
    - Delete on any row removes only that row
16. Switch back to "10/page" — confirm the layout is the same div-grid shape but without virtualization wrappers

### Cleanup

17. Paste into DevTools console — deletes by `uat-` prefix from BOTH `db.jobs` AND `db.materials`:

```
(async () => {
  const { db } = await import('/src/db/database.ts');
  const jobsDeleted = await db.jobs.where('id').startsWith('uat-').delete();
  const materialsDeleted = await db.materials.where('id').startsWith('uat-').delete();
  console.log(`Cleaned up: ${jobsDeleted} jobs, ${materialsDeleted} materials`);
})();
```

Refresh the page; verify the Jobs and Asset Library tabs return to their pre-UAT state.

### UAT result (2026-05-20)

Human-reported: **approved** — all UAT items passed:
- No clipping observed at numeric `rowHeight={56}` with the notes+tags 20% subset
- Smooth scroll under 4× CPU throttle in JobsManager (no dropped frames)
- AssetLibrary at 100/page: smooth, correct column alignment, sort works, Edit/Delete behavior correct

## 5. Bundle Composition (post-split)

Captured from a clean default `npm run build` (Plan 02 baseline; Plan 03's gate measures the main chunk on every build thereafter).

| Chunk | Filename | Raw KB | Gzipped KB |
|-------|----------|--------|------------|
| Main app | `dist/assets/index-Dtce8U6u.js` | 195.43 | **45.56** |
| React vendor | `dist/assets/react-vendor-WStCuO__.js` | 190.94 | 59.94 |
| Other vendors | `dist/assets/vendor-Bu2k-o6b.js` | 154.87 | 50.60 |
| Dexie vendor | `dist/assets/dexie-vendor-4i-0Q9rj.js` | 97.08 | 32.43 |

**Largest contributor to `vendor-*.js`:** `jszip` (~95 KB minified, used for 3MF / G-code archive parsing) — by itself it accounts for roughly 60% of the `vendor` chunk's raw size. If `vendor` ever needs trimming, code-splitting the 3MF parser into a dynamic import is the obvious next lever.

**Headroom under the 300 KB PERF-01 budget:** 300 − 45.56 ≈ **254 KB remaining** for the main chunk. Plan 03's gate prints the actual measured size on every successful build so headroom shrink is visible over time.

**Route lazy chunks preserved** (per D-03): `LandingPage` (4.70 KB gz), `FeaturesPage` (2.31 KB gz), `DownloadPage` (2.70 KB gz), `FAQPage` (3.17 KB gz), plus the pre-existing `ChangelogPage`, `FeedbackPage`, `Header` dynamic splits.

## 6. Threat-Model Status

| Threat ID | Status | Evidence |
|-----------|--------|----------|
| **T-11-SC** (supply-chain — react-window / rollup-plugin-visualizer legitimacy) | **Mitigated** | Plan 01 package-legitimacy checkpoint signed off by orchestrator 2026-05-20; canonical maintainers (`brianvaughn/react-window`, `btd/rollup-plugin-visualizer`) verified. |
| **T-11-LK** (visualizer leaks into production builds) | **Mitigated** | Plan 02: visualizer gated on `mode === 'analyze'` via spread-empty-array plugin entry. Default `npm run build` does NOT produce `dist/stats.html` — verified by absence-check. |
| **T-11-LK2** (assert-bundle-size collision with existing build chain) | **Mitigated** | Plan 01: `scripts.build` left UNTOUCHED. Plan 03: bundle gate appended LAST in the chain (`b.endsWith('&& node scripts/assert-bundle-size.mjs')` regression-guard). |
| **T-11-GATE** (silent 300 KB threshold drift) | **Mitigated** | Plan 03: `MAX_GZIPPED_BYTES = 307200; // 300 KB — PERF-01 / D-11; bumping requires explicit decision trail` — inline provenance makes any future bump visible in `git blame`. |
| **T-11-DISTLESS** (missing `dist/` produces false-pass) | **Mitigated** | Plan 03: explicit `candidates.length === 0` branch exits 1 with directive error pointing at `vite build`. Verified by deleting `dist/` and re-running. |
| **T-11-COLALIGN** (div-grid table column misalignment) | **Mitigated** | Plan 05: matching `grid grid-cols-N` Tailwind utility on BOTH the header row and every data row. Verified visually in UAT — printer table columns (`Printer / Brand / Type / Price / Wattage / Nozzle / Actions`) line up cleanly. |
| **T-11-CLIP** (JobsManager bimodal-card clipping at fixed height) | **Mitigated + verified by human UAT 2026-05-20** | Plan 04: `useDynamicRowHeight({ defaultRowHeight: 88, key: selectedJobId ?? '' })` lets cards measure their own height; selection-driven `key` arg invalidates the cache so expand/collapse round-trips correctly. UAT confirmed no clipping; expand/collapse smooth on 3 sampled jobs. |
| **T-11-CLIP2** (AssetLibrary `rowHeight={56}` clipping with notes+tags) | **Mitigated — verified by human UAT 2026-05-20: no clipping observed at numeric `rowHeight={56}` with notes+tags subset; `useDynamicRowHeight` swap deferred unless future regression** | Plan 05 used fixed `rowHeight={56}` with the explicit caveat that 20% of seeded printer assets carrying notes+tags would surface clipping if it occurred. Plan 06 UAT exercised that fixture and reported no clipping. |
| **T-11-A11Y2** (loss of `<table>` semantic markup in AssetLibrary) | **Accept** (documented) | Plan 05: ARIA `role="row"` / `role="columnheader"` / `role="cell"` provide screen-reader-equivalent semantics. Full semantic markup loss is accepted; future a11y hardening is deferred. |
| **T-11-UATLEAK** (UAT seed data persists in real Dexie) | **Mitigated** | Plan 06 cleanup snippet (section 4 above) deletes by `uat-` prefix from BOTH `db.jobs` AND `db.materials`. Documented prominently. |
| **T-11-DEVVSBUILD** (UAT runs dev server, not prod bundle) | **Accept** | Documented limitation; Plan 03's build-time gate already verifies prod bundle is healthy; virtualization behavior is identical between dev and prod (react-window has no env-conditional paths). Optional follow-up: re-run UAT against `npm run preview`. |
| **T-11-SEEDDRIFT** (seed snippets diverge from `src/types.ts`) | **Mitigated** | Section 4 instructs future maintainers to cross-check the snippet against `src/types.ts` before running. |

## 7. Pointers for v1.2 / future phases

- **If the main chunk grows past 250 KB gzipped**, reconsider granular per-library chunking (D-02's "Deferred Ideas" — D-02 reconsideration trigger). Current measured value (45.0 KB) leaves substantial headroom but the trigger is set well below the 300 KB hard gate so a future bump arrives with planning lead time.
- **The 20% notes+tags clipping fixture remains in the SUMMARY's section 4 seed snippet** — if a future change to AssetLibrary row content (e.g., adding additional inline metadata) causes clipping at `rowHeight={56}`, re-run the UAT to confirm the regression. The fix is a localized swap to `useDynamicRowHeight({ defaultRowHeight: 56 })` (the JobsManager pattern from Plan 04), keeping every other piece of the call site intact.
- **The div-grid replacement (Plan 05) lost native `<table>` markup.** If a future accessibility audit requires `<table>` semantics back, design Q1 needs revisiting — likely via a CSS-only solution that keeps `<table>` layout intact alongside virtualization (e.g., not virtualizing tables at all and accepting the perf cost above 50/page), since the iteration-1 `tagName="tbody"` + `<colgroup>` approach was already proven structurally broken.
- **Automated perf testing (Playwright / Lighthouse) belongs in v2 alongside E2E** per TEST-F1 in REQUIREMENTS.md. Manual UAT per D-13 was the deliberate v1.1 choice.
- **Rollup circular-chunk warning** (`Circular chunk: vendor -> react-vendor -> vendor`) is documented in Plan 02 SUMMARY — non-fatal, build succeeds, all chunks emit, app runs correctly. Caused by `scheduler` (in `vendor` per the fallback rule) being a runtime peer of `react-dom` (in `react-vendor`). Not fixing now because resolving cleanly would either change chunk boundaries (drifting from D-01) or split `vendor` further (forbidden by D-02). The 300 KB gate is the real signal for chunk-allocation health, and it is green.

## 8. Files Modified

Across all 6 plans:

| File | Plan | Reason |
|------|------|--------|
| `package.json` | 01, 03 | Add `react-window@^2.2.7` runtime dep, `rollup-plugin-visualizer@^5.14.0` devDep, `scripts.analyze`, append bundle-size assertion to `scripts.build` |
| `package-lock.json` | 01 | Lockfile regeneration after `npm install` (619 packages added) |
| `vite.config.ts` | 02 | Functional `defineConfig(({ mode }) => ({...}))` + `build.rollupOptions.output.manualChunks` (3-tier split) + conditional `rollup-plugin-visualizer` gated on `mode === 'analyze'` |
| `scripts/assert-bundle-size.mjs` | 03 | NEW — 38-line Node CLI build gate; reads largest `dist/assets/index-*.js`, gzips in-memory, exits 1 above 307200 bytes |
| `src/components/JobsManager.tsx` | 04 | Add `import { List, useDynamicRowHeight, type RowComponentProps }`; declare `useDynamicRowHeight` cache; extract `JobCard` (plain) + `JobRow` (RowComponentProps adapter); replace `jobs.map(...)` seam with `jobs.length > 100 ? <List> : <flatmap>` ternary |
| `src/components/AssetLibrary.tsx` | 05 | Add react-window import; declare 6 sub-components (`MobileCardItem`/`MobileCardRow`, `PrinterRow`/`PrinterRowAdapter`, `MaterialRow`/`MaterialRowAdapter`); replace two desktop `<table>` blocks with `<div>`-grid markup (`grid grid-cols-7` printer, `grid grid-cols-6` materials) carrying ARIA `role="row"`/`columnheader`/`cell`; wire `effectiveItemsPerPage > 50` virtualization gate at all three call sites |
| `.planning/phases/11-performance-optimization/11-01-SUMMARY.md` through `11-05-SUMMARY.md` | each plan | Per-plan summaries (5 total) |
| `.planning/phases/11-performance-optimization/11-SUMMARY.md` | 06 | THIS file — phase-level wrap-up |

**No `scripts/seed-test-jobs.mjs` was created** (design Q3 resolution — seed snippets live in section 4 only).

## 9. NEW Badge

**NOT added.**

Phase 11 is an infrastructure improvement: vendor chunk splitting + list virtualization. End users perceive faster startup and smoother scrolling but they never see a new feature surface. Per the project memory rule:

> "Could the user describe what changed without reading the changelog?"

No — the user cannot describe what changed. There is no new tab, button, screen, control, or visible behavior. A NEW badge here would draw attention to nothing and dilute the signal of real new features. Per CONTEXT.md "Out of scope" — infrastructure improvement is invisible to users — and per the global NEW badge rule, no entry was added to `src/features.ts` and no `<NewBadge>` was placed.

Phase 11 ships bundled with the v1.2 release per CONTEXT.md's "ship together as part of the v1.2 release" note — the user-facing v1.2 features will carry their own badges and the performance work rides along silently.

---

*Phase: 11-performance-optimization*
*Plans completed: 6 of 6*
*Completed: 2026-05-20*
*Requirements satisfied: PERF-01, PERF-02*
