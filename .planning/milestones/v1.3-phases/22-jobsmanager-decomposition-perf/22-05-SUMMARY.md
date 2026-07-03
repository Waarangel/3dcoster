---
phase: 22-jobsmanager-decomposition-perf
plan: 05
subsystem: ui
tags: [perf, useMemo, refactor, react, jobsmanager, recordsalemodal, customerlibrary]

requires:
  - phase: 22-jobsmanager-decomposition-perf
    provides: "Plan 22-03 placed calculateMarketplaceFee at module scope inside RecordSaleModal.tsx (PERF-03 already satisfied — this plan only owed PERF-02 useMemo collapse). Plan 22-04 left JobsManager.tsx at 1474 LOC (the perf-pass base)."

provides:
  - "src/components/JobsManager.tsx — module-scope `computeBreakEvenInfo(job, salesByJob)` pure function + `breakEvenMap = useMemo(() => new Map(searchedJobs.map(j => [j.id, computeBreakEvenInfo(j, salesByJob)])), [searchedJobs, salesByJob])` built once per render. JobRowProps.getBreakEvenInfo shape preserved via inline arrow wrapper `(job) => breakEvenMap.get(job.id)!` in rowProps."
  - "src/components/RecordSaleModal.tsx — single `const marketplaceFee = useMemo(() => calculateMarketplaceFee(saleQuantity * salePrice, saleMarketplace), [saleQuantity, salePrice, saleMarketplace])` replaces the 3 redundant in-JSX call sites (Sale Total summary block: Marketplace Fee row + Net Revenue row)."
  - "src/components/CustomerLibrary.tsx — `useDynamicRowHeight({ defaultRowHeight: 88, key: searchQuery })` invalidates the dynamic row-height cache when the customer search filter changes."

affects:
  - "phase 22-jobsmanager-decomposition-perf plan 22-06 (final shrink + PERF-07 lift). 22-06 inherits JobsManager.tsx at 1491 LOC — under the cumulative <1500 ROADMAP gate before any of its own work begins."
  - "phase 23 (test coverage hardening) — break-even logic is now extractable to a unit-tested util if a future plan wants to exercise computeBreakEvenInfo in isolation; today it stays at module scope per the No-Analog rule (single consumer)."

tech-stack:
  added: []
  patterns:
    - "Pre-computed Map memo for per-row derived data: `Map<entityId, ComputedShape>` built once per render via useMemo, consumers do O(1) lookups (mirrors the pattern in Phase 13 — salesByJob — already in the same file)."
    - "Pure-function-at-module-scope + thin-arrow-wrapper-in-props: lift the body once, route via `(entity) => map.get(entity.id)!` at the rowProps construction site to preserve the existing prop shape and keep test fixtures untouched (D-19 / Pitfall 6)."
    - "Per-render useMemo for fee/total computations consumed by multiple JSX sites: one source of truth, dependency array spans the inputs only."
    - "Row-height cache invalidation key on filter state: `useDynamicRowHeight({..., key: filterState })` so virtualized list row heights are re-measured when the visible set changes (mirrors Phase 15 plan 04 D-05)."

key-files:
  created: []
  modified:
    - "src/components/JobsManager.tsx (1474 → 1491 LOC, +17 net — module-scope `computeBreakEvenInfo` block adds ~35 LOC including comments; in-component `getBreakEvenInfo` useCallback deletion subtracts ~32 LOC; net +3 from the breakEvenMap useMemo addition; small comment-trim style commit shaved 9 LOC to keep cumulative <1500 gate slack ahead of 22-06)"
    - "src/components/RecordSaleModal.tsx (627 → 640 LOC, +13 — new `marketplaceFee = useMemo(...)` block with explanatory comment + JSX simplification)"
    - "src/components/CustomerLibrary.tsx (401 → 405 LOC, +4 — one-line edit + 3-line comment)"

