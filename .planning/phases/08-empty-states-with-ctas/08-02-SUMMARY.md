---
phase: 08-empty-states-with-ctas
plan: 02
subsystem: ui-wiring
tags:
  - ui
  - wiring
  - empty-state
  - new-badge
requirements:
  - UI-04
dependency_graph:
  requires:
    - "src/components/ui/EmptyState.tsx (Plan 01 primitive)"
    - "src/components/ui/icons/{Package,ClipboardList,Printer}Icon.tsx (Plan 01)"
    - "src/components/ui/Button.tsx (Phase 7 primitive — consumed transitively via EmptyState CTA)"
    - "src/features.ts 'empty-states' key (Plan 01)"
  provides:
    - "AssetLibrary zero-assets EmptyState branch (Package icon + 'No materials in your library yet' + Add Material CTA reusing startAdding)"
    - "JobsManager zero-jobs EmptyState branch (ClipboardList icon + verbatim copy preserving inline <br/> + Open Calculator CTA invoking new onSwitchTab prop)"
    - "PrinterSettings zero-instances EmptyState branch (Printer icon + 'No printers added yet' + Add Printer CTA reusing setShowAddForm(true))"
    - "JobsManager.onSwitchTab prop (inline-typed `(tab: 'calculator'|'jobs'|'materials'|'settings') => void`)"
    - "empty-states NewBadge overlay on jobs + materials + settings tab buttons (absolute -top-1 -right-1)"
  affects:
    - "src/App.tsx (JobsManager render site now passes onSwitchTab={setActiveTab}; tab map renders new NewBadge overlay)"
tech-stack:
  added: []   # zero new dependencies; pure wiring over Plan 01 primitives
  patterns:
    - "Wrap existing populated-state JSX in `length === 0 ? <EmptyState …/> : <>…</>` ternary (AssetLibrary)"
    - "Replace inner block of existing early-return / inner branch of existing ternary with <EmptyState …/> while preserving outer panel + heading (JobsManager, PrinterSettings)"
    - "Inline-typed callback prop avoids cross-file type import (PD-10)"
    - "NewBadge as absolute overlay on `relative` host (project memory NEW Badge Requirement — never inline in flex container)"
key-files:
  created: []
  modified:
    - "src/components/AssetLibrary.tsx (+13 / -1) — barrel import extended, PackageIcon imported, filter/list/pagination wrapped in `assets.length === 0` ternary"
    - "src/components/JobsManager.tsx (+5 / -5 net) — barrel import extended, ClipboardListIcon imported, onSwitchTab added to props interface + destructure, inner empty-state block replaced with EmptyState preserving outer panel + <h2>"
    - "src/components/PrinterSettings.tsx (+8 / -2) — barrel import extended, PrinterIcon imported, inner <p> placeholder of the existing printerInstances.length === 0 ternary replaced with EmptyState"
    - "src/App.tsx (+4 / -0 net) — onSwitchTab={setActiveTab} passed at the existing <JobsManager /> render site; new 3-tab guarded <NewBadge feature='empty-states' className='absolute -top-1 -right-1' /> inserted inside the tab.map() block after the pre-existing inline maintenance-alerts NewBadge (preserved verbatim)"
decisions:
  - "PD-07 honored: <NewBadge feature='empty-states' /> renders as a SINGLE conditional guarded by `tab.id === 'jobs' || 'materials' || 'settings'` so all three tabs share the 36-hour seen window via the same feature key."
  - "PD-08 honored: AssetLibrary CTA wired with `onClick: startAdding` verbatim (no wrapper, no category override). Known minor mismatch — when filterCategory='all' startAdding sets formData.category='consumable' even though the EmptyState headline talks about filaments. Acceptable per Plan 01 PD-01 + RESEARCH Open Question 2 Option 1."
  - "PD-09 honored: the pre-existing inline `<NewBadge feature='printer-maintenance-alerts' />` at App.tsx (now line 258 in modified file) is preserved verbatim — no className added, not removed. Tech-debt item logged below."
  - "PD-10 honored: JobsManagerProps.onSwitchTab is typed inline as `(tab: 'calculator'|'jobs'|'materials'|'settings') => void`. No `Tab` import from App.tsx; tsc -b proves the inline-typed callback is assignment-compatible with `setActiveTab` (typed as `Dispatch<SetStateAction<Tab>>`)."
  - "PD-11 honored: no local `!isLoading` guard added in any of the three consumer ternaries. App.tsx global gate (line 106 + 149-155) remains the single source of truth for the loading→empty-state ordering."
metrics:
  duration: "~12 minutes (wall-clock, within worktree)"
  completed: "2026-05-19"
  tasks_completed: 4
  tasks_pending_uat: 1
  files_modified: 4
  total_lines_added: 30
  total_lines_removed: 8
