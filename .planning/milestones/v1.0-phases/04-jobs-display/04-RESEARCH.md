# Phase 4: Jobs Display - Research

**Researched:** 2026-04-15
**Domain:** React component state — JobsManager display + CostCalculator edit restore
**Confidence:** HIGH

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| JOBS-01 | JobsManager shows all filaments per job (e.g., "PETG 200g + PLA 50g") | JobsManager already has `job.filaments` mapping at line 217; the rendering code exists but produces empty output because Phase 3 may not yet have landed. Need to verify the rendered output is correct for both single and multi-filament jobs and matches today's display for single-filament. |
| JOBS-02 | Editing a job restores all filament rows with correct price fallback | CostCalculator `useEffect` at line 190 already rebuilds `FilamentRow[]` from `editingJob.filaments`; fallback chain is `fu.pricePerGram ?? asset?.costPerUnit ?? 0`. Migrated jobs have `pricePerGram` undefined, so they fall back to asset library price — which is the correct behaviour. Need to verify this works for all cases including jobs whose filament asset has been deleted. |
</phase_requirements>

---

## Summary

Phase 4 is the display and edit-restore half of the multi-material feature. Phases 1-3 already migrated the data model, wired the calculator form, and persisted `filaments: FilamentUsage[]` on every saved job. Phase 4 is narrow: it surfaces that stored data correctly in `JobsManager` and verifies the round-trip edit path works end-to-end.

Both requirements have skeleton implementations already present in the codebase from Phase 3 work. JOBS-01 rendering code is live at `JobsManager.tsx:217-222` — it maps `job.filaments` to a `+`-joined span list. JOBS-02 restore logic is live at `CostCalculator.tsx:190-199` — it rebuilds `FilamentRow[]` from `editingJob.filaments` with a three-tier price fallback (`pricePerGram` override → asset `costPerUnit` → `0`).

The research task is therefore to understand exactly what state the current code is in, identify any remaining gaps (e.g., empty-filament edge case display, deleted-asset graceful degradation), and give the planner precise task targets rather than a full re-implementation.

**Primary recommendation:** Phase 4 is a verification and hardening phase, not a build phase. The plan should contain: (1) smoke-test the existing display and edit paths, (2) harden the two known edge cases (empty filament list on migrated job, deleted asset on restore), (3) confirm single-filament display unchanged.

---

## Standard Stack

### Core (already in project — no new installs)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React 19 | ^19.2.0 | Component rendering | Project standard |
| TypeScript ~5.9 | ~5.9.3 | Type safety | Project standard |
| Dexie 4 | ^4.2.1 | IndexedDB queries | Project standard |
| Tailwind CSS 4 | ^4.1.18 | Styling | Project standard |

**No new packages needed for this phase.**

**Build verification command:**
```bash
tsc -b && vite build
```
(Per CLAUDE.md: always use `tsc -b`, not `tsc --noEmit`, to catch `noUnusedLocals` / `noUnusedParameters`.)

---

## Architecture Patterns

### Existing Component Boundary

```
App.tsx
├── editingJob: PrintJob | null          ← state owner
├── handleEditJob(job) → setEditingJob + setActiveTab('calculator')
├── handleCancelEdit() → setEditingJob(null)
│
├── <JobsManager onEditJob={handleEditJob} />   ← JOBS-01 display
└── <CostCalculator editingJob={editingJob} />  ← JOBS-02 restore
```

No new components are needed. Both display (JobsManager) and restore (CostCalculator) are already wired through `App.tsx`.

### Pattern 1: Filament Display in JobsManager

Current code (line 217-222):
```tsx
// Source: src/components/JobsManager.tsx:217
{(job.filaments ?? []).map((f, i) => (
  <span key={i}>
    {i > 0 && ' + '}
    {getFilamentName(f.filamentId ?? '')}{f.grams ? ` ${f.grams}g` : ''}
  </span>
))}
```

This is correct for multi-material. The `getFilamentName` helper looks up by `filamentId` in the `materials` prop — returning `'Unknown'` for deleted assets. The fallback text for an empty `filaments[]` array is an empty string (renders nothing), which is a gap: a migrated job with `filaments: []` would show only the pipe separator and print time.

### Pattern 2: Edit Restore in CostCalculator

