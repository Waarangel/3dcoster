---
phase: 15-tags-search-quick-duplicate
plan: 12
subsystem: jobs-manager
tags: [jobs-manager, tag-editor-reshape, edit-in-place, inline-chip-strip, gap-closure, gap-E, round-2]
dependency_graph:
  requires: [15-10-PLAN, 15-11-SUMMARY]
  provides: [Gap E closed — edit-in-place title + inline chip strip with hover X and + affordance]
  affects: [src/components/JobsManager.tsx, src/components/JobsManager.test.tsx]
tech_stack:
  added: []
  patterns:
    - "edit-in-place: parent-owned exclusive state (editingTitleJobId, addingTagJobId) scoped to one row at a time"
    - "inline chip strip: chips render in title row with group/chip hover-reveal X button"
    - "add-tag input: narrow max-w-[12ch] D-17 — auto-focuses, Enter/blur commits, Escape cancels"
    - "Tag icon (D-18): kept as NewBadge anchor; now opens add-tag input (not a panel)"
key_files:
  created: []
  modified:
    - src/components/JobsManager.tsx
    - src/components/JobsManager.test.tsx
decisions:
  - "D-16: title-row overflow strategy = flex-wrap — chips wrap below title on narrow screens; no truncation or horizontal scroll"
  - "D-17: add-tag input width = max-w-[12ch] narrow; blur commits if non-empty else cancels"
  - "D-18: Tag icon + NewBadge 'tags' overlay KEPT; icon now triggers handleStartAddTag (add-tag input), not panel open"
  - "handleRemoveTag persists tags: undefined (not []) when result is empty — preserves D-02 empty-input semantic"
  - "handleSaveTitle skips write when safeName === job.name (no noop updatedAt bump)"
  - "allow-raw-html comments use // style inside ternary arms to avoid JSX parse ambiguity with the {/* */} form"
metrics:
  duration_minutes: 35
  completed_date: "2026-05-24"
  tasks_completed: 2
  files_modified: 2
  commits: 2
  test_count_before: 263
  test_count_after: 267
  test_delta: +4
  bundle_gz_kb: 61.5
---

# Phase 15 Plan 12: Gap E Round 2 — Edit-in-Place Title + Inline Chip Strip Summary

**One-liner:** Replaced the rejected Plan-15-10 dropped-down panel with edit-in-place affordances — title click becomes an inline input, tag chips render in the title row with hover X to remove, and a `+` opens a narrow inline input with usage-suggesting placeholder.

## What Was Built

### Task 1 — JobsManager.tsx reshape (commit `7430011`)

All Plan-15-10 panel identifiers driven to zero. The dropped-down `{isEditingPanel && (...)}` block is completely removed. In its place:

**Title edit-in-place:** Clicking the job title button calls `onStartEditTitle(job.id)`. When `isEditingTitle === true`, the button is replaced by a raw `<input>` at the same DOM position. Enter saves; Escape cancels; blur saves if non-empty else cancels. The `handleSaveTitle` handler trims and falls back to `job.name` on empty (empty-name guard preserved from Plan-15-10).

**Inline chip strip (D-11 styling preserved):** Tag chips render inline in the title row (`group flex items-center gap-3 flex-wrap` — D-16 flex-wrap). Each chip is `relative group/chip inline-flex items-center text-xs px-1.5 py-0.5 rounded bg-slate-600/50 text-slate-400` with a hover-reveal `<button aria-label="Remove tag {tag}">X</button>` child. The standalone chip strip below the filament meta line is removed.

**`+` add-tag affordance (D-02 cap):** Conditional on `(job.tags?.length ?? 0) < 10`. When `isAddingTag === false`, a `+` button calls `onStartAddTag(job.id)`. When `isAddingTag === true`, a narrow `max-w-[12ch]` input opens with `placeholder={ADD_TAG_PLACEHOLDER}` (`'trending, popular, out of date'` — D-16 lock). `handleSubmitAddTag` uses `parseTagsInput(tagRaw)?.[0]` and enforces dedupe + cap-at-10.

**Tag icon hover affordance + NewBadge (D-18):** Tag icon kept as a discoverability shortcut; its `onClick` now calls `handleStartAddTag(job.id)` instead of the removed panel handler. `<NewBadge feature="tags" className="absolute -top-1 -right-1 pointer-events-none" />` unchanged on the Tag icon.