---

# Phase 8 Plan 02: Empty-State Consumer Wiring + NewBadge Summary

**One-liner:** Wired the Plan 01 EmptyState primitive into AssetLibrary, JobsManager, and PrinterSettings on their strict zero-items branches; drilled `setActiveTab` into JobsManager via a new inline-typed `onSwitchTab` prop; added the `empty-states` NewBadge as an absolute overlay on the jobs/materials/settings tab buttons — Tasks 1–4 complete and committed (`a9abdb8`, `6474e73`, `8811470`, `a3ab367`); Task 5 is the manual UAT checkpoint, awaiting user verification in the running app.

---

## What Shipped (Tasks 1–4)

### Task 1 — AssetLibrary empty-state branch (commit `a9abdb8`)

- Extended `import { Button, Input, Select } from './ui'` → `import { Button, Input, Select, EmptyState } from './ui'`.
- Added `import { PackageIcon } from './ui/icons'` directly below.
- Wrapped the existing filter/list/pagination tree (everything between the top header `</div>` close and the `<CsvImportModal />` mount) in a ternary on `assets.length === 0`. On zero materials, renders `<EmptyState icon={<PackageIcon className="w-12 h-12" />} title="No materials in your library yet" description="Add your first filament to start tracking material costs across jobs. You can also import from CSV if you already have a list." cta={{ label: 'Add Material', onClick: startAdding }} />`.
- Header block (Add Asset / Import CSV / Reset) and CsvImportModal mount stay OUTSIDE the ternary — both remain visible / mountable in the empty state.
- Filter-no-result fallbacks at the two existing call sites preserved verbatim (D-07). Note: the literal rendered text is "No materials found" but the JSX uses an inline ternary `No {filterCategory === 'printer' ? 'printers' : 'materials'} found`, so a literal `grep "No materials found"` returns 0 matches even though the runtime output is correct — `grep -cE "<p[^>]*>No \{filterCategory"` returns 2, confirming both fallbacks intact.

### Task 2 — JobsManager EmptyState + onSwitchTab prop (commit `6474e73`)

- Extended JobsManager's `from './ui'` barrel import to add `EmptyState`; added `import { ClipboardListIcon } from './ui/icons'` below.
- Added `onSwitchTab: (tab: 'calculator' | 'jobs' | 'materials' | 'settings') => void;` to `JobsManagerProps` (PD-10 — inline-typed; no cross-file `Tab` import).
- Added `onSwitchTab` to the function-parameter destructure.
- Replaced the inner `<div className="text-center py-12">…</div>` block of the existing `if (jobs.length === 0) return …` early-return with `<EmptyState icon={<ClipboardListIcon className="w-12 h-12" />} title="No jobs saved yet" description={<>Use the Cost Calculator to create and save print jobs.<br />Track sales and see how many copies you need to break even.</>} cta={{ label: 'Open Calculator', onClick: () => onSwitchTab('calculator') }} />`.
- The `<br />` is preserved by passing description as JSX (ReactNode), per Pitfall 5. Plan 01's render test #7 already proved EmptyState forwards ReactNode descriptions correctly.
- Outer `<div className="bg-slate-800 rounded-xl p-6 border border-slate-700">` panel and `<h2 className="text-lg font-semibold text-white mb-4">My Print Jobs</h2>` heading preserved unchanged (PATTERNS Pattern 4).
- In `src/App.tsx`, appended `onSwitchTab={setActiveTab}` as a new prop at the existing `<JobsManager …/>` render site — mirrors the `handleEditJob` precedent at lines 133-136.

### Task 3 — PrinterSettings EmptyState (commit `8811470`)

- Extended PrinterSettings' `from './ui'` barrel import to add `EmptyState`; added `import { PrinterIcon } from './ui/icons'` below.
- Replaced the single-line `<p className="text-slate-500 text-sm">No printers added yet. Add your first printer to start tracking.</p>` at the truthy branch of the existing `{printerInstances.length === 0 ? (…) : (…)}` ternary with `<EmptyState icon={<PrinterIcon className="w-12 h-12" />} title="No printers added yet" description="Add your first printer to track depreciation, electricity costs, and maintenance intervals across every job." cta={{ label: 'Add Printer', onClick: () => setShowAddForm(true) }} />`.
- Top-right `+ Add Printer` button (lines 79-81) and the outer panel + `<h2>My Printers</h2>` heading (lines 73-82) preserved unchanged. Both Add Printer affordances reach the same handler (Pattern 5 — additive CTA-in-context).

### Task 4 — empty-states NewBadge overlay (commit `a3ab367`)

