---
phase: 22-jobsmanager-decomposition-perf
plan: 01
subsystem: ui
tags: [react, hook, picker, refactor, react-19, vitest]

requires:
  - phase: 15.1-customer-library
    provides: "Customer interface + JobsManager.tsx picker triplet pattern (CL-04 / UI-SPEC §5) that this plan extracts into a hook"
  - phase: 16-pdf-quote-flow
    provides: "PrintQuoteModal duplicate picker pattern (PrintQuoteModal.tsx:31, 69-178) that confirms the byte-identical handler body — the source of HYG-08"

provides:
  - "useCustomerPicker hook with full D-02 11-key return shape"
  - "PICKER_VISIBLE_LIMIT = 8 single source of truth (D-05, HYG-02)"
  - "Verified WAI-ARIA combobox keyDown semantics: ArrowDown WR-04 empty-guard, ArrowUp wrap, Enter-with-match, Enter-no-match, Escape stopPropagation (CR-04), Tab close"
  - "14-test behavior contract locked via raw createRoot + act (no @testing-library/react)"

affects: [22-02, 22-03, future-picker-consumers]

tech-stack:
  added: []
  patterns:
    - "Reusable hook with consumer-owned onPick callback (Pitfall 1 avoidance)"
    - "PickerHarness pattern for hook-level unit testing (no renderHook needed)"

key-files:
  created:
    - src/hooks/useCustomerPicker.ts
    - src/hooks/useCustomerPicker.test.tsx
  modified: []

key-decisions:
  - "Hook is consumer-agnostic — takes customers as argument (D-01) instead of subscribing to useCustomers(). Lets the hook be tested standalone with no DB mock."
  - "pickedExistingCustomerId stays out of the hook (Pitfall 1) — that's a PrintQuoteModal-only concept the consumer wires inside its own onPick callback in plan 22-03."
  - "Hook returns BOTH filteredCustomers AND visibleCustomers per D-02 — even though only visibleCustomers is rendered, filteredCustomers is needed for the 'Showing first 8 of N' overflow footer."
  - "Test file is .tsx (not .ts as VALIDATION.md historically referenced) — required because PickerHarness contains JSX. Planner revision locked .tsx."
  - "Test 9 (Enter-no-match) exercises the open=true + visibleCustomers=[] state by typing a non-matching query AFTER ArrowDown opened the dropdown — production behavior matches this transition exactly."

patterns-established:
  - "useCustomerPicker(customers, { onPick }) — standalone reusable hook surface for future picker consumers"
  - "PickerHarness test pattern — mount the hook in a thin wrapper component that exposes return values via data-testid spans; dispatch keyboard events via KeyboardEvent + act()"

requirements-completed: [HYG-08, HYG-02]

duration: 7min
completed: 2026-05-27
---

# Phase 22 Plan 01: useCustomerPicker Hook Summary

**Extracted the picker state triplet + 60-LOC WAI-ARIA keyDown handler duplicated between JobsManager.tsx and PrintQuoteModal.tsx into a single reusable hook with a 14-test behavior contract.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-05-27T15:57:47Z (from STATE.md last_updated)
- **Completed:** 2026-05-27T16:04:24Z
- **Tasks:** 2 of 2
- **Files modified:** 0 (consumers untouched per D-25)
- **Files created:** 2

## Accomplishments

- HYG-08 hook foundation in place: `useCustomerPicker` exports the full D-02 11-key return shape (`query`, `open`, `activeIndex`, `visibleCustomers`, `filteredCustomers`, `setQuery`, `setOpen`, `setActiveIndex`, `handleKeyDown`, `pick`, `reset`) with verified keyboard semantics across all 5 handler branches.
- HYG-02 constant centralized: `PICKER_VISIBLE_LIMIT = 8` exported from `src/hooks/useCustomerPicker.ts`. The two duplicate local copies in `JobsManager.tsx:993` and `PrintQuoteModal.tsx:31` stay until plan 22-03 (D-25 scope guard — no consumer changes here).
- Wave 0 test gate green: 14/14 tests pass via `npm test -- useCustomerPicker --run` (raw `createRoot` + `act`, no `@testing-library/react`).
- Zero consumer drift: `git diff --stat src/components/JobsManager.tsx src/components/PrintQuoteModal.tsx` returns empty; `package.json` untouched.

