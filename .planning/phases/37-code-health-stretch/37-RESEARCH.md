# Phase 37: Code Health (STRETCH) - Research

**Researched:** 2026-06-26
**Domain:** React immutability patterns, TypeScript type narrowing, IndexedDB async batching
**Confidence:** HIGH

---

## Summary

Phase 37 is a pure code-health pass — no user-facing changes, no new behaviour. It closes two
audit items (HYG-11 and HYG-12) and must be provably behaviour-preserving for each change. The
STRETCH label means it is droppable without affecting milestone success if v1.9 runs long.

**The most important finding:** The audit's "3 index-mutation lines" is technically accurate as a
count of `updated[index] = ...` writes in non-test source, but they are only partially "wrong" in
the classical sense. All three lines (CostCalculator.tsx:842, :1304, :1320) already copy the array
before writing into the copy, so they never mutate React state in-place. The violation is that they
use the snapshot form of `setState(updated)` instead of the functional-updater form
`setState(prev => prev.map(...))` — which is the idiomatic pattern already established by
`updateFilamentRow` at line 194. The stale-closure risk is low in practice (these are synchronous
event-handlers where React 18 batches the prior render), but the audit flags the inconsistency
accurately.

HYG-12 involves three distinct micro-tasks across two files: extracting `updatePackagingMaterial`
as a named `map`-based handler (mirroring `updateFilamentRow`), batching independent IndexedDB
reads in `useAssets` init, and tightening `as UserProfile` / `as Currency` unsafe casts to
validated narrowing.

**Primary recommendation:** Implement HYG-11 by converting all three handlers to functional-updater
`setState(prev => prev.map(...))` form. Implement HYG-12.1 by extracting a named
`updatePackagingMaterial` using the same `.map` pattern. HYG-12.2 batches 4 independent IDB reads
into two `Promise.all` pairs. HYG-12.3 replaces two runtime-safe casts and leaves two build-time-
safe casts documented-and-unchanged.

---

## User Constraints (from CONTEXT.md)

No CONTEXT.md exists for this phase. Constraints are inherited from the project CLAUDE.md and
REQUIREMENTS.md:

- **Behaviour-preserving only.** No user-visible changes. No new features.
- **TypeScript:** use `tsc -b` (not `tsc --noEmit`) per CLAUDE.md — Vercel runs `tsc -b && vite
  build`; only `tsc -b` catches `noUnusedLocals` / `noUnusedParameters`.
- **Immutability:** ALWAYS create new objects, NEVER mutate existing ones (common/coding-style.md).
- **Test gate:** vitest green, full suite (`npm test`) before `/gsd:verify-work`.
- **STRETCH / droppable:** cut this phase first if v1.9 runs long.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| HYG-11: array update style | React component | — | State update patterns live with the component that owns the state |
| HYG-12.1: named update helper | React component | — | Extract inline JSX handler to named function, same file |
| HYG-12.2: IDB read batching | useAssets hook | — | IndexedDB access is the hook's sole responsibility |
| HYG-12.3: type cast narrowing | Touched file (component / hook / util) | — | Narrowing belongs at the parse boundary, not at the use site |

---

## HYG-11 — The Exact 3 Violations

### Verdict: the "exactly 3" audit claim is CORRECT

A comprehensive scan of all `[index] =` and related mutation patterns in `src/` (excluding test
files and DOM ref arrays) found exactly 3 `updated[index] = ...` writes in production source, all
in `CostCalculator.tsx`. No other files contain equivalent patterns. [VERIFIED: direct code grep]

### Candidate scan methodology

Patterns investigated and cleared:

