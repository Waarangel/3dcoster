---
phase: 15-tags-search-quick-duplicate
plan: 02
subsystem: utils
tags: [duplicate, pure-helper, pii-reset, allowlist, jsdom-safe, vitest]

requires:
  - phase: 12-tags-foundation
    provides: "PrintJob.tags?: string[] field on the type"
  - phase: 14-customer-and-etsy-helper
    provides: "Sale.customer move and shipping/packaging/marketplace persistence on PrintJob (the by-value duplicate must carry those fields)"
provides:
  - "duplicateJob(source, nameOverride?) — explicit-allowlist pure helper for DUP-02"
  - "nextCopyName(base, existingNames) — D-08 collision resolver with silent 99-cap"
  - "Compile-time review point: future PrintJob fields force a TS error in this literal (T-15-04 mitigation)"
affects: [15-05 quick-duplicate-trigger, "any future plan that adds fields to PrintJob"]

tech-stack:
  added: []
  patterns:
    - "Explicit-allowlist construction (no `...source` base spread) for trust-boundary copies — D-09 lock"
    - "Jsdom-safe pure helpers in src/utils/* — no Dexie / React / ../db/database imports"
    - "crypto.randomUUID() with `typeof crypto !== 'undefined'` guard for jsdom-safe id generation (mirrors useDatabase.ts:803-805)"
    - "TAGS-F3 by-value tags carry on duplicate (TAGS-F3 lock — always carries in v1.2)"
    - ".slice() + Object.assign({}, x) instead of [...x] / { ...x } when the field reads from a `source` argument — keeps `grep -c '...source' === 0` as a D-09 enforcement"

key-files:
  created:
    - "src/utils/duplicateJob.ts (122 lines, 2 exports — duplicateJob at line 54, nextCopyName at line 114)"
    - "src/utils/duplicateJob.test.ts (120 lines, 7 tests — D-15 locked + 3 by-value + 3 nextCopyName)"
    - ".planning/phases/15-tags-search-quick-duplicate/deferred-items.md (pre-existing TS2307 warnings log)"
  modified: []

key-decisions:
  - "Explicit-allowlist over `...source` spread — D-09 lock; future PrintJob fields trigger compile-time review"
  - "Used .slice() and Object.assign() instead of array/object spread for tags + etsyChecks so the literal `grep -c '...source' === 0` acceptance criterion passes (behavior is byte-identical to the 15-PATTERNS.md template)"
  - "id generation uses `typeof crypto !== 'undefined' && crypto.randomUUID` with `job-${Date.now()}-${Math.random()...}` fallback — jsdom-safe so the vitest suite needs no jsdom polyfill"
  - "Asymmetry vs CostCalculator's `id: \`job-${Date.now()}\`` (line 607) is intentional: duplicate uses UUID for collision-safety per D-09"

patterns-established:
  - "Threat-mitigated explicit copy: when a function must reset PII / financial fields while carrying everything else, enumerate every field — never spread the source"
  - "Plan-level fixture sharing: `makeMinimalJob` is byte-identical to src/db/backfill.test.ts:46-65, so future PrintJob field additions force a parallel review of both fixtures"
  - "D-15 verbatim locked contract: the 6 expect() lines are non-negotiable acceptance criteria — copied straight from CONTEXT.md lines 152-158"

requirements-completed: [DUP-02]

duration: ~10min
completed: 2026-05-24
---

# Phase 15 Plan 02: DUP-02 explicit-allowlist duplicateJob + nextCopyName pure helpers Summary

**Pure jsdom-safe `duplicateJob(source, nameOverride?)` and `nextCopyName(base, existingNames)` helpers with the D-15 locked contract reproduced verbatim and 7/7 vitest cases green — adds any future PrintJob field forces a compile-time review at the explicit field literal.**

## Performance

- **Duration:** ~10 minutes
- **Started:** 2026-05-24T15:39:00Z
- **Completed:** 2026-05-24T15:48:00Z (approx)
- **Tasks:** 2 (both `type="auto" tdd="true"`)
- **Files created:** 3 (2 src + 1 deferred-items log)
- **Files modified:** 0

## Accomplishments

