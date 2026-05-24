---
phase: 15-tags-search-quick-duplicate
plan: "10"
subsystem: jobs-manager
tags: [jobs-manager, tag-editor-reshape, title-click-panel, hover-tag-icon, new-badge-retarget, scope-refinement, gap-closure, gap-B]
dependency_graph:
  requires: ["15-08", "15-09"]
  provides:
    - JobsManager with pencil-button tag-edit affordance removed
    - Unified title+tags inline edit panel (title-click or hover Tag icon opens it)
    - Explicit chevron-button selection toggle (replaces click-anywhere toggle)
    - NewBadge feature="tags" re-targeted to hover Tag icon overlay
  affects:
    - src/components/JobsManager.tsx
tech_stack:
  added: []
  patterns:
    - Explicit chevron-icon accordion toggle (replaces implicit click-anywhere toggle)
    - Hover Tag icon (CSS group-hover opacity) as discovery affordance with absolute-overlay NewBadge
    - Unified inline edit panel outside isSelected accordion for collapsed-row editability
    - Two-field handleSavePanel persists name + tags atomically in one db.jobs.put
key_files:
  modified:
    - src/components/JobsManager.tsx
  created: []
decisions:
  - "CHEVRON BUTTON selected as the click-target conflict resolution (option a from VERIFICATION.md Gap B). Rationale: an explicit chevron with aria-expanded is a discoverable affordance with a clear semantic contract; option b (click-outside-title-region) creates an invisible click-target gradient that is hostile to keyboard users and screen readers."
  - "ONE Save / Cancel pair per panel (not auto-save on blur). Rationale: auto-save loses the user's ability to abandon a typo; an explicit Save button mirrors every other inline-edit pattern in the codebase (CustomerEditModal, SettingsModal, JobCard Edit button → CostCalculator)."
  - "Empty-name guard: handleSavePanel falls back to job.name when the trimmed input is empty — never persists a blank job name. Line: `const safeName = trimmedName.length > 0 ? trimmedName : job.name;`"
  - "Re-seed effect: panelName and panelTagsInput re-seed from current job on every isEditingPanel true transition — stale values from a prior edit session cannot survive a re-open."
  - "Did NOT add an inline-panel Duplicate button — VERIFICATION.md Gap B does not request this; DUP-01 is Withdrawn-from-v1.2 per Gap D."
  - "allow-raw-html comments added before chevron button, title button, and tag-icon button — the Button primitive adds unwanted layout mass and padding to what are inherently icon-only / plain-text affordances."
metrics:
  duration: "~25 minutes"
  completed: "2026-05-24"
  tasks_completed: 1
  files_changed: 1
---

# Phase 15 Plan 10: Gap B — Title-Click Panel + Hover Tag Icon Summary

**One-liner:** Pencil-button tag editor replaced with a title-click + hover-Tag-icon inline panel combining both title-rename and tag editing; explicit chevron-button now owns the accordion selection toggle; NewBadge `tags` re-targeted to the hover Tag icon overlay.

---

## What Was Built

Gap B gap-closure plan executed. The `pencil`-icon ghost button added in Phase 15 Plan 05 has been completely removed from the JobCard action row. In its place:

1. **Chevron button** — to the left of the job title; the exclusive affordance for toggling accordion expansion (`aria-expanded`, rotates 90° when selected).
2. **Title button** — clicking the job title (now a `<button>` not an `<h3>`) opens the unified inline edit panel.
3. **Hover Tag icon** — a `<TagIcon>` button appears inline with the title on `group-hover` of the title row; clicking it opens the same panel. Stays visible (`opacity-100`) while the panel is open so the NewBadge target is never hidden during editing.
4. **NewBadge re-targeted** — `feature="tags"` `<NewBadge>` is now an `absolute -top-1 -right-1` overlay on the hover Tag icon button (not the old label-inline pencil-button site).
5. **Unified inline edit panel** — sits OUTSIDE the `{isSelected && (...)}` accordion so it is reachable from collapsed rows. Contains a Title input (autoFocus) + Tags input + Save/Cancel pair.

### Changes in `src/components/JobsManager.tsx`

1. **New SVG components added** — `ChevronRightIcon` and `TagIcon` declared locally before the SearchIcon declaration. PencilIcon declaration removed entirely.

2. **JobCardProps reshaped** — Four renamed props:
   - `isEditingTags` → `isEditingPanel`
   - `onStartEditTags` → `onStartEditPanel`
   - `onCancelEditTags` → `onCancelEditPanel`
   - `onSaveTags: (job, value: string)` → `onSavePanel: (job, value: { name: string; tagsInput: string })`