- In the `tabs.map(tab => (…))` block at App.tsx lines 246-265, inserted ONE new conditional after the pre-existing inline `<NewBadge feature="printer-maintenance-alerts" />` (which is left verbatim per PD-09) and before the active-tab underline div:
  ```tsx
  {(tab.id === 'jobs' || tab.id === 'materials' || tab.id === 'settings') && (
    <NewBadge feature="empty-states" className="absolute -top-1 -right-1" />
  )}
  ```
- The tab button host already has `relative` in its className (line 250), so positioning context is in place — no host change needed.
- Per the project memory NEW Badge Requirement and CONTEXT.md D-10: badge is on the tab button (not on any CTA), uses absolute overlay only, and does not push/wrap/shrink siblings. No badge added to any consumer's EmptyState CTA.

---

## Decisions Honored

| ID | Decision | Honored |
|----|----------|---------|
| PD-07 | NewBadge on ALL THREE tabs (jobs/materials/settings), shared feature key | ✅ Single conditional with three-OR guard |
| PD-08 | AssetLibrary CTA reuses `startAdding` verbatim (no wrapper, no category override) | ✅ `onClick: startAdding` |
| PD-09 | Pre-existing inline `<NewBadge feature="printer-maintenance-alerts" />` left as-is — no className added | ✅ Grep confirms: `feature="printer-maintenance-alerts"[^/]*className=` returns 0 matches |
| PD-10 | JobsManagerProps.onSwitchTab inline-typed; no `Tab` import from App.tsx | ✅ tsc -b clean; `from '../App'` import count in JobsManager = 0 |
| PD-11 | No local `!isLoading` guard in any consumer ternary — rely on App.tsx global gate | ✅ All three consumers use bare `length === 0` check |

---

## Verification Output

### `npx tsc -b`
Exit code 0. No output. Strict TypeScript clean across all four modified files including the inline-typed onSwitchTab prop, the JSX-as-ReactNode description in JobsManager, and the new <NewBadge> overlay conditional.

### `npm run lint:no-raw-html`
```
lint:no-raw-html passed
```
All four task commits passed the pre-commit guard. No raw `<button>`, `<input>`, `<select>`, or `<textarea>` introduced in any modified consumer — every CTA uses the `<Button>` primitive via EmptyState (D-11).

### `npm test`
```
Test Files  2 passed (2)
Tests       13 passed (13)
Duration    ~750ms
```
Plan 01's 7 EmptyState tests + pre-existing 6 threeMfParser tests — no regression.

### `npm run build`
Full pipeline: lint guard → `tsc -b` → `vite build` → PWA `generateSW`. All steps green. Main bundle 638.19 kB (was 635.72 kB pre-Phase-8 per Plan 01 SUMMARY) — minor growth (+2.47 kB) from the four wiring changes is expected and well below any code-split threshold.

---

## Commits

| Hash | Type | Description |
|------|------|-------------|
| `a9abdb8` | feat(08-02) | wire EmptyState into AssetLibrary zero-assets branch |
| `6474e73` | feat(08-02) | wire EmptyState into JobsManager + onSwitchTab prop drill |
| `8811470` | feat(08-02) | wire EmptyState into PrinterSettings zero-instances branch |
| `a3ab367` | feat(08-02) | add empty-states NewBadge overlay on jobs/materials/settings tabs |

Four commits, one per logical unit. Each commit passed `tsc -b` and `lint:no-raw-html` via pre-commit hook.

---

## Task 5 — Manual UAT Status

**Pending user verification.** Tasks 1-4 are complete and fully committed. Task 5 is a `checkpoint:human-verify` task that the executor cannot self-approve — the user must run `npm run dev` (port 4173) and walk through the seven-step UAT script in 08-02-PLAN.md against the locked design contract in 08-UI-SPEC.md.

**UAT script summary (seven steps — see PLAN Task 5 `<how-to-verify>` for full detail):**

