---
phase: 16-printable-pdf-quote
plan: "04"
subsystem: pdf-ui-wiring
tags: [pdf, buttons, ui-wiring, quote-number, component-tests, vite-config]
dependency_graph:
  requires:
    - 16-01 (assert-no-static-jspdf.mjs, assert-no-pdf-preload.mjs gate scripts)
    - 16-02 (UserProfile.defaultTerms field, pdf-quote feature flag)
    - 16-03 (src/pdf/generateQuotePdf.ts — dynamic import target)
  provides:
    - src/components/CostCalculator.tsx — Generate PDF button + handler + GeneratePdfButton subcomponent + REQUIRED onPersistQuoteNumber prop
    - src/components/JobsManager.tsx — Generate PDF button in expanded accordion + handler + REQUIRED onPersistQuoteNumber + userProfile props
    - src/components/UserProfileModal.tsx — Default Quote Terms textarea bound to userProfile.defaultTerms
    - src/components/CostCalculator.test.tsx — 4 real tests for GeneratePdfButton disabled-state (no it.todo remaining)
    - src/App.tsx — handlePersistQuoteNumber (atomic db.jobs.put + dbSetUserProfile + setEditingJob state sync)
    - vite.config.ts — modulePreload: false + named pdf manualChunk
  affects:
    - src/App.tsx (new imports: db, setUserProfile as dbSetUserProfile; new handler; updated CostCalculator + JobsManager props)
    - vite.config.ts (build.modulePreload + rollupOptions.output.manualChunks extended with pdf branch)
tech_stack:
  added: []
  patterns:
    - GeneratePdfButton extracted as exported subcomponent (focused prop surface for testability)
    - createRoot + act pattern for jsdom React component testing without @testing-library/react
    - isGenerating state flag (T-16-12 double-click prevention)
    - generatingJobIds Set<string> for per-job parallel PDF generation (JobsManager)
    - REQUIRED onPersistQuoteNumber callback (no ?: in props interface — TypeScript enforces App.tsx provides it)
    - Atomic sequenced writes: db.jobs.put() then dbSetUserProfile() then setEditingJob() state sync
    - Dynamic import pattern: await import('../pdf/generateQuotePdf') on both surfaces
    - v1.2 limitation comment in CostCalculator handler (no customer block — use JobsManager for customer-attached PDFs)
    - modulePreload: false + manualChunks pdf branch for lazy-loading contract
key_files:
  created:
    - (none — all existing files modified)
  modified:
    - src/components/CostCalculator.tsx
    - src/components/JobsManager.tsx
    - src/components/UserProfileModal.tsx
    - src/components/CostCalculator.test.tsx
    - src/App.tsx
    - vite.config.ts
decisions:
  - "GeneratePdfButton extracted as exported subcomponent — avoids mounting full CostCalculator prop surface in tests; accepted per plan fallback guidance (Action sub-task B step 6)"
  - "generatingJobIds uses Set<string> not boolean — multiple JobsManager accordion rows can be open simultaneously"
  - "handlePersistQuoteNumber in App.tsx calls setEditingJob (not setJobs) — editingJob is independent React state, not derived from useLiveQuery jobs array; useLiveQuery auto-syncs jobs but not editingJob"
  - "App.tsx imports db and setUserProfile as dbSetUserProfile directly — avoids dependency on useUserProfile hook's updateProfile which also calls setProfileState"
  - "npm install ran in agent worktree — node_modules was empty, jspdf not available for generateQuotePdf.test.ts; installed all deps so full vitest suite passes (181 tests)"
metrics:
  duration_minutes: 8
  completed_date: "2026-05-23"
  tasks_completed: 2
  files_created: 0
  files_modified: 6
  commits: 2
---

# Phase 16 Plan 04: UI Wiring — Generate PDF Buttons, App Callback, UserProfileModal Terms, vite Config Summary

**One-liner:** Two Generate PDF buttons wired (CostCalculator + JobsManager accordion) with atomic quote-number persistence, Default Quote Terms textarea, and vite modulePreload disabled for lazy-chunk contract.

## Tasks Completed

