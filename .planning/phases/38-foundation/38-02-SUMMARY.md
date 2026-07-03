---
phase: 38-foundation
plan: 02
subsystem: ui
tags: [react-router, useSearchParams, routing, a11y, vitest]

# Dependency graph
requires: []
provides:
  - "activeTab in src/App.tsx derived from useSearchParams (URL is the source of truth for the active app tab)"
  - "VALID_TABS whitelist as the single validation point for untrusted ?tab= URL input"
  - "navigateToTab shared push/replace setter pattern for future App.tsx navigation needs"
  - "src/App.test.tsx — first App-level component-mount test file (createRoot+act harness), reusable Dexie-hook mock scaffold for future App tests"
affects: [40-insight-layer, 45-brand-launch]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "URL-as-state for UI navigation (useSearchParams) instead of useState, with a whitelist validation gate before untrusted param values reach render logic"
    - "Dual-setter navigation (push vs replace) exposed as one shared navigateToTab helper, with push kept as the default 'setActiveTab'-shaped callback for existing call sites"

key-files:
  created:
    - src/App.test.tsx
  modified:
    - src/App.tsx

key-decisions:
  - "A3 (edit-nav): handleEditJob navigates to calculator with replace (not push) — opening a job for edit is not a 'real' navigation a user expects to Back out of."
  - "D-06: bare /app and /app?tab=calculator both resolve to calculator; navigateToTab omits ?tab= entirely when the target is calculator so the URL never carries a redundant explicit param for the default tab."
  - "D-07: an unrecognized ?tab= value falls back to calculator for render AND is stripped from the URL via a single-shot replace effect keyed on [rawTab, setSearchParams] — no extra history entry, no render loop."
  - "Test harness: MemoryRouter's internal history is not wired to window.history, so the D-05 Back-navigation test uses createMemoryRouter + RouterProvider instead, giving deterministic router.navigate(-1) control without timing-based assertions."

requirements-completed: [FOUND-03]

# Metrics
duration: 8min
completed: 2026-07-03
---

# Phase 38 Plan 02: Tab-in-URL Routing Summary

**Active app tab moved from `useState<Tab>` to `useSearchParams` in `src/App.tsx`, closing the deferred v1.9 UAT finding where browser Back exited `/app` to the marketing site instead of retracing tabs.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-03T20:37:58Z
- **Completed:** 2026-07-03T20:46:00Z (approx)
- **Tasks:** 2
- **Files modified:** 2 (1 new, 1 modified)

## Accomplishments

- `activeTab` is now derived from `useSearchParams` with a `VALID_TABS` whitelist gating any value read from the URL before it can select a tab (closes T-38-03 tampering surface)
- Tab-bar clicks and keyboard nav push a history entry — pressing Back retraces the tab trail instead of exiting `/app` (D-05)
- An invalid/unknown `?tab=` value falls back to calculator and is stripped from the URL via a single-shot `replace` effect, with no residual history entry (D-07)
- Bare `/app` and `/app?tab=calculator` are both treated as calculator (D-06); the URL never carries a redundant `?tab=calculator` for the default tab
- `handleEditJob`'s navigation to calculator uses `replace` per Assumption A3 — editing a job isn't a navigation a user expects to Back out of
- Zero changes to `src/main.tsx` or `vite.config.ts` — `BrowserRouter` already wraps both the web and Tauri render trees, so one code path serves both platforms (D-08)
- Roving-tabindex / `aria-selected` tab bar JSX is byte-identical (confirmed via `git diff` — no hunk touches that block)
- First-ever `src/App.test.tsx`: 6 routing/A11Y tests using the project's `createRoot`+`act` harness (no RTL, matching the established project convention)

## Task Commits

Each task was committed atomically:

1. **Task 1: Write App-level routing tests FIRST (RED)** - `47fa978` (test)
2. **Task 2: Replace useState tab with useSearchParams (GREEN)** - `096cf9c` (feat)

**Plan metadata:** (pending — SUMMARY commit, next)

## Files Created/Modified

- `src/App.test.tsx` (new) - MemoryRouter/createMemoryRouter-based mount tests covering bare-`/app`→calculator, `?tab=jobs`, `?tab=calculator` alias, invalid-param fallback+replace, push-then-Back retrace, and the roving-tabindex A11Y contract. Mocks every Dexie hook `App.tsx`/`JobsManager` consume.
- `src/App.tsx` - `useState<Tab>` replaced with `useSearchParams`-derived `activeTab`; added `VALID_TABS` whitelist, `navigateToTab` push/replace setter, D-07 cleanup effect, and A3-compliant `handleEditJob`.

## Decisions Made

