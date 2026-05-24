---
phase: 15-tags-search-quick-duplicate
plan: 03
subsystem: cost-calculator
tags: [tags, cost-calculator, input, parse, tdd]
dependency_graph:
  requires:
    - "15-01 (normalizeTagsOnJob — the reconcile-path D-02 normalizer)"
    - "Phase 12 PrintJob.tags? schema (v6)"
  provides:
    - "parseTagsInput — shared input-path D-02 transform (consumed by 15-04 JobsManager inline edit)"
    - "_normalizeTagToken — private single-source-of-truth for the D-02 whitelist + trim/lowercase sequence"
    - "TAGS_MAX constant — D-02 cap-at-10 (read by both backfill helpers)"
    - "tagsInput state + Tag input UI in CostCalculator (one of two TAGS-01 input surfaces; the second lands in 15-04)"
  affects:
    - "src/db/backfill.ts (added parseTagsInput + refactored normalizeTagsOnJob to share _normalizeTagToken)"
    - "src/components/CostCalculator.tsx (new state, new input field, both save branches wire tags)"
tech_stack:
  added: []
  patterns:
    - "Shared private helper + named constant for D-02 transform (DRY between input + reconcile paths)"
    - "JSX label-inline NewBadge (D-13 + project memory) — mirrors Model URL pattern exactly"
    - "Inline at-cap warning rendered conditionally (no toast — non-blocking surface)"
key_files:
  created: []
  modified:
    - "src/db/backfill.ts (parseTagsInput export + _normalizeTagToken extraction + TAGS_MAX constant)"
    - "src/db/backfill.test.ts (added parseTagsInput describe block with 8 it() cases)"
    - "src/components/CostCalculator.tsx (tagsInput state, sessionStorage persist, edit pre-fill, clearForm reset, Tags row JSX, both save branches wire tags)"
decisions:
  - "Extracted `_normalizeTagToken` private helper rather than inline-duplicating the D-02 whitelist regex — DRY win, single source of truth (the regex appears in CODE exactly once at backfill.ts:55)"
  - "Centralized D-02 cap-at-10 as `TAGS_MAX = 10` constant — both functions read it; never literal 10 in branches"
  - "Tags row gets its own flex-wrap row below Model URL (not a sibling inside the URL/Cost/AuthorMin row) so the at-cap warning has room to render without disturbing existing layout"
  - "Inline warning uses an IIFE inside JSX rather than a memoized derived value — keeps the warning logic adjacent to the Input, avoids polluting component state surface for a derived render"
  - "tagsInput is sessionStorage-persisted alongside other identity-row fields (modelUrl, printName) so a refresh during compose doesn't lose work"
metrics:
  start_time: "2026-05-24T15:52:00Z"
  end_time: "2026-05-24T15:56:04Z"
  duration_minutes: 4
  task_count: 2
  file_count: 3
  completed_date: "2026-05-24"
---

# Phase 15 Plan 03: Tag Input on CostCalculator Save (TAGS-01 surface a) Summary

Add a comma-separated tag input to the CostCalculator save form and a shared `parseTagsInput` helper that re-uses the D-02 transform with the Plan 15-01 reconcile path — both via a single private `_normalizeTagToken` helper so input + reconcile cannot drift.

## What Shipped

**parseTagsInput helper** (`src/db/backfill.ts:103-128`):
- Signature: `export function parseTagsInput(raw: string): string[] | undefined`
- Pipeline: comma-split → `_normalizeTagToken` (trim + lowercase + whitelist `/[^a-z0-9\s\-_]/g`) → drop empty → dedupe via Set → cap at TAGS_MAX
- Empty input + all-strip-to-empty → `undefined` (D-02 line 43 lock — preserves "no tags ever set" semantic on freshly-saved jobs)
- 8 unit tests cover: basic normalize, dedupe, multi-word preserved, empty undefined, whitespace-only undefined, cap-at-10, emoji/punctuation strip, all-strip-to-empty

**Shared D-02 transform** (`src/db/backfill.ts:39-56`):
- `TAGS_MAX = 10` constant — both `parseTagsInput` and `normalizeTagsOnJob` read it
- `_normalizeTagToken(raw)` private helper — the whitelist regex `/[^a-z0-9\s\-_]/g` appears in code **exactly once** (line 55)
- `normalizeTagsOnJob` (Plan 15-01) refactored to call through `_normalizeTagToken` (behavior unchanged; all 6 existing test cases still pass)

**CostCalculator UI** (`src/components/CostCalculator.tsx`):
- `tagsInput` local state (line 119) — sessionStorage-persisted under `tagsInput` key
- New Tags row inserted between the Model URL row (lines 787-855) and the Multi-Filament Rows (now at lines 857-879)
- Label-inline NewBadge (`<NewBadge feature="tags" />`) — mirrors the Model URL JSX shape EXACTLY (no `className="absolute"` — D-13 + project memory rule)
- InfoTooltip: "Comma-separated. Lowercase, max 10. Use hyphens or spaces inside a tag — e.g. 'phone-stand, pla, gloss'."
- Input placeholder: `phone-stand, pla, gloss`
- Inline at-cap warning: rendered via IIFE only when `parseTagsInput(tagsInput).length >= 10`
- Edit pre-fill (line 207): `setTagsInput(editingJob?.tags?.join(', ') ?? '')`
- clearForm reset (line 522): `setTagsInput('')`
- Both save branches wire `tags: parseTagsInput(tagsInput)`:
  - **Update branch** at handleSaveJob line 599 (just after `marketplace`, inside the `updatedJob: PrintJob` literal)
  - **Create branch** at handleSaveJob line 634 (just after `marketplace`, before `copiesSold: 0`)