key-decisions:
  - "computeBreakEvenInfo stays at module scope inside JobsManager.tsx (NOT extracted to src/utils/computeBreakEven.ts). No 2nd consumer today — No-Analog rule applies. If Phase 23 adds a unit test directly on this function it must export it; today it remains an internal module-scope helper."
  - "JobRowProps shape preserved verbatim (D-19, Pitfall 6) — `getBreakEvenInfo: (job: PrintJob) => BreakEvenInfo` stays a function callable, not a Map. JobCard's prop interface is unchanged; JobsManager.test.tsx's renderJobCard helper passes `info` directly as a prop and is unaffected."
  - "rowProps.getBreakEvenInfo is an inline arrow wrapper at the rowProps construction site, NOT a wrapping useCallback. The plan's literal acceptance criterion `grep -c 'const getBreakEvenInfo = useCallback' == 0` would have been violated by a wrapping useCallback. The arrow's identity changes per render but only when `breakEvenMap` changes (already tracked in the rowProps useMemo deps), so React.memo on JobCard still short-circuits unchanged rows. The non-virtualized fallback reads `breakEvenMap.get(job.id)!` directly."
  - "rowProps useMemo dep array updated: `getBreakEvenInfo` replaced with `breakEvenMap`. The arrow inside the memo body closes over `breakEvenMap`, so the Map identity is the correct invalidation key. ESLint's exhaustive-deps lint stays satisfied because the arrow's only free variable is `breakEvenMap`."
  - "`handleRecordSale`'s in-handler `marketplaceFee` local intentionally shadows the new component-scope memoized `marketplaceFee`. The handler uses `unitPrice = salePrice || job.sellingPrice` as the fee-calculation input — different semantics from the JSX summary which always uses bare `salePrice`. When the user submits with an empty Price field, the handler must charge a fee on `job.sellingPrice * saleQuantity`, NOT $0. Documented inline. The plan's `<acceptance_criteria>` line `grep -c 'calculateMarketplaceFee(' returns exactly 2` was based on the planner's assumption of 3 in-component calls; the actual file has 4 (handler + 3 JSX), so the achievable target is 3 (definition + memo + untouched handler). Final count: 3."
  - "`useDynamicRowHeight` import was already present (line 3, plan 22-04's region). The one-line change at line 154 → 158 (the comment block bumped numbering) is the entire PERF-04 surface area. No new imports."

patterns-established:
  - "Per-row derived-data Map pattern: when a component renders N rows and each row needs a derived value computed from row data + a shared dataset (e.g., a Map<id, RelatedData>), build a `Map<id, DerivedValue>` once per render and pass an O(1)-lookup wrapper to each row. This avoids the double-compute (rowProps + the React-window per-row callback) and lets React.memo correctly short-circuit rows whose row-data didn't change."
  - "Memo-collapsing repeated JSX fee calls: when the same calculation appears 2+ times in JSX (e.g., total summary, line item, net), wrap it in a `useMemo` once and reference the const at each site. The dep array becomes the single source of truth for invalidation."

requirements-completed: [PERF-01, PERF-02, PERF-03, PERF-04]

duration: 6min
completed: 2026-05-27
---

# Phase 22 Plan 05: Perf bundle (breakEvenMap + marketplaceFee memo + CustomerLibrary row-height key) Summary

