# Phase 1: Data Foundation - Research

**Researched:** 2026-04-14
**Domain:** TypeScript types + Dexie.js IndexedDB schema migration
**Confidence:** HIGH

## Summary

Phase 1 is a pure data layer change with no UI surface. It adds `FilamentUsage` to `src/types.ts`, removes two fields from `PrintJob`, and writes a Dexie v4→v5 migration that converts existing job records. The spec is already highly detailed and the patterns are well-established for this stack.

The biggest risk is TypeScript compilation: `strict: true` + `noUnusedLocals` + `noUnusedParameters` are enforced by `tsc -b` (used in the build script). Removing `filamentId` and `filamentGrams` from `PrintJob` will cause type errors in every consumer file immediately — CostCalculator, JobsManager, App.tsx, and any other file that references those fields. Phase 1 must decide whether to stub consumers or accept temporary type errors. This is the key planning decision.

The Dexie migration pattern (version().stores().upgrade()) is identical to existing versions in database.ts. The design spec's migration code is accurate and directly usable. No additional library installation is needed.

**Primary recommendation:** Add stub-compatible shims or use TypeScript `@ts-ignore` guards on known-broken consumers to keep `tsc -b` green during Phase 1. This avoids blocking the build pipeline until Phase 3 updates the consumers properly.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- `FilamentUsage` type fields: `filamentId: string`, `grams: number`, `pricePerGram?: number`, `currency?: Currency`
- `PrintJob` changes: remove `filamentId: string` and `filamentGrams: number`, add `filaments: FilamentUsage[]`
- Migration (v4→v5): same store indexes; convert existing jobs using `modify()` with `delete` on old fields
- Migration edge cases: empty/undefined `filamentId` results in `filaments: []`; valid `filamentId` results in `filaments: [{ filamentId, grams: filamentGrams || 0 }]`
- `pricePerGram` intentionally omitted from migrated jobs (form falls back to asset library `costPerUnit`)
- `MaterialUsage` type is unchanged
- `Material` type alias for `Asset` maintained
- `CostBreakdown.filament` stays as `number` (single total) — no structural change

### Claude's Discretion

- Whether to temporarily stub consumers (CostCalculator, JobsManager, etc.) to keep compilation working, or accept temporary compilation errors until Phase 3

### Deferred Ideas (OUT OF SCOPE)

- Per-filament cost breakdown display (v2)
- AMS slot management (separate feature)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DATA-01 | PrintJob stores multiple filaments as `filaments: FilamentUsage[]` replacing single `filamentId`/`filamentGrams` | Direct type edit in `src/types.ts` — remove two fields, add one |
| DATA-02 | Each FilamentUsage tracks filamentId, grams, optional pricePerGram override, and currency | New interface with four fields, two optional |
| DATA-03 | Database migration (v4→v5) converts existing single-filament jobs to filaments array | Dexie `version(5).stores({...}).upgrade(tx => tx.table('jobs').toCollection().modify(...))` pattern |
| DATA-04 | Migration handles edge cases: empty filamentId, missing filamentGrams, undefined values | `job.filamentId && job.filamentId.trim() !== ''` guard before creating the array entry |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Dexie.js | 4.2.1 (installed) | IndexedDB wrapper with schema versioning | Already in use; `version().upgrade()` is the canonical migration path |
| TypeScript | ~5.9.3 | Type safety | Already in use; strict mode enforced |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| dexie-react-hooks | 4.2.0 | `useLiveQuery` for reactive DB reads | Not directly involved in Phase 1 but used by hooks that consume `PrintJob` |

### Alternatives Considered
None — the stack is locked and the libraries are already installed.

**No new installation required for Phase 1.**

---

## Architecture Patterns

### Current Database Version Chain
```
v1 — materials, settings
v2 — + printers
v3 — + jobs (id, name, createdAt), + sales
v4 — + printerInstances; jobs gains printerInstanceId index
v5 — (Phase 1) same stores; migrate jobs.filamentId/filamentGrams → jobs.filaments[]
```

### Pattern 1: Dexie Version Migration
**What:** Call `db.version(N).stores({...}).upgrade(tx => {...})` — the stores definition must list ALL tables even if unchanged. The upgrade callback mutates rows in place via `modify()`.
**When to use:** Any schema change or data migration.
**Example:**
```typescript
// Source: Dexie docs + existing database.ts pattern
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
      }];
    } else {
      job.filaments = [];
    }
    delete job.filamentId;
    delete job.filamentGrams;
  });
});
```

