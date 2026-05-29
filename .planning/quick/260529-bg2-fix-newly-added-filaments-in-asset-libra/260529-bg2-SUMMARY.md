---
phase: quick-260529-bg2
plan: 01
subsystem: asset-library / cost-calculator
tags: [bugfix, filament, currency, reconcile, dexie]
requires:
  - src/types.ts (Currency, Material, UserProfile)
  - src/db/database.ts (getUserProfile, materials.currency index)
provides:
  - AssetLibrary save layer writes currency (defaults to userCurrency)
  - FilamentSelector read layer tolerates null currency + Unbranded bucket
  - reconcileFilamentCurrency pure idempotent heal helper + useAssets wiring
affects:
  - src/components/AssetLibrary.tsx
  - src/App.tsx
  - src/components/FilamentSelector.tsx
  - src/db/backfill.ts
  - src/hooks/useDatabase.ts
  - src/db/backfill.test.ts
tech-stack:
  added: []
  patterns:
    - "Nullish-coalescing default (?? not ||) so an explicit value still wins"
    - "Synthetic 'Unbranded' group key sorted last, never drops brand-less rows"
    - "Pure idempotent reconcile helper cloned from reconcileQuoteCurrency"
    - "WR-01 one-per-page-load reconcile flag set AFTER bulkPut await; assets-undefined first-emission guard"
key-files:
  created: []
  modified:
    - src/components/AssetLibrary.tsx
    - src/App.tsx
    - src/components/FilamentSelector.tsx
    - src/db/backfill.ts
    - src/hooks/useDatabase.ts
    - src/db/backfill.test.ts
decisions:
  - "Read rule stays `currency === userCurrency || currency == null` — tolerate only null/undefined, never a different explicit currency (no false positives)"
  - "No CAD/USD/FX scope creep; USD-seeded Bambu rows are never reconciled"
  - "No new form controls; category 'All'-tab default ('consumable') left untouched"
metrics:
  duration: "~16 min"
  completed: "2026-05-29"
  tasks_completed: 3
  checkpoint_pending: 1
  files_modified: 6
---

# Phase quick-260529-bg2 Plan 01: Fix Newly-Added Filaments In Asset Library Summary

Closes every gate that dropped a legitimately-added filament from the Cost Calculator's `FilamentSelector` — at the save layer (currency now defaults to `userCurrency`), the read layer (null-currency tolerance + an "Unbranded" bucket), and via a one-time idempotent `reconcileFilamentCurrency` that heals already-saved `currency: undefined` rows on next app launch.

## What Was Built

### Task 1 — Save layer (commit `e6a8b64`)
- Added `userCurrency: Currency` to `AssetLibraryProps`; imported `Currency` in AssetLibrary.tsx; destructured it in the component signature.
- Material save branch now writes `currency: formData.currency ?? userCurrency` (nullish `??`, so a future explicit-currency value still wins).
- `App.tsx` wires `userCurrency={userProfile.currency}` at the `<AssetLibrary>` call site, mirroring the existing `<FilamentSelector>`/`<CostCalculator>`/`<JobsManager>` pattern.
- No new form controls added; category default untouched.

### Task 2 — Read layer (commit `1620a6c`)
- Relaxed the FilamentSelector filter to `m.category === 'filament' && (m.currency === userCurrency || m.currency == null)` (loose `== null` matches both `undefined` and `null`; a different explicit currency is still excluded).
- Brand-less filaments are bucketed under a synthetic `'Unbranded'` group key. `'Unbranded'` always sorts LAST; real brands stay alphabetical (`localeCompare`). `getFilamentsForBrand('Unbranded')` returns `!f.brand` rows; named groups return `f.brand === brand`. The dropdown render structure (mapping over `brands`) is unchanged.

### Task 3 — Reconcile (commit `5cc4f16`)
- Added pure, idempotent `reconcileFilamentCurrency(materials, currency)` to `backfill.ts`, cloned from `reconcileQuoteCurrency`: skips non-filament rows, skips rows with an explicit currency (`m.currency != null`), pushes spread copies for null-currency filament rows, returns `[]` when nothing needs patching. No Dexie/React/IO inside. Includes the four-example docstring.
- Wired into `useAssets` (useDatabase.ts) behind module-scope `filamentCurrencyReconcileRan`: a sibling `useEffect` placed AFTER the init effect (so seeds exist first), keyed on `[assets === undefined]`, with the `assets === undefined` first-emission guard, a `cancelled` flag, a try/catch that logs and does NOT throw, a one-shot `getUserProfile({ currency: 'CAD', ... })` read, `db.materials.bulkPut(patches)` only when `patches.length > 0`, and the WR-01 flag set AFTER the await resolves. No schema migration (the `currency` index already exists, so `bulkPut` updates it automatically).
- Added five unit tests to `backfill.test.ts`: null-currency patch, explicit-USD untouched, non-filament untouched, idempotent second pass, and spread-copy/no-mutation isolation.