3. **JobCard local state reshaped** — `tagEditValue` removed; replaced by:
   - `const [panelName, setPanelName] = useState(() => job.name)`
   - `const [panelTagsInput, setPanelTagsInput] = useState(() => (job.tags ?? []).join(', '))`
   - Re-seed `useEffect` keyed on `[isEditingPanel, job.name, job.tags]` — re-seeds on every open transition.
   - `handleTagSave` useCallback removed; save is invoked directly from panel JSX.

4. **JobCard root** — `onClick={() => onToggleSelect(job.id)}` removed; `cursor-pointer` class removed. Root is no longer a click target.

5. **Title row reshaped** — New `<div className="group flex items-center gap-3">` wrapper containing:
   - Chevron button (`aria-expanded`, `onToggleSelect`)
   - Title button (`onStartEditPanel`, `aria-label="Edit job title and tags"`)
   - Tag icon button (`onStartEditPanel`, `aria-label="Edit tags"`, hover-reveal via group opacity)
   - `<NewBadge feature="tags" className="absolute -top-1 -right-1 pointer-events-none" />`
   - Break-even pills (unchanged)

6. **Action row** — Pencil button JSX block removed. Row now reads: Record Sale (green) / Create Quote (blue, `feature="pdf-quote"`) / Edit (ghost) / Delete (red).

7. **Old inline tag editor** — The `{isEditingTags && (<div className="mt-3 pt-3 border-t border-slate-700"...>` block removed from inside the `{isSelected && (...)}` accordion.

8. **New inline edit panel** — Inserted AFTER `<div className="flex items-start justify-between">` and BEFORE `{isSelected && (...)}`:
   - Title input with `autoFocus`; Enter saves, Escape cancels
   - Tags input; Enter saves, Escape cancels
   - Save / Cancel buttons (explicit pair)
   - `onClick={(e) => e.stopPropagation()}` on the outer wrapper

9. **Parent state reshaped** — `editingTagsJobId` → `editingPanelJobId`; handlers `handleStartEditTags`, `handleCancelEditTags`, `handleSaveTags` → `handleStartEditPanel`, `handleCancelEditPanel`, `handleSavePanel`.

10. **handleSavePanel** — Persists both name and tags atomically:
    ```ts
    const trimmedName = value.name.trim();
    const safeName = trimmedName.length > 0 ? trimmedName : job.name;
    const parsedTags = parseTagsInput(value.tagsInput);
    await db.jobs.put({ ...job, name: safeName, tags: parsedTags, updatedAt: new Date() });
    ```

11. **JobRowProps, JobRow adapter, rowProps useMemo, non-virtualized fallback** — All four sites updated with renamed props.

12. **allow-raw-html comments** — Added before the three new `<button>` elements (chevron, title, tag icon) per the project's lint-no-raw-html script requirement.

---

## Files Modified

| File | Change | Line delta |
|------|--------|-----------|
| `src/components/JobsManager.tsx` | Removed pencil-button + old tag editor; added ChevronRightIcon + TagIcon + title-click panel + hover Tag icon; reshared props/state/handlers everywhere | +201 -142 (+59 net) |

---

## LOCKED File Integrity

| File | Status |
|------|--------|
| `src/utils/duplicateJob.ts` | BYTE-IDENTICAL — `git diff` output: empty |
| `src/utils/duplicateJob.test.ts` | BYTE-IDENTICAL — `git diff` output: empty |
| `src/features.ts` | BYTE-IDENTICAL — `git diff` output: empty |
| `src/components/CostCalculator.tsx` | BYTE-IDENTICAL — `git diff` output: empty |
| `src/db/backfill.ts` | BYTE-IDENTICAL — `git diff` output: empty |
| `src/hooks/useDatabase.ts` | BYTE-IDENTICAL — `git diff` output: empty |

Confirmed by: `git diff src/utils/duplicateJob.ts src/utils/duplicateJob.test.ts src/features.ts src/components/CostCalculator.tsx src/db/backfill.ts src/hooks/useDatabase.ts` → no output.

---

## NewBadge Count Audit

| Feature key | Expected | Actual | Location |
|-------------|----------|--------|----------|
| `feature="tags"` | 1 | 1 | JobsManager.tsx hover Tag icon overlay |
| `feature="tags"` in CostCalculator | 0 | 0 | Preserves Gap A removal |
| `feature="search-jobs"` | 1 | 1 | JobsManager.tsx search input wrapper |
| `feature="pdf-quote"` | 1 | 1 | JobsManager.tsx Create Quote button |
| `feature="quick-duplicate"` | 0 | 0 | Preserves Gap D removal |

Total `feature="tags"` consumers across codebase: **1** (project memory rule: one badge per feature key).

---

## Click-Target Conflict Resolution

**Decision: CHEVRON BUTTON (option a from VERIFICATION.md Gap B)** — not option b (click-outside-title-region).