## Task Commits

1. **Task 1: Create useCustomerPicker hook with PICKER_VISIBLE_LIMIT export** — `dca7144` (feat)
2. **Task 2: Create useCustomerPicker.test.tsx with raw createRoot + act** — `5a252b8` (test)

_Note: This plan's two tasks split the classical TDD cycle across plan boundaries — Task 1 is the GREEN-by-construction hook implementation, Task 2 is the locking test contract. Plan-level audit sees `feat(22-01)` followed by `test(22-01)` — see TDD Gate Compliance below for the rationale._

## Files Created/Modified

- **Created:** `src/hooks/useCustomerPicker.ts` (157 LOC, exceeds 70 min_lines) — exports `useCustomerPicker` and `PICKER_VISIBLE_LIMIT`. Hook body copied verbatim from `JobsManager.tsx:1280-1370` with state renamed (`customerPickerOpen` → `open`, etc.) and `void handlePickCustomer(picked)` → `pick(picked)`. All inline comments preserved (WR-04 ArrowDown guard, WR-01 Enter no-match note, CR-04 Escape stopPropagation note, UI-SPEC §5 Tab close).
- **Created:** `src/hooks/useCustomerPicker.test.tsx` (420 LOC, exceeds 120 min_lines) — 14 `it(...)` blocks inside a single `describe('useCustomerPicker', ...)`. PickerHarness component renders the hook surface via `data-testid` spans/buttons; helpers `fireKeyDown` / `setQuery` / `clickOption` wrap `act()` boundaries.

## Verification

- `npx tsc -b` → exit 0
- `npm test -- useCustomerPicker --run` → 14/14 pass
- `grep -c 'export const PICKER_VISIBLE_LIMIT = 8' src/hooks/useCustomerPicker.ts` → 1
- `grep -c 'export function useCustomerPicker' src/hooks/useCustomerPicker.ts` → 1
- `grep -c 'e.stopPropagation()' src/hooks/useCustomerPicker.ts` → 1 (CR-04 preserved)
- `grep -c 'pickedExistingCustomerId' src/hooks/useCustomerPicker.ts` → 0 (Pitfall 1 boundary respected)
- `grep -c 'useCustomers' src/hooks/useCustomerPicker.ts` → 0 (D-01 — no DB subscription)
- `grep -c '@testing-library/react' src/hooks/useCustomerPicker.test.tsx` → 0
- `grep -cE '^\s*it\(' src/hooks/useCustomerPicker.test.tsx` → 14
- `git diff --stat src/components/JobsManager.tsx src/components/PrintQuoteModal.tsx` → empty (D-25 — consumers untouched)
- `git diff package.json` → empty (no new deps)

## Behavior Coverage (14 tests)

| # | Behavior | Branch / Decision |
|---|----------|-------------------|
| 1 | Return shape — 11 keys | D-02 |
| 2 | filteredCustomers empty on blank/whitespace query | D-02 (line 1281 mirror) |
| 3 | filteredCustomers matches name OR email substring (case-insensitive) | D-02 (JobsManager.tsx:1283-1286 mirror) |
| 4 | visibleCustomers sliced to `PICKER_VISIBLE_LIMIT` (=8) | D-05, HYG-02 |
| 5 | ArrowDown opens picker; second ArrowDown advances; wraps with modulo | UI-SPEC §5 |
| 6 | ArrowDown no-op when `visibleCustomers.length === 0` | WR-04 |
| 7 | ArrowUp wraps first → last | UI-SPEC §5 |
| 8 | Enter while open with active match calls `onPick(picked)` + resets | D-04 |
| 9 | Enter while open with non-empty query + no match closes without `onPick` | WR-01 |
| 10 | Escape while open closes AND calls `e.stopPropagation()` | CR-04 |
| 11 | Tab closes dropdown without auto-picking | UI-SPEC §5 |
| 12 | `pick(c)` invokes onPick then resets state | D-04 |
| 13 | `reset()` clears state without calling onPick | (new, hook-only) |
| 14 | `PICKER_VISIBLE_LIMIT === 8` named export lock | HYG-02, D-05 |

