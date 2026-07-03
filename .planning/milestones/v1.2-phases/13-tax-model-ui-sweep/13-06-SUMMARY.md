---
phase: 13-tax-model-ui-sweep
plan: 06
subsystem: ui
tags: [ui-10, newbadge-cleanup, feature-registry, react, typescript]

# Dependency graph
requires:
  - phase: 13-tax-model-ui-sweep
    provides: "Plan 03 — emitted <NewBadge feature='default-tax-rate' /> JSX in SettingsModal; Plan 04 — removed 2 NewBadge JSX sites from AssetLibrary and dropped the NewBadge import; Plan 05 — removed 3 NewBadge JSX sites from CostCalculator (kept NewBadge import for model-url)"
provides:
  - "src/components/UserProfileModal.tsx — zero NewBadge references (JSX + import dropped); Currency label simplified back to `block` (the flex layout existed solely to host the inline badge)"
  - "src/components/GcodeImport.tsx — zero NewBadge references (JSX + import dropped); drop-zone <p> simplified back to `text-sm` (the flex-justify-center existed solely to inline the badges with text)"
  - "src/features.ts — exactly 4 fresh entries (settings-reorg 2026-05-20, default-profit-margin 2026-05-18, model-url 2026-05-20, default-tax-rate 2026-05-21); 9 stale entries pruned"
  - "UI-10 audit complete — all 11 stale NewBadge JSX sites removed across the phase (2 in AssetLibrary via Plan 04; 3 in CostCalculator via Plan 05; 1 in UserProfileModal + 2 in GcodeImport via this plan); Plan 03's default-tax-rate JSX badge now resolves to a valid registry entry and will render for users opening the app within the 14-day window of 2026-05-21"
