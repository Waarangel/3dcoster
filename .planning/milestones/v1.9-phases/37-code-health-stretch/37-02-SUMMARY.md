---
phase: 37-code-health-stretch
plan: "02"
subsystem: database-hooks
tags: [code-health, hyg-12, promise-all, type-narrowing, idb, refactor]
dependency_graph:
  requires: [37-01]
  provides: [batched-useAssets-init-reads, validated-UserProfile-narrowing-C1-C3]
  affects:
    - src/hooks/useDatabase.ts
    - src/db/database.ts
tech_stack:
  added: []
  patterns:
    - "Promise.all batching of independent IDB COUNT reads"
    - "Partial<UserProfile> + typeof narrowing (v9 validated-narrowing pattern)"
key_files:
  created: []
  modified:
    - src/hooks/useDatabase.ts
    - src/hooks/useDatabase.test.ts
    - src/db/database.ts
    - src/db/database.test.ts
decisions:
  - "Batch A+B only (printerCount + packagingCount) — reads C/D/E left sequential (MEDIUM-risk complexity of !flagRan ternaries exceeds value for a droppable STRETCH plan)"
  - "Narrow C1 (v8 migration database.ts:133) and C3 (createQuote useDatabase.ts:1211) only — other 7 casts are build-safe or caller-validated (C7/C8/C9 in backfill.ts) and left unchanged per RESEARCH scope lock"
  - "Use readFileSync source-contract assertions (no runtime harness exercises useAssets init path in jsdom)"
metrics:
  duration: "~10 minutes"
  completed: "2026-06-26T09:25:00Z"
---

# Phase 37 Plan 02: HYG-12.2 Promise.all Batching + HYG-12.3 Cast Narrowing Summary

Batched the two independent `useAssets` init COUNT reads (`printerCount` + `packagingCount`) into a single `Promise.all` with a consolidated cancelled check (HYG-12.2), and replaced the two real unsafe `as UserProfile` casts with `Partial<UserProfile>` + `typeof` validated narrowing matching the v9 pattern already in the file (HYG-12.3 C1 + C3). Full suite 760 tests green, `tsc -b` clean — zero behavioral change.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Batch useAssets A+B reads via Promise.all + narrow C3 createQuote cast | 38a9bf5 | useDatabase.ts, useDatabase.test.ts |
| 2 | Narrow C1 v8-migration currency cast in database.ts | 25a5cbf | database.ts, database.test.ts |
| 3 | Full-suite + tsc -b + lint regression gate | — (no source changes; gates passed clean) | — |

## What Was Built

### HYG-12.2: useAssets init reads A+B batched via Promise.all

Replaced two sequential `await db.materials...count()` calls (with two intermediate `if (cancelled) return` guards) with a single destructured `Promise.all`:

```typescript
const [printerCount, packagingCount] = await Promise.all([
  db.materials.where('category').equals('printer').count(),
  db.materials.where('category').equals('packaging').count(),
]);
if (cancelled) return;
```

The two `bulkPut` writes remain sequential and cancel-checked after the batch. Reads C/D/E (migration probes interleaved with conditional writes) are left sequential per the scope-locked plan decision.

### HYG-12.3 C3: createQuote nextQuoteNumber narrowing

Replaced `(JSON.parse(settingsRow.value) as UserProfile).nextQuoteNumber ?? 1` with validated narrowing inside the existing try/catch:

```typescript
const parsedProfile = JSON.parse(settingsRow.value) as Partial<UserProfile>;
nextNum = typeof parsedProfile.nextQuoteNumber === 'number'
  ? parsedProfile.nextQuoteNumber
  : 1;
```

### HYG-12.3 C1: v8-migration currency narrowing

Replaced `(JSON.parse(settingsRow.value) as UserProfile).currency` with the v9-pattern narrowing:

```typescript
const parsedV8 = JSON.parse(settingsRow.value) as Partial<UserProfile>;
if (typeof parsedV8.currency === 'string' && parsedV8.currency.length > 0) {
  currency = parsedV8.currency;
}
```

Corrupt/partial rows now cleanly leave `currency` at the `'USD'` default. The v8 migration already ran for all existing users (Pitfall 3 from RESEARCH).

### Source-contract tests

Added `readFileSync`-based source-contract assertions in both test files (new `describe` blocks) covering: Promise.all presence, absence of standalone packagingCount sequential assignment, bulkPut write blocks intact, catch block log preserved, Partial<UserProfile> + typeof guard patterns, and absence of the old unvalidated casts.

## Deviations from Plan

None — plan executed exactly as written. A+B-only batch scope and C1+C3-only narrowing were both pre-locked decisions carried in from RESEARCH.

## Regression Gate Results

| Gate | Result |
|------|--------|
| `npx vitest run src/hooks/useDatabase.test.ts` | 15/15 passed |
| `npx vitest run src/db/database.test.ts` | 32/32 passed |
| `npx vitest run` (full suite) | 760 passed, 1 todo — 0 failures |
| `tsc -b` | clean (exit 0) |
| `npm run lint` | 0 errors, 21 pre-existing warnings (none introduced by this plan) |

## Known Stubs

None — this plan contains no user-facing UI or data stubs. All changes are internal type-narrowing and read-ordering refactors.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes. T-37-01 (v8 currency cast) and T-37-02 (createQuote nextQuoteNumber cast) from the threat register are both mitigated by this plan as planned.

## Self-Check: PASSED

- `src/hooks/useDatabase.ts` modified: FOUND
- `src/hooks/useDatabase.test.ts` modified: FOUND
- `src/db/database.ts` modified: FOUND
- `src/db/database.test.ts` modified: FOUND
- Commit 38a9bf5: FOUND (Task 1)
- Commit 25a5cbf: FOUND (Task 2)
- Full suite 760 tests green: VERIFIED
- tsc -b clean: VERIFIED
