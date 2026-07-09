---
phase: 41-quick-win-features
plan: 03
subsystem: inventory
tags: [typescript, react, dexie, spool-lifecycle, moisture-risk]

# Dependency graph
requires:
  - phase: 41-quick-win-features (plan 01)
    provides: HygroscopicityClass union + Asset.openedAt/storageLocation/dryingLog/hygroscopicityOverride optional fields, spool-lifecycle NEW-badge key
  - phase: 39-cost-realism
    provides: "src/utils/abrasive.ts — the override-aware auto-detect resolver pattern this plan mirrors exactly for hygroscopicity"
provides:
  - "src/utils/hygroscopicity.ts — detectHygroscopicityClass/resolveHygroscopicityClass/resolveMoistureRisk/daysSinceOpened, pure module with a cited, locked day-threshold table"
  - "MoistureRiskBadge + one-tap log-drying IconButton on the Asset Library's filament rows (desktop MaterialRow + mobile MobileCardItem)"
  - "Spool section in the material edit modal: opened date, storage location, drying-log summary, hygroscopicity override Select"
affects: [41-04-PLAN, 41-05-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A second pure override-aware auto-detect resolver (hygroscopicity.ts) following abrasive.ts's exact shape: detect*(type, name) → resolve*(asset) with override-wins-over-auto-detect semantics."
    - "AssetRowCallbacks gained an OPTIONAL onLogDrying callback threaded through listRowProps/row adapters alongside onEdit/onDelete — the printer row path simply never receives/uses it, no type forking needed."

key-files:
  created:
    - src/utils/hygroscopicity.ts
    - src/utils/hygroscopicity.test.ts
  modified:
    - src/components/AssetLibrary.tsx

key-decisions:
  - "detectHygroscopicityClass matches nylon by NAME (nylon|pa6|pa11|pa12|polyamide) in addition to the two CF-nylon FilamentTypes (PA6-CF/PPA-CF) — closes RESEARCH.md Pitfall 1: FilamentType has no plain-nylon entry and the default catalog ships zero nylon rows."
  - "RISK_THRESHOLDS (HIGH 1/3, MEDIUM 3/7, LOW 14/30 days) shipped verbatim as the user-confirmed, cited values locked at plan-phase (41-RESEARCH.md 'Open Questions (RESOLVED)' Q1) — not re-derived."
  - "MoistureRiskBadge and the log-drying IconButton were added to BOTH the desktop MaterialRow and the mobile MobileCardItem (plan's acceptance criteria named MaterialRow only) — StockBadge/EditButton/DeleteButton already exist in both rows, so limiting the new feature to desktop only would have created a coverage gap for mobile users tracking spool lifecycle."
  - "daysSinceOpened returns null (not 0/LOW) when openedAt is unset; MoistureRiskBadge renders a muted 'Not opened' state for that case so an untracked spool never reads as false LOW risk."
  - "HYGRO_CLASS_LABELS (badge copy: HIGH→'Nylon/PA', MEDIUM→'PETG/TPU', LOW→'PLA') lives in AssetLibrary.tsx, not hygroscopicity.ts — it's UI-only presentation copy, not part of the pure module's resolver contract."

patterns-established:
  - "Spool section in the material edit form mirrors the abrasiveOverrideId Select block structure verbatim for the new hygroscopicityOverride Select, keeping the override-Select UX consistent across Phase 39/41 material fields."

requirements-completed: [LIFE-01]

coverage:
  - id: D1
    description: "hygroscopicity.ts resolves HIGH/MEDIUM/LOW hygroscopicity class (nylon-by-name included) and the current moisture-risk tier from a cited, locked day-threshold table"
    requirement: "LIFE-01"
    verification:
      - kind: unit
        ref: "src/utils/hygroscopicity.test.ts (15 tests: detect/resolve class incl. nylon-by-name, RISK_THRESHOLDS exact-match, resolveMoistureRisk day boundaries for all 3 classes, daysSinceOpened incl. null/drying-log-reset/pre-dating cases)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A moisture-risk badge (with days-open + guidance tooltip) and a one-tap log-drying action render on filament-category rows, both desktop and mobile, and never show a false LOW for an unopened spool"
    requirement: "LIFE-01"
    verification:
      - kind: unit
        ref: "npx tsc -b (exits 0); npm run lint:no-raw-html (passes — IconButton used, no raw <button>); src/components/AssetLibrary.test.tsx (16/16 pass, no regression)"
        status: pass
    human_judgment: true
    rationale: "The badge's visual tone/copy and the log-drying tap-to-reset interaction are UI-driven and best confirmed via UAT (deferred per the plan's own verification section); tsc + lint + the existing test suite prove the wiring compiles and doesn't regress prior AssetLibrary behavior, but no test asserts the badge's rendered risk tier or the drying-log append visually."
  - id: D3
    description: "The material edit modal's Spool section captures opened date, storage location, drying-log summary + log action, and a hygroscopicity override Select; 'New spool' resets the clock; all four fields persist through handleSubmit"
    requirement: "LIFE-01"
    verification:
      - kind: unit
        ref: "npx tsc -b (exits 0); npm run test (92 files / 1133 passed, 1 todo — full suite green); grep confirms no dangerouslySetInnerHTML in AssetLibrary.tsx"
        status: pass
    human_judgment: true
    rationale: "The end-to-end edit-form → save → persisted-fields flow is UI-driven and best confirmed via UAT (deferred per the plan's own verification section, which explicitly calls out 'set a nylon spool's opened date to 12 days ago' as a manual check); tsc + full suite prove the wiring compiles and doesn't regress, but the visual/interactive flow needs a human look."

# Metrics
duration: ~6min
completed: 2026-07-09
status: complete
---

# Phase 41 Plan 03: Spool Lifecycle + Moisture-Risk Badge (LIFE-01) Summary

**Pure hygroscopicity.ts resolver (mirroring abrasive.ts, nylon-by-name matching, a cited/locked day-threshold table) powering a moisture-risk badge + one-tap log-drying on filament rows, plus a full Spool section in the material edit modal.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-07-09T17:50:00Z (approx)
- **Completed:** 2026-07-09T17:56:00Z (approx)
- **Tasks:** 3
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments
- `src/utils/hygroscopicity.ts` exports `detectHygroscopicityClass`/`resolveHygroscopicityClass` (mirroring `abrasive.ts`'s override-aware auto-detect pattern verbatim), `resolveMoistureRisk`, and `daysSinceOpened`. The nylon-by-name regex (`nylon|pa6|pa11|pa12|polyamide`) closes RESEARCH.md Pitfall 1 — `FilamentType` has no plain-nylon entry, only `'PA6-CF'`/`'PPA-CF'`. `RISK_THRESHOLDS` ships the exact user-confirmed, cited day-threshold table (HIGH 1/3, MEDIUM 3/7, LOW 14/30 days) verbatim per the plan-phase lock.
- 15 unit tests cover class detection (CF-nylon types, plain-nylon names, MEDIUM/LOW classes, unknown default), override resolution, the exact `RISK_THRESHOLDS` shape, `resolveMoistureRisk`'s day-boundary transitions for all 3 classes, and `daysSinceOpened`'s null/drying-log-reset/pre-dating-log behavior.
- `AssetLibrary.tsx`'s `MaterialRow` (desktop) and `MobileCardItem` (mobile) both gained a `MoistureRiskBadge` (HIGH=red/MEDIUM=amber/LOW=green, "Not opened" muted state for an untracked spool, guidance `InfoTooltip`) and a one-tap `IconButton` "log drying" action (droplet icon, `aria-label="Log drying for {asset.name}"`) that appends today's ISO date to `dryingLog` immutably via the existing `onUpdateAsset` prop — threaded through `AssetRowCallbacks`/`listRowProps`/both row adapters as an optional `onLogDrying` callback.
- The material edit form's filament-only section gained a "Spool" subsection: an opened-date input with a "New spool" reset (sets `openedAt` to today, clears `dryingLog`), a storage-location text field, a read-only drying-log summary ("Last dried {date}, {n} sessions") with its own "Log drying today" action, and a hygroscopicity-override `Select` mirroring the existing `abrasiveOverrideId` block's structure. `handleSubmit`'s material-object build now carries all four new fields through to `onUpdateAsset`/`onAddAsset`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Pure hygroscopicity resolver + moisture-risk table (mirror abrasive.ts) with tests** - `c3f5418` (test)
2. **Task 2: Moisture-risk badge on the filament MaterialRow + one-tap log-drying from the card** - `3f4a4bb` (feat)
3. **Task 3: Spool section in the material edit modal (opened date, storage location, drying log, hygroscopicity override)** - `2671811` (feat)

**Plan metadata:** (pending — final docs commit follows this SUMMARY)

## Files Created/Modified
- `src/utils/hygroscopicity.ts` - Pure `detectHygroscopicityClass`/`resolveHygroscopicityClass`/`resolveMoistureRisk`/`daysSinceOpened` + `RISK_THRESHOLDS`/`HYGRO_PATTERNS`
- `src/utils/hygroscopicity.test.ts` - 15 tests covering class detection, override resolution, threshold values, risk-tier boundaries, and the moisture-risk clock
- `src/components/AssetLibrary.tsx` - `MoistureRiskBadge`/`DropletIcon`/`HYGRO_CLASS_LABELS` module-scope additions; `onLogDrying` threaded through `AssetRowCallbacks`/`listRowProps`/row adapters; `handleLogDrying` callback; Spool section in the edit form; `handleSubmit`'s material object extended with the four new fields

## Decisions Made
- Nylon-by-name matching in `detectHygroscopicityClass` mirrors `ABRASIVE_PATTERNS`'s dual match exactly, closing the documented FilamentType gap rather than only switching on the type union.
- `RISK_THRESHOLDS` shipped as the exact, previously user-confirmed numbers (no re-derivation) per the plan's explicit instruction and the "no arbitrary numbers" rule — provenance is in the file's header comment.
- Extended the moisture badge + log-drying action to both `MaterialRow` and `MobileCardItem` (plan's acceptance criteria named `MaterialRow` only) for feature parity with the existing `StockBadge`/`EditButton`/`DeleteButton` pattern that already appears in both rows — a desktop-only badge would have left mobile users unable to see spool risk or log drying sessions.
- `daysSinceOpened` returns `null` (not `0`) for an untracked spool so the badge can render a distinct "Not opened" state instead of a misleading LOW-risk badge.

## Deviations from Plan

None - plan executed exactly as written. (The MaterialRow-and-MobileCardItem badge/log-drying extension beyond the plan's literal acceptance-criteria wording is documented above as a decision, not a deviation — it stays within D-12's "filament card" scope and the plan's own read_first note that StockBadge already renders in both rows.)

## Issues Encountered
- `npm run lint:no-raw-html` initially flagged a false positive: a comment containing literal `<input type="date">` text matched the raw-HTML-detector's regex. Reworded the comment to avoid angle-bracket HTML-tag-like text; re-ran the lint script to confirm it passed. No code change was needed, only comment wording.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `npx tsc -b` exits 0; `npm run lint:no-raw-html` passes; full test suite green (92 files, 1133 passed, 1 todo).
- The end-to-end badge/log-drying/edit-modal flow is implemented per the plan's `<verification>` section but deferred to `/gsd-verify-work` UAT, matching the plan's own instruction ("Manual/UAT (deferred to /gsd-verify-work)") — including the plan's explicit callout to surface the shipped day-thresholds for user confirmation at UAT (RESEARCH flagged MEDIUM confidence).
- No blockers for Plans 41-04/41-05 — this plan touched only `src/utils/hygroscopicity.ts`/`.test.ts` (new) and `src/components/AssetLibrary.tsx`, none of which are in other Wave 3 plans' `files_modified`.

---
*Phase: 41-quick-win-features*
*Completed: 2026-07-09*

## Self-Check: PASSED

- FOUND: src/utils/hygroscopicity.ts
- FOUND: src/utils/hygroscopicity.test.ts
- FOUND: src/components/AssetLibrary.tsx
- FOUND: .planning/phases/41-quick-win-features/41-03-SUMMARY.md
- FOUND: c3f5418
- FOUND: 3f4a4bb
- FOUND: 2671811