affects:
  - "Phase 14 (Etsy helper) and Phase 16 (PDF) — no badge-related dependencies; the trimmed registry is the canonical state going forward"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pitfall 6 sequencing enforced: JSX consumers removed FIRST (Plans 04/05 + this plan's Task 1), then cross-repo grep gate verified ZERO remaining consumers for the 9 stale keys, then the registry entries were deleted in Task 2"
    - "Host-class cleanup on badge removal: when a parent's `flex items-center gap-1.5` (label) or `flex items-center justify-center gap-1.5` (paragraph) existed SOLELY to host the inline badge, the parent class simplifies back to its sibling default (`block` for labels, `text-sm` for paragraphs) — preserves visual consistency with neighboring elements"

key-files:
  created: []
  modified:
    - "src/components/UserProfileModal.tsx — drop NewBadge import + JSX site + simplify Currency label class"
    - "src/components/GcodeImport.tsx — drop NewBadge import + 2 JSX sites + simplify drop-zone <p> class"
    - "src/features.ts — prune from 12 entries to exactly 4 (add default-tax-rate, remove 9 stale)"

key-decisions:
  - "Currency label in UserProfileModal simplified from `flex items-center gap-1.5` back to `block` — the flex hosting pattern existed only for the inline badge; sibling labels (Name, Street Address, City, etc.) use `block text-xs text-slate-400 mb-1` and the simplification restores visual consistency. Plan action text authorizes executor judgment on host-class cleanup ('if the parent has a class that exists SOLELY to host the badge, remove it')."
  - "Drop-zone <p> in GcodeImport simplified from `text-sm flex items-center justify-center gap-1.5` to `text-sm` — same reasoning. The outer drop-zone <div> already has `text-center` so paragraph text inherits centering; the flex/justify-center existed solely to inline the badges next to the text."
  - "default-tax-rate registry entry date is 2026-05-21 — matches Plan 03's JSX badge feature key (verified via 13-03-SUMMARY frontmatter and the SettingsModal feature='default-tax-rate' literal). This closes the Plan 03 orphan: the badge will now resolve and render."
  - "Trailing `// Add new features here with their release date` comment retained — cosmetic, not functional. Plan action text marks it 'optional, executor discretion'."

patterns-established:
  - "UI-10 audit completion pattern: (1) audit JSX consumers across all surfaces, (2) remove JSX sites in dependency-ordered waves, (3) cross-repo grep gate verifies zero stragglers, (4) registry entries pruned LAST. The two-stage gate (per-file zero-refs check + cross-repo audit) is the contract that prevents registry-only orphans."

requirements-completed: [UI-10]

# Metrics
duration: ~3min
completed: 2026-05-21
---

# Phase 13 Plan 06: NewBadge Registry Cleanup Summary

**UI-10 audit completed — 3 remaining stale NewBadge JSX sites removed (UserProfileModal + GcodeImport), both files' NewBadge imports dropped, and `src/features.ts` pruned from 12 entries down to exactly 4 (settings-reorg, default-profit-margin, model-url, default-tax-rate). Plan 03's default-tax-rate badge now has a valid registry entry and will render.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-21T13:18Z (approx)
- **Completed:** 2026-05-21T13:23Z
- **Tasks:** 2 / 2
- **Files modified:** 3

## Accomplishments

- **UserProfileModal.tsx:** `<NewBadge feature="multi-currency" />` deleted; `import { NewBadge } from './NewBadge';` deleted; Currency label class simplified from `flex items-center gap-1.5 text-xs text-slate-400 mb-1` back to `block text-xs text-slate-400 mb-1` to match sibling labels in the same modal.
- **GcodeImport.tsx:** `<NewBadge feature="gcode-import" />` and `<NewBadge feature="3mf-import" />` deleted; `import { NewBadge } from './NewBadge';` deleted; drop-zone paragraph class simplified from `text-sm flex items-center justify-center gap-1.5` back to `text-sm`.
- **src/features.ts:** 9 stale entries removed (`per-unit-licensing`, `author-min-price`, `configurable-marketplace-fees`, `custom-carriers`, `multi-currency`, `packaging-materials`, `csv-import`, `gcode-import`, `3mf-import`); 1 new entry added (`default-tax-rate: new Date('2026-05-21')`); 3 fresh entries retained (`settings-reorg`, `default-profit-margin`, `model-url`). Final registry has exactly 4 entries.
- **Cross-repo audit gate satisfied BEFORE the registry edit** (Pitfall 6): `grep -rE 'NewBadge feature="(per-unit-licensing|...)"' src/` returned zero matches across the entire `src/` tree after Task 1's JSX removals, confirming all 9 stale keys had zero remaining JSX consumers.

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove NewBadge JSX + import from UserProfileModal and GcodeImport** — `47f2067` (refactor)
2. **Task 2: Prune src/features.ts to 4 fresh entries (add default-tax-rate; remove 9 stale)** — `5227446` (chore)

_Note: Plan is `tdd="true"` per frontmatter, but tasks are purely subtractive (JSX deletion + registry pruning) with no `<behavior>` block — the MVP+TDD gate predicate (`tdd=true AND behavior block AND non-test source files`) returns false for both tasks, so the gate is not applicable. Verification gate is `npx tsc -b` + the plan's grep acceptance criteria + the cross-repo audit gate (manual UAT deferred to phase wrap-up per VALIDATION.md row 12)._

## Files Created/Modified

- `src/components/UserProfileModal.tsx` — 6 lines deleted, 2 inserted (net -4). NewBadge import removed; multi-currency badge JSX removed; Currency label class simplified.
- `src/components/GcodeImport.tsx` — 5 lines deleted, 2 inserted (net -3). NewBadge import removed; both gcode-import and 3mf-import badges removed; drop-zone <p> class simplified.
- `src/features.ts` — 10 lines deleted, 1 inserted (net -9). Registry shrunk from 12 entries to 4; default-tax-rate added with today's date.

## Decisions Made

- **Host-class simplification on badge removal** — both files had parent elements (`<label>` in UserProfileModal, `<p>` in GcodeImport) using a flex layout solely to host the inline badge. Per the plan's action text ("if the parent has a class that exists SOLELY to host the badge, remove it"), both parents reverted to their sibling defaults (`block` for the label, `text-sm` for the paragraph). This keeps the UserProfileModal Currency label visually consistent with the surrounding 6 labels (Name, Street Address, City, Province/State, Postal/ZIP, Country) and preserves the drop-zone paragraph's inherited text-center from its parent.
- **default-tax-rate date matches Plan 03's JSX authoring date** — Plan 03's SettingsModal h3 emits `<NewBadge feature="default-tax-rate" />` and the must_haves contract locks the date to 2026-05-21 (today). The registry entry uses `new Date('2026-05-21')` verbatim per the must_haves.truths line.
- **Trailing comment retained** — the `// Add new features here with their release date` comment is documentation for future contributors. Removing it would have been a separate cosmetic decision unrelated to UI-10; left in place.
- **Cross-repo grep run AFTER Task 1, BEFORE Task 2** — Pitfall 6 sequencing: confirm zero JSX consumers exist for the 9 stale keys before deleting their registry entries. The grep returned zero matches across all of `src/`, so the Task 2 deletion was safe.

## Deviations from Plan

None — plan executed exactly as written.

The only judgment calls (simplifying the host classes in both Task 1 files) were explicitly authorized by the plan action text. No new files, no behavior changes, no scope creep.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration, no environment variables.

## Verification Evidence

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| `npx tsc -b` after Task 1 | exit 0 | exit 0 | PASS |
| `npx tsc -b` after Task 2 | exit 0 | exit 0 | PASS |
| `! grep -n "NewBadge" src/components/UserProfileModal.tsx` | zero matches | zero matches | PASS |
| `! grep -n "NewBadge" src/components/GcodeImport.tsx` | zero matches | zero matches | PASS |
| `! grep -F 'feature="multi-currency"' src/components/UserProfileModal.tsx` | zero matches | zero matches | PASS |
| `! grep -F 'feature="gcode-import"' src/components/GcodeImport.tsx` | zero matches | zero matches | PASS |
| `! grep -F 'feature="3mf-import"' src/components/GcodeImport.tsx` | zero matches | zero matches | PASS |
| Cross-repo stale-key audit (VALIDATION row 19) | zero matches | zero matches across all of `src/` | PASS |
| `grep -v '^\s*//' src/features.ts \| grep -cE 'new Date\('` (VALIDATION row 20) | exactly 4 | 4 | PASS |
| `grep -F "'default-tax-rate': new Date('2026-05-21')" src/features.ts` | 1 match | 1 match | PASS |
| `grep -F "'settings-reorg':" src/features.ts` | 1 match | 1 match | PASS |
| `grep -F "'default-profit-margin':" src/features.ts` | 1 match | 1 match | PASS |
| `grep -F "'model-url':" src/features.ts` | 1 match | 1 match | PASS |
| 9 stale entries absent from `src/features.ts` | all absent | all 9 absent | PASS |
| `npx vitest run` (full plan-level suite) | green | 6 files, 92 tests passed | PASS |

## Threat Surface

No new threat surface beyond the planned register. T-13-19 (orphaned registry vs orphaned JSX) is mitigated by the Pitfall 6 sequencing — the cross-repo grep gate ran AFTER Task 1's JSX removals and BEFORE Task 2's registry pruning, confirming zero stale JSX consumers existed at the moment the registry entries were deleted. T-13-20 (stale badge leaking past `NEW_FEATURE_MAX_AGE_DAYS`) is closed because both the JSX consumers and the registry entries for the 9 stale keys are now removed. T-13-21 (NewBadge with unknown key) remains the safe fallback (NewBadge.tsx returns null), now exercised only by Plan 03's `default-tax-rate` JSX which DOES have a valid entry. T-13-SC (package legitimacy) accept — zero new packages installed in this plan.

## Known Stubs

None.

## Next Phase Readiness

- **UI-10 audit is fully closed.** All 11 stale NewBadge JSX sites identified in the phase RESEARCH inventory have been removed across Plans 03/04/05/06. The 4-entry registry contract from UI-SPEC line 207 is in place.
- **Plan 03's `default-tax-rate` badge will now render** for users who open the app within the 14-day window starting 2026-05-21 (i.e., through 2026-06-04), gated by the 36-hour user-seen window per the NewBadge two-gate contract.
- **Phase 13 execution is complete pending verification.** Plans 01, 02, 03, 04, 05, 06 have all landed. Phase wrap-up next: `/gsd:verify-work` on this plan, then phase-level verifier on the full 6-plan delta.
- **Phase 14 (Etsy helper)** has no dependency on the NewBadge registry; the trimmed registry is the canonical state going forward.

## Self-Check: PASSED

**Files modified verified present:**
- FOUND: src/components/UserProfileModal.tsx
- FOUND: src/components/GcodeImport.tsx
- FOUND: src/features.ts

**Commits verified present in `git log --oneline`:**
- FOUND: 47f2067 (refactor(13-06): remove stale NewBadge JSX + imports from UserProfileModal and GcodeImport)
- FOUND: 5227446 (chore(13-06): prune features.ts to 4 fresh entries (add default-tax-rate))

**Plan acceptance criteria verified:**
- UserProfileModal.tsx: zero NewBadge references (JSX + import) — verified via grep
- GcodeImport.tsx: zero NewBadge references (JSX + import) — verified via grep
- features.ts: exactly 4 entries, contents match the must_haves contract verbatim
- Cross-repo stale-key audit gate (VALIDATION row 19): zero matches
- Entry-count gate (VALIDATION row 20): exactly 4 non-comment `new Date(` lines
- `npx tsc -b` exits 0
- `npx vitest run` passes 92/92 (no regressions from registry/JSX cleanup)

---
*Phase: 13-tax-model-ui-sweep*
*Plan: 06*
*Completed: 2026-05-21*