| # | Name | Commit | Key Outputs |
|---|------|--------|-------------|
| 1 | Wire Generate PDF button + handler in CostCalculator + App.tsx + UserProfileModal + vite.config.ts | 8bd4681 | CostCalculator.tsx, UserProfileModal.tsx, App.tsx, vite.config.ts |
| 2 | Wire Generate PDF button in JobsManager + flip CostCalculator.test.tsx todos to real tests | 74579da | JobsManager.tsx, CostCalculator.test.tsx |

## Generate PDF Button Details

### CostCalculator surface

| Property | Value |
|----------|-------|
| Location | Save Job row, before Save/Update button |
| Disabled when | !editingJob OR sellingPrice <= 0 OR isGenerating |
| Title on disabled (no editingJob) | "Save the job first" |
| Title on disabled (no price) | "Set a selling price first" |
| Customer block | None (v1.2 limitation — documented in 1-line code comment) |
| NewBadge | Absolute overlay, className="absolute -top-1 -right-1" |
| Subcomponent | `GeneratePdfButton` — exported for testability |

### JobsManager surface

| Property | Value |
|----------|-------|
| Location | Expanded accordion action row, after Record Sale, before Edit |
| Disabled when | generatingJobIds.has(job.id) |
| Customer block | Most-recent Sale's customer (sorted desc by soldAt) |
| stopPropagation | Yes — consistent with Edit/Delete pattern |
| NewBadge | Absolute overlay, className="absolute -top-1 -right-1" |
| Multi-job support | Set<string> keyed by job.id — multiple accordions can generate simultaneously |

## App.tsx onPersistQuoteNumber Contract

```typescript
const handlePersistQuoteNumber = async (job: PrintJob, profile: UserProfile): Promise<PrintJob> => {
  await db.jobs.put(job);          // 1. Persist quoteNumber to Dexie
  await dbSetUserProfile(profile); // 2. Persist nextQuoteNumber+1 to Dexie
  setEditingJob(prev => prev && prev.id === job.id ? job : prev); // 3. Sync React state
  return job;                       // 4. Return persisted job for generator
};
```

Key points:
- `setJobs` is NOT called — `jobs` uses `useLiveQuery` which auto-syncs from Dexie
- `setEditingJob` IS called — editingJob is independent `useState`, not auto-synced
- Both Dexie writes complete before returning — eliminates T-16-19 stale-snapshot risk

## UserProfileModal Default Quote Terms

- Section: "Default Quote Terms" (before Feedback Link)
- Label: "Default quote terms (optional)"
- Placeholder: "e.g. Payment due within 14 days. All sales final."
- Helper text: "Added to the Terms section of every PDF quote."
- Binding: value={userProfile.defaultTerms || ''}, onChange spreads with `|| undefined` to keep field absent in JSON when empty

## vite.config.ts Changes

```typescript
build: {
  modulePreload: false,   // Prevents pdf chunk from being preloaded on every page load
  rollupOptions: {
    output: {
      manualChunks(id) {
        // ... existing react-vendor, dexie-vendor, vendor splits ...
        if (id.includes('/src/pdf/') || id.includes('/jspdf/') || id.includes('/jspdf-autotable/')) {
          return 'pdf';
        }
      }
    }
  }
}
```

## Test Coverage

| File | Tests before | Tests after | it.todo remaining |
|------|-------------|-------------|-------------------|
| src/components/CostCalculator.test.tsx | 0 real (2 todos) | 4 | 0 |

Tests use `GeneratePdfButton` subcomponent via `createRoot + act` in jsdom environment. No `@testing-library/react` required.