- **A3 edit-nav uses replace, not push** — implemented as specified in RESEARCH.md; `navigateToTab('calculator', { replace: true })` in `handleEditJob`, while the tab bar and keyboard handler keep push semantics via `setActiveTab`.
- **Test harness for Back-navigation (D-05)**: `MemoryRouter`'s history object is internal to the component and is NOT connected to `window.history` — `window.history.back()` has no effect on it. Switched the D-05 test to `createMemoryRouter` + `RouterProvider`, which exposes a `Router` instance whose `.navigate(-1)` drives the same in-memory stack the app renders against. This is a more reliable, non-timing-based pattern than the originally sketched `window.history.back()` approach and should be the reference pattern for any future App-level Back-navigation test.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Stubbed `__IS_TAURI__` and `window.matchMedia` in the new test file**
- **Found during:** Task 1 (writing `src/App.test.tsx`)
- **Issue:** `src/App.test.tsx` is the first test file in the project to actually mount `<App/>`. Two jsdom/Vite gaps that were previously latent (because prior `App`-adjacent coverage was source-contract-only, per `CostCalculator.test.tsx`'s documented pattern) surfaced immediately: (1) `__IS_TAURI__` is a Vite `define` global from `vite.config.ts`, but `vitest.config.ts` is a separate config with no `define` block, so the identifier is unbound under Vitest; (2) jsdom does not implement `window.matchMedia`, which `useIsStandalone()` and the editing-banner scroll effect both call.
- **Fix:** Added `vi.stubGlobal('__IS_TAURI__', false)` (web build path) and a `window.matchMedia` polyfill stub, both scoped to this test file only, with inline comments explaining why the gap exists and that it is not new debt introduced by App.tsx's changes.
- **Files modified:** `src/App.test.tsx`
- **Verification:** All 6 tests pass; full 825-test suite stays green; no other test file's environment was touched.
- **Committed in:** `47fa978` (Task 1 commit)

**2. [Rule 3 - Blocking] Added missing `useQuotes`/`useSales` mocks to the Dexie hook mock**
- **Found during:** Task 1 (writing `src/App.test.tsx`)
- **Issue:** The `jobs` tab renders `JobsManager`, which calls `useQuotes()` and `useSales(selectedJobId)` directly (not passed as props). The initial mock (built from App.tsx's own prop-hook list) omitted both, causing a `vi.mock` shape error on any test that reached the jobs tab.
- **Fix:** Added both hook mocks mirroring `JobsManager.test.tsx`'s existing shapes exactly (documented inline per that file's shape-rationale comment convention).
- **Files modified:** `src/App.test.tsx`
- **Verification:** `pushes a history entry on tab click...` (D-05) test, which navigates to the jobs tab, passes.
- **Committed in:** `47fa978` (Task 1 commit)

**3. [Rule 1 - Bug] Fixed `tsc -b` errors from an incorrect type import in the test file**
- **Found during:** Task 2 (post-implementation `tsc -b` verification, per CLAUDE.md's mandatory `tsc -b` rule)
- **Issue:** `import { type Router } from 'react-router-dom'` does not exist as an exported type in this react-router-dom version — `Router` is a component (value), and importing it as a type produced TS2749, plus TS6133 (declared but never read, since the import itself failed to resolve as a type).
- **Fix:** Removed the `Router` type import; typed the helper's return as `ReturnType<typeof createMemoryRouter>` instead, which is exact and doesn't depend on a package-internal type name.
- **Files modified:** `src/App.test.tsx`
- **Verification:** `npx tsc -b` exits clean; `npx vitest run src/App.test.tsx` still green.
- **Committed in:** `096cf9c` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 3/Rule 1 — blocking issues found while building the test harness and verifying the build)
**Impact on plan:** All three fixes were necessary to get the test file compiling and passing; none expand scope beyond what Task 1/Task 2 already specified. No architectural changes, no new dependencies.

## Issues Encountered

None beyond the auto-fixed items above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- FOUND-03 is fully closed: tab-in-URL routing is live, tested, and A11Y-preserving.
- `src/App.tsx` is now a clean modification target for other Phase 38 plans (e.g., Plan 01's CostCalculator split) — this plan touched only `src/App.tsx`/`src/App.test.tsx` and did not touch `CostCalculator.tsx`, so no merge conflict risk with Plan 01's wave.
- The `createMemoryRouter`+`RouterProvider` Back-navigation test pattern established here is reusable for any future phase that adds more App-level routes/tabs (e.g., Phase 40's Insights tab slot referenced in STATE.md).
- No blockers or concerns for downstream phases.

---
*Phase: 38-foundation*
*Completed: 2026-07-03*

## Self-Check: PASSED

- FOUND: src/App.test.tsx
- FOUND: src/App.tsx
- FOUND: .planning/phases/38-foundation/38-02-SUMMARY.md
- FOUND: commit 47fa978 (Task 1)
- FOUND: commit 096cf9c (Task 2)
- FOUND: commit 28bf5b7 (SUMMARY)
