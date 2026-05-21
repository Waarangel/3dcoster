# Phase 12: Schema Foundation - Pattern Map

**Mapped:** 2026-05-20
**Files analyzed:** 4 (2 modified, 2 optional new)
**Analogs found:** 4 / 4

---

## File Classification

| New/Modified File | Action | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|--------|------|-----------|----------------|---------------|
| `src/db/database.ts` | modify | db-config / migration | schema-versioning (event-driven on `versionchange`) | `src/db/database.ts:49-71` (v5 block, same file) | exact (self-analog) |
| `src/types.ts` | modify | type-definitions | static (compile-time) | `src/types.ts:131-175` (existing `FilamentUsage` + `PrintJob`) | exact (self-analog) |
| `src/db/backfill.ts` (optional) | new | utility / pure helper | transform (sync, no I/O) | `src/utils/costCalc.ts` (pure helper module pattern) | role-match |
| `src/db/__tests__/backfillTags.test.ts` (optional) | new | test | request-response (Vitest assertion) | `src/components/ui/EmptyState.test.ts` (small, focused, no-DOM unit test) | role-match |

**Match quality legend:** `exact` = same file + same role; `role-match` = different file but identical role and data-flow; `partial` = closest available, requires adaptation.

---

## Pattern Assignments

### `src/db/database.ts` (db-config, schema-versioning event-driven)

**Analog:** `src/db/database.ts:49–71` (the v5 upgrade block, same file).

The phase appends a new v6 block immediately after the v5 block (line 71) and BEFORE `export { db }` (currently line 73). All migration semantics (stores definition repeated verbatim, `upgrade(tx => ...)` returning the `modify()` promise, mutate-in-place pattern) are copied from v5.

#### Imports pattern (lines 1–2 — no changes needed)

```typescript
import Dexie, { type EntityTable } from 'dexie';
import type { Material, PrinterConfig, PrinterInstance, ElectricityConfig, LaborConfig, PrintJob, Sale, UserProfile, ShippingConfig, MarketplaceFees } from '../types';
```

Note: `JobCustomer` is NOT imported here — it's a structural type used only inside `PrintJob.customer?: JobCustomer`, which Dexie stores as JSON (no schema-string reference). No new import lines needed in `database.ts`.

#### Core pattern: v6 upgrade block (modeled on v5 lines 49–71)

**v5 template to copy verbatim (lines 49–71):**

```typescript
db.version(5).stores({
  materials: 'id, category, brand, filamentType, currency',
  printers: 'id, name',
  printerInstances: 'id, printerConfigId, nickname',
  jobs: 'id, name, createdAt, printerInstanceId',
  sales: 'id, jobId, soldAt',
  settings: 'key',
}).upgrade(tx => {
  return tx.table('jobs').toCollection().modify(job => {
    const hasFilament = job.filamentId && job.filamentId.trim() !== '';
    if (hasFilament) {
      job.filaments = [{
        filamentId: job.filamentId,
        grams: job.filamentGrams || 0,
        // pricePerGram intentionally omitted — form falls back to asset library price
      }];
    } else {
      job.filaments = [];
    }
    delete job.filamentId;
    delete job.filamentGrams;
  });
});
```

**Key things to copy from v5 verbatim:**

1. **Stores definition repeats ALL 6 tables**, even though no schema strings change (Dexie convention used in v1–v5; D-04 keeps `jobs` schema as `'id, name, createdAt, printerInstanceId'`).
2. **`upgrade(tx => { return tx.table(...).toCollection().modify(...) })`** — the `return` on the `modify()` promise is mandatory (RESEARCH Pitfall 2 / STATE.md note from v1.0).
3. **Arrow function with braces** that explicitly `return`s — not a brace-less expression form, but the `return` keyword is present.
4. **Direct property mutation inside `modify()` callback** (e.g. `job.filaments = [...]`, `delete job.filamentId`) — Dexie's proxy doesn't persist new-object replacement (RESEARCH Pitfall — v1.0 Phase 01 Pitfall 4).

