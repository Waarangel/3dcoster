---
phase: 15-tags-search-quick-duplicate
plan: 05
subsystem: jobs-manager
tags: [jobs-manager, tag-chips, inline-edit, overflow-menu, duplicate, new-badge, reconcile-wiring]
dependency_graph:
  requires:
    - "15-01 (normalizeTagsOnJob — Phase 12 backfill + Phase 15 normalizer; Plan 15-05 wires it into useJobs init via tagsNormalizeRan)"
    - "15-02 (duplicateJob + nextCopyName — Plan 15-05 imports both for the [⋯] Duplicate handler)"
    - "15-03 (parseTagsInput — Plan 15-05 uses it for inline tag editor persistence)"
    - "15-04 (sticky sub-header + search wrapper — Plan 15-05 adds the search-jobs NewBadge to its wrapper without modifying any Plan 15-04 logic)"
  provides:
    - "JobCard tag chips display block (D-11 lock — byte-identical to AssetLibrary chip styling)"
    - "Inline tag editor on JobsManager (D-01 surface b) — re-tag without round-tripping through CostCalculator"
    - "[⋯] overflow menu + Quick Duplicate menu item on every JobCard (D-07 + DUP-01)"
    - "Post-duplicate scroll+highlight pattern (2s blue ring on the new row) — lower-risk toast substitute per PATTERNS.md No-Analog note"
    - "Process-lifetime tag normalize reconcile in useJobs (D-12) — sibling to copiesSoldReconcileRan"
    - "Three new entries in src/features.ts (tags, search-jobs, quick-duplicate) with release date 2026-05-24 (D-13)"
    - "Three NewBadge JSX consumers in JobsManager — tags label-inline, search-jobs + quick-duplicate absolute-overlay (D-13 + project memory rule)"
  affects:
    - "src/features.ts (3 new entries, 8→11 total)"
    - "src/hooks/useDatabase.ts (1 new import, 1 new module flag, 1 new effect inside useJobs)"
    - "src/components/JobsManager.tsx (2 new imports, 3 new parent state slots, 4 new useCallback handlers, 1 click-outside effect, JobCard + JobRow prop chain extended, local PencilIcon SVG component)"
tech_stack:
  added: []
  patterns:
    - "Module-scope tagsNormalizeRan flag + idempotent useEffect mirroring copiesSoldReconcileRan (D-12 — error-swallowing + flag-reset for retry)"
    - "One-at-a-time overflow + inline-editor state lifted to JobsManager parent (overflowOpenJobId, editingTagsJobId) — only ever one menu/editor open across the whole list"
    - "Click-outside handler on window guarded by an open-id check (no listener attached when no menu is open)"
    - "Post-write highlight pattern: setHighlightedJobId + setTimeout(2000) — ring-2 ring-blue-400 with ring-offset-slate-900 on the JobCard root"
    - "Allow-raw-html comment guard pattern for the [⋯] trigger + menuitem button (mirrors the QuoteRow precedent verbatim)"
    - "NewBadge placement rule applied: square / icon-button surfaces get absolute-overlay (search-jobs + quick-duplicate); label-flex surfaces get inline-child placement (tags). Three absolute-overlay badges total in JobsManager — pdf-quote unchanged + 2 new — NOT 4 (which would indicate the tags badge was misplaced)"
key_files:
  created: []
  modified:
    - "src/features.ts"
    - "src/hooks/useDatabase.ts"
    - "src/components/JobsManager.tsx"