**Three orthogonal perf passes — JobsManager pre-computes per-row break-even info via a `breakEvenMap` Map<jobId, BreakEvenInfo> useMemo (closes CODE-AUDIT #16 + #29); RecordSaleModal collapses 3 redundant in-JSX `calculateMarketplaceFee` calls into a single memoized `marketplaceFee` const (closes CODE-AUDIT #17 + #31); CustomerLibrary's dynamic row-height cache now invalidates on search-filter changes (closes CODE-AUDIT #18). Zero behavioral / visual change. tsc -b clean; 428/429 vitest green (1 todo unchanged); build clean at 57.21 KB gz main chunk.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-05-27T16:46:40Z (first task commit `0f3a7e7`)
- **Completed:** 2026-05-27T16:52:49Z (last commit `686cec2` style trim)
- **Tasks:** 3 of 3 (+ 1 style-trim follow-up commit)
- **Files modified:** 3 (JobsManager.tsx, RecordSaleModal.tsx, CustomerLibrary.tsx)
- **LOC delta:**
  - JobsManager.tsx: 1474 → 1491 LOC (+17; under the cumulative <1500 ROADMAP gate)
  - RecordSaleModal.tsx: 627 → 640 LOC (+13)
  - CustomerLibrary.tsx: 401 → 405 LOC (+4)
  - Net across this plan: +34 LOC (all comment + memo declaration; computational work moved out of render hot paths)

## Accomplishments

- **PERF-01 closed (CODE-AUDIT #16, #29):** `computeBreakEvenInfo(job, salesByJob)` is a pure module-scope function in JobsManager.tsx (line 43). The component-scope `breakEvenMap` useMemo (around line 1015, dep array `[searchedJobs, salesByJob]`) builds the full per-row Map once per render. The three consumers all do O(1) Map lookups:
  - rowProps construction site: `getBreakEvenInfo: (job: PrintJob) => breakEvenMap.get(job.id)!` (inline arrow wrapper, D-19/Pitfall 6 — JobRowProps shape unchanged)
  - Virtualized JobRow at line 837: receives the wrapper via `rowProps.getBreakEvenInfo` and calls `getBreakEvenInfo(job)` exactly once per JobCard render
  - Non-virtualized fallback at line 1366: `info={breakEvenMap.get(job.id)!}` direct read
  - Eliminates the prior double-compute (rowProps wrapped a useCallback; the useCallback's `[salesByJob]` dep also caused the rowProps memo to re-build on every sale write, cascading a re-render to all visible JobCards).
- **PERF-02 closed (CODE-AUDIT #17):** `const marketplaceFee = useMemo(() => calculateMarketplaceFee(saleQuantity * salePrice, saleMarketplace), [saleQuantity, salePrice, saleMarketplace])` at RecordSaleModal.tsx:225. The three JSX consumers (Marketplace Fee conditional row, the inline `-$` display, and the Net Revenue computation) all read the memo's value. Previously 3 redundant calls to `calculateMarketplaceFee(...)` ran on every modal-state change — now 1 call per `[saleQuantity, salePrice, saleMarketplace]` change.
- **PERF-03 closed (CODE-AUDIT #31) — inherited from plan 22-03:** `calculateMarketplaceFee` is a pure module-scope function at RecordSaleModal.tsx:47, body verbatim from JobsManager.tsx pre-extraction:
  ```ts
  function calculateMarketplaceFee(price: number, marketplace: MarketplaceType): number {
    switch (marketplace) {
      case 'facebook_shipped':
        return Math.max(0.80, price * 0.10) + price * 0.029;
      case 'etsy':
        return price * 0.065 + price * 0.03 + 0.45;
      default:
        return 0;
    }
  }
  ```
  Plan 22-03's SUMMARY.md confirmed the function was lifted at extraction time. This plan's PERF-03 work was verification-only.
- **PERF-04 closed (CODE-AUDIT #18):** CustomerLibrary.tsx:158 — `const customerRowHeightCache = useDynamicRowHeight({ defaultRowHeight: 88, key: searchQuery });` The `searchQuery` state from line 116 now drives cache invalidation. Mirrors the Phase 15 plan 04 D-05 bi-key pattern.
- **Cumulative JobsManager LOC under 1500:** 1491 LOC after this plan's net delta. The ROADMAP cumulative <1500 gate is now headroom-clear before plan 22-06 begins its own shrink work.
- **Build/test green:** tsc -b clean. Full vitest suite 428 passed + 1 todo (identical to baseline). JobsManager.test.tsx 31/31. RecordSaleModal.test.tsx 9/9. Production build clean; main chunk 57.21 KB gz (within Phase 22 size targets).

## Task Commits

1. **Task 1: Implement breakEvenMap memo + lift computeBreakEvenInfo to module scope (PERF-01)** — `0f3a7e7` (perf)
2. **Task 2: Hoist calculateMarketplaceFee + memoize marketplaceFee in RecordSaleModal (PERF-02 + PERF-03)** — `f03710b` (perf)
3. **Task 3: Add `key: searchQuery` to CustomerLibrary `useDynamicRowHeight` (PERF-04)** — `d201665` (perf)
4. **Style trim: compress PERF-01 comment block to keep cumulative <1500 LOC gate slack** — `686cec2` (style)

## Files Created/Modified

### Modified

- **`src/components/JobsManager.tsx`** (1474 → 1491 LOC, +17) — Three coordinated edits:
  - Added module-scope `computeBreakEvenInfo(job: PrintJob, salesByJob: Map<string, Sale[]>): BreakEvenInfo` pure function after the `BreakEvenInfo` type declaration (line 43). Body verbatim from the deleted in-component `getBreakEvenInfo` useCallback.
  - Deleted the in-component `getBreakEvenInfo = useCallback(...)` block (formerly at lines 992-1022 in the base).
  - Inserted `const breakEvenMap = useMemo(() => new Map(searchedJobs.map((j) => [j.id, computeBreakEvenInfo(j, salesByJob)])), [searchedJobs, salesByJob])` immediately after the `searchedJobs` and `salesByJob` definitions in the component body.
  - Updated rowProps construction: replaced `getBreakEvenInfo,` shorthand with `getBreakEvenInfo: (job: PrintJob) => breakEvenMap.get(job.id)!,` arrow wrapper (D-19 lock).
  - Updated rowProps useMemo dep array: `getBreakEvenInfo` → `breakEvenMap`.
  - Updated non-virtualized branch JobCard `info` prop: `getBreakEvenInfo(job)` → `breakEvenMap.get(job.id)!`.
  - Virtualized JobRow at line 837 was NOT changed — it receives `getBreakEvenInfo` via the rowProps wrapper unchanged.

- **`src/components/RecordSaleModal.tsx`** (627 → 640 LOC, +13) — Two coordinated edits:
  - Inserted `const marketplaceFee = useMemo(() => calculateMarketplaceFee(saleQuantity * salePrice, saleMarketplace), [saleQuantity, salePrice, saleMarketplace])` between `availableMarketplaces` (line 214) and `handleRecordSale` (line 232).
  - Replaced 3 JSX call sites with reads of the const:
    - Line 607 (was: `{calculateMarketplaceFee(saleQuantity * salePrice, saleMarketplace) > 0 && (`) → `{marketplaceFee > 0 && (`
    - Line 610 (was: `<span className="font-mono">-${calculateMarketplaceFee(...).toFixed(2)}</span>`) → `<span className="font-mono">-${marketplaceFee.toFixed(2)}</span>`
    - Line 616 (was: `${((saleQuantity * salePrice) + saleShippingCost - calculateMarketplaceFee(...)).toFixed(2)}`) → `${((saleQuantity * salePrice) + saleShippingCost - marketplaceFee).toFixed(2)}`
  - `handleRecordSale`'s line 234 local `const marketplaceFee = calculateMarketplaceFee(unitPrice * saleQuantity, saleMarketplace)` is INTENTIONALLY preserved — different semantics (uses `unitPrice` with the `job.sellingPrice` fallback when `salePrice` is 0).

- **`src/components/CustomerLibrary.tsx`** (401 → 405 LOC, +4) — One-line behavioral change (+ 3 comment lines):
  - Line 158 (was: `const customerRowHeightCache = useDynamicRowHeight({ defaultRowHeight: 88 });`) → `const customerRowHeightCache = useDynamicRowHeight({ defaultRowHeight: 88, key: searchQuery });`
  - `searchQuery` state at line 116 (`const [searchQuery, setSearchQuery] = useState('');`) is unchanged — already in scope at the call site.

## Decisions Made

1. **rowProps.getBreakEvenInfo is an inline arrow at the construction site, not a useCallback.** The plan's literal acceptance criterion (`grep -c 'const getBreakEvenInfo = useCallback' == 0`) ruled out keeping a useCallback wrapper around the Map lookup. The inline arrow inside the rowProps useMemo closes over `breakEvenMap`; the dep array (with `breakEvenMap` in it) re-builds rowProps only when the map changes, so React.memo on JobCard still short-circuits unchanged rows. JobRowProps shape preserved verbatim (Pitfall 6 lock).

2. **`handleRecordSale`'s in-handler `marketplaceFee` local intentionally shadows the new outer memo.** The handler computes `unitPrice = salePrice || job.sellingPrice` and calls `calculateMarketplaceFee(unitPrice * saleQuantity, saleMarketplace)`. The JSX uses bare `salePrice` (no fallback) — the displayed total reflects the user's current entry verbatim, while the persisted Sale record uses the job's listed selling price as a fallback if the user submits with an empty Price field. Different semantics → different local. Documented inline.

3. **PERF-03 was already satisfied at plan-22-03 extraction time.** `calculateMarketplaceFee` lives at module scope (RecordSaleModal.tsx:47); this plan's Task 2 only needed to add the PERF-02 useMemo and rewire the 3 JSX sites.

4. **Comment trim follow-up committed as `style` not `perf`.** No behavior change; pure documentation compression to give plan 22-06 some headroom under the cumulative <1500 LOC gate.

5. **No NewBadge entry added.** Perf-only milestone — zero user-visible UI change. Project memory rule: "If end users will never see the change (refactors, ..., internal utilities), DO NOT add an entry to `src/features.ts` and DO NOT add a `<NewBadge>`."

## Deviations from Plan

### Annotations (not deviations — plan acceptance text vs. file reality)

**1. [Annotation] `grep -c 'calculateMarketplaceFee(' src/components/RecordSaleModal.tsx` returns 3, not 2**
- **Why:** The plan's `<acceptance_criteria>` assumed only 3 in-component calls (the 3 JSX sites). The actual file has 4 in-component calls (handler at line 234 + the 3 JSX sites). After collapsing the 3 JSX calls, the achievable minimum is 3 (definition + useMemo body + the untouched handler call). The handler call MUST be preserved as documented above — its inputs differ.
- **Files modified:** none beyond the standard PERF-02 wiring
- **Verification:** `grep -n 'calculateMarketplaceFee(' src/components/RecordSaleModal.tsx` returns exactly: line 47 (definition), line 225 (useMemo body), line 234 (handler — intentional shadow). Plan's spirit ("collapse the 3 JSX calls into one memo") is fully met.

**2. [Annotation] `grep -c 'const getBreakEvenInfo = useCallback' src/components/JobsManager.tsx` returns 0**
- The plan's literal acceptance text says "0 (old useCallback deleted)" — fully satisfied. The new wrapper is an inline arrow inside the rowProps useMemo construction, not a wrapping useCallback (see Decision #1).

### Worktree environment fix

**1. [Worktree environment fix] Ran `npm install` to seed worktree `node_modules`**
- **Found during:** baseline `tsc -b` check before Task 1
- **Issue:** Worktree spawned without `node_modules`; pre-existing module-not-found errors masked any real diagnostics.
- **Fix:** `npm install --no-audit --no-fund --prefer-offline` — 648 packages in 4s.
- **Files modified:** none (node_modules is gitignored)
- **Commit:** none — environment-only

No Rule 1 / 2 / 3 / 4 deviations. No bugs surfaced; no architectural changes; no auth gates; no checkpoints.

## Authentication Gates

None — pure code-only execution.

## Issues Encountered

None of substance. Two observations:

1. **`<acceptance_criteria>` count mismatches** between the planner's static estimate and file reality on the `calculateMarketplaceFee(` grep count (annotation #1 above). Spirit of the criterion is met; the literal count differs by 1 because there are 4 in-component calls, not 3.
2. **`grep -c 'breakEvenMap.get'` returns 2**, not the "at least 1" lower bound — the second match is the non-virtualized fallback at line 1366. Within the plan's intent. The plan's acceptance criterion 3 (`grep -c 'breakEvenMap.get' returns at least 1`) is satisfied.

## User Setup Required

None.

## Threat Flags

None — pure structural refactor. No new network, file, auth, or schema surface. The Convert-from-Quote atomic `db.transaction` (the only DB-write surface in RecordSaleModal) was untouched by this plan.

## Known Stubs

None — every change rewires existing computation into a memoized form; no placeholders, no TODO markers, no empty-data fallbacks introduced.

## Deferred Issues

None.

## Next Phase Readiness

- **Plan 22-06 (final JobsManager shrink + test-mock update for useAllSales):** Inherits JobsManager.tsx at **1491 LOC** — ~9 LOC of slack under the cumulative <1500 gate before 22-06's own shrink work begins. The duplicate `useSales()` + `useSales(jobId)` pair survives this plan; PERF-07 lift to `useAllSales` is 22-06 scope per plan 22-03 SUMMARY.
- **`computeBreakEvenInfo` extractability:** If Phase 23 wants a direct unit test on the break-even math, the function is already pure — moving it to `src/utils/computeBreakEven.ts` is a 1-line export change. No 2nd consumer today (No-Analog rule); stays in JobsManager.tsx.
- **`useDynamicRowHeight` bi-key pattern:** Customers and Jobs both now use the same invalidation idiom (Jobs uses tri-key, Customers single-key). The pattern is locked across the two virtualized lists in the app.

---

## Self-Check: PASSED

- `src/components/JobsManager.tsx` — modified, 1491 LOC (under 1500 cumulative gate target)
  - `grep -c '^function computeBreakEvenInfo' = 1` — PASS
  - `grep -c 'const breakEvenMap = useMemo' = 1` — PASS
  - `grep -c 'breakEvenMap.get' = 2` — PASS (≥1 required)
  - `grep -c 'computeBreakEvenInfo(' = 2` (definition + memo body) — PASS
  - `grep -c 'const getBreakEvenInfo = useCallback' = 0` — PASS
  - `grep -c 'breakEvenMap' = 5` — PASS (≥2 required)
- `src/components/RecordSaleModal.tsx` — modified, 640 LOC
  - `grep -c '^function calculateMarketplaceFee' = 1` — PASS
  - `grep -c 'const marketplaceFee = useMemo' = 1` — PASS
  - `grep -c 'calculateMarketplaceFee(' = 3` (def + memo + handler; see annotation #1) — annotation; spirit met
  - `grep -c 'marketplaceFee' = 9` — PASS (≥4 required: outer memo + 3 JSX consumers + handler local + 2 Sale-record writes + comment)
- `src/components/CustomerLibrary.tsx` — modified, 405 LOC
  - `grep -cE 'useDynamicRowHeight\(\{[^}]*key:\s*searchQuery' = 1` — PASS
  - `grep -c 'key: searchQuery' = 1` — PASS (≥1 required)
- Commit `0f3a7e7` (Task 1, perf) — FOUND in `git log`
- Commit `f03710b` (Task 2, perf) — FOUND in `git log`
- Commit `d201665` (Task 3, perf) — FOUND in `git log`
- Commit `686cec2` (style trim) — FOUND in `git log`
- `npx tsc -b` exits 0 — PASS
- `npx vitest run` → 428 passed + 1 todo (identical to baseline) — PASS
- `npm run build` → clean; main chunk 57.21 KB gzipped — PASS

---
*Phase: 22-jobsmanager-decomposition-perf*
*Plan: 05*
*Completed: 2026-05-27*