#### v6 block to produce (drop-in after line 71):

```typescript
db.version(6).stores({
  // Schema strings IDENTICAL to v5 — no new indexes (D-04: tags filter is in-memory)
  materials: 'id, category, brand, filamentType, currency',
  printers: 'id, name',
  printerInstances: 'id, printerConfigId, nickname',
  jobs: 'id, name, createdAt, printerInstanceId',
  sales: 'id, jobId, soldAt',
  settings: 'key',
}).upgrade(tx => {
  // Backfill tags=[] so Phase 15 readers can call Array methods without guards.
  // Other new fields (customer/taxRate/taxAmount/quoteNumber on PrintJob;
  // defaultTaxRate/nextQuoteNumber on UserProfile) stay undefined and are
  // handled by read-side defaults (e.g. getUserProfile fallback at line 124).
  return tx.table('jobs').toCollection().modify(job => {
    if (!Array.isArray(job.tags)) job.tags = [];
  });
});
```

#### versionchange handler pattern (NEW — no in-file analog)

Reference: Dexie official docs (`https://dexie.org/docs/Dexie/Dexie.on.versionchange`).

**Placement:** Immediately after the v6 `.upgrade(...)` chain closes, and BEFORE `export { db }` on line 73. Per D-11 + RESEARCH Pitfall 1, module-top-level attachment is required so the handler is registered synchronously during module evaluation, before any consumer (`useDatabase.ts`) lazily fires `db.open()`.

```typescript
// Reload this tab if another tab loads a newer schema (SCHEMA-02 / D-10 / D-11).
// Without this, Dexie's default handler closes the connection and console.warn()s,
// which crashes the React tree via useLiveQuery references.
db.on('versionchange', () => {
  window.location.reload();
});
```

**Anti-patterns to avoid (RESEARCH-derived):**

- Do NOT put the handler in `main.tsx` / `App.tsx` / a `useEffect` — runs after first DB read.
- Do NOT wrap in `setTimeout` or show a `confirm()` / toast (D-10).
- Do NOT use `job.tags ??= []` in the migrator — use `Array.isArray(job.tags)` (D-08-adjacent + RESEARCH Pitfall 5).
- Do NOT forget `return` on `tx.table(...).modify(...)` (RESEARCH Pitfall 2).

#### Error handling pattern

Dexie owns the migration transaction's error handling — there is NO try/catch in the v5 block, and there should be none in v6. If `modify()` throws, Dexie rolls back the entire `upgrade` transaction atomically. This matches the v1.0 Phase 01 decision.

---

### `src/types.ts` (type-definitions, static)

**Analog:** `src/types.ts:131–175` (existing `FilamentUsage` interface + `PrintJob` interface).

Three changes, all additive (no removals, no renames):