decisions:
  - "Used db.jobs.add / db.jobs.put directly in JobsManager rather than threading new addJob/updateJob props from App.tsx — JobsManager already imports `db` and uses it directly (e.g., the Convert-to-Sale transaction at line 1230). Keeps the diff surgical."
  - "Inline tag editor lives as a NEW row below the action row (not inline with the action buttons) so it doesn't push Record Sale / Create Quote / Edit / Delete buttons to wrap. Pencil affordance lives IN the action row (ghost+border button); the input + Save/Cancel row reveals below it via `mt-3 pt-3 border-t border-slate-700`."
  - "Pencil button is HIDDEN while the editor is open (`!isEditingTags &&`) to avoid duplicate affordances — clicking the pencil starts edit; the Save/Cancel buttons close it."
  - "Enter/Escape keyboard shortcuts on the inline input — Enter saves (parseTagsInput + db.jobs.put), Escape cancels. Mirrors common form keyboard UX without adding a new pattern."
  - "Local PencilIcon component (mirrors CustomerLibrary.tsx:352-365 verbatim) — same project policy decision as Plan 15-04's local SearchIcon: avoid shared one-off icon modules until 3+ surfaces want it."
  - "Did NOT modify the useDynamicRowHeight cache key (per plan explicit constraint — Plan 15-04 owns the D-05 tri-key). The inline tag editor changing row height is picked up by react-window's per-row resize observer naturally."
  - "Did NOT touch CostCalculator.tsx (Plan 15-03 owns the `tags` NewBadge there). This plan adds ONE additional `tags` NewBadge consumer in JobsManager's inline editor — both surfaces share the same feature key per D-13."
metrics:
  start_time: "2026-05-24T16:13:34Z"
  end_time: "2026-05-24T16:21:01Z"
  duration_minutes: 7
  task_count: 2
  file_count: 3
  completed_date: "2026-05-24"
requirements_addressed: [TAGS-01, TAGS-04, DUP-01]
---

# Phase 15 Plan 05: JobsManager Tag Chips + Inline Edit + [⋯] Quick Duplicate + NewBadges Summary

The user-visible payoff plan for Phase 15. Chips are visible on every JobCard, users can re-tag without leaving JobsManager, the `[⋯] → Duplicate` action ships DUP-01 visibly with a 2s highlight ring, and the three new feature badges signal "new" to existing users on their next page load. Plus the D-12 silent reconcile that fixes any DevTools-corrupted legacy tags on first emission.

## What Was Built

### 1. `src/features.ts` (Task 1) — three new entries

Appended three entries immediately before the `// Add new features here` marker. Counts: 8 prior + 3 new = 11 total.

```ts
'pdf-quote': new Date('2026-05-23'),
'tags': new Date('2026-05-24'),
'search-jobs': new Date('2026-05-24'),
'quick-duplicate': new Date('2026-05-24'),
// Add new features here with their release date
```

### 2. `src/hooks/useDatabase.ts` (Task 1) — D-12 reconcile wiring

**Import update at line 6** (added `normalizeTagsOnJob`):
```ts
import { backfillCustomersFromSales, reconcileCopiesSoldFromSales, normalizeTagsOnJob } from '../db/backfill';
```

**Module-scope flag at line 19** (sibling to `copiesSoldReconcileRan`):
```ts
// Phase 15 D-12 — process-lifetime flag for the tag-normalization reconcile (sibling to copiesSoldReconcileRan).
let tagsNormalizeRan = false;
```

**New effect inside `useJobs`** (lines 491–530, immediately after the `copiesSoldReconcileRan` effect):
```ts
useEffect(() => {
  if (tagsNormalizeRan) return;
  if (jobs === undefined) return;
  tagsNormalizeRan = true;
  let cancelled = false;
  (async () => {
    try {
      const dirty: PrintJob[] = [];
      for (const job of jobs) {
        const copy: PrintJob = { ...job, tags: job.tags ? [...job.tags] : undefined };
        if (normalizeTagsOnJob(copy)) {
          dirty.push({ ...copy, updatedAt: new Date() });
        }
      }
      if (cancelled) return;
      if (dirty.length > 0) {
        await db.transaction('rw', db.jobs, async () => {
          for (const job of dirty) await db.jobs.put(job);
        });
      }
    } catch (err) {
      console.error('tag normalize reconcile failed:', err);
      tagsNormalizeRan = false;
    }
  })();
  return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [jobs === undefined]);
```

