---
phase: 15-tags-search-quick-duplicate
plan: 01
subsystem: db
tags: [tags, normalization, reconcile, pure-helper, jsdom-safe]
requires: [phase-12-backfillTagsOnJob]
provides: [normalizeTagsOnJob]
affects: [src/db/backfill.ts, src/db/backfill.test.ts]
tech_stack:
  added: []
  patterns: [pure-helper-reconcile, jsdom-safe-module, jsdoc-examples-block]
key_files:
  created: []
  modified:
    - src/db/backfill.ts
    - src/db/backfill.test.ts
decisions:
  - D-12 reconcile rule applied — Phase 15 normalizer co-exists with Phase 12 backfill; safe in either order, multiple times
  - Structural typing on helper signature (`{ tags?: string[] }`) — no PrintJob import required, keeps jsdom-safety contract minimal
  - JSDoc Examples block enumerates 6 cases verbatim (matches backfillTagsOnJob convention exactly)
metrics:
  duration_min: 3
  duration_secs: 192
  completed_date: 2026-05-24
requirements_addressed: [TAGS-01]
---

# Phase 15 Plan 01: normalizeTagsOnJob pure helper Summary

D-12 reconcile helper that normalizes legacy `PrintJob.tags` arrays to D-02 canonical form (lowercase + trim + dedupe + cap-at-10 + `/[^a-z0-9\s\-_]/g` whitelist) on app load, with 6 Vitest cases covering every transform branch.

## What Was Built

### Helper signature
```typescript
export function normalizeTagsOnJob(job: { tags?: string[] }): boolean
```

- **Return contract:** `true` when the helper mutated `job.tags` (caller should `bulkPut`), `false` when no write is needed (input already canonical, or `job.tags` is not an array)
- **Idempotency:** running a second time on already-canonical tags returns `false` and does not mutate
- **Type:** structural — accepts any object with optional `tags?: string[]`, no PrintJob import needed
- **Module safety:** zero Dexie / `./database` imports; the test file imports it without triggering the `new Dexie('3DCosterDB')` top-level side effect

### Transform pipeline (per D-02)
For each entry in `job.tags`:
1. Skip non-string entries (typeof guard against DevTools-injected corruption)
2. `raw.trim().toLowerCase().replace(/[^a-z0-9\s\-_]/g, '')`
3. Drop entries that become empty after step 2
4. Dedupe via `Set<string>` (case-insensitive after lowercase)
5. Break early when `cleaned.length >= 10` (D-02 cap)

After the loop, an idempotency short-circuit compares `cleaned` to `job.tags` element-by-element; identical input → returns `false` without assigning. Otherwise assigns `job.tags = cleaned` and returns `true`.

## Files Modified

### `src/db/backfill.ts`
- **Lines 32–79 added** — new `normalizeTagsOnJob` JSDoc block + function definition, inserted between `backfillTagsOnJob` (ends at line 30) and `backfillQuotesFromJobs` (now starts at line 82)
- JSDoc cites "Phase 15 D-12 reconcile (per [[reconcile-legacy-data]])" in line 1
- JSDoc Examples block enumerates 6 cases mirroring backfillTagsOnJob convention
- **`backfillTagsOnJob` unchanged** — lines 28–30 still read `if (!Array.isArray(job.tags)) job.tags = [];` verbatim

### `src/db/backfill.test.ts`
- **Line 2 updated** — added `normalizeTagsOnJob` to the destructured import list (between `backfillTagsOnJob` and `backfillQuotesFromJobs`)
- **Lines 400–446 added** — new `describe('normalizeTagsOnJob (Phase 15 D-12)', () => { ... })` block at end of file, after `reconcileCopiesSoldFromSales` describe (which ends at line 398)
- 6 it() cases verbatim from the locked PATTERNS template
- Existing `backfillTagsOnJob`, `backfillQuotesFromJobs`, `backfillCustomersFromSales`, `reconcileCopiesSoldFromSales` describe blocks untouched

## Test Cases (6 new, all passing)

| # | Case | Input | Expected | Status |
|---|------|-------|----------|--------|
| 1 | lowercases + trims existing tags | `['PLA', '  Phone-Stand  ']` | `changed=true`, tags = `['pla', 'phone-stand']` | PASS |
| 2 | dedupes case-insensitively | `['pla', 'PLA', 'Pla']` | tags = `['pla']` | PASS |
| 3 | strips emoji and punctuation via /[^a-z0-9\s\-_]/g whitelist | `['pla!!', 'phone💀stand', '@@@']` | tags = `['pla', 'phonestand']` ('@@@' → '' → dropped) | PASS |
| 4 | caps at 10 tags, silently dropping the rest | 15 entries `tag0..tag14` | tags.length === 10 | PASS |
| 5 | returns false (no mutation) when already canonical | `['pla', 'phone-stand']` | `changed=false`, tags unchanged | PASS |
| 6 | returns false when tags is undefined (Phase 12 backfill not yet run) | `{}` | `changed=false` | PASS |