### Pattern 2: TypeScript Type Edit in types.ts
**What:** Remove `filamentId: string` and `filamentGrams: number` from `PrintJob`; add `filaments: FilamentUsage[]`. Export `FilamentUsage` for consumer imports.
**When to use:** Before the migration — types drive the shape, migration implements it.
**Example:**
```typescript
// src/types.ts — new interface (add before PrintJob)
export interface FilamentUsage {
  filamentId: string;
  grams: number;
  pricePerGram?: number;
  currency?: Currency;
}

// Updated PrintJob (remove filamentId and filamentGrams, add filaments)
export interface PrintJob {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  filaments: FilamentUsage[];       // REPLACES filamentId + filamentGrams
  printTimeHours: number;
  printerInstanceId: string;
  modelCost: number;
  modelCostPerUnit?: boolean;
  authorMinPrice?: number;
  prepTimeMinutes: number;
  postProcessingMinutes: number;
  materialsUsed: MaterialUsage[];
  failureRate: number;
  costPerUnit: number;
  sellingPrice: number;
  copiesSold: number;
  notes?: string;
}
```

### Pattern 3: Compilation Stub Strategy (Claude's Discretion)
**What:** To prevent `tsc -b` failure while consumers still reference the old fields, two approaches are available:
1. **Stub approach:** Temporarily add `/** @deprecated */ filamentId?: string; filamentGrams?: number;` as optional fields to `PrintJob` — this makes the type a superset. Remove them in Phase 3. Risk: misleading type during dev.
2. **Accept errors approach:** Remove fields, let TypeScript fail. The planner and executor work from explicit error output. Phase 3 fixes each error. Risk: `npm run build` breaks until Phase 3.
3. **Recommended:** Accept type errors during Phase 1, but add `// @ts-expect-error DATA-FOUNDATION-PHASE1` comments on each broken consumer line as a tracking mechanism. This keeps the intent clear without hiding the incomplete work.

**Recommendation for planner:** Document the compilation-error approach explicitly in tasks. The build script is `tsc -b && vite build`, so the web build will fail after Phase 1 until Phase 3. This is acceptable if the team understands it. Alternatively, use optional deprecated fields and clean them up in Phase 3.

### Anti-Patterns to Avoid
- **Dual-path maintenance:** Do NOT keep both `filamentId` and `filaments` on `PrintJob` as permanent fields — this was explicitly rejected in the decisions. The deprecated-optional stub is only acceptable as a temporary Phase 1→3 bridge.
- **Mutating the modify callback return value without returning:** The `modify` callback in Dexie must mutate `job` directly (not return a new object). The `delete` keyword on properties inside the callback is the correct Dexie pattern for removing fields.
- **Forgetting `return` on the upgrade function:** `upgrade(tx => { return tx.table(...).modify(...) })` — the `return` is required; without it Dexie may not wait for the migration to complete before opening the database.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| IndexedDB schema versioning | Custom migration logic | `db.version(5).upgrade()` | Dexie handles transaction safety, version gating, and rollback semantics |
| Mutating all existing rows | Manual `toArray()` + loop + `put()` | `toCollection().modify()` | `modify()` runs inside the upgrade transaction atomically; manual loops can partially fail |

**Key insight:** Dexie's `modify()` inside an upgrade transaction is the only safe way to transform all rows — it runs as a single atomic IDB transaction.

---

## Common Pitfalls

### Pitfall 1: Missing `return` in upgrade callback
**What goes wrong:** The database opens before migration completes; rows are in mixed state (some migrated, some not).
**Why it happens:** JavaScript Promises swallowed when not returned.
**How to avoid:** Always `return tx.table(...).toCollection().modify(...)` in the upgrade function.
**Warning signs:** App loads but some jobs have `filaments` and some still have `filamentId`.

### Pitfall 2: TypeScript strict mode breaks build immediately
**What goes wrong:** After removing `filamentId`/`filamentGrams` from `PrintJob`, `tsc -b` fails on `CostCalculator.tsx` (references `filamentId`, `filamentGrams`, `editedFilamentPrice`, `editedFilamentCurrency`), `JobsManager.tsx`, and `App.tsx`.
**Why it happens:** `strict: true` + `noUnusedLocals` + `noUnusedParameters` are all enabled.
**How to avoid:** Plan a task that addresses the compilation strategy before or alongside the type change. If accepting errors, document them explicitly in the plan.
**Warning signs:** Running `tsc -b` after Phase 1 exits non-zero.