Mirrors the copiesSoldReconcileRan template exactly. Shallow-copy each job + tags array before mutation so the dexie-react-hooks liveQuery cache is never touched. Error path swallows + resets the flag for retry on next mount.

### 3. `src/components/JobsManager.tsx` (Task 2) — multi-surface

**Imports added (top of file):**
```ts
import { parseTagsInput } from '../db/backfill';
import { duplicateJob, nextCopyName } from '../utils/duplicateJob';
```

**Local SVG component** (`PencilIcon`, lines 692–706) — mirrors `CustomerLibrary.tsx:352-365` verbatim.

**New JobCardProps fields** (lines 60–75):
- `onDuplicate`, `isHighlighted`, `overflowOpen`, `onToggleOverflow`
- `isEditingTags`, `onStartEditTags`, `onCancelEditTags`, `onSaveTags`

**New parent state** (lines 779–797):
- `overflowOpenJobId: string | null` — one menu open at a time
- `highlightedJobId: string | null` — post-duplicate ring target
- `editingTagsJobId: string | null` — one editor open at a time

**Click-outside handler** (lines 821–832, after the debounce effect) — closes the overflow menu when any other click bubbles to window. Guarded by `!overflowOpenJobId` so no listener is attached when no menu is open.

**Handler callbacks** (lines 1337–1397):
- `handleDuplicate(source)`: composes `nextCopyName` + `duplicateJob`; persists via `db.jobs.add`; seeds `highlightedJobId` + 2s timer.
- `handleToggleOverflow(jobId)`: toggles the open id (same id → close, different id → transfer).
- `handleStartEditTags(jobId)`: opens the inline editor; closes any open `[⋯]` menu.
- `handleCancelEditTags()`: closes the editor.
- `handleSaveTags(job, value)`: `parseTagsInput(value)` + `db.jobs.put` with refreshed `updatedAt`.

**JobCard render block** — three new surfaces:

1. **Tag chips (D-11)** — lines 433–445. Between the filament/print-time meta line and the price block. Byte-identical chip styling: `text-xs px-1.5 py-0.5 rounded bg-slate-600/50 text-slate-400`. Non-interactive `<span>`. Wrapper: `<div className="flex flex-wrap gap-1 mt-1">`.

2. **Highlight ring (D-07)** — line 412. JobCard root className appends `ring-2 ring-blue-400 ring-offset-2 ring-offset-slate-900` when `isHighlighted` is true. 2s window, set by `handleDuplicate`.

3. **Action row (D-07 + D-01 surface b)** — lines 533–604:
    - Wrapping `<div>` now has `relative` so the `[⋯]` menu's absolute positioning anchors correctly.
    - Pencil ghost button between Create Quote and Edit (hidden when editor is open).
    - `[⋯]` overflow trigger at the end (after Delete), wrapped in `<div className="relative">` with `<NewBadge feature="quick-duplicate" className="absolute -top-1 -right-1" />`. Menu reveals a single "Duplicate" menuitem on click; clicking the menuitem calls `onDuplicate(job)` and closes the menu.

4. **Inline tag editor (D-01 surface b)** — lines 606–648. Conditionally rendered below the action row when `isEditingTags`. Label uses the flex-container pattern with `<NewBadge feature="tags" />` as a label-inline child (NOT absolute-overlay). Enter/Escape keyboard support. Save calls `parseTagsInput` + `db.jobs.put`.

**Search input NewBadge** (line 1610) — `<NewBadge feature="search-jobs" className="absolute -top-1 -right-1" />` mounted inside the Plan 15-04 search input wrapper (which already has `relative` positioning). Plan 15-04 logic untouched.

**JobRow adapter** (lines 769–841) — extended to forward the new props per row, computing `overflowOpen`, `isHighlighted`, `isEditingTags` from the parent state by id matching.

**rowProps useMemo** — extended with the 8 new fields and their dependencies.

## Self-Check: PASSED