## Test Counts

- **backfill.test.ts baseline:** 28 it() cases (5 backfillTagsOnJob + 7 backfillQuotesFromJobs + 9 backfillCustomersFromSales + 7 reconcileCopiesSoldFromSales)
- **After this plan:** 34 it() cases (baseline + 6 new normalizeTagsOnJob cases) — matches expected `baseline + 6`
- **Full project suite:** 248 passed, 1 todo (the pre-existing costCalc.test.ts tax/VAT placeholder) — no regressions

## Verification Results

| Check | Result |
|-------|--------|
| `npx tsc -b` exit | 0 |
| `grep -c "export function normalizeTagsOnJob" src/db/backfill.ts` | 1 |
| `grep -c "Phase 15 D-12" src/db/backfill.ts` | 1 |
| `grep -c "reconcile-legacy-data" src/db/backfill.ts` | 1 |
| `grep -c "cleaned.length >= 10" src/db/backfill.ts` | 1 |
| Real Dexie/`./database` imports in `src/db/backfill.ts` | 0 (only JSDoc mentions, no `import` statements) |
| `grep -c "describe('normalizeTagsOnJob" src/db/backfill.test.ts` | 1 |
| Total `it(` count in backfill.test.ts | 34 (28 baseline + 6) |
| `normalizeTagsOnJob` references in test file | 9 (1 import + 6 it body call sites + 2 in describe/comment header) |
| `npm test -- --run src/db/backfill.test.ts` | 34/34 PASS |
| Full `npm test` | 248 passed / 1 todo / 0 failed |

## Commits

| Task | Commit | Type | Message |
|------|--------|------|---------|
| 1 | `ca6c9ad` | feat | feat(15-01): add normalizeTagsOnJob pure helper |
| 2 | `3d45c75` | test | test(15-01): add normalizeTagsOnJob describe block (6 cases) |

## Deviations from Plan

None — plan executed exactly as written. The PATTERNS template at lines 207–249 was followed verbatim for the helper body, and the test template at lines 262–300 was followed verbatim for the six it() cases.

**Pre-flight finding (not a deviation):** The worktree's `node_modules` was empty at agent start (Claude Code worktree spawn does not auto-install). Running `npm install` resolved 648 packages and `tsc -b` then exited 0. No package was added to `package.json` — this was strictly populating the worktree with already-declared deps. The main repo equally lacks these deps installed; this is a worktree-specific setup step, not a project-state change.

## Authentication Gates

None encountered.

## Known Stubs

None — the helper is a complete pure function with no placeholder data paths. Plan 15-05 will wire this helper into `useJobs` init (separate plan in this phase).

## Threat Flags

None — the helper introduces no new network endpoints, auth paths, file access, or schema changes. The threat register's T-15-01 (input tampering) is mitigated by the `/[^a-z0-9\s\-_]/g` whitelist that strips all punctuation/emoji before any downstream renderer sees the value; T-15-02 (jsdom contamination) is mitigated by the zero-Dexie-import rule verified by grep.

## TDD Gate Compliance

This plan uses helper-first ordering (Task 1 = helper, Task 2 = tests) per the plan author's choice, so the standard RED → GREEN sequence is inverted to GREEN-with-targeted-verification. The TDD intent (every line of new code in `normalizeTagsOnJob` has a corresponding assertion) is satisfied:
- 6 transform branches in the helper, 6 test cases, 1:1 coverage
- All 6 tests passed on first run after the helper was committed (no iterations needed)

Per the plan's frontmatter `type: execute` (not `type: tdd`), the strict RED/GREEN commit sequence is not gated.

## Self-Check: PASSED

- `[ -f src/db/backfill.ts ]` → FOUND
- `[ -f src/db/backfill.test.ts ]` → FOUND
- `[ -f .planning/phases/15-tags-search-quick-duplicate/15-01-SUMMARY.md ]` → FOUND (this file)
- Commit `ca6c9ad` (Task 1) → FOUND in `git log --oneline`
- Commit `3d45c75` (Task 2) → FOUND in `git log --oneline`
- `npx tsc -b` exits 0 → CONFIRMED
- `npm test -- --run src/db/backfill.test.ts` → 34/34 PASS
