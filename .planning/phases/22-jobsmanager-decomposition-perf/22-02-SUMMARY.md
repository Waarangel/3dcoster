---
phase: 22-jobsmanager-decomposition-perf
plan: 02
subsystem: ui
tags: [icon, refactor, dedup, svg, react]

requires:
  - phase: 22 (Wave 0)
    provides: existing ui/icons barrel (PackageIcon, ClipboardListIcon, PrinterIcon)
provides:
  - Shared SearchIcon SVG component at src/components/ui/icons/SearchIcon.tsx
  - SearchIcon export added to ui/icons barrel
  - HYG-03 closed (SearchIcon SVG duplicate eliminated)
affects: [22-03-record-sale-modal, 22-04-use-customer-picker, 22-06-jobs-manager-shrink]

tech-stack:
  added: []
  patterns:
    - "Shared SVG icon module: function component + SVGProps spread + named export, re-exported via ui/icons barrel (mirrors PackageIcon.tsx)"

key-files:
  created:
    - src/components/ui/icons/SearchIcon.tsx
  modified:
    - src/components/ui/icons/index.ts
    - src/components/JobsManager.tsx
    - src/components/CustomerLibrary.tsx

key-decisions:
  - "PICKER_VISIBLE_LIMIT constant left in place in JobsManager.tsx — plan 22-03 owns its removal alongside picker state triplet (per 22-02-PLAN.md action note)"
  - "Separate `import { SearchIcon } from './ui/icons';` line in JobsManager rather than merging with existing `ClipboardListIcon` import — matches plan acceptance-criteria grep regex"

patterns-established:
  - "SVG icon dedup pattern: when a private icon SVG is needed by ≥2 components, extract to src/components/ui/icons/<Name>.tsx + add to barrel + delete locals (closes HYG family)"

requirements-completed: [HYG-03]

duration: 4min
completed: 2026-05-27
---

# Phase 22 Plan 02: Dedup SearchIcon SVG (HYG-03) Summary

**Extracted duplicate SearchIcon SVG (byte-identical copies in JobsManager.tsx:974-991 and CustomerLibrary.tsx:387-399) into shared src/components/ui/icons/SearchIcon.tsx, added it to the ui/icons barrel, and replaced both local copies with named imports — zero visual change, all 416 tests pass.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-05-27T16:08:47Z
- **Completed:** 2026-05-27T16:13:00Z
- **Tasks:** 2
- **Files modified:** 4 (1 created, 3 edited)

## Accomplishments

- Single source of truth for the SearchIcon SVG markup (path `M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z`, `strokeWidth={2}`, viewBox `0 0 24 24`) lives at `src/components/ui/icons/SearchIcon.tsx`
- Both consumers (`JobsManager.tsx` job search input + `CustomerLibrary.tsx` customer search input) now import from the `./ui/icons` barrel; 33 lines of duplicated SVG code deleted
- HYG-03 (TECH-DEBT H3 — SearchIcon SVG duplicate) closed
- Zero behavioral or visual change confirmed by full test suite (416 passed, 1 todo) and tsc -b clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Create SearchIcon component + update icons barrel** — `b5e98a8` (feat)
2. **Task 2: Delete local SearchIcon copies + import from barrel in both consumers** — `07c4111` (refactor)

## Files Created/Modified

- `src/components/ui/icons/SearchIcon.tsx` (created, 17 lines) — Shared SearchIcon function component mirroring PackageIcon.tsx structure, with the canonical SVG markup from CustomerLibrary's prior local copy (D-16)
- `src/components/ui/icons/index.ts` (1 line added → 4 lines total) — Added `export { SearchIcon } from './SearchIcon';`
- `src/components/JobsManager.tsx` (-17 lines local SearchIcon function + 3-line comment block; +1 line import) — `function SearchIcon` deleted; `import { SearchIcon } from './ui/icons';` added on line 9
- `src/components/CustomerLibrary.tsx` (-13 lines local SearchIcon function; +1 line import) — `function SearchIcon` deleted; `import { SearchIcon } from './ui/icons';` added on line 6

**Final ui/icons/index.ts content (4 lines):**

```typescript
export { PackageIcon } from './PackageIcon';
export { ClipboardListIcon } from './ClipboardListIcon';
export { PrinterIcon } from './PrinterIcon';
export { SearchIcon } from './SearchIcon';
```