## Tasks Completed

| Task | Name                                                                              | Commit  |
|------|-----------------------------------------------------------------------------------|---------|
| RED  | test(15-03): add failing tests for parseTagsInput (Phase 15 D-02)                 | bac790f |
| GREEN| feat(15-03): implement parseTagsInput with shared D-02 transform (TAGS-01)        | add6795 |
| Task 2 | feat(15-03): add Tag input field to CostCalculator save form (TAGS-01)          | 15b62a3 |

## Verification

- `npx tsc -b` → exits 0 (clean)
- `npx vitest run src/db/backfill.test.ts` → 42 tests pass (34 pre-existing + 8 new parseTagsInput)
- `npx vitest run` → **263 tests pass, 1 todo** across 18 test files — no regression in any sibling suite
- `grep -c "tags: parseTagsInput(tagsInput)" src/components/CostCalculator.tsx` → **2** (Update + Create branches)
- `grep -c "<NewBadge feature=\"tags\" className=\"absolute" src/components/CostCalculator.tsx` → **0** (label-inline confirmed, NOT absolute-overlay)
- `grep -c "/\[\^a-z0-9.*\]/g" src/db/backfill.ts` → 4 (2 JSDoc references + 2 code locations — both code locations are inside `_normalizeTagToken` shared helper consumed by `normalizeTagsOnJob` and `parseTagsInput`; the regex literal appears in *exactly one* runtime location at line 55)
- Model URL field at `CostCalculator.tsx:788-801` structurally unchanged (still has `NewBadge feature="model-url"`)

## D-02 Transform Sharing — Single Source of Truth

The acceptance criterion specifies: *"The whitelist regex `/[^a-z0-9\s\-_]/g` appears in BOTH `normalizeTagsOnJob` AND `parseTagsInput` (or once in a shared private helper)"*. We chose the **shared private helper** branch:

```ts
function _normalizeTagToken(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9\s\-_]/g, '');
}
```

Both `parseTagsInput` and `normalizeTagsOnJob` call through `_normalizeTagToken`. The whitelist regex appears in executable code **exactly once** (line 55). The cap-at-10 is centralized as `TAGS_MAX = 10` and read by both functions. Drift between input and reconcile paths is now impossible without changing the shared helper.

## NewBadge Placement Decision (D-13 + Project Memory)

The Tags NewBadge uses the **label-inline** pattern, NOT absolute-overlay. Rationale (from project memory `feedback_narrow_currency_inputs.md` + D-13):

- Host is a `<label className="flex items-center gap-1.5 ...">` — a flex container with explicit gap
- Inline children (the `<span>`, `<InfoTooltip>`, `<NewBadge>`) participate in the gap-1.5 flow
- The label is NOT inside a `flex-1` siblings-must-share-width container (the row-level flex-wrap above handles wrapping at the field level, not at the label level)
- This matches Model URL EXACTLY (lines 790-794) — the canonical analog called out in the plan

Absolute-overlay (`className="absolute -top-1 -right-1"`) is reserved for the upcoming **square icon buttons** in Plans 15-04 (search input) and 15-05 (overflow `[⋯]` trigger). Mixing the two patterns in the same wave would muddy the design language.

## Deviations from Plan

None — plan executed exactly as written.

The plan's acceptance criterion offered a choice between "2 inline regex occurrences" or "1 in a shared private helper" — we took the shared-helper path (recommended in the plan body itself: *"if the executor wants to extract a private helper `_normalizeTagToken(raw: string): string` shared by both functions, that's acceptable (and recommended for DRY)"*). This is a recorded plan-allowed choice, not a deviation.

## Threat Surface Scan

No new threat surface beyond the plan's threat model (T-15-06 + T-15-07). Both are mitigated:

- **T-15-06 (XSS-via-tag):** The D-02 whitelist `/[^a-z0-9\s\-_]/g` strips `<` and `>` before persistence. The Tags chip render (Plan 15-04) will be plain text (no `dangerouslySetInnerHTML`); even if a tag character slipped through, React would escape it on render.
- **T-15-07 (DoS via unbounded input):** Cap-at-10 enforced inside `parseTagsInput`. The Input element is single-line; browser-level practical limits prevent megabyte pastes. The Set+cap structure runs in O(n) over the split parts and breaks at 10, so worst-case work is bounded.

## Known Stubs

None.

## Self-Check: PASSED

- Created files: (none — modifications only)
- Modified files:
  - `src/db/backfill.ts` — FOUND (parseTagsInput exported)
  - `src/db/backfill.test.ts` — FOUND (8 new it() cases in parseTagsInput describe block)
  - `src/components/CostCalculator.tsx` — FOUND (tagsInput state, Tag input field, both save branches wired)
- Commits: bac790f, add6795, 15b62a3 — all present in `git log --oneline` on `claude/pedantic-ride-ab48c5`
- `npx tsc -b` exits 0
- `npx vitest run` → 263 pass, 1 todo, 0 fail

## TDD Gate Compliance

| Gate | Commit | Verified |
|------|--------|----------|
| RED | bac790f (test: failing tests) | 8 it() cases FAILED with `TypeError: parseTagsInput is not a function` |
| GREEN | add6795 (feat: implementation) | All 8 tests pass; 34 pre-existing tests pass; tsc clean |
| REFACTOR | (not needed) | `_normalizeTagToken` extraction was part of GREEN as the recommended-DRY path |
