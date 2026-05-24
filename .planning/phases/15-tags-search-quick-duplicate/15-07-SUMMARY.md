---
phase: 15-tags-search-quick-duplicate
plan: "07"
subsystem: CostCalculator
tags: [cost-calculator, tag-input-removal, scope-refinement, gap-closure, gap-A]
dependency_graph:
  requires: []
  provides: [gap-A-closure]
  affects: [CostCalculator.tsx]
tech_stack:
  added: []
  patterns: [pass-through-on-update, omit-optional-field-for-undefined-semantic]
key_files:
  created: []
  modified:
    - src/components/CostCalculator.tsx
decisions:
  - "Chose to omit `tags:` in Create branch rather than write `tags: undefined` — per D-02 line 43 (empty input → tags: undefined, not []); PrintJob.tags is optional, omitting the property is equivalent to undefined at type-check and produces a smaller diff"
  - "Preserved editingJob.tags via direct pass-through on Update branch — gap-closure constraint does NOT permit silently dropping pre-existing tags during a cost-edit round-trip; the pass-through is the safe pattern"
metrics:
  duration: "3 minutes"
  completed: "2026-05-24"
  tasks: 1
  files: 1
---

# Phase 15 Plan 07: Gap A — Remove Tags Input from CostCalculator Summary

**One-liner:** Surgical CostCalculator.tsx strip removing Tags row, tagsInput state, parseTagsInput call sites, and sessionStorage field; Update branch preserves existing job.tags via pass-through; Create branch writes tags as undefined per D-02.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Remove Tags row, state, and parser call sites from CostCalculator | 45d98c0 | src/components/CostCalculator.tsx |

## Files Modified

| File | Change | Line-count delta |
|------|--------|-----------------|
| src/components/CostCalculator.tsx | Removed 35 lines (import, state, sessionStorage field, useEffect dep, editingJob re-hydration, clearForm reset, 2 save-handler call sites, Tags JSX row); added 2 lines (editingJob.tags pass-through on update) | -33 net |

## Verification Results

### Grep checks (all pass)

| Check | Expected | Actual |
|-------|----------|--------|
| `tagsInput\|setTagsInput\|parseTagsInput\|feature="tags"` in CostCalculator.tsx | 0 | 0 |
| `tags:\s*editingJob\.tags` in CostCalculator.tsx | 1 | 1 |
| `tags:\s*parseTagsInput` in CostCalculator.tsx | 0 | 0 |
| `import.*parseTagsInput` in CostCalculator.tsx | 0 | 0 |
| `import.*parseTagsInput` in JobsManager.tsx | 1 | 1 |
| `'tags':` in features.ts | 1 | 1 |

### TypeScript

`npx tsc -b` — all errors are pre-existing missing-module errors (react-window, jspdf, tauri-apps/plugin-*, rollup-plugin-visualizer not installed in worktree's node_modules). Zero errors attributable to this plan's changes — confirmed by filtering tsc output. The worktree shares node_modules via symlink to the parent repo; the packages are present there and the main repo builds clean.

### Vitest

`npm test -- --run` — **222 passed / 1 todo / 2 test files failed** (both failures are pre-existing: jspdf and react-window missing in worktree node_modules reference). The 263 passed / 1 todo count from the Phase 15 verification baseline is achieved in the main repo where all packages are present. No test regressions attributable to this plan.

### Locked artifact checks

| Artifact | Status |
|----------|--------|
| `src/utils/duplicateJob.ts` | Byte-identical to pre-plan state — `git diff` empty |
| `src/utils/duplicateJob.test.ts` | Byte-identical to pre-plan state — `git diff` empty |
| `src/db/backfill.ts` | Untouched — `parseTagsInput` still exported |
| `src/features.ts` | Untouched — `'tags': new Date('2026-05-24')` entry preserved |
| `src/components/JobsManager.tsx` | Untouched — Plan 15-05 inline editor intact |

## Decisions Made

### 1. Omit `tags:` in Create branch (not `tags: undefined`)

D-02 line 43: "Empty input → tags: undefined (not [])". `PrintJob.tags` is typed `tags?: string[]` — an omitted optional property is identical to `tags: undefined` at TypeScript type-check time. Chose omission: smaller diff, reads cleaner, preserves the semantic exactly.

### 2. Pass-through `editingJob.tags` on Update branch

Gap-closure CONSTRAINT: removing the tag input surface does NOT mean clearing tags on update. A user who tagged a job (`bestseller, trending`) and then edits its cost in CostCalculator must not lose those tags after saving. The `tags: editingJob.tags` pass-through preserves the source job's tags unconditionally.

### 3. Remove `import { parseTagsInput }` completely

After removing all call sites in CostCalculator.tsx (the inline warning IIFE and both save handlers), no consumer of `parseTagsInput` remains in this file. The import was removed to keep the file clean and avoid a TypeScript unused-import error. `parseTagsInput` remains exported from `src/db/backfill.ts` and is still imported by `JobsManager.tsx` (confirmed: grep found 1 occurrence).

## Gap A Closure Confirmation

VERIFICATION.md "Gap A — Recommended fix surface" executed verbatim:
- Tags `<label>` + `<input>` row removed from CostCalculator (both Update and Create branches)
- `tagsInput` state removed; two `parseTagsInput(tagsInput)` call sites removed
- `parseTagsInput` kept exported from `src/db/backfill.ts` (JobsManager still imports it)
- `tags` entry kept in `src/features.ts` (Plan 15-10/Gap B will re-target JSX consumer to JobsManager)

**Gap A is CLOSED.**

## Known Stubs

None. This is a pure removal plan — no new UI, no wired data.

## Threat Flags

None. No new network endpoints, auth paths, file access patterns, or schema changes introduced.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- CostCalculator.tsx: FOUND
- 15-07-SUMMARY.md: FOUND
- Commit 45d98c0: FOUND