Files modified verified:
- `src/features.ts` — 11 entries; new `tags`, `search-jobs`, `quick-duplicate` keys present
- `src/hooks/useDatabase.ts` — `let tagsNormalizeRan = false` at module scope; `normalizeTagsOnJob` imported and called per-job inside the effect
- `src/components/JobsManager.tsx` — all 3 new NewBadge JSX sites present; tags label-inline (no absolute class); search-jobs + quick-duplicate absolute-overlay; Duplicate menuitem text in place; `ring-2 ring-blue-400` highlight class present

Commits verified in `git log --oneline -5`:
- `f6adf53` — Task 1: features.ts + useDatabase.ts
- `f794f77` — Task 2: JobsManager.tsx

Tooling verified:
- `npx tsc -b` — clean exit
- `npx vitest run` — 18 test files, 263 passed (1 todo), no regressions
- `node scripts/lint-no-raw-html.mjs` — passed

## Deviations from Plan

None — plan executed exactly as written. The plan was prescriptive (down to the chip class string and the menu item label); no architectural surprises and no auto-fix paths triggered. Two acceptance-criteria grep patterns were slightly stricter than the actual JSX layout but the functional behavior matches:
- The `'>Duplicate<'` literal grep didn't match because the JSX has whitespace between `>` and `Duplicate` (multi-line JSX indentation). Functionally the menu item is correctly labeled "Duplicate" with `role="menuitem"`.
- The plain-substring `"text-xs px-1.5 py-0.5 rounded bg-slate-600/50 text-slate-400"` returned 1 because the Plan 15-04 chip filter row inserts `transition-colors` into the middle of the same class set. A regex with `.*` between the segments correctly returns 2.

Both are grep-pattern brittleness, not implementation issues.

## D-13 Compliance — NewBadge Placement Confirmation

| Badge | Surface | Pattern | Site |
|-------|---------|---------|------|
| `tags` | Inline tag editor label | LABEL-INLINE (child of `<label className="flex items-center gap-1.5">`) | JobsManager.tsx (inline editor) + CostCalculator.tsx (Plan 15-03) |
| `search-jobs` | Plan 15-04 search input wrapper | ABSOLUTE-OVERLAY (`className="absolute -top-1 -right-1"`) | JobsManager.tsx search wrapper |
| `quick-duplicate` | `[⋯]` overflow trigger | ABSOLUTE-OVERLAY (`className="absolute -top-1 -right-1"`) | JobsManager.tsx [⋯] wrapper |

Total absolute-overlay `<NewBadge>` JSX consumers in JobsManager.tsx: **3** (pre-existing `pdf-quote` + new `quick-duplicate` + new `search-jobs`). **NOT 4** — `tags` is correctly LABEL-INLINE. Per the project memory rule + D-13 lock, absolute-overlay is reserved for square / icon-button surfaces; label flex containers use inline-child placement so the badge participates in the existing flex without disrupting siblings.

## Phase 15 Closure

This plan completes the 4 of 6 plans the orchestrator was sequenced for. Plan 15-06 (UAT) remains — visual confirmation that the chips appear on JobCards, the inline editor opens + saves, the `[⋯] → Duplicate` action spawns a new row at the top with the 2s blue ring, and the three new NewBadges show correctly on fresh sessions.

The six Phase 15 requirements (TAGS-01..04, DUP-01..02) are now ALL implemented across the plan set:
- TAGS-01 (tag input on CostCalculator + JobsManager): Plan 15-03 + Plan 15-05
- TAGS-02 (search bar): Plan 15-04
- TAGS-03 (chip filter): Plan 15-04
- TAGS-04 (filter cache invalidation): Plan 15-04
- DUP-01 (Duplicate row action): Plan 15-05
- DUP-02 (duplicate unit-test contract): Plan 15-02

D-12 reconcile shipped (this plan). D-13 NewBadge wiring complete (3 entries + 3 JSX consumers + 2 label-inline + 2 absolute-overlay). Threat-model mitigations T-15-10, T-15-11, T-15-12 honoured.