| File | Pattern | Verdict |
|------|---------|---------|
| `src/utils/csvHelpers.ts:338-342` | `row[col] = ...` inside `generateExportCsv` | OK — `row` is a freshly-created local `Record<string, string>` accumulator, never React state |
| `src/utils/backupRestore.ts:83,140,141` | `copy[field] = ...`, `stores[store] = ...`, `counts[store] = ...` | OK — all write into freshly-created local accumulators (copy, stores, counts) |
| `src/utils/backupExport.ts:22` | `data[store] = ...` | OK — `data` is a freshly-created local `{} as BackupData` |
| `src/utils/fxRates.ts:97` | `rates[code] = rate` | OK — `rates` is a freshly-created `Partial<Record<Currency, number>>` accumulator |
| `src/utils/maintenanceDismissed.ts:38` | `map[instanceId] = [...existing, hours]` | OK — `map` comes from `getMaintenanceDismissedMap()` (deserialized from localStorage, not React state); immediately re-serialized; already uses spread for the nested array |
| `src/components/NewBadge.tsx:21` | `map[feature] = Date.now()` | OK — `map` is from `getFirstSeenMap()` (deserialized from localStorage, not React state); immediately re-serialized |
| `src/components/CostCalculator.tsx:842` | `updated[index] = { ...updated[index], [field]: value }` | **VIOLATION** — see below |
| `src/components/CostCalculator.tsx:1304` | `updated[index] = { ...updated[index], materialId: e.target.value }` | **VIOLATION** — see below |
| `src/components/CostCalculator.tsx:1320` | `updated[index] = { ...updated[index], quantity: parseFloat(e.target.value) \|\| 0 }` | **VIOLATION** — see below |
| `src/hooks/useDatabase.ts:1139` | `list.push(q)` | OK — `list` is retrieved from a new `Map`, the mutation is of a local array entry, not React state; map is returned from `useMemo`, not mutated in-place |

### Violation 1 — CostCalculator.tsx line 842

**Current code (lines 840–844):**
```typescript
const updateMaterialUsage = (index: number, field: keyof MaterialUsage, value: string | number) => {
  const updated = [...materialsUsed];
  updated[index] = { ...updated[index], [field]: value };   // line 842
  setMaterialsUsed(updated);
};
```

**Why it is a violation:**
- Uses snapshot form `setState(updated)` — `materialsUsed` is captured at render time. If two
  updates fire in the same batch (unlikely here but possible in test harnesses), the second
  `updated` is built from the stale snapshot rather than the post-first-update value.
- The pattern is inconsistent with `updateFilamentRow` (line 194) which uses the functional-updater
  form `setState(prev => prev.map(...))`.

**Immutable rewrite (functional-updater + `map`):**
```typescript
const updateMaterialUsage = (index: number, field: keyof MaterialUsage, value: string | number) => {
  setMaterialsUsed(prev =>
    prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
  );
};
```

**Behaviour preserved:** identical — produces a new array with one element replaced, same object
shape. The functional-updater guarantees it operates on the latest state (not the snapshot).

---

### Violation 2 — CostCalculator.tsx line 1304 (inline `onChange` handler)

**Current code (lines 1302–1306, inside `packagingMaterials.map`):**
```typescript
onChange={e => {
  const updated = [...packagingMaterials];
  updated[index] = { ...updated[index], materialId: e.target.value };   // line 1304
  setPackagingMaterials(updated);
}}
```

**Why it is a violation:** Same snapshot issue as Violation 1, plus the handler is inlined in JSX
without a name, making it impossible to unit-test in isolation. Inconsistent with `updateFilamentRow`.

**Immutable rewrite (named helper extracted; mirrors `updateFilamentRow` / HYG-12.1):**

This violation and HYG-12.1 (`updatePackagingMaterial`) are the same change. Extracting a named
helper eliminates both the snapshot issue and the inline handler:

```typescript
// Declare near updateMaterialUsage (approx line 844):
const updatePackagingMaterial = (index: number, field: keyof MaterialUsage, value: string | number) => {
  setPackagingMaterials(prev =>
    prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
  );
};
```

Then replace inline handler:
```typescript
onChange={e => updatePackagingMaterial(index, 'materialId', e.target.value)}
```

---

### Violation 3 — CostCalculator.tsx line 1320 (inline `onChange` handler)

**Current code (lines 1318–1322):**
```typescript
onChange={e => {
  const updated = [...packagingMaterials];
  updated[index] = { ...updated[index], quantity: parseFloat(e.target.value) || 0 };   // line 1320
  setPackagingMaterials(updated);
}}
```

**Why it is a violation:** Same snapshot issue. Also the companion to Violation 2 — both
`onChange` handlers update the same `packagingMaterials` state with the same pattern.

**Immutable rewrite:** Collapsed into the `updatePackagingMaterial` helper from Violation 2:
```typescript
onChange={e => updatePackagingMaterial(index, 'quantity', parseFloat(e.target.value) || 0)}
```

---

### Summary Table