### Pitfall 3: Dexie `EntityTable` type mismatch after type change
**What goes wrong:** `database.ts` imports `PrintJob` for the `EntityTable<PrintJob, 'id'>` generic. After changing `PrintJob`, the existing hooks in `useDatabase.ts` that read/write jobs will reflect the new type automatically — but TypeScript may flag usages of the old fields elsewhere at compile time.
**Why it happens:** TypeScript propagates the type change through all importers immediately.
**How to avoid:** Treat this as expected. The compile errors are the correct signal of what needs updating in Phase 3.

### Pitfall 4: Dexie `modify` mutates the proxy object, not a copy
**What goes wrong:** Developer creates a new object and tries to assign it to `job` — `job = { ...job, filaments: [...] }` — this does NOT work. Dexie's modify callback passes a proxy; you must mutate properties directly.
**Why it happens:** Common pattern in React state management doesn't apply to Dexie modify.
**How to avoid:** Set properties directly: `job.filaments = [...]; delete job.filamentId;`

### Pitfall 5: `filamentGrams || 0` edge case with NaN
**What goes wrong:** If `filamentGrams` was stored as a non-numeric string (unlikely but defensive), `|| 0` still produces 0 which is correct. However, if stored as `null`, `null || 0` also produces 0.
**Why it happens:** Legacy data may have inconsistent types in IndexedDB.
**How to avoid:** The `|| 0` fallback in the spec handles all falsy cases correctly. No additional guard needed.

---

## Code Examples

Verified patterns from Dexie 4.x:

### Correct modify with property deletion
```typescript
// Source: Dexie 4.x docs — modify() callback signature
// db.version(N).upgrade(tx => tx.table('name').toCollection().modify(obj => { ... }))
// The callback receives the stored object directly (not a copy).
// Mutate properties in place; use `delete` to remove them.
tx.table('jobs').toCollection().modify(job => {
  job.filaments = [];
  delete job.filamentId;    // removes the field from the stored record
  delete job.filamentGrams; // removes the field from the stored record
});
```

### FilamentUsage type with Currency import
```typescript
// src/types.ts — Currency is already defined in the same file
export interface FilamentUsage {
  filamentId: string;       // References Asset with category === 'filament'
  grams: number;
  pricePerGram?: number;    // User-editable override; undefined = fall back to asset costPerUnit
  currency?: Currency;      // Currency for the price override
}
```

### Verifying migration did not run already (safe re-run)
```typescript
// Dexie version upgrades are idempotent by version number —
// once v5 is applied, the upgrade function never runs again.
// No explicit "already migrated" check is needed.
```

---

## Affected Files (Phase 1 Scope)

| File | Change | Compilation Impact |
|------|--------|--------------------|
| `src/types.ts` | Add `FilamentUsage`; update `PrintJob` (remove 2 fields, add 1) | Immediate type errors in consumers |
| `src/db/database.ts` | Add `db.version(5).stores({...}).upgrade(...)` | No immediate error (upgrade is untyped callback) |
| `src/components/CostCalculator.tsx` | NOT changed in Phase 1 | Will have type errors after types.ts change |
| `src/components/JobsManager.tsx` | NOT changed in Phase 1 | Will have type errors after types.ts change |
| `src/App.tsx` | NOT changed in Phase 1 | May have type errors if it references old fields |

### Compilation error surface (what will break after Phase 1 types change)

`CostCalculator.tsx` uses:
- `filamentId` state variable (line 55)
- `filamentGrams` state variable (line 54)
- `editedFilamentPrice` state variable (line 56)
- `editedFilamentCurrency` state variable (line 57)
- These are passed through `onSaveJob` → `PrintJob` which no longer has these fields

`JobsManager.tsx` uses:
- `job.filamentId` and/or `job.filamentGrams` for display (likely in rows, not yet confirmed beyond line 60)
- Receives `PrintJob[]` as prop

The planner should create a task that explicitly accounts for this breakage.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None installed |
| Config file | None — Wave 0 gap |
| Quick run command | `tsc -b` (TypeScript compilation only) |
| Full suite command | `tsc -b && npm run lint` |