Current code (line 190-199):
```tsx
// Source: src/components/CostCalculator.tsx:190
const restoredRows: FilamentRow[] = (editingJob.filaments ?? []).map(fu => {
  const asset = materials.find(m => m.id === fu.filamentId);
  return {
    filamentId: fu.filamentId,
    grams: fu.grams,
    editedPrice: fu.pricePerGram ?? asset?.costPerUnit ?? 0,
    editedCurrency: fu.currency ?? asset?.currency ?? userCurrency,
  };
});
setFilamentRows(restoredRows.length > 0 ? restoredRows : [makeDefaultRow(userCurrency)]);
```

The price fallback chain is already correct for JOBS-02. When `pricePerGram` is undefined (migrated jobs) and the asset is found, `asset.costPerUnit` is used — this is the "asset-library fallback" the requirement specifies. When the asset has been deleted, `asset` is `undefined` so both price and currency fall to safe defaults (`0` and `userCurrency`). The restore function also handles an empty `filaments` array by producing a single default row, which is correct behaviour.

### Anti-Patterns to Avoid

- **Do not re-implement display logic from scratch.** The mapping code already exists; scope is to verify and harden it, not replace it.
- **Do not read `filamentId` / `filamentGrams` from jobs.** Those fields are deleted by the v5 migration. Any code path that references them is a bug.
- **Do not add a `+` separator when only one filament exists.** The `i > 0 &&` guard already handles this.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Filament name lookup | Custom resolver | Existing `getFilamentName(id)` in JobsManager | Already handles missing assets with `'Unknown'` fallback |
| Price fallback | Custom price resolution | Existing three-tier chain in CostCalculator restore effect | Already handles `undefined`, missing asset, and zero correctly |
| Edit routing | Custom tab navigation | Existing `handleEditJob` → `setActiveTab('calculator')` | App.tsx already owns this flow |

---

## Common Pitfalls

### Pitfall 1: Empty filaments array shows nothing in display

**What goes wrong:** A job with `filaments: []` (edge case from migration when `filamentId` was blank) renders the job subtitle as just ` | Xh` with no filament info. The separator `|` has nothing before it.

**Why it happens:** `(job.filaments ?? []).map(...)` produces no output for an empty array. The current template doesn't have a fallback for this case.

**How to avoid:** Add a fallback text — e.g., `filaments.length === 0 ? 'No filament data' : <span mapping>` — or filter out zero-gram entries before rendering.

**Warning signs:** Job cards in the list that show only `| Xh` with nothing before the pipe.

### Pitfall 2: Deleted asset shows "Unknown" in display and 0 price on edit

**What goes wrong:** If a user deleted a filament from their asset library that was used in a saved job, the display shows "Unknown" and the edit form loads `editedPrice: 0`.

**Why it happens:** `getFilamentName` returns `'Unknown'` on miss; `asset?.costPerUnit ?? 0` resolves to `0`.