| # | File | Line | Root Cause | Immutable Rewrite |
|---|------|------|------------|-------------------|
| V1 | `CostCalculator.tsx` | 842 | Snapshot `setState`; `updated[index] =` write | `setMaterialsUsed(prev => prev.map(...))` |
| V2 | `CostCalculator.tsx` | 1304 | Inline snapshot `setState`; no named helper | Extract `updatePackagingMaterial`; call it |
| V3 | `CostCalculator.tsx` | 1320 | Inline snapshot `setState`; no named helper | Same `updatePackagingMaterial` helper |

V2 and V3 collapse into a single new function (`updatePackagingMaterial`) which also satisfies
HYG-12.1. This means HYG-11 and HYG-12.1 share a single implementation task.

---

## HYG-12 — Consistency Cleanups

### HYG-12.1 — `updatePackagingMaterial` via `map`

**Finding:** The function does not exist yet. It is the inline handlers at lines 1302–1306 and
1318–1322 that the audit wants extracted as a named helper. [VERIFIED: direct code search]

**Current pattern (inline in JSX):**
```typescript
onChange={e => {
  const updated = [...packagingMaterials];
  updated[index] = { ...updated[index], materialId: e.target.value };
  setPackagingMaterials(updated);
}}
```

**Sibling helper for comparison (line 194 — `updateFilamentRow`):**
```typescript
const updateFilamentRow = (index: number, patch: Partial<FilamentRow>) => {
  setFilamentRows(prev => prev.map((row, i) => i === index ? { ...row, ...patch } : row));
};
```

**Target rewrite:**
```typescript
const updatePackagingMaterial = (
  index: number,
  field: keyof MaterialUsage,
  value: string | number,
) => {
  setPackagingMaterials(prev =>
    prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
  );
};
```

The signature is analogous to the existing `updateMaterialUsage` (line 840). The JSX call sites
become one-liners:
```typescript
onChange={e => updatePackagingMaterial(index, 'materialId', e.target.value)}
onChange={e => updatePackagingMaterial(index, 'quantity', parseFloat(e.target.value) || 0)}
```

**Risk:** Zero — pure refactor of JSX inline lambda into a named function with identical semantics.

---

### HYG-12.2 — `useAssets` init reads batched with `Promise.all`

**Current sequential structure (inside `useAssets` `init()` function):**

```
count = await db.materials.count()           ← must be sequential (gates the else branch)
  if count === 0 → bulkPut + return
  else:
    printerCount = await db.materials...count()   ← read A (line 84)
    packagingCount = await db.materials...count() ← read B (line 92) — INDEPENDENT of A
    hasBambuCatalog = await db.materials.get()    ← read C (line 102) — INDEPENDENT of A, B
    if (!printerCatalogReconcileRan):
      ender3v3 = await db.materials.get()         ← read D (line 120) — INDEPENDENT of C
    if (!bambuPlaPureReconcileRan):
      hasPlaPure = await db.materials.get()       ← read E (line 138) — INDEPENDENT of C, D
```

Reads A+B are independent. Reads C+D+E are independent of each other (but C's conditional writes
are independent; D and E are already inside runtime guards).

**Batching analysis:**

Batch 1 — `printerCount` and `packagingCount` (lines 84, 92):
```typescript
const [printerCount, packagingCount] = await Promise.all([
  db.materials.where('category').equals('printer').count(),
  db.materials.where('category').equals('packaging').count(),
]);
if (cancelled) return;
```

The two `if (cancelled)` guards between A and B (lines 85, 93) are collapsed into one post-batch
check — equivalent because Dexie IDB calls are non-cancellable in-flight anyway.

Batch 2 — `hasBambuCatalog`, `ender3v3`, `hasPlaPure` (lines 102, 120, 138):

These three are currently interleaved with conditional `bulkPut` calls and `if (!flagRan)` guards.
Simple `Promise.all` across all three is possible IF the subsequent conditional writes are
independent (which they are — each guards a different catalog):

```typescript
const [hasBambuCatalog, ender3v3, hasPlaPure] = await Promise.all([
  db.materials.get('bambu-pla-sparkle'),
  !printerCatalogReconcileRan
    ? db.materials.get('creality-ender3-v3')
    : Promise.resolve(null),
  !bambuPlaPureReconcileRan
    ? db.materials.get('bambu-pla-pure')
    : Promise.resolve(null),
]);
if (cancelled) return;
// Then handle conditional writes sequentially (they already were)
```