## Verification

`npm run build` passes end-to-end (lint-no-raw-html, vitest run --coverage, tsc -b, vite build, bundle-size + pdf asserts):
- Test Files: 31 passed; Tests: 471 passed | 1 todo (+5 new vs. baseline).
- `tsc -b`: 0 type errors. lint-no-raw-html: passed (no new raw `<select>`/`<input>`).

Grep gates (all confirmed):
- `src/App.tsx:330` → `userCurrency={userProfile.currency}`
- `src/components/AssetLibrary.tsx:631` → `currency: formData.currency ?? userCurrency`
- `src/components/FilamentSelector.tsx:37` → `m.currency == null`
- `grep -c "Unbranded|UNBRANDED" FilamentSelector.tsx` → 7 (≥ 1)
- `reconcileFilamentCurrency` exported in backfill.ts and called in useDatabase.ts
- `filamentCurrencyReconcileRan` module flag + guard + post-await set present
- `if (assets === undefined) return` first-emission guard present

**Environment note (non-blocking):** the worktree had no installed `node_modules`, so the first build run reported 4 unresolved-import failures (`react-window`, `fake-indexeddb`, `@tauri-apps/plugin-*`) — all pre-existing missing dependencies, not introduced by these changes. Ran `npm install` (deps already declared in package.json) to make the verify gate runnable; the subsequent build is fully green.

## Pending Human Checkpoint (Task 4 — checkpoint:human-verify, gate=blocking)

Code is complete and the automated verify (npm run build) passes. The human UAT was NOT performed by the executor per task type. A dev server is already running on http://localhost:4173.

UAT steps for the human:
1. **NEW-ADD (unbranded):** Asset Library → Filament tab → "+ Add Filament", fill Name/Unit/Package Cost/Units, leave Brand BLANK, Save. Cost Calculator → open FilamentSelector → confirm it appears under an "Unbranded" group at the bottom.
2. **BRANDED:** Add another filament WITH a Brand. Confirm it appears under that brand's group (alphabetical) and "Unbranded" still sorts last.
3. **RECONCILE:** Reload once — a previously-invisible user-added filament should now appear. Reload a SECOND time — no console errors, no duplicate writes (idempotent).
4. **NEGATIVE:** A filament tagged with a DIFFERENT explicit currency than the profile should still NOT appear.

Resume signal: type "approved" once branded + unbranded filaments appear and reconcile heals existing rows, or describe any row still missing.

## Deviations from Plan

**[Rule 3 - Blocking issue] Installed declared dependencies so the verify gate could run.**
- **Found during:** Task 1 automated verify.
- **Issue:** The worktree had no resolvable `node_modules`; `npm run build`'s vitest step failed on unresolved imports of `react-window`, `fake-indexeddb`, and `@tauri-apps/plugin-dialog/fs` — all already declared in `package.json` but not installed in this worktree's resolution path. Not caused by the task changes.
- **Fix:** Ran `npm install` (no package added/changed — only restored already-declared deps). This is a dependency restore, NOT a package-manager install of a new/unverified package, so the package-legitimacy checkpoint does not apply.
- **Files modified:** none (node_modules is gitignored and not committed).
- **Commit:** n/a (no source change).

No other deviations — the three implementation tasks executed exactly as written.

## Known Stubs

None. No hardcoded empty values, placeholder text, or unwired data sources were introduced.

## Self-Check: PASSED

Files modified exist:
- FOUND: src/components/AssetLibrary.tsx
- FOUND: src/App.tsx
- FOUND: src/components/FilamentSelector.tsx
- FOUND: src/db/backfill.ts
- FOUND: src/hooks/useDatabase.ts
- FOUND: src/db/backfill.test.ts

Commits exist:
- FOUND: e6a8b64 (Task 1 — save layer)
- FOUND: 1620a6c (Task 2 — read layer)
- FOUND: 5cc4f16 (Task 3 — reconcile + tests)