**How to avoid:** This is acceptable behaviour — document it. Do not attempt to recover deleted asset data (it's gone). The `0` price prompts the user to set a price before saving, which is correct.

**Warning signs:** This is not a bug to fix in Phase 4; it is expected graceful degradation.

### Pitfall 3: TypeScript errors from `filaments` being optional in older code paths

**What goes wrong:** `tsc -b` fails because some code path references `job.filamentId` or `job.filamentGrams` (the old deleted fields).

**Why it happens:** The `PrintJob` type no longer has `filamentId`/`filamentGrams`. Any code accidentally referencing them gives a TS error.

**How to avoid:** Search for any remaining references before building. The Phase 3 plan states these were cleaned up, but confirm with `tsc -b`.

**Warning signs:** TypeScript error: `Property 'filamentId' does not exist on type 'PrintJob'`.

### Pitfall 4: Single-filament job display regression

**What goes wrong:** Old single-filament jobs (migrated to `filaments: [{filamentId, grams}]`) display differently to how they did before Phase 3 (they used to show `filamentType + grams` format).

**Why it happens:** `getFilamentName` returns `brand + filamentType` joined — the same format as before. But if `brand` is empty it gives just `filamentType`, which is the pre-migration behaviour. Should be fine, but needs visual verification.

**Warning signs:** Job cards that look different after migration for old single-filament data.

---

## Code Examples

### Correct multi-filament display (verified current implementation)

```tsx
// Source: JobsManager.tsx:151-154 (getFilamentName helper)
const getFilamentName = (filamentId: string) => {
  const filament = materials.find(m => m.id === filamentId);
  return filament ? `${filament.brand || ''} ${filament.filamentType || filament.name}`.trim() : 'Unknown';
};
```

```tsx
// Source: JobsManager.tsx:217-222 (display render)
{(job.filaments ?? []).map((f, i) => (
  <span key={i}>
    {i > 0 && ' + '}
    {getFilamentName(f.filamentId ?? '')}{f.grams ? ` ${f.grams}g` : ''}
  </span>
))}
```

### Correct edit-restore with price fallback (verified current implementation)

```tsx
// Source: CostCalculator.tsx:190-199
const restoredRows: FilamentRow[] = (editingJob.filaments ?? []).map(fu => {
  const asset = materials.find(m => m.id === fu.filamentId);
  return {
    filamentId: fu.filamentId,
    grams: fu.grams,
    editedPrice: fu.pricePerGram ?? asset?.costPerUnit ?? 0,
    editedCurrency: fu.currency ?? asset?.currency ?? userCurrency,
  };
});
setFilamentRows(restoredRows.length > 0 ? restoredRows : [makeDefaultRow(userCurrency)]);
```

### Empty filament fallback (gap — to be added in Phase 4)

```tsx
// Recommended addition in JobsManager subtitle render
const filamentSummary = job.filaments?.length > 0
  ? job.filaments.map((f, i) => (
      <span key={i}>{i > 0 && ' + '}{getFilamentName(f.filamentId ?? '')}{f.grams ? ` ${f.grams}g` : ''}</span>
    ))
  : <span className="text-slate-500">No filament data</span>;
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `job.filamentId` + `job.filamentGrams` scalar fields | `job.filaments: FilamentUsage[]` array | Phase 1 (DB v5 migration) | All display code must map over the array; scalar access is a bug |
| Single filament display: `${filamentType} ${grams}g` | Multi-filament: joined with ` + ` separators | Phase 4 target | No API changes; pure UI string formatting |

---

## Open Questions

1. **Are there any jobs in the wild with `filaments: []` (empty array)?**
   - What we know: The v5 migration creates `filaments: []` when `filamentId` was blank/empty (see `database.ts:58`). This is a real edge case for users who started a job but never selected a filament.
   - What's unclear: How common this is.
   - Recommendation: Handle defensively with a "No filament data" fallback text. Low effort, prevents a visually broken card.

2. **Does the current `getFilamentName` output exactly match the pre-Phase-3 display for single-filament jobs?**
   - What we know: It returns `brand + filamentType || name`. Pre-Phase-3 display code is no longer in the repo so exact comparison requires running the app.
   - What's unclear: Whether `brand` was shown before.
   - Recommendation: Run the app and compare an old single-filament job (migrated) against the requirement "shows in the same format as today."

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None installed — no vitest/jest in package.json |
| Config file | None |
| Quick run command | `tsc -b` (type-level correctness) |
| Full suite command | `tsc -b && vite build` |

No automated test infrastructure exists in this project. All validation for Phase 4 is manual visual inspection plus TypeScript compilation.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| JOBS-01 | JobsManager subtitle shows all filaments joined with ` + ` | manual | `tsc -b && vite build` (type check only) | N/A |
| JOBS-02 | Edit restore populates all filament rows with correct price fallback | manual | `tsc -b && vite build` (type check only) | N/A |

### Sampling Rate

- **Per task commit:** `tsc -b`
- **Per wave merge:** `tsc -b && vite build`
- **Phase gate:** `tsc -b && vite build` green + manual smoke test before `/gsd:verify-work`

### Wave 0 Gaps

None — existing infrastructure (TypeScript compiler + Vite build) covers compile-time correctness. No test framework to install. Manual testing is the validation method.

---

## Sources

### Primary (HIGH confidence)
- Direct code read: `src/components/JobsManager.tsx` — display rendering at lines 151-154, 217-222
- Direct code read: `src/components/CostCalculator.tsx` — edit restore at lines 190-201
- Direct code read: `src/db/database.ts` — v5 migration at lines 56-71
- Direct code read: `src/types.ts` — `PrintJob.filaments: FilamentUsage[]` at lines 131-136, 148
- Direct code read: `src/App.tsx` — edit flow wiring at lines 112-119

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` — confirmed Phase 3 completed; `handleSaveJob` writes `filaments: FilamentUsage[]`
- `.planning/REQUIREMENTS.md` — JOBS-01, JOBS-02 requirement text verbatim

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — read directly from package.json
- Architecture: HIGH — read directly from source files
- Pitfalls: HIGH — derived from actual code paths read from source, not speculation

**Research date:** 2026-04-15
**Valid until:** 2026-05-15 (stable codebase, no external dependencies for this phase)