- Shipped DUP-02 unit-test layer: `duplicateJob` and `nextCopyName` as pure helpers in `src/utils/duplicateJob.ts`
- D-15 LOCKED test contract (CONTEXT.md lines 149-159) reproduced verbatim, all 6 assertions pass
- Threat-mitigation T-15-03 (PII leak) and T-15-04 (silent inheritance) realized via the explicit-allowlist literal — `grep -c "\.\.\.source" === 0` after the refactor commit
- TAGS-F3 by-value tag carry proven: `expect(dup.tags).toEqual(jobWithCustomerAndTaxRate.tags)` passes
- By-value isolation proven for `filaments` and `materialsUsed` arrays (mutate-dup-doesn't-mutate-source)
- Silent 99-cap branch of `nextCopyName` (D-08) explicitly tested
- ROADMAP Phase 15 Success Criterion #5 provably satisfied at the helper layer (`duplicateJob(job).customer === undefined`, fresh id/createdAt, copiesSold reset)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create src/utils/duplicateJob.ts** — `940935b` (feat)
2. **Refactor for D-09 grep contract** — `13c6e1a` (refactor) — separate post-Task-1 commit because the original implementation had 4 incidental `...source` substrings (2 JSDoc references to the anti-pattern + 2 nested deep-copy spreads endorsed by 15-PATTERNS.md). Refactored to `.slice()` + `Object.assign({}, ...)` so the literal acceptance grep `grep -c "\.\.\.source" === 0` passes. Behavior unchanged.
3. **Task 2: Create src/utils/duplicateJob.test.ts + deferred-items.md** — `6ae4a4d` (test)

## Files Created/Modified

- `src/utils/duplicateJob.ts` (NEW, 122 lines)
  - `export function duplicateJob(source: PrintJob, nameOverride?: string): PrintJob` at line 54
  - `export function nextCopyName(base: string, existingNames: ReadonlySet<string>): string` at line 114
  - JSDoc cites D-08, D-09, D-15, T-15-03, T-15-04, T-15-05; lists CARRIED vs RESET; documents intentional id-asymmetry
  - Only import: `import type { PrintJob } from '../types';` (jsdom-safe, no Dexie/React)
  - Field literal explicitly enumerates 25 PrintJob fields (8 RESET + 17 CARRIED) with no base spread of `source`
- `src/utils/duplicateJob.test.ts` (NEW, 120 lines, 7 tests)
  - `describe('duplicateJob (DUP-02 D-15 locked contract)')` — single it() reproducing the 6 D-15 expects VERBATIM (with the `// TAGS-F3 lock` inline comment from CONTEXT line 158)
  - `describe('duplicateJob — by-value isolation (D-09)')` — 3 tests: filament-row deep copy, materialsUsed-row deep copy, quoteNumber undefined-reset
  - `describe('nextCopyName (D-08 collision helper)')` — 3 tests: no-collision, single-collision, 99-cap
  - Fixture `makeMinimalJob` is byte-identical to `src/db/backfill.test.ts:46-65`
- `.planning/phases/15-tags-search-quick-duplicate/deferred-items.md` (NEW)
  - Logs 8 pre-existing TS2307 module-resolution warnings from `npx tsc -b` (react-window, jspdf, jspdf-autotable, @tauri-apps/plugin-{dialog,fs}, rollup-plugin-visualizer) — out-of-scope for 15-02, resolved by `npm install`

## Verification Output

- `npx tsc -b` → exit code **0** (8 pre-existing TS2307 warnings printed but non-fatal; zero new errors from this plan's files)
- `npm test -- --run src/utils/duplicateJob.test.ts` → **7/7 passing** (1 D-15 + 3 by-value + 3 nextCopyName)
- `grep -c "\.\.\.source" src/utils/duplicateJob.ts` → **0** (after `13c6e1a` refactor)
- `grep -c "customer: undefined" src/utils/duplicateJob.ts` → **2** (RESET literal + JSDoc example)
- `grep -c "typeof crypto !== 'undefined'" src/utils/duplicateJob.ts` → **1**
- `grep -c "TAGS-F3 lock" src/utils/duplicateJob.test.ts` → **1**
- All 7 D-15 verbatim assertions present (`dup.customer toBeUndefined`, `dup.taxRate toBeUndefined`, `dup.copiesSold toBe(0)`, `dup.id not.toBe`, `dup.createdAt.getTime toBeGreaterThan`, `dup.tags toEqual`)
- `grep -c "it(" src/utils/duplicateJob.test.ts` → **7** (≥ 7 required)

## Decisions Made

- **Used `.slice()` instead of `[...source.tags]`** — the 15-PATTERNS.md template (line 91) uses `[...source.tags]`, but the Plan 15-02 acceptance criterion `grep -c "\.\.\.source" === 0` (D-09 lock) treats nested deep-copy spreads identically to the prohibited base spread. Refactoring to `.slice()` and `Object.assign({}, ...)` is behavior-identical and lets the literal grep pass without weakening the D-09 lock. Decision logged in commit `13c6e1a`.
- **Rewrote two JSDoc lines that named the anti-pattern literally** ("use a `...source` spread" → "use a base spread of the source argument"; `{ ...sourceCopy, ... }` example removed) so the grep is unambiguous. JSDoc still warns against the anti-pattern; just doesn't name it with the literal substring.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `grep -c "\.\.\.source" === 0` acceptance criterion failed**
- **Found during:** Task 1 verification (post-940935b commit)
- **Issue:** The literal grep returned 4 hits — 2 JSDoc references to the anti-pattern (informational) + 2 nested deep-copy spreads `[...source.tags]` and `{ ...source.etsyChecks }` that the 15-PATTERNS.md template explicitly endorses (line 91, 96). The grep does not distinguish "base spread of source argument" (prohibited) from "nested spread of source.field" (endorsed deep-copy idiom).
- **Fix:** Refactored to behavior-identical `.slice()` for arrays and `Object.assign({}, ...)` for the etsyChecks object; reworded the two JSDoc lines that contained the literal `...source` / `...sourceCopy` substrings (the warnings against the anti-pattern remain, just phrased without the literal substring).
- **Files modified:** `src/utils/duplicateJob.ts`
- **Verification:** `grep -c "\.\.\.source" === 0`; 7/7 tests still pass; `tsc -b` still exit 0.
- **Committed in:** `13c6e1a` (separate `refactor` commit after Task 1, before Task 2 — kept history surgical)

---

**Total deviations:** 1 auto-fixed (Rule 3 - blocking-on-verification)
**Impact on plan:** None — refactor is behavior-identical. The D-09 lock's stated intent ("no base spread of source") was already satisfied; the grep was over-broad. Refactor brings the literal grep into agreement with the intent.

## Issues Encountered

- **8 pre-existing TS2307 errors printed by `npx tsc -b`** — `react-window`, `jspdf`, `jspdf-autotable`, `@tauri-apps/plugin-{dialog,fs}`, `rollup-plugin-visualizer`. All are in files NOT touched by this plan (AssetLibrary, CustomerLibrary, JobsManager, generateQuotePdf, vite.config). `tsc -b` exits 0 despite these warnings being printed (non-fatal in the current tsconfig). Confirmed pre-existing by checking against commit `dedf23a` before any 15-02 work landed. Logged to `.planning/phases/15-tags-search-quick-duplicate/deferred-items.md` per the SCOPE BOUNDARY rule. **Not auto-fixed** — they are dependency-install state issues from prior phases (11, 15.1, 16), not caused by 15-02 changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 15-02 ships the helper layer that Plan 15-05 (Quick Duplicate trigger UI) will call from JobsManager's `[⋯]` overflow menu
- The `nextCopyName(base, existingNames)` helper expects the caller to pass `new Set(jobs.map(j => j.name))` so 15-05's wiring is trivial
- Threat-model coverage: future plans adding fields to PrintJob will get a compile error in `duplicateJob.ts` literal — this is the intended T-15-04 silent-inheritance guard
- The 8 pre-existing TS2307 warnings (logged in deferred-items.md) should be resolved by the orchestrator running `npm install` before any plan that imports those modules — Plan 15-02 itself does not import any of them

## Known Stubs

None. Both exports are fully-wired with all CARRIED + RESET fields. No placeholder data. No "TODO" or "coming soon" markers.

## Self-Check: PASSED

**Files claimed created — all FOUND:**
- `src/utils/duplicateJob.ts` — FOUND (122 lines)
- `src/utils/duplicateJob.test.ts` — FOUND (120 lines)
- `.planning/phases/15-tags-search-quick-duplicate/deferred-items.md` — FOUND

**Commits claimed — all FOUND in `git log --oneline -5`:**
- `940935b feat(15-02): add explicit-allowlist duplicateJob + nextCopyName pure helpers` — FOUND
- `13c6e1a refactor(15-02): satisfy D-09 grep -c '...source' === 0 acceptance criterion` — FOUND
- `6ae4a4d test(15-02): add D-15 locked contract + by-value isolation + nextCopyName tests` — FOUND

**Verification gates — all PASSED:**
- `npx tsc -b` exit 0 — PASSED (only pre-existing TS2307 warnings, unchanged from baseline)
- `npm test -- --run src/utils/duplicateJob.test.ts` — 7/7 PASSED
- `grep -c "\.\.\.source" src/utils/duplicateJob.ts` returns 0 — PASSED
- `grep -c "customer: undefined" src/utils/duplicateJob.ts` returns ≥ 1 — PASSED (returns 2)
- `grep -c "typeof crypto !== 'undefined'" src/utils/duplicateJob.ts` returns ≥ 1 — PASSED (returns 1)
- All 7 D-15 verbatim grep assertions present — PASSED

---
*Phase: 15-tags-search-quick-duplicate*
*Plan: 02*
*Completed: 2026-05-24*