**State plumbing:** `editingPanelJobId` → `editingTitleJobId` + `addingTagJobId` in parent. `JobCardProps` 4 panel fields → 9 edit-in-place fields. `JobRowProps`, `JobRow` adapter, `rowProps` useMemo, and non-virtualized fallback all updated.

**Module-scope constant:** `export const ADD_TAG_PLACEHOLDER = 'trending, popular, out of date';`

**`export const JobCard`:** JobCard promoted to named export (mirrors `OrdersQuoteRows`/`SaleFromQuoteSubtext` pattern) for test access.

### Task 2 — JobsManager.test.tsx (commit `cb5aef9`)

Added `describe('JobCard edit-in-place (Gap E)', ...)` block with 4 test cases:

- **(a)** Title button click: `button[aria-label="Edit job title"]` present → click calls `onStartEditTitle('job-1')` → re-render with `isEditingTitle=true` shows `input[aria-label="Edit job title"]` with `value='Phone Stand'`; button is gone.
- **(b)** Chip X: render with `tags: ['pla', 'phone-stand']` → two `button[aria-label="Remove tag *"]` present → click calls `onRemoveTag(job, 'pla')` once.
- **(c)** `+` add-tag: `button[aria-label="Add tag"]` present → click calls `onStartAddTag('job-1')` → re-render with `isAddingTag=true` shows `input[aria-label="Add tag"]` with `placeholder === ADD_TAG_PLACEHOLDER`; sanity-checks `ADD_TAG_PLACEHOLDER === 'trending, popular, out of date'`.
- **(d)** Tag cap: render with 10 tags → `button[aria-label="Add tag"]` null, `input[aria-label="Add tag"]` null; Tag icon shortcut (`aria-label="Add tag via shortcut"`) present; 10 chip X buttons present.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] JSX comment syntax caused esbuild parse error**
- **Found during:** Task 1 Step 13 (build verification)
- **Issue:** Plan specified `{/* allow-raw-html: ... */}` inside ternary expression arms (`isEditingTitle ? (...)`) which is invalid JSX — the `{/* */}` form creates a JSX expression node that can't be the sole expression in a ternary alongside `<input>`. Esbuild rejected the file.
- **Fix:** Changed to `// allow-raw-html: ...` (JS line comment) which is valid inside the JS expression context of a ternary. This is the same approach used by the existing `/* allow-raw-html: ... */` comments in other ternary arms.
- **Files modified:** `src/components/JobsManager.tsx`

**2. [Rule 1 - Bug] lint-no-raw-html flagged JSDoc comments containing `<input>` and `<button>` text**
- **Found during:** Task 1 Step 13 lint check
- **Issue:** The `lint-no-raw-html.mjs` script matches ANY line containing `<button|input|select|textarea` and requires the PREVIOUS line to contain `allow-raw-html`. JSDoc prop descriptions like `/** ... whether the title <input> is open ... */` were being flagged.
- **Fix:** Rewrote JSDoc descriptions to avoid the `<input>` / `<button>` HTML element literal text (e.g., "inline title edit field" instead of "inline title `<input>`"). Also removed `<input>` from the ADD_TAG_PLACEHOLDER comment block and the panel-removal comment.
- **Files modified:** `src/components/JobsManager.tsx`

**3. [Rule 1 - Bug] allow-raw-html comment text itself triggered the lint rule**
- **Found during:** Task 1 Step 13 lint check (second pass)
- **Issue:** `/* allow-raw-html: title edit-in-place input — Input primitive adds padding/border mass that breaks the in-place visual replacement of the title <button> */` — this comment text contained `<button>` which matched the lint pattern on the comment line itself (with the PREVIOUS line lacking `allow-raw-html`).
- **Fix:** Shortened allow-raw-html comment text to not include `<button>` or `<input>` HTML tags.
- **Files modified:** `src/components/JobsManager.tsx`

## Panel Identifier Grep Counts (must all be 0)

```
grep -cE 'editingPanelJobId|setEditingPanelJobId|panelName|setPanelName|panelTagsInput|setPanelTagsInput|handleStartEditPanel|handleCancelEditPanel|handleSavePanel|isEditingPanel|onStartEditPanel|onCancelEditPanel|onSavePanel' src/components/JobsManager.tsx
```
Result: **0** — all Plan-15-10 panel identifiers removed.