**Rationale:**
- The chevron is a discoverable affordance with an explicit `aria-expanded` attribute — screen readers announce "Expand job details" / "Collapse job details" clearly.
- Option b (invisible click-region gradient) creates an unannounced click zone hostile to keyboard users: clicking "near but not on the title" would have no visible affordance and no accessible label.
- The chevron rotates 90° when expanded, mirroring the Sale row's `group-open:rotate-90` chevron pattern (visual consistency).
- Exactly one `onClick onToggleSelect(job.id)` remains in the file — confirmed by grep.

---

## Save Semantics Decision

**ONE Save / Cancel pair per panel** (not auto-save on blur).

**Rationale:** Auto-save-on-blur would cause the panel to persist a mid-edit typo whenever the user accidentally clicked outside the panel. An explicit Save button matches every other inline-edit and modal pattern in the codebase: CustomerEditModal, SettingsModal, the CostCalculator's own title-rename flow, JobCard → Edit button. Users understand Save/Cancel intuitively and can safely abandon typos via Cancel.

---

## Post-Plan Action Row Composition

Record Sale (green success) / Create Quote (blue primary, `feature="pdf-quote"` NewBadge) / Edit (ghost+border) / Delete (danger)

No pencil button. No `[⋯]` overflow button (removed by Gap D, Plan 15-08).

---

## Vitest Results

- Test Files: 18 passed (18)
- Tests: **263 passed | 1 todo (264)**
- 0 failed

Matches pre-plan baseline. No new test cases; existing tests untouched.

---

## TypeScript Results

`npx tsc -b` exits 0. Zero new errors introduced.

---

## Build Results

`npm run build` completes successfully:
- lint:no-raw-html: passed (allow-raw-html annotations on all three new buttons)
- tsc -b: exit 0
- vite build: built in 2.25s
- main chunk: 62.6 KB gzipped (under 300 KB assertion passes)
- pdf chunk: no modulepreload link (assertion passes)

---

## Grep Audit (all at expected values)

| Target | Expected | Actual |
|--------|----------|--------|
| old tag-edit names (combined regex) | 0 | 0 |
| `PencilIcon` | 0 | 0 |
| `editingPanelJobId` | ≥ 3 | 7 |
| `isEditingPanel` | ≥ 3 | 8 |
| `onSavePanel` | ≥ 4 | 10 |
| `TagIcon` | ≥ 2 | 3 |
| `ChevronRightIcon` | ≥ 2 | 3 |
| `feature="tags"` (JobsManager) | 1 | 1 |
| `feature="tags"` (CostCalculator) | 0 | 0 |
| `feature="search-jobs"` | 1 | 1 |
| `feature="quick-duplicate"` | 0 | 0 |
| `feature="pdf-quote"` | 1 | 1 |
| `group flex items-center gap-3` | 1 | 1 |
| `aria-label="Edit job title and tags"` | 1 | 1 |
| `aria-label="Edit tags"` | 1 | 1 |
| `onClick onToggleSelect(job.id)` | 1 | 1 |
| `cursor-pointer transition-colors` | 0 | 0 |

---

## Deviations from Plan

**[Rule 2 - Auto-fix] Added `// allow-raw-html` comments before the three new `<button>` elements**

- **Found during:** Verification (build step)
- **Issue:** The project's `lint-no-raw-html.mjs` build guard forbids raw `<button>` elements in `src/components/` unless the preceding line contains `allow-raw-html`. The three new buttons (chevron, title, tag icon) are icon-only / text affordances where the `Button` primitive would add visually incorrect padding and layout mass — raw `<button>` is the correct choice. The plan's `<interfaces>` block specified `<button>` elements but did not include the required allow-raw-html annotations.
- **Fix:** Added three `{/* allow-raw-html: ... */}` comments immediately before each `<button>` element, each with a rationale matching the project's annotation convention.
- **Files modified:** `src/components/JobsManager.tsx`
- **Commit:** included in main task commit `24e483d`

---

## Known Stubs

None. All new surfaces are wired to live state (`panelName`, `panelTagsInput` ← `job.name`, `job.tags`). The save handler persists to IndexedDB via `db.jobs.put`. No hardcoded placeholders.

---

## Threat Flags

None. This plan only reshapes UI surface — no new network endpoints, auth paths, file access patterns, or schema changes introduced.

---

## Self-Check

- `src/components/JobsManager.tsx` exists and was modified: confirmed (git diff shows 1 file changed, 201 insertions, 142 deletions)
- Commit `24e483d` exists: confirmed (`git rev-parse --short HEAD` = `24e483d`)
- LOCKED files byte-identical: confirmed (`git diff` = empty for all six)
- All grep audit counters at expected values: confirmed (table above)
- `npx tsc -b` exits 0: confirmed
- `npm test -- --run` reports 263 passed / 1 todo / 0 failed: confirmed
- `npm run build` completes successfully: confirmed

## Self-Check: PASSED