**Risk: MEDIUM.** The batching changes the order of `cancelled` checks — from "check after each
read" to "check once after the batch". In the current code the `cancelled` guard fires immediately
after each await. With `Promise.all` all three reads run to completion even if `cancelled` becomes
true mid-flight. This is acceptable because:
1. Dexie IDB reads have no side effects (they are reads).
2. The reads themselves complete fast (<1ms on local IDB).
3. The `cancelled` check still fires before any writes.

The concern to document: DO NOT batch writes — only the reads. The `bulkPut` calls after the reads
must remain sequential and individually cancelled-checked.

**Error semantics:** `Promise.all` rejects on first error (same as sequential `try/catch` in
practice, since all reads hit the same IndexedDB transaction). No change in observable error
handling.

**Performance gain:** Minor (saves 2–3 IDB round-trips on startup, typically <10ms). The audit
flags this for consistency (pattern) more than for performance.

---

### HYG-12.3 — `as UserProfile` / `as Currency` casts → validated narrowing

**All casts found in non-test production source:**

| # | File | Line | Cast | Risk Assessment |
|---|------|------|------|----------------|
| C1 | `src/db/database.ts` | 133 | `(JSON.parse(settingsRow.value) as UserProfile).currency` | **Unsafe** — `.currency` may be undefined if the settings row has an older shape. The v9 migration comment at line 175 explicitly documents this as a known bug pattern. |
| C2 | `src/db/database.ts` | 179 | `JSON.parse(settingsRow.value) as Partial<UserProfile>` | **Safe** — already uses `Partial<>` + validates `typeof parsed.currency !== 'string'` before use. This IS the v9 validated-narrowing pattern. Leave unchanged. |
| C3 | `src/hooks/useDatabase.ts` | 1211 | `(JSON.parse(settingsRow.value) as UserProfile).nextQuoteNumber ?? 1` | **Low-risk** — wrapped in try/catch; `.nextQuoteNumber` is typed optional (`?? 1` fallback); but the outer cast is still unvalidated. Tighten. |
| C4 | `src/utils/csvHelpers.ts` | 214 | `row.currency.trim().toUpperCase() as Currency` | **Safe** — immediately checked with `VALID_CURRENCIES.includes(curr)`. The cast to `Currency` is needed to satisfy `VALID_CURRENCIES.includes()` typing but the `.includes()` guard does the actual validation. Already pattern-correct; annotate, leave unchanged. |
| C5 | `src/components/UserProfileModal.tsx` | 42 | `e.target.value as Currency` | **Safe** — the `<Select>` is populated exclusively from `Object.entries(CURRENCY_CONFIG)`, so `e.target.value` can only be a valid Currency key. The cast is build-time-guaranteed safe; annotate, leave unchanged. |
| C6 | `src/utils/fxRates.ts` | 8 | `Object.keys(CURRENCY_CONFIG) as Currency[]` | **Safe** — `CURRENCY_CONFIG` is typed `Record<Currency, ...>` so `Object.keys()` produces exactly the Currency members. Standard TS limitation (`Object.keys` returns `string[]`). Annotate, leave unchanged. |
| C7 | `src/db/backfill.ts` | 245 | `currency as Currency` | **Low-risk in context** — `currency: string` parameter comes from the v8 migration caller which read it from the settings row with a `try/catch` and defaulted to `'USD'`; the v9 reconcile validated it before calling this function. However, the function signature itself accepts `string` so the cast is only caller-trust validated, not intrinsic. |
| C8 | `src/db/backfill.ts` | 290 | `currency as Currency` (in `reconcileQuoteCurrency`) | **Same as C7** — caller (v9 migration in `database.ts`) validated the string before calling. |
| C9 | `src/db/backfill.ts` | 325 | `currency: currency as Currency` (in `reconcileAssetCurrency`) | **Same as C7** — caller (`useAssets` effect) validated the string before calling. |

**The "v9 migration" validated-narrowing pattern** (from `database.ts:179-181`):
```typescript
const parsed = JSON.parse(settingsRow.value) as Partial<UserProfile>;
if (typeof parsed.currency !== 'string' || parsed.currency.length === 0) return;
userCurrency = parsed.currency; // now narrows to string, and caller trusts it is a valid currency
```

**Recommended changes:**