## Edit-in-Place Identifier Counts (all present)

| Identifier | Count |
|---|---|
| `editingTitleJobId` | 7 |
| `addingTagJobId` | 7 |
| `handleStartEditTitle` | 4 |
| `handleCancelEditTitle` | 4 |
| `handleSaveTitle` | 4 |
| `handleStartAddTag` | 4 |
| `handleCancelAddTag` | 4 |
| `handleSubmitAddTag` | 4 |
| `handleRemoveTag` | 4 |
| `isEditingTitle` | 8 |
| `isAddingTag` | 8 |
| `onSaveTitle` | 9 |
| `onSubmitAddTag` | 9 |
| `onRemoveTag` | 8 |
| `ADD_TAG_PLACEHOLDER` export | 1 |
| `JobCard` export | 1 |

## Standalone Chip Strip Removed

`grep -nE '"flex flex-wrap gap-1 mt-1"' src/components/JobsManager.tsx | wc -l` → **0**

## NewBadge Consumer Audit

| Feature key | File | Count |
|---|---|---|
| `tags` | JobsManager.tsx | 1 (Tag icon overlay — D-18 lock) |
| `tags` | CostCalculator.tsx | 0 (Gap A preserved) |
| `search-jobs` | JobsManager.tsx | 1 |
| `pdf-quote` | JobsManager.tsx | 1 |
| `quick-duplicate` | JobsManager.tsx | 0 (Gap D preserved) |

## LOCKED File git diff Evidence

```
git diff src/utils/duplicateJob.ts src/utils/duplicateJob.test.ts  → (empty)
git diff src/features.ts                                            → (empty)
git diff src/components/CostCalculator.tsx                          → (empty)
git diff src/db/backfill.ts                                         → (empty)
git diff src/hooks/useDatabase.ts                                   → (empty)
git diff src/types.ts                                               → (empty)
```

All six locked files byte-identical to pre-plan state. DUP-02 contract preserved.

## Automated Gate Results

| Gate | Result |
|---|---|
| `node scripts/lint-no-raw-html.mjs` | PASS — "lint:no-raw-html passed" |
| `npx tsc -b` | PASS — 0 new errors in JobsManager.tsx (pre-existing module declaration errors for react-window/jspdf are unrelated to this plan; skipLibCheck=true suppresses them at build) |
| `npm test -- --run` | PASS — **267 passed / 1 todo / 0 failed** (263 baseline + 4 new Gap E tests) |
| `npm run build` | PASS — built in 2.34s; main chunk 61.5 KB gzip (under 300 KB Phase 11 gate) |

## D-16/D-17/D-18 Decision Values Applied

- **D-16 (overflow strategy):** `flex-wrap` added to title row wrapper (`group flex items-center gap-3 flex-wrap`). Chips wrap below title on narrow viewports — no truncation, no horizontal scroll.
- **D-17 (add-tag input width):** `max-w-[12ch]` with `px-2 py-0.5 text-xs` classes. Narrow enough to avoid layout jump on open; accommodates longest plausible single tag.
- **D-18 (Tag icon + NewBadge target):** Both kept. Tag icon `aria-label` changed from `"Edit tags"` to `"Add tag via shortcut"`. `onClick` changed from `handleStartEditPanel` to `handleStartAddTag`. NewBadge `feature="tags"` overlay position unchanged.

## Commits

| Task | Commit | Files | Description |
|---|---|---|---|
| Task 1 | `7430011` | `src/components/JobsManager.tsx` | feat(15-12): replace dropped-down panel with edit-in-place title + inline chip strip |
| Task 2 | `cb5aef9` | `src/components/JobsManager.test.tsx` | test(15-12): add Gap E component tests |

## Known Stubs

None — all tag data flows from `job.tags` (live IndexedDB via Dexie liveQuery). No placeholder or hardcoded values in the UI path.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundary crossings introduced. All writes are local IndexedDB via the existing `db.jobs.put` pattern.

## Self-Check: PASSED

- `src/components/JobsManager.tsx` — exists, 2093 lines
- `src/components/JobsManager.test.tsx` — exists, 488 lines
- Commits `7430011` and `cb5aef9` — both present in `git log --oneline`
- Panel identifier count: 0 (verified above)
- Test count: 267 passed (verified by npm test run)
- Build: 61.5 KB gz (verified by npm run build)
- All 6 locked file diffs: empty (verified above)