```
vitest run: 181 passing, 0 failures (13 test files)
tsc -b: clean
assert-no-static-jspdf: passes (jspdf only in src/pdf/)
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Pre-commit hook rejected raw `<button>` in GeneratePdfButton**

- **Found during:** Task 1 commit attempt
- **Issue:** The project has a `lint:no-raw-html` pre-commit hook that flags raw `<button>` elements. `GeneratePdfButton` initially used a raw `<button>` instead of the `Button` primitive.
- **Fix:** Replaced with `<Button variant="secondary" btnSize="lg" ... />` from `./ui`
- **Files modified:** src/components/CostCalculator.tsx
- **Commit:** 8bd4681 (already included)

**2. [Rule 3 - Blocking] Agent worktree node_modules was empty — jspdf not available**

- **Found during:** Task 2 full vitest suite run
- **Issue:** The agent worktree (`node_modules/` had only `.vite` cache) did not have jspdf installed. `src/pdf/generateQuotePdf.test.ts` (plan 03) failed with "Failed to resolve import jspdf". This is a worktree infrastructure issue — plan 01 installed jspdf in the pedantic-ride worktree, not shared here.
- **Fix:** Ran `npm install` in the agent worktree to install all dependencies per `package.json`. All 181 tests pass after install.
- **Files modified:** node_modules/ (not committed — gitignored)
- **Impact:** None on committed code; pre-existing issue resolved.

**3. [Rule 1 - Architecture] handlePersistQuoteNumber uses setEditingJob not setJobs**

- **Found during:** Task 1 App.tsx implementation
- **Issue:** The plan's implementation contract called for `setJobs(prev => prev.map(...))` to sync App state. However, `jobs` in App.tsx uses `useLiveQuery` — it auto-syncs from Dexie when `db.jobs.put(job)` is called. Calling `setJobs` is not possible (no `setJobs` setter from `useJobs()` hook). The real problem is `editingJob` — a separate `useState` that does NOT auto-sync from Dexie.
- **Fix:** Used `setEditingJob(prev => prev && prev.id === job.id ? job : prev)` to sync the editingJob state after the Dexie write. This achieves the plan's goal (fresh editingJob on next render) via the correct mechanism.
- **Documented in:** decisions table above

## v1.2 Limitations Documented

- CostCalculator PDF does not include a customer block (no Sale context available). To get a customer-attached PDF, generate from the JobsManager accordion which pulls the most-recent sale's customer. Documented in a 1-line code comment in the handler.

## Known Stubs

None — all buttons are fully wired to real handlers that call `generateQuotePdf`. The `onPersistQuoteNumber` callback in App.tsx writes to real Dexie.

## Threat Flags

No new unplanned threat surface. All planned mitigations applied:

| Threat | Mitigation Applied |
|--------|-------------------|
| T-16-12: Quote number race | isGenerating flag (CostCalculator) + generatingJobIds Set (JobsManager) |
| T-16-14: PDF crash takes down UI | try/catch around both handleGeneratePdf handlers; finally resets generating state |
| T-16-15: NewBadge layout disruption | absolute -top-1 -right-1 on both surfaces; relative wrapper on host |
| T-16-19: Stale React snapshot | setEditingJob called in handlePersistQuoteNumber; generator uses RETURNED job |

## Self-Check

- [x] src/components/CostCalculator.tsx has handleGeneratePdf + isGenerating + GeneratePdfButton: VERIFIED
- [x] onPersistQuoteNumber: is REQUIRED (no ?:) in CostCalculator: VERIFIED
- [x] src/components/JobsManager.tsx has handleGeneratePdf + generatingJobIds + Generate PDF button: VERIFIED
- [x] onPersistQuoteNumber: is REQUIRED (no ?:) in JobsManager: VERIFIED
- [x] src/components/UserProfileModal.tsx has defaultTerms Textarea: VERIFIED
- [x] src/App.tsx has handlePersistQuoteNumber (db.jobs.put + dbSetUserProfile + setEditingJob + return): VERIFIED
- [x] src/App.tsx passes onPersistQuoteNumber to CostCalculator AND JobsManager: VERIFIED
- [x] vite.config.ts has modulePreload: false: VERIFIED
- [x] vite.config.ts manualChunks returns 'pdf' for src/pdf/ + /jspdf/ + /jspdf-autotable/: VERIFIED
- [x] CostCalculator.test.tsx has 4 real tests, 0 it.todo: VERIFIED
- [x] vitest run: 181 passing, 0 failures: VERIFIED
- [x] tsc -b: clean: VERIFIED
- [x] assert-no-static-jspdf.mjs: exits 0: VERIFIED
- [x] Task 1 commit 8bd4681 exists: VERIFIED
- [x] Task 2 commit 74579da exists: VERIFIED

## Self-Check: PASSED