**C1 — database.ts line 133 (v8 migration, TIGHTEN):**
```typescript
// BEFORE:
currency = (JSON.parse(settingsRow.value) as UserProfile).currency;

// AFTER (matches v9 pattern):
const parsedV8 = JSON.parse(settingsRow.value) as Partial<UserProfile>;
if (typeof parsedV8.currency === 'string' && parsedV8.currency.length > 0) {
  currency = parsedV8.currency;
}
// else fall through to 'USD' default (already set above)
```

**C3 — useDatabase.ts line 1211 (createQuote, TIGHTEN):**
```typescript
// BEFORE:
nextNum = (JSON.parse(settingsRow.value) as UserProfile).nextQuoteNumber ?? 1;

// AFTER:
const parsedProfile = JSON.parse(settingsRow.value) as Partial<UserProfile>;
nextNum = typeof parsedProfile.nextQuoteNumber === 'number'
  ? parsedProfile.nextQuoteNumber
  : 1;
```

**C4, C5, C6 — LEAVE UNCHANGED** (build-time or validation-guarded). Add a one-line comment:
`// as Currency: build-time safe — Select values come from Object.entries(CURRENCY_CONFIG)`

**C7, C8, C9 (backfill.ts) — DOCUMENT, not change.** The callers validate; the function contract
trusts the caller. Changing the function signature from `string` to `Currency` would be the clean
fix but is a larger API change affecting test fixtures. For Phase 37 scope: add a JSDoc note on the
function parameter explaining the caller responsibility. The existing tests for backfill.ts already
pass valid currency strings.

**Risk: LOW.** C1 change is in the v8 migration (runs once on first DB open to version 8; for
existing users this ran months ago). C3 is in a transaction that already has a try/catch. Both
changes make the code strictly more defensive.

---

## Standard Stack

No new packages. All work is pure refactoring within the existing codebase.

| Tool | Version | Purpose |
|------|---------|---------|
| vitest | existing | Test runner for behaviour-equivalence verification |
| TypeScript `tsc -b` | existing | Type-safety verification (MUST use `tsc -b`, not `--noEmit`) |

---

## Package Legitimacy Audit

Not applicable — no new packages installed in this phase.

---

## Architecture Patterns

### The `updateFilamentRow` reference pattern (line 194)

This is the canonical immutable array-element update in this codebase:

```typescript
// Source: src/components/CostCalculator.tsx:193-195
const updateFilamentRow = (index: number, patch: Partial<FilamentRow>) => {
  setFilamentRows(prev => prev.map((row, i) => i === index ? { ...row, ...patch } : row));
};
```

Every `setXxx(prev => prev.map(...))` pattern in this phase must produce identical shape output
to the `updated[index] = ...` pattern it replaces.

### Anti-Pattern: snapshot `setState` with index write

```typescript
// ANTI-PATTERN — do not copy this:
const updated = [...materialsUsed];
updated[index] = { ...updated[index], [field]: value };
setMaterialsUsed(updated);
```

The `setState` receives a snapshot of the prior render's state. Under concurrent React or test
harness batching this can cause a stale update. The functional updater form is always safe.

### Anti-Pattern: inline JSX mutation handlers

Inline event handlers that mutate copies (as at lines 1302–1322) cannot be unit-tested in
isolation and create multiple snapshot-state closures over the same state atom.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Type guard for Currency | Custom `isCurrency` predicate | `VALID_CURRENCIES.includes()` (already exists in csvHelpers.ts) |
| Type guard for UserProfile fields | Zod schema | `typeof parsed.field === 'type'` narrowing (v9 pattern already established) |

---

## Common Pitfalls

### Pitfall 1: Conflating "no in-place mutation" with "safe"

**What goes wrong:** Seeing `const updated = [...arr]; updated[i] = ...` and concluding there is
no problem because `arr` itself is not mutated.

**Why it happens:** The array copy is correct but the `setState(updated)` is snapshot-based — it
captures the state at the render when the handler was created. The copy is fine; the capture is the
problem.

**How to avoid:** Always use `setState(prev => ...)` when updating state from within an event
handler that reads the current state.

**Warning signs:** `const updated = [...someState]` followed by `updated[i] = ...` and
`setSomeState(updated)` in a non-functional form.

---

### Pitfall 2: Batching reads that have dependent writes below them

**What goes wrong:** Moving reads into `Promise.all` that have intermediate `if (cancelled)` guards
between them, and forgetting to consolidate the cancel check.