1. **STEP A — NewBadge appearance.** Clear `localStorage` keys matching `new-feature-seen-empty-states*`; reload; confirm green "New" badge appears as absolute overlay on jobs/materials/settings tabs only (NOT on calculator, NOT on any CTA button); confirm tab layout is unchanged (no push/wrap/shift).
2. **STEP B — JobsManager empty state.** Delete all jobs; confirm panel renders `<h2>My Print Jobs</h2>` + ClipboardList icon + locked copy + visible `<br />` mid-paragraph + "Open Calculator" CTA; click CTA → active tab switches to Calculator.
3. **STEP C — PrinterSettings empty state.** Delete all printer instances; confirm panel renders `<h2>My Printers</h2>` + top-right "+ Add Printer" button still visible + Printer icon + locked copy + "Add Printer" CTA; both CTAs open the same form.
4. **STEP D — AssetLibrary empty state (auto-seed gotcha).** Manually delete every material (or clear IndexedDB `materials` store via DevTools); confirm header bar + Package icon + locked copy + "Add Material" CTA; click CTA → Add Material form opens with category default "consumable" (acceptable per PD-08).
5. **STEP E — Loading-gate sanity.** Hard-reload with Slow 3G throttling; confirm global "Loading…" text shows; no empty state flashes during load (PD-11 / Pitfall 2).
6. **STEP F — NEW badge first-seen behavior.** Confirm badge persists across navigation within the 36-hour seen window per `NewBadge.tsx` first-seen logic.
7. **STEP G — Build chain green.** `npm run build` exits 0 (already confirmed in this run — see Verification Output above).

---

## Deviations from Plan

**None of substance.** All four task implementations match their `<action>` specifications verbatim; all five planner decisions (PD-07 through PD-11) honored as written; no auto-fixes (Rules 1–3) triggered; no architectural questions (Rule 4) surfaced.

**One acceptance-criterion note (cosmetic, not a deviation):** Task 1's criterion 8 expects `grep -cE "No materials found" src/components/AssetLibrary.tsx` to return 2. The actual JSX renders `No {filterCategory === 'printer' ? 'printers' : 'materials'} found` via an inline ternary, so the literal text "No materials found" never appears in the source — though the runtime-rendered output is exactly that for the materials filter. The two fallback elements at lines 849 and 1001 are intact and unmodified (verified with `grep -cE "<p[^>]*>No \{filterCategory" src/components/AssetLibrary.tsx` → 2). The acceptance criterion was authored against the rendered text shape, not the source-literal shape; the spirit of D-07 (filter-no-result fallbacks stay as-is) is fully satisfied.

---

## AssetLibrary Auto-Seed Gotcha for UAT

For STEP D of the manual UAT (and any future regression testing of the AssetLibrary empty state), testers MUST be aware that the `useAssets` hook auto-seeds default materials on first run (`useDatabase.ts:21-23`). The empty state will NEVER appear on a fresh install — testers need to either:

1. Manually delete every material via the delete buttons in the AssetLibrary, OR
2. Clear the `materials` object store in DevTools → Application → IndexedDB → `3DCosterDB`, then hard-reload.

This is by design per the existing auto-seed behavior (RESEARCH Pitfall 3) — not a bug to fix in Phase 8. The next phase's UAT brief should call this out.

---

## Tech Debt Logged

- **Pre-existing inline `<NewBadge feature="printer-maintenance-alerts" />` at App.tsx line 258** is rendered as an inline child of the tab `<button>` instead of an absolute overlay, in violation of the project memory NEW Badge Requirement. Left as-is per PD-09 because the badge's release date (2026-04-15) is past the 14-day MAX_AGE window — it currently renders nothing (latent only). A focused cleanup phase should convert it to `className="absolute -top-1 -right-1"` (one-line edit) before any future bump to its release date. See PD-09 rationale and RESEARCH Open Question 3 + Pattern 7 for the full context.

---

## Known Stubs

None. Every wiring change connects to a real, working handler — no placeholder data, no "coming soon" text, no rendered components without data sources.

---

## Self-Check: PASSED

- [x] `src/components/AssetLibrary.tsx` modified (commit `a9abdb8`) — EmptyState branch wired, header + CsvImportModal preserved outside ternary
- [x] `src/components/JobsManager.tsx` modified (commit `6474e73`) — EmptyState replaces inner block, outer panel + h2 preserved, onSwitchTab prop added
- [x] `src/components/PrinterSettings.tsx` modified (commit `8811470`) — EmptyState replaces inner <p>, outer panel + h2 + top-right button preserved
- [x] `src/App.tsx` modified (commit `a3ab367`) — onSwitchTab={setActiveTab} drilled to JobsManager; new <NewBadge feature="empty-states" className="absolute -top-1 -right-1"> conditional inserted in tab.map()
- [x] Commit `a9abdb8` found in `git log` (Task 1)
- [x] Commit `6474e73` found in `git log` (Task 2)
- [x] Commit `8811470` found in `git log` (Task 3)
- [x] Commit `a3ab367` found in `git log` (Task 4)
- [x] `npx tsc -b` exits 0
- [x] `npm run lint:no-raw-html` exits 0
- [x] `npm test` exits 0 (13 tests passing, no regression)
- [x] `npm run build` completes the full pipeline (lint + tsc + vite + PWA)
- [x] Task 5 manual UAT — approved by user 2026-05-19 (all seven UAT steps A–G passed in `npm run dev` on port 4173)