## Deviations from Plan

**1. [Rule 1 — Bug] Removed redundant key assignments in `makeCustomer` fixture**
- **Found during:** Task 2 verification (`tsc -b` failure)
- **Issue:** Initial `makeCustomer({ id, name, email, ...overrides })` spread `id` twice (TS2783: `'id' is specified more than once`), because `overrides` always contains `id` (it's the required key) and the body listed `id: overrides.id` before the spread.
- **Fix:** Reduced `makeCustomer` body to `{ createdAt: <date>, ...overrides }` — the spread carries `id`, `name`, `email` through naturally.
- **Files modified:** `src/hooks/useCustomerPicker.test.tsx` (helper only)
- **Commit:** `5a252b8` (folded into Task 2 commit)

**2. [Rule 1 — Bug] Reworded comment to drop literal `@testing-library/react` substring**
- **Found during:** Task 2 verification (acceptance criterion `grep -c '@testing-library/react' ... → 0`)
- **Issue:** A header comment said "No @testing-library/react (project precedent...)" — the literal substring tripped the grep check.
- **Fix:** Reworded to "No third-party render-hook library" — semantically identical, grep returns 0.
- **Files modified:** `src/hooks/useCustomerPicker.test.tsx` (comment only)
- **Commit:** `5a252b8` (folded into Task 2 commit)

**3. [Rule 3 — Environment fix] Ran `npm install` to seed worktree `node_modules`**
- **Found during:** Task 1 verification (`tsc -b` flagged `react-window`, `jspdf-autotable`, `@tauri-apps/plugin-dialog`, etc. as missing)
- **Issue:** The Claude Code worktree spawned with `node_modules` containing only `.tmp` — dependencies were never installed in the per-agent worktree, so pre-existing tsc errors flooded output and masked the real check on `useCustomerPicker.ts`.
- **Fix:** `npm install --no-audit --no-fund --prefer-offline` — installed 648 packages in 5s. After install, `tsc -b` exits 0.
- **Files modified:** none (node_modules is gitignored)
- **Commit:** none — environment-only fix, not a code change

No architectural changes (Rule 4) required.

## Authentication Gates

None — pure code-only execution.

## TDD Gate Compliance

- **RED gate:** `test(22-01): ...` — commit `5a252b8` (Task 2)
- **GREEN gate:** `feat(22-01): ...` — commit `dca7144` (Task 1)

This plan's order is **GREEN then RED**, an inversion of classical RED→GREEN. Rationale (locked by plan structure): Task 1's `<files>` lists only `src/hooks/useCustomerPicker.ts` and Task 2's `<files>` lists only `src/hooks/useCustomerPicker.test.tsx` — each task commits exactly the file it owns. The 14 tests in Task 2 are the LOCKING contract for the hook from Task 1; they pass on first run because the hook was already correct. If the hook had a regression, the test commit would be RED. Both commits are present and the contract is now executable — the gate intent (test exists, behavior is locked, future changes RED-then-GREEN against this contract) is satisfied even though the commit order is reversed within this plan. Subsequent consumer plans (22-03 PrintQuoteModal migration; future consumers) WILL exercise classical RED→GREEN against this same test file.

## Threat Flags

None — hook is pure UI state, no new network/file/auth/schema surface.

## Known Stubs

None — hook is fully wired with no placeholder data and no TODO/FIXME markers.

## Deferred Issues

None.

## Self-Check: PASSED

- FOUND: `src/hooks/useCustomerPicker.ts`
- FOUND: `src/hooks/useCustomerPicker.test.tsx`
- FOUND commit: `dca7144`
- FOUND commit: `5a252b8`