**LOC delta (raw `git diff --numstat`):**
- JobsManager.tsx: +1 / -18 (net −17)
- CustomerLibrary.tsx: +1 / -15 (net −14)
- SearchIcon.tsx: +17 (new file)
- icons/index.ts: +1 / -0 (net +1)
- Combined: 33 lines of duplicated SVG markup eliminated; 17 lines added to shared module; net −13 LOC across affected files

**PICKER_VISIBLE_LIMIT touched? NO.** Plan explicitly noted: "Default action: LEAVE PICKER_VISIBLE_LIMIT in place; plan 22-03 owns its removal alongside the picker state triplet." Verified `grep -n "PICKER_VISIBLE_LIMIT" src/components/JobsManager.tsx` still returns 4 references (definition at line 993 + 3 picker call sites at lines 1289/1291/1937/1939 — the picker logic 22-03 will extract).

## Decisions Made

- **Separate import line for SearchIcon in JobsManager rather than merging with existing `ClipboardListIcon` import.** First attempted `import { ClipboardListIcon, SearchIcon } from './ui/icons';` but the plan's acceptance-criteria grep regex (`^import \{ SearchIcon \} from ['\"]\./ui/icons`) requires a standalone `import { SearchIcon }` line. Switched to separate import statements to match plan-specified verification.
- **PICKER_VISIBLE_LIMIT left untouched** — plan explicitly assigns its removal to plan 22-03 as part of the picker state-triplet extraction. Verified the constant is still actively referenced by `filteredCustomers.slice(...)`, the "Showing first N of M matches" footer, and the picker overflow logic in the inline Record Sale modal block.

## Deviations from Plan

None — plan executed exactly as written. Two micro-adjustments worth noting (neither qualifies as a deviation):

1. **Worktree node_modules bootstrap (one-time setup).** Initial `tsc -b` reported pre-existing module-not-found errors (react-window, jspdf, @tauri-apps/plugin-*) because the worktree was created without `node_modules` populated. Ran `npm install` once to bootstrap; afterward `tsc -b` exited 0 with zero diagnostics. This is standard worktree setup, not a plan deviation — the packages are all already in `package.json` (not new installs), and Rule 3's "package install" exclusion targets adding *new* packages, not bootstrapping existing ones.
2. **Import line shape adjusted to match plan grep regex** (documented under "Decisions Made") — followed plan instruction verbatim ("Add it adjacent to other `./ui` imports") after first-pass merge attempt failed the acceptance regex.

## Issues Encountered

None during planned work.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- HYG-03 closed; SearchIcon is now consumed by JobsManager.tsx (line 1727) and CustomerLibrary.tsx (line 236) via the shared barrel
- Wave-1 sibling plan 22-01 (useCustomerPicker) and Wave-2 plans 22-03 (RecordSaleModal extraction), 22-04 (useCustomerPicker hook adoption), 22-05 (SaleRow component), and 22-06 (JobsManager shrink) are unaffected by this change — they may also need SearchIcon and will pull it from the same barrel
- No merge conflicts expected with sibling Wave-1 plan 22-01 (different files: useCustomerPicker.ts vs ui/icons + 2 component import-block edits)

---

## Self-Check: PASSED

- `src/components/ui/icons/SearchIcon.tsx` — FOUND
- `src/components/ui/icons/index.ts` — FOUND (4 lines, including new SearchIcon export)
- `src/components/JobsManager.tsx` — FOUND (function SearchIcon deleted, import added)
- `src/components/CustomerLibrary.tsx` — FOUND (function SearchIcon deleted, import added)
- Commit `b5e98a8` (Task 1, feat) — FOUND in `git log`
- Commit `07c4111` (Task 2, refactor) — FOUND in `git log`
- `npx tsc -b` exit 0 — PASS
- `npm test --run` — 416 passed, 1 todo (PASS)
- `grep -c 'function SearchIcon' src/components/JobsManager.tsx src/components/CustomerLibrary.tsx` returns 0 / 0 — PASS
- `wc -l src/components/ui/icons/index.ts` returns 4 — PASS

---
*Phase: 22-jobsmanager-decomposition-perf*
*Completed: 2026-05-27*