1. **Add `JobCustomer` interface** — placed above `PrintJob` (mirrors the `FilamentUsage` at line 131 → `PrintJob` at line 139 layout per RESEARCH Open Question #2).
2. **Extend `PrintJob`** (currently lines 139–175) with 5 new optional fields.
3. **Extend `UserProfile`** (currently lines 195–212) with 2 new optional fields.

#### Existing pattern to mirror: `FilamentUsage` immediately above `PrintJob` (lines 131–139)

```typescript
export interface FilamentUsage {
  filamentId: string;       // References Asset with category === 'filament'
  grams: number;
  pricePerGram?: number;    // User-editable override; undefined = fall back to asset costPerUnit
  currency?: Currency;      // Currency for the price override
}

// A saved print job with break-even tracking
export interface PrintJob {
  id: string;
  // ...
}
```

#### Pattern: optional-field addition (existing examples in `PrintJob`)

`PrintJob` already has multiple `field?: Type` examples that prove the pattern:

| Line | Existing optional field | Pattern proof |
|------|-------------------------|---------------|
| 152  | `modelCostPerUnit?: boolean;` | optional primitive + trailing `?` |
| 153  | `authorMinPrice?: number;`    | optional number |
| 154  | `modelUrl?: string;`          | optional string |
| 174  | `notes?: string;`             | optional string |

This is the exact pattern the 5 new `PrintJob` fields and 2 new `UserProfile` fields will follow.

#### `JobCustomer` to insert (above `PrintJob`, e.g. between lines 137 and 138)

```typescript
// Customer details for the job (Phase 14 writes/reads).
// All fields optional; runtime validation lives in Phase 14's form (D-09).
export interface JobCustomer {
  name?: string;
  email?: string;
  address?: string;  // Freeform multi-line; PDF prints verbatim (D-08)
  company?: string;
}
```

#### `PrintJob` additions (5 new optional fields)

Suggested grouping per CONTEXT.md Claude's Discretion: customer near `name`, tax near `sellingPrice`, `quoteNumber` near the bottom.

```typescript
export interface PrintJob {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;

  // Customer details (Phase 14)                       <-- NEW
  customer?: JobCustomer;                              // NEW

  // Tags (Phase 15)                                   <-- NEW
  tags?: string[];                                     // NEW

  // Print parameters
  filaments: FilamentUsage[];
  printTimeHours: number;
  printerInstanceId: string;

  // ... (existing fields unchanged through line 168) ...

  // Pricing
  sellingPrice: number;
  taxRate?: number;     // Phase 13: per-job override (percent)    <-- NEW
  taxAmount?: number;   // Phase 13: computed sellingPrice * taxRate  <-- NEW

  // Break-even tracking
  copiesSold: number;

  // Notes
  notes?: string;

  // Quote numbering (Phase 16) — assigned on first PDF gen, then reused (D-05)
  quoteNumber?: number;                                // NEW
}
```

#### `UserProfile` additions (2 new optional fields)

```typescript
export interface UserProfile {
  currency: Currency;
  name?: string;
  laborHourlyRate: number;
  defaultProfitMargin?: number;
  address?: {
    street?: string;
    city?: string;
    province?: string;
    postalCode?: string;
    country?: string;
  };
  assetLibraryItemsPerPage?: number;

  // Tax (Phase 13)
  defaultTaxRate?: number;                             // NEW

  // Quote numbering (Phase 16) — first quote is #1 (D-06); read via `?? 1`
  nextQuoteNumber?: number;                            // NEW
}
```

#### Validation pattern

Per D-09, no runtime validation belongs in `types.ts` — only structural types. Phase 14 will add form-level validation in its component layer. This matches every other interface in `types.ts` (no Zod/Yup, no runtime guards).

---

### `src/db/backfill.ts` (OPTIONAL — utility, pure transform)

**Analog:** `src/utils/costCalc.ts` (pure-function module pattern that exports verifiable transforms tested by `src/utils/costCalc.test.ts`).

Per RESEARCH "Wave 0 Gaps" + Open Question #1, this file is OPTIONAL. The planner decides whether to extract the migrator body into a pure exported function so it can be unit-tested under jsdom (which cannot run a full Dexie migration — RESEARCH Pitfall 3).

#### Imports pattern (from analog `src/utils/costCalc.ts` opening lines)

A `src/db/backfill.ts` file would have minimal imports — no Dexie, no types imports needed if the signature uses `Record<string, unknown>`:

```typescript
// src/db/backfill.ts — no imports needed; pure structural type.
```

If the planner wants stronger typing:

```typescript
// Optional stricter form (still no Dexie import — keeps module testable under jsdom)
import type { PrintJob } from '../types';
```

#### Core pattern: pure helper export

```typescript
/**
 * Backfill `tags = []` on a job record that came from a pre-v6 schema.
 *
 * Used by the v6 Dexie upgrade callback in `database.ts`. Extracted as a
 * pure function so it can be unit-tested under jsdom (Vitest's environment),
 * which does NOT implement IndexedDB and cannot run a full Dexie migration
 * (RESEARCH Pitfall 3).
 *
 * Uses `Array.isArray` (not `??=`) so a manually-edited IndexedDB row with
 * `tags: "string"` or `tags: 42` is also normalized to `[]` (RESEARCH Pitfall 5).
 *
 * Examples:
 *   const j = {}; backfillTagsOnJob(j); // j.tags === []
 *   const j = { tags: ['a'] }; backfillTagsOnJob(j); // j.tags === ['a']
 *   const j = { tags: 'oops' }; backfillTagsOnJob(j); // j.tags === []
 */
export function backfillTagsOnJob(job: Record<string, unknown>): void {
  if (!Array.isArray(job.tags)) job.tags = [];
}
```

#### Wiring back into `database.ts`

If extracted, the v6 upgrade body becomes a one-liner:

```typescript
import { backfillTagsOnJob } from './backfill';

db.version(6).stores({ /* same as v5 */ }).upgrade(tx => {
  return tx.table('jobs').toCollection().modify(backfillTagsOnJob);
});
```

**Tradeoff (per RESEARCH):** Adds a one-line export that's only consumed by tests. If the planner skips this extraction, SCHEMA-01 (b) becomes a `checkpoint:human-verify` task instead of an automated Vitest assertion.

---

### `src/db/__tests__/backfillTags.test.ts` (OPTIONAL — test)

**Analog:** `src/components/ui/EmptyState.test.ts` (small, focused, jsdom-safe unit test that exercises a pure function with no DB / no DOM dependency for the core assertions).

**Why this analog (not `costCalc.test.ts`):** `EmptyState.test.ts` is the closest in size and structure — `it()` blocks each test one behavior of one exported function, no fixture helpers. `costCalc.test.ts` is a larger fixture-builder pattern (60+ lines just for helpers) which would be overkill for a 1-line pure function.

#### Imports pattern (from analog `src/components/ui/EmptyState.test.ts:1–4`)

```typescript
import { describe, it, expect } from 'vitest';
import { EmptyState, shouldShowEmptyState } from './EmptyState';
```

Adapted for backfill:

```typescript
import { describe, it, expect } from 'vitest';
import { backfillTagsOnJob } from '../backfill';
```

#### Core test pattern (from analog `EmptyState.test.ts:6–25`)

The analog uses one `describe` block, with individual `it` blocks each asserting a single behavior. Mirror this:

```typescript
describe('backfillTagsOnJob', () => {
  it('sets tags=[] when undefined', () => {
    const job: Record<string, unknown> = { id: '1' };
    backfillTagsOnJob(job);
    expect(job.tags).toEqual([]);
  });

  it('preserves an existing array of tags', () => {
    const job: Record<string, unknown> = { id: '1', tags: ['a', 'b'] };
    backfillTagsOnJob(job);
    expect(job.tags).toEqual(['a', 'b']);
  });

  it('replaces a non-array tags value with []', () => {
    const job: Record<string, unknown> = { id: '1', tags: 'oops' };
    backfillTagsOnJob(job);
    expect(job.tags).toEqual([]);
  });

  it('replaces null tags with []', () => {
    const job: Record<string, unknown> = { id: '1', tags: null };
    backfillTagsOnJob(job);
    expect(job.tags).toEqual([]);
  });
});
```

#### File location convention

The analog test sits adjacent to its source (`EmptyState.tsx` + `EmptyState.test.ts` in the same folder). For consistency with the wider project, prefer **`src/db/backfill.test.ts`** (sibling, no `__tests__` subfolder) over `src/db/__tests__/backfillTags.test.ts` — none of the existing 4 test files in the repo use a `__tests__` folder. They all sit beside their source:

| Test file | Source it tests |
|-----------|-----------------|
| `src/utils/costCalc.test.ts` | `src/utils/costCalc.ts` |
| `src/utils/threeMfParser.test.ts` | `src/utils/threeMfParser.ts` |
| `src/components/ui/EmptyState.test.ts` | `src/components/ui/EmptyState.tsx` |
| `src/components/ui/Skeleton.test.ts` | `src/components/ui/Skeleton.tsx` |

**Recommendation to planner:** Use `src/db/backfill.test.ts` (sibling) rather than `src/db/__tests__/backfillTags.test.ts` (CONTEXT prompt's suggested path) — it matches the existing repo convention exactly.

#### Vitest env confirmation

`vitest.config.ts:5` confirms `environment: 'jsdom'` and `include: ['src/**/*.test.ts']`. A test placed at `src/db/backfill.test.ts` is automatically picked up by the existing glob — no config changes needed.

The test must NOT import anything from `src/db/database.ts`, because that file constructs `new Dexie(...)` at module-top-level which throws under jsdom (RESEARCH Pitfall 4). Importing only from `src/db/backfill.ts` (zero Dexie side effects) is safe.

---

## Shared Patterns

### Pattern S1: Dexie module-top-level side effects

**Source:** `src/db/database.ts:11–18` (`const db = new Dexie('3DCosterDB')`)
**Applies to:** Any new file in `src/db/` and any test under jsdom.

```typescript
const db = new Dexie('3DCosterDB') as Dexie & { /* table typings */ };
```

**Implication for Phase 12:** The v6 `.version()` chain MUST be appended to this same singleton in the same file. The `versionchange` handler MUST be attached after the chain but before `export { db }`. Tests MUST NOT import from `database.ts` (RESEARCH Pitfall 4).

### Pattern S2: `upgrade(tx => { return tx.table(...).modify(...) })` returning the promise

**Source:** `src/db/database.ts:56–70` (v5 upgrade block)
**Applies to:** The new v6 block.

The braced-arrow-function-with-explicit-return form is the canonical project pattern. Verified working in production since v1.0 ship. **Mandatory** for v6 (RESEARCH Pitfall 2 / STATE.md "Dexie v5 migration returns modify() promise to ensure complete record conversion").

### Pattern S3: Optional fields with `field?: Type` and no deprecated stubs

**Source:** Multiple — `src/types.ts:152, 153, 154, 174` (within `PrintJob`); `src/types.ts:197, 201, 211` (within `UserProfile`)
**Applies to:** All 5 new `PrintJob` fields, 2 new `UserProfile` fields, all 4 `JobCustomer` fields.

```typescript
modelCostPerUnit?: boolean;    // existing pattern
authorMinPrice?: number;       // existing pattern
modelUrl?: string;             // existing pattern
notes?: string;                // existing pattern
```

No `@deprecated` markers, no V6-augment type. Locked decision inherited from v1.0 Phase 01 (CONTEXT.md "Established Patterns").

### Pattern S4: Settings table fallback merge (no migration needed for `UserProfile` new fields)

**Source:** `src/db/database.ts:76–88` (`getSetting` + `getUserProfile`)

```typescript
export async function getSetting<T>(key: string, defaultValue: T): Promise<T> {
  const setting = await db.settings.get(key);
  if (!setting) return defaultValue;
  try {
    return JSON.parse(setting.value) as T;
  } catch {
    return defaultValue;
  }
}
```

**Applies to:** `UserProfile.defaultTaxRate` and `UserProfile.nextQuoteNumber` — these are JSON-stringified into the `settings` table, NOT stored as IndexedDB rows. When `getUserProfile(defaultValue)` is called with a full default object that includes the new fields, missing keys are filled by the consumer's `defaultValue` argument. **No migration code is required** for the `userProfile` settings blob (D-02 + RESEARCH Architectural Map row 5).

### Pattern S5: Vitest unit test scaffolding (jsdom-safe)

**Source:** `src/components/ui/EmptyState.test.ts:1–4` (import block)
**Applies to:** Optional `src/db/backfill.test.ts`.

```typescript
import { describe, it, expect } from 'vitest';
import { /* exported pure functions */ } from './module-under-test';
```

Project test convention:
- Sibling file (`module.test.ts` next to `module.ts`), NO `__tests__` subfolder
- jsdom environment auto-applied via `vitest.config.ts:5`
- No Dexie imports anywhere in the test chain
- One `describe` block per exported function, one `it` block per behavior

---

## No Analog Found

| File | Role | Why no analog | Mitigation |
|------|------|---------------|------------|
| (none) | — | The `versionchange` event handler is the only truly new construct in this phase, but Dexie's official docs (cited in RESEARCH Sources) provide the exact pattern verbatim. The v5 block in `database.ts:49–71` serves as the analog for everything else. | Planner can reference the Dexie official docs link in PLAN.md task notes; no codebase analog needed because the pattern is a one-line event subscription with no project-specific structure to mimic. |

All files in this phase have a clear closest analog. No "novel pattern" gaps requiring RESEARCH.md-only patterns.

---

## Metadata

**Analog search scope:**
- `src/db/` (1 file — `database.ts`)
- `src/types.ts` (1 file)
- `src/utils/*.test.ts` (2 files)
- `src/components/ui/*.test.ts` (2 files)
- `vitest.config.ts` (1 file)

**Files scanned:** 7 (full read on `database.ts`, `types.ts`, `vitest.config.ts`; partial reads on test files; directory listing on `src/db/`)

**Key architectural insights:**
- `database.ts` is the ONLY file in the project that imports Dexie directly — all schema work is fully localized to this single file.
- `types.ts` is the ONLY file that declares `PrintJob` / `UserProfile` — all type extensions live here.
- jsdom env in `vitest.config.ts` confirms RESEARCH Pitfall 3 risk (no IndexedDB in tests) — only pure-function tests are viable for Phase 12.
- The repo has zero `__tests__/` subfolders; all 4 existing test files are siblings of their source — the planner should follow this convention if it elects to create the optional `backfill.test.ts`.
- Cross-tier note: `useDatabase.ts` is the sole consumer of `db`; no hook updates needed in Phase 12 (additive optional fields are silently accessible).

**Pattern extraction date:** 2026-05-20

---

## PATTERN MAPPING COMPLETE

**Phase:** 12 - Schema Foundation
**Files classified:** 4 (2 modified, 2 optional new)
**Analogs found:** 4 / 4

### Coverage
- Files with exact analog: 2 (`database.ts`, `types.ts` — self-analogs)
- Files with role-match analog: 2 (`backfill.ts` → `costCalc.ts`; `backfill.test.ts` → `EmptyState.test.ts`)
- Files with no analog: 0

### Key Patterns Identified
- v6 Dexie upgrade copies the v5 block at `src/db/database.ts:49–71` verbatim — same stores definition repeated, same `return tx.table().toCollection().modify(...)` shape, only the `modify()` body changes to `if (!Array.isArray(job.tags)) job.tags = [];`
- New `versionchange` handler attaches at module-top-level immediately after the `.upgrade()` chain and BEFORE `export { db }` on line 73 — this is the only pattern in the phase with no in-codebase analog (Dexie official docs provide the verbatim shape)
- `PrintJob` / `UserProfile` / new `JobCustomer` use the project's existing `field?: Type` optional-field convention (already proven by `modelCostPerUnit?`, `authorMinPrice?`, `notes?`, `defaultProfitMargin?`); no V6-augment type, no deprecated stubs
- Optional `backfill.ts` + `backfill.test.ts` follow `src/utils/costCalc.ts` + `costCalc.test.ts` pattern (sibling test, pure-function helper, no Dexie import in test chain to stay jsdom-safe per RESEARCH Pitfall 4)
- `UserProfile` new fields need NO migration code — `getUserProfile(defaultValue)` already fallback-merges missing keys via the existing `getSetting` JSON-parse path (`src/db/database.ts:76–88`)

### File Created
`.planning/phases/12-schema-foundation/12-PATTERNS.md`

### Ready for Planning
Pattern mapping complete. Planner can now reference exact analog file ranges + verbatim code excerpts in PLAN.md task actions.