**Why it happens:** The original sequential code interleaves reads and cancel checks. Batching the
reads collapses the cancel check windows.

**How to avoid:** Move `if (cancelled) return` to AFTER the `Promise.all`, before the first
conditional write. Reads are non-destructive; a stale read result that is then discarded by a
cancel check is harmless.

**Warning signs:** Writing `Promise.all(...)` and forgetting to remove the individual cancel checks
between reads (they are now unreachable code).

---

### Pitfall 3: Tightening casts in migration code that already ran

**What goes wrong:** Changing v8 migration code (database.ts lines 128–144) and worrying about
breaking existing users.

**Why it happens:** The v8 migration ran on every user's first DB open after the v8 upgrade — for
all current users that was months ago. The migration path no longer executes for them.

**How to avoid:** The cast tightening at C1 only makes the existing fallback logic explicit — it
does not change what happens, only prevents a potential `undefined` from flowing into `currency`
if a corrupt row exists. Safe to ship.

---

### Pitfall 4: Using `tsc --noEmit` instead of `tsc -b`

**What goes wrong:** Build passes locally but fails on Vercel because `tsc -b` enforces
`noUnusedLocals` / `noUnusedParameters`.

**How to avoid:** Always run `tsc -b` per CLAUDE.md. After extracting `updatePackagingMaterial`,
verify both the old inline references are removed (otherwise the `index` variable from the `.map`
closure will be flagged as unused if not referenced).

---

## Runtime State Inventory

Not applicable — Phase 37 is a pure code refactor with no data model changes, no renamed strings,
no migrations.

---

## Environment Availability