**No automated test framework is installed.** The project uses manual testing per the design spec. `tsc -b` is the primary automated gate.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DATA-01 | PrintJob has `filaments: FilamentUsage[]`, no `filamentId`/`filamentGrams` | TypeScript compile check | `tsc -b` | N/A — type change |
| DATA-02 | FilamentUsage has 4 fields (2 required, 2 optional) | TypeScript compile check | `tsc -b` | N/A — type change |
| DATA-03 | v4→v5 migration runs on existing DB | Manual | Open app with existing data, inspect IndexedDB in DevTools | N/A |
| DATA-04 | Edge cases: empty filamentId, missing grams | Manual | Create jobs with edge case data, run migration, inspect result | N/A |

### Sampling Rate
- **Per task commit:** `tsc -b` — catches type errors immediately
- **Per wave merge:** `tsc -b && npm run lint`
- **Phase gate:** `tsc -b` green (or explicitly documented suppressions) before `/gsd:verify-work`

### Wave 0 Gaps
No test framework needs installing for Phase 1 — manual testing per the design spec is the stated approach. The only automated gate is TypeScript compilation.

- [ ] No unit test coverage for migration logic — consider testing the `modify` callback as a pure function if validation requirements increase

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single `filamentId` + `filamentGrams` on PrintJob | `filaments: FilamentUsage[]` array | Phase 1 (this work) | Enables multi-material jobs |
| Dexie v4 (printerInstances added) | Dexie v5 (filaments migration) | Phase 1 | All existing jobs get migrated transparently |

**Not deprecated in this phase:**
- `MaterialUsage` — unchanged, handles post-processing consumables
- `Material` type alias — maintained for backwards compatibility
- `CostBreakdown.filament` as `number` — stays a single total

---

## Open Questions

1. **Compilation strategy: stubs vs. accepted errors**
   - What we know: Removing `filamentId`/`filamentGrams` from `PrintJob` immediately breaks `CostCalculator.tsx`, `JobsManager.tsx`, and potentially `App.tsx`
   - What's unclear: Whether the team (or CI) can tolerate a non-compiling state between Phase 1 and Phase 3
   - Recommendation: Planner should decide and document this explicitly as a task. The `@ts-expect-error` comment approach is the most honest. The deprecated-optional-fields approach keeps the build green but adds noise.

2. **App.tsx surface area**
   - What we know: `CostCalculator.tsx` and `JobsManager.tsx` are confirmed consumers of the old fields; `App.tsx` passes `PrintJob` through props/callbacks
   - What's unclear: Whether `App.tsx` itself references `filamentId`/`filamentGrams` directly, or only passes `PrintJob` as an opaque object
   - Recommendation: The planner should include reading `App.tsx` in the Phase 1 task to confirm blast radius before committing the type change.

---

## Sources

### Primary (HIGH confidence)
- Dexie 4.2.1 installed source + type definitions (`node_modules/dexie/dist/dexie.d.ts`) — verified `modify()`, `upgrade()`, and `EntityTable` signatures
- `src/types.ts` (read directly) — confirmed current `PrintJob` shape with `filamentId: string`, `filamentGrams: number`
- `src/db/database.ts` (read directly) — confirmed v4 schema, no v5 yet
- `src/hooks/useDatabase.ts` (read directly) — confirmed `useJobs()` uses `EntityTable<PrintJob, 'id'>`
- `src/components/CostCalculator.tsx` (read directly) — confirmed `filamentId`, `filamentGrams`, `editedFilamentPrice`, `editedFilamentCurrency` as state variables
- `tsconfig.app.json` (read directly) — confirmed `strict: true`, `noUnusedLocals`, `noUnusedParameters` all enabled
- `package.json` (read directly) — confirmed `tsc -b && vite build` as the build command; no test framework installed

### Secondary (MEDIUM confidence)
- `.planning/phases/01-data-foundation/01-CONTEXT.md` — design decisions locked by user
- `docs/superpowers/specs/2026-04-14-multi-material-support-design.md` — full design spec with verified migration code

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries are already installed and in active use; no new dependencies
- Architecture: HIGH — migration pattern is identical to existing v1–v4 in database.ts; spec code is directly usable
- Pitfalls: HIGH — TypeScript compilation breakage is confirmed by reading the actual consumer files

**Research date:** 2026-04-14
**Valid until:** 2026-05-14 (stable stack — Dexie 4.x, TypeScript 5.x)