| Dependency | Required By | Available | Fallback |
|------------|------------|-----------|---------|
| vitest | Test verification | ✓ (existing) | — |
| TypeScript tsc | Type check | ✓ (existing) | — |

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest (jsdom environment) |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test -- --run` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behaviour | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| HYG-11 | `updateMaterialUsage` uses functional updater | source-scan (static) | `npm test -- CostCalculator` | ✅ |
| HYG-11 | `packagingMaterials` handlers use functional updater | source-scan (static) | `npm test -- CostCalculator` | ✅ |
| HYG-12.1 | `updatePackagingMaterial` helper exists and uses `.map` | source-scan (static) | `npm test -- CostCalculator` | ✅ |
| HYG-12.2 | `useAssets` init uses `Promise.all` for independent reads | source-scan (static) | `npm test -- useDatabase` | ✅ (tests exist; may not cover init path) |
| HYG-12.3 | `as UserProfile` casts replaced with `Partial<>` + `typeof` check | source-scan (static) | `npm test` | ✅ (existing backfill + database tests) |

**Notes on test coverage:**
- `CostCalculator.test.tsx` covers PERF-11 and FIX-04 via source-scanning; HYG-11 can follow the
  same pattern (assert that the old `updated[index] =` pattern is absent and the `prev.map`
  pattern is present).
- No existing test exercises the `updateMaterialUsage` or `updatePackagingMaterial` paths via
  actual interaction (the test suite focuses on source-text assertions). Wave 0 should add a
  static-source assertion for each rewritten handler.
- `useDatabase.test.ts` tests the `createQuote` tx-scoped read (covering C3 cast); no existing
  test exercises the init migration reads specifically — `Promise.all` batching can be validated
  by source-scan assertion only.

### Sampling Rate

- **Per task commit:** `npm test -- --run`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] Source-text assertion: `updateMaterialUsage` uses `prev.map` pattern (not `updated[index] =`)
- [ ] Source-text assertion: `updatePackagingMaterial` function exists and uses `prev.map`
- [ ] Source-text assertion: inline `packagingMaterials` handlers delegate to `updatePackagingMaterial`
- [ ] Source-text assertion: `as UserProfile` at database.ts:133 is replaced with `Partial<UserProfile>`
- [ ] Source-text assertion: `as UserProfile` at useDatabase.ts:1211 is replaced with `Partial<UserProfile>`

---

## Security Domain

HYG-12.3 is directly relevant to security:

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | Yes — C1/C3 read from stored JSON | `typeof` narrowing before use, not blind cast |

**Cast tightening as security hygiene:** The v8 migration cast at `database.ts:133` passes
`parsed.currency` (which could be `undefined` for a corrupted or partially-migrated settings row)
directly into the `currency` variable. The v9 migration (database.ts:179) already fixed this for
v9 upgrade logic. C1 applies the same fix to the older v8 path.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | All 3 index-mutation violations are in CostCalculator.tsx | HYG-11 | If more exist in other files (e.g. a component added after this audit), plan will miss them. Mitigated: grep confirmed no other `[index] =` in production source. | [VERIFIED: direct grep]
| A2 | `Promise.all` batching of IDB reads does not change error semantics | HYG-12.2 | If one read throws, `Promise.all` rejects immediately (same as sequential in the existing try/catch). Semantics identical. | [ASSUMED from Dexie/IDB behaviour; LOW risk] |
| A3 | The v8 migration at database.ts:133 has already run for all existing users | HYG-12.3 C1 | If a user somehow has a v7 → v8 upgrade still pending, the tightened cast changes behaviour (now bails to 'USD' instead of propagating undefined). This is SAFER behaviour, not worse. | [ASSUMED from release history; LOW risk] |

---

## Open Questions

1. **HYG-12.2: batch scope**
   - What we know: 5 sequential reads in the `else` branch, 2 independent pairs (A+B, then C+D+E).
   - What's unclear: Whether batching D (`ender3v3`) and E (`hasPlaPure`) together is worth
     the complexity of the `!flagRan ? db.get(...) : Promise.resolve(null)` short-circuit pattern.
   - Recommendation: batch A+B unconditionally (clean and simple); batch C+D+E only if the planner
     agrees the complexity is acceptable. If not, leave C, D, E sequential and only ship the A+B
     batch (still satisfies the audit spirit).

2. **HYG-12.3: C7/C8/C9 in backfill.ts**
   - What we know: three `as Currency` casts where `currency` is a `string` parameter validated by
     callers.
   - What's unclear: whether changing the function signatures (`string → Currency`) is in scope for
     Phase 37 (it would tighten the API at the cost of touching more files + test fixtures).
   - Recommendation: leave function signatures as `string` for Phase 37; add JSDoc comments
     documenting the caller-validation contract. Full signature tightening deferred to v2.0
     refactor.

---

## Code Examples

### Functional updater pattern (target for all 3 HYG-11 fixes)
```typescript
// Source: CostCalculator.tsx:193 — updateFilamentRow (the established sibling)
const updateFilamentRow = (index: number, patch: Partial<FilamentRow>) => {
  setFilamentRows(prev => prev.map((row, i) => i === index ? { ...row, ...patch } : row));
};
```

### v9 validated-narrowing pattern (target for HYG-12.3 C1, C3)
```typescript
// Source: src/db/database.ts:178-185 (v9 migration upgrade handler)
try {
  const parsed = JSON.parse(settingsRow.value) as Partial<UserProfile>;
  if (typeof parsed.currency !== 'string' || parsed.currency.length === 0) return;
  userCurrency = parsed.currency;
} catch (err) {
  console.error('[v9 migration] skipped — settings unreadable:', err);
  return;
}
```

---

## Sources

### Primary (HIGH confidence)
- `src/components/CostCalculator.tsx` — direct inspection; all three violations confirmed at
  lines 842, 1304, 1320
- `src/hooks/useDatabase.ts` — direct inspection; sequential init reads at lines 84, 92, 102,
  120, 138; `as UserProfile` cast at 1211
- `src/db/database.ts` — direct inspection; v9 validated-narrowing pattern at 178-181;
  `as UserProfile` cast at 133
- `docs/CALCULATOR_APP_AUDIT.md` — Tier 6 "Already solid" note; item 6.5

### Secondary (MEDIUM confidence)
- `src/db/backfill.ts` — `as Currency` casts reviewed; determined to be caller-validated

---

## Metadata

**Confidence breakdown:**
- HYG-11 violation locations: HIGH — grep-verified, all 3 confirmed, no others found
- HYG-12.1 (updatePackagingMaterial): HIGH — directly follows from violations 2 and 3
- HYG-12.2 (Promise.all batching): MEDIUM — batching is correct but the `cancelled` guard
  consolidation needs care
- HYG-12.3 (cast narrowing): HIGH for C1/C3 (changes), MEDIUM for C7/C8/C9 (leave as-is
  recommendation)
- Overall: HIGH

**Research date:** 2026-06-26
**Valid until:** Stable (codebase is on feature-freeze for v1.9 hardening; these files are not
expected to change before Phase 37 executes)
