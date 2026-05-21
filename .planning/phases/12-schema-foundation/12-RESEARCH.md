# Phase 12: Schema Foundation - Research

**Researched:** 2026-05-20
**Domain:** Dexie.js IndexedDB schema migration + multi-tab versionchange handling + TypeScript optional-field additions
**Confidence:** HIGH

## Summary

Phase 12 is a tightly-scoped data layer change with no UI surface. It adds five optional fields to `PrintJob`, two optional fields to `UserProfile`, a new `JobCustomer` interface, a Dexie v5→v6 migration that backfills only `tags = []`, and the multi-tab `db.on('versionchange', () => window.location.reload())` guard. The entire CONTEXT.md is locked (D-01 through D-11) — research validates that every locked decision matches Dexie's official recommendations and identifies a small number of implementation details the planner must lock down.

The risk surface is small but real. Three implementation details deserve explicit attention in PLAN.md: (1) the `versionchange` handler MUST be registered before `db.open()` is implicitly fired, and Dexie's TypeScript types confirm this is supported; (2) the `modify()` callback MUST `return` its promise (matches the existing v5 pattern at `src/db/database.ts:56`) — without `return`, Dexie may signal "ready" before all rows are visited; (3) the `Array.isArray(job.tags)` defensive guard chosen in the CONTEXT specifics is preferable to `job.tags ??= []` because the migration only runs ONCE per database (Dexie tracks applied versions), so the guard is purely defensive against manually-edited IndexedDB records, not against re-run.

The TypeScript type changes are pure additive optional-field additions — every existing `PrintJob` / `UserProfile` literal in the 9 consumer files continues to type-check without modification (consumers don't reference the new fields yet, that's Phases 13–16).

**Primary recommendation:** Implement exactly as locked in CONTEXT.md D-01 through D-11. Mirror the v5 block at `src/db/database.ts:49–71` verbatim for the v6 block (only the `modify()` body and version number change), insert `db.on('versionchange', () => window.location.reload())` on the line immediately after the final `.upgrade(...)` close of v6 and before `export { db }`, and place `JobCustomer` immediately above `PrintJob` in `src/types.ts`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Schema versioning | Database / Storage (Dexie/IndexedDB) | — | IndexedDB native — Dexie's `db.version().stores().upgrade()` is the only safe migration primitive |
| Data backfill (`tags = []`) | Database / Storage (Dexie upgrade transaction) | — | Must run inside the v6 upgrade transaction atomically; `toCollection().modify()` is the only safe path |
| Type definitions (`PrintJob`, `UserProfile`, `JobCustomer`) | Build-time (TypeScript) | — | Pure compile-time; no runtime cost |
| Multi-tab reload coordination | Browser / Client (`db.on('versionchange', ...)` registered on the singleton) | Database / Storage (Dexie event dispatch) | Browser owns `window.location.reload()`; Dexie surfaces the underlying IndexedDB `versionchange` event |
| Default-value injection for new `UserProfile` fields | API / Database helper (`getUserProfile(defaultValue)`) | — | Already implemented at `src/db/database.ts:124–130` — no migration needed, defaults merge on read |

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Bump Dexie version from 5 to 6 in `src/db/database.ts`. The schema string for every table stays identical to v5 — no new indexes, no removed indexes. Dexie still requires the `.version(6).stores(...).upgrade(...)` block to register the version bump and run the upgrade callback.
- **D-02:** The `upgrade(tx => ...)` callback backfills only `tags = []` on existing `jobs` records. Every other new field (`customer`, `taxRate`, `taxAmount`, `quoteNumber` on PrintJob; `defaultTaxRate`, `nextQuoteNumber` on UserProfile) stays undefined on existing data. UserProfile lives in `settings` table as a JSON-stringified value — it does NOT need migration because `getUserProfile(defaultValue)` already falls back to the default if a key is missing on the parsed object.
- **D-03:** The `modify()` call returns its promise (matches the v5 Phase 01 pattern from v1.0). This ensures the upgrade transaction waits for every record to be visited before Dexie reports v6 as ready.
- **D-04:** Do NOT add `*tags` multi-entry index to the jobs schema string. At 10–500 saved jobs, in-memory `Array.filter` filtering in Phase 15 is <1ms and avoids reindex-on-migration risk. Schema string stays `'id, name, createdAt, printerInstanceId'`.
- **D-05:** Add `quoteNumber?: number` to `PrintJob` in v6. Undefined until the user generates a PDF for that job for the first time (Phase 16). PDF generation reads `userProfile.nextQuoteNumber ?? 1`, assigns it to `job.quoteNumber`, persists the job, then increments `userProfile.nextQuoteNumber`. Regenerating the PDF reuses the stored `job.quoteNumber` — no double-issue.
- **D-06:** `UserProfile.nextQuoteNumber` defaults to 1 when undefined (the first quote ever issued is `#1`, not `#0`).
- **D-07:** `quoteNumber?: number` on `PrintJob` is ADDED beyond the SCHEMA-01 field list. SCHEMA-01 only lists `tags`, `customer`, `taxRate`, `taxAmount`. Plan-phase MUST call this out explicitly in PLAN.md but treat it as in-scope for Phase 12 since the field MUST land in v6 schema before Phase 16 starts.
- **D-08:** `JobCustomer = { name?: string; email?: string; address?: string; company?: string }`. Address is a freeform string (multi-line textarea in Phase 14's UI), NOT a structured object.
- **D-09:** All four `JobCustomer` fields are optional. No runtime validation in the type.
- **D-10:** Plain `db.on('versionchange', () => window.location.reload())` exactly as SCHEMA-02 specifies. No toast, no countdown, no setTimeout wrapper.
- **D-11:** Register the `versionchange` handler immediately after `new Dexie(...)` and `.version().stores()` chain, before `db.open()` implicitly fires. The handler must be attached for the lifetime of the page (no cleanup needed — the page reload IS the cleanup).

### Claude's Discretion

- Exact comment style in `database.ts` (the v5 block has terse inline comments — match that)
- Order of new fields within the `PrintJob` interface (group with semantically related existing fields: customer near `name`, tax near `sellingPrice`, quoteNumber separate near the bottom)
- Whether to extract `JobCustomer` into its own block above `PrintJob` or place it inline near `PrintJob` — planner picks
- TypeScript declaration approach — straight optional-field additions to the existing interfaces (matches the v1.0 Phase 01 "no deprecated stubs" pattern; no V6 augment type needed)
- Whether to add a one-line `versionchange` comment in `database.ts` explaining why the reload exists — bias toward yes

### Deferred Ideas (OUT OF SCOPE)

- Multi-entry index on `tags` (`*tags` in schema string) — rejected per D-04
- Structured customer address (street/city/postal/country) — rejected per D-08
- `versionchange` UX polish (toast + countdown, or block-DB-writes pattern) — rejected per D-10
- Index on `customer.email` — no current query pattern requires it
- Type-level email validation for `JobCustomer.email` — runtime validation belongs in Phase 14's form
- Tax UI / Settings tax rate / region lookup (Phase 13)
- Customer form section / JobsManager customer column (Phase 14)
- Tag input / chip filter / search (Phase 15)
- PDF generation / quote number assignment (Phase 16)
- NEW badge — schema-only work, invisible to the user
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SCHEMA-01 | Dexie v5→v6 migration adds optional fields to `PrintJob` (`tags?`, `customer?`, `taxRate?`, `taxAmount?`) and `UserProfile` (`defaultTaxRate?`, `nextQuoteNumber?`); existing v1.0/v1.1 jobs load without error (`tags = []` backfilled) | The v5 block at `src/db/database.ts:49–71` is a verified, working template. The Dexie official upgrade pattern (`db.version(N).stores({...}).upgrade(tx => return tx.table(...).toCollection().modify(...))`) is identical. Returning the `modify()` promise is documented as required for upgrade-completion ordering. `getUserProfile(defaultValue)` at `src/db/database.ts:124–130` already merges missing keys, so UserProfile new fields don't need migration. |
| SCHEMA-02 | `db.on('versionchange', () => window.location.reload())` wired in `database.ts`; opening a second tab after a schema upgrade reloads the first tab cleanly instead of crashing | Dexie's official docs document `db.on('versionchange', fn)` and call out that without a handler, Dexie's built-in default closes the database and console.logs — which is what causes the white-screen crash. `window.location.reload()` is the documented recommendation for SPAs. Dexie's TypeScript types at `node_modules/dexie/dist/dexie.d.ts:498` confirm the event subscription signature. |
| SCHEMA-01 extension | `JobCustomer` interface in `src/types.ts`: `{ name?, email?, address?, company? }` | Pure additive TypeScript change — no runtime dependency. |
| SCHEMA-01 extension | `quoteNumber?: number` on `PrintJob` (added beyond SCHEMA-01 explicit list per D-07) | Required by Phase 16 (PDF). Storing on the job at PDF time (vs. re-incrementing on regenerate) is the locked counter-design choice. |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Dexie.js | 4.2.1 (installed) | IndexedDB wrapper with schema versioning + event subscription (`db.on`) | Already in use through v1–v5; the canonical migration path. Confirmed via `npm view dexie version` and `package.json:21` |
| TypeScript | ~5.9.3 (installed) | Type safety on `PrintJob` / `UserProfile` / new `JobCustomer` | Already in use; `strict + noUnusedLocals + noUnusedParameters + verbatimModuleSyntax` enforced via `tsc -b` (project standard per CLAUDE.md) |
| Vitest | 4.1.4 (installed) | Unit test framework — used for automated portions of validation | Already in use; runs as part of `npm run build` (`vitest run --coverage && tsc -b && vite build`) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| dexie-react-hooks | 4.2.0 (installed) | `useLiveQuery` for reactive DB reads | Not directly involved in Phase 12 but transparently picks up the new fields |
| jsdom | 29.0.2 (installed) | DOM for Vitest | Available if a v6-migration unit test is written (NOTE: jsdom has incomplete IndexedDB support — see Pitfall 3) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Plain `db.on('versionchange', () => window.location.reload())` | Conditional `confirm()` reload (Dexie's official example) | Dexie's example uses `confirm()` to let the user defer — but this is hostile UX for a small calculator app and contradicts D-10. Rejected. |
| `db.on('versionchange', () => { db.close(); db.open(); })` (in-place reconnect) | Avoids page reload | Doesn't propagate the new schema types to already-rendered React components — would leave the UI in a broken state. Page reload is correct for a Vite/React SPA. |
| `Array.isArray(job.tags)` guard | `job.tags ??= []` (nullish-coalesce assign) | The Array.isArray form also defends against `tags = "not-an-array"` from manually-edited IndexedDB. `??=` only handles `null`/`undefined`. CONTEXT specifics already chose `Array.isArray` (line 113); keep it. |
| Add `quoteNumber` to schema string as an index | Index `quoteNumber` for fast lookup | No query pattern requires it (quoteNumber is read off the job record directly, never queried). Keep schema string identical to v5. |

**No new dependencies required.** Phase 12 uses only installed libraries.

**Installation:**
```bash
# No installs needed.
```

**Version verification (run at research time):**
```bash
# Confirmed from package.json (read at research time):
#   "dexie": "^4.2.1"
#   "dexie-react-hooks": "^4.2.0"
#   "typescript": "~5.9.3"
#   "vitest": "^4.1.4"
# Both dexie@4.2.1 and dexie-react-hooks@4.2.0 are stable major-4 releases.
```

## Package Legitimacy Audit

> Phase 12 installs ZERO new packages. The audit table below is included for completeness — every package referenced is already a transitive or direct dependency from the v1.0/v1.1 work and has been used in production since v1.0 shipped 2026-04-15.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| dexie | npm | ~10 yrs (4.2.1 current major) | ~700K/wk | github.com/dexie/Dexie.js | N/A (no installs) | Already in production use — D-01 |
| dexie-react-hooks | npm | ~5 yrs | ~80K/wk | github.com/dexie/Dexie.js | N/A (no installs) | Already in production use |

**Packages removed due to slopcheck [SLOP] verdict:** none — no installs in this phase.
**Packages flagged as suspicious [SUS]:** none.

*No `npm install` step required.*

---

## Architecture Patterns

### System Architecture Diagram

```
[Page load / React boot]
        |
        v
[main.tsx -> App.tsx -> useDatabase.ts] imports `db` from `./db/database.ts`
                                                |
                                                v
                              [database.ts module evaluation]
                                                |
                                ┌---------------+---------------┐
                                |                               |
                                v                               v
                  [new Dexie('3DCosterDB')]    [db.version(1..5)...stores().upgrade() chain]
                                |                               |
                                v                               v
                       [db.version(6).stores(<unchanged>).upgrade(tx => return tx.table('jobs').toCollection().modify(...))]
                                                |
                                                v
                       [db.on('versionchange', () => window.location.reload())]  <-- D-11 attachment site
                                                |
                                                v
                                       [export { db }]
                                                |
                                                v
                  [first consumer call (useLiveQuery / db.jobs.toArray())]
                                                |
                                                v
                            [Dexie implicitly calls db.open() lazily]
                                                |
                                                v
              ┌-----------------------------------------------------------------+
              |                                                                 |
              v                                                                 v
      [Fresh DB / no prior version]                            [Existing v1–v5 DB present]
              |                                                                 |
              v                                                                 v
       [Open at v6 directly]                                  [Run upgrade chain v(current+1)..v6]
              |                                                                 |
              v                                                                 v
       [tags absent on jobs                                       [v6.upgrade(tx) executes:
        — undefined access guarded                                    tx.table('jobs').toCollection().modify(job => {
        by Phase 13–15 consumers]                                      if (!Array.isArray(job.tags)) job.tags = [];
                                                                    })  // returns promise; Dexie awaits it]
                                                                            |
                                                                            v
                                                                  [All existing jobs: job.tags === []
                                                                   All other new fields: undefined]

[Multi-tab scenario]
  Tab A: existing session on v5 schema
  Tab B: user opens app in new tab (new bundle bumps to v6)
        |
        v
  Tab B calls db.open() implicitly -> sees v5 < v6 -> requests upgrade
        |
        v
  IndexedDB fires `versionchange` event on Tab A's open connection
        |
        v
  Dexie surfaces it to Tab A's `db.on('versionchange', ...)` handler
        |
        v
  Tab A: window.location.reload()  <-- handler closes connection naturally on unload
        |
        v
  Tab B: upgrade transaction proceeds (no longer blocked)
        |
        v
  Tab A reloads on v6 cleanly
```

### Recommended Project Structure

No structural changes. All edits are localized:

```
src/
├── db/
│   └── database.ts        # Add db.version(6).stores().upgrade() block + db.on('versionchange', ...)
├── types.ts               # Add JobCustomer interface; extend PrintJob + UserProfile with optional fields
└── (no other files touched in Phase 12)
```

### Component Responsibilities

| File | Responsibility | Lines Touched |
|------|----------------|---------------|
| `src/db/database.ts` | Append v6 migration block after v5 (`:71`) and before `export { db }` (`:73`); attach `db.on('versionchange', ...)` after the `.upgrade()` block | Insert ~10 new lines between current `:71` and `:73` |
| `src/types.ts` | Add `JobCustomer` interface; extend `PrintJob` (lines 139–175) with 5 optional fields; extend `UserProfile` (lines 195–212) with 2 optional fields | ~3 surgical edits |

### Pattern 1: Dexie Version Migration with `modify()` Promise Return

**What:** Append a new `db.version(N).stores({...}).upgrade(tx => return tx.table(...).toCollection().modify(...))` block. The stores definition repeats every table (Dexie convention used through v1–v5 in this project). The upgrade callback mutates rows in place via `modify()`. The `modify()` call MUST be returned.

**When to use:** Any schema version bump, including ones that don't change the schema string (still required when adding a data migration like the `tags` backfill).

**Example:**
```typescript
// Source: src/db/database.ts:49–71 (existing v5 block — verified working since v1.0 shipped 2026-04-15)
// Source: Dexie official docs https://dexie.org/docs/Version/Version.upgrade().html
db.version(6).stores({
  // Schema strings IDENTICAL to v5 (D-04: no *tags index)
  materials: 'id, category, brand, filamentType, currency',
  printers: 'id, name',
  printerInstances: 'id, printerConfigId, nickname',
  jobs: 'id, name, createdAt, printerInstanceId',
  sales: 'id, jobId, soldAt',
  settings: 'key',
}).upgrade(tx => {
  // Backfill tags=[] on existing jobs so Phase 15 can read job.tags safely.
  // Other new fields (customer/tax*/quoteNumber) stay undefined on existing rows.
  return tx.table('jobs').toCollection().modify(job => {
    if (!Array.isArray(job.tags)) job.tags = [];
  });
});
```

### Pattern 2: `versionchange` Multi-Tab Reload Guard

**What:** Subscribe to Dexie's `versionchange` event on the `db` singleton with `window.location.reload()`. Without this, Dexie's built-in default closes the DB connection and `console.warn`s — but the React components still hold references through `useLiveQuery`, which causes the white-screen crash that SCHEMA-02 targets.

**When to use:** ANY Dexie app that ships schema upgrades to users who may have multiple tabs open. Mandatory once you cross v1 → v2 in production.

**Example:**
```typescript
// Source: Dexie official docs https://dexie.org/docs/Dexie/Dexie.on.versionchange
// Adapted to plain reload per D-10 (no confirm() prompt — hostile UX in a small calculator).
//
// MUST be attached BEFORE first db.open() implicit fire. Module-top-level placement
// (immediately after the .version().upgrade() chain) satisfies this — the handler is
// registered synchronously during module evaluation, before any React consumer calls
// useLiveQuery() / db.jobs.toArray().
db.on('versionchange', () => {
  // Another tab loaded a newer schema and needs to upgrade. Reload so this tab
  // unloads its DB connection and starts on the new schema after the page reload.
  window.location.reload();
});
```

### Pattern 3: TypeScript Optional-Field Addition (No Deprecated Stubs)

**What:** Add new fields as `field?: Type` directly to the existing interface. No `@deprecated` markers, no transition-phase optional/required dance. Inherited from v1.0 Phase 01 (locked decision, logged in STATE.md).

**When to use:** Any additive schema migration where existing records won't have the new field. Reading code uses `??` defaults; writing code only sets the field when meaningful.

**Example:**
```typescript
// Source: src/types.ts existing pattern (e.g. PrintJob.modelCostPerUnit?: boolean at line 152)

// New interface — place ABOVE PrintJob (or inline immediately above per Claude's discretion).
export interface JobCustomer {
  name?: string;
  email?: string;
  address?: string;  // Freeform — multi-line textarea in Phase 14; PDF prints verbatim (D-08)
  company?: string;
}

// PrintJob — additive only. Suggested grouping (Claude's discretion D-discretion):
export interface PrintJob {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;

  // Customer (Phase 14)
  customer?: JobCustomer;

  // Tags (Phase 15)
  tags?: string[];

  // Print parameters
  filaments: FilamentUsage[];
  printTimeHours: number;
  printerInstanceId: string;
  // ... (existing fields unchanged) ...
  sellingPrice: number;

  // Tax (Phase 13) — grouped near sellingPrice since tax is computed from it
  taxRate?: number;
  taxAmount?: number;

  copiesSold: number;
  notes?: string;

  // Quote number (Phase 16) — assigned on first PDF generation, then reused (D-05)
  quoteNumber?: number;
}

// UserProfile — additive only.
export interface UserProfile {
  currency: Currency;
  name?: string;
  laborHourlyRate: number;
  defaultProfitMargin?: number;
  address?: { /* unchanged */ };
  assetLibraryItemsPerPage?: number;

  // Tax (Phase 13)
  defaultTaxRate?: number;

  // Quote numbering (Phase 16) — undefined defaults to 1 on first read (D-06)
  nextQuoteNumber?: number;
}
```

### Anti-Patterns to Avoid

- **Forgetting `return` on the `modify()` promise:** Without `return`, Dexie may mark v6 complete before every row is visited. Symptom: some jobs have `tags=[]`, others have `tags=undefined`. The v5 block already demonstrates the correct `return tx.table(...)` pattern at `database.ts:57` — copy it verbatim. (Verified in v1.0 STATE.md: "Dexie v5 migration returns modify() promise to ensure complete record conversion").
- **Attaching `db.on('versionchange', ...)` AFTER first DB read:** Dexie opens the connection lazily on the first table access. If the handler is attached AFTER `useLiveQuery` has already fired, there's a small window where another tab could upgrade and Dexie's default handler (close + console.warn) runs instead. Mitigation: attach the handler at module-top-level inside `database.ts`, immediately after the `.upgrade()` chain — this runs during module evaluation, synchronously, before any consumer can call into Dexie. (D-11 codifies this.)
- **Trying to set `job` to a new object in `modify()`:** Dexie's `modify()` callback receives a proxy; `job = { ...job, tags: [] }` does NOT persist. Mutate properties directly: `job.tags = []`. (Logged in v1.0 Phase 01 RESEARCH.md as Pitfall 4.)
- **Adding `*tags` to the schema string "just in case":** Rejected per D-04. Adding the multi-entry index later (in a future v7 bump) is safe and reversible. Adding it speculatively now risks reindex-on-migration failures that won't surface until production users hit them.
- **Wrapping the reload in `setTimeout(..., 1500)` or showing a toast:** Rejected per D-10. The race window between toast display and user click vs. another tab's upgrade is real; the plain reload eliminates it.
- **Adding a `JobCustomer` runtime validator (Zod / Yup / hand-rolled regex):** Rejected per D-09. Phase 14's form does input validation; the type is permissive.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| IndexedDB schema versioning | Custom version-tracking with `localStorage.dbVersion` + manual migration loop | `db.version(N).stores().upgrade()` | Dexie handles transaction safety, version gating, atomic rollback on error, and re-entrant safety |
| Mutating all existing rows in a migration | `toArray()` + `for` loop + `db.jobs.put(updated)` | `tx.table('jobs').toCollection().modify(...)` inside `upgrade()` | `modify()` runs inside the upgrade's atomic IDB transaction; manual loops can partially fail and leave half-migrated data |
| Multi-tab coordination for schema upgrades | `BroadcastChannel` + custom protocol + reload coordinator | `db.on('versionchange', () => window.location.reload())` | IndexedDB ALREADY fires `versionchange` on every open connection when another tab requests a higher version; Dexie surfaces it as a typed event. Reimplementing this is duplicating browser primitives. |
| Detecting a "stale" tab post-upgrade | `setInterval` polling DB version | Same `versionchange` event | The browser dispatches the event the moment another tab calls `indexedDB.open(name, higherVersion)` — polling is wasteful and slower |
| `JobCustomer` runtime validation | Zod / Yup schema + parse-on-write | Plain TypeScript types + Phase 14 form-level validation | Locked decision D-09; runtime validation library would add ~14KB gz for a field nobody currently writes |

**Key insight:** The entirety of Phase 12 leans on browser primitives (IndexedDB versioning) and Dexie's documented wrapper. Hand-rolling any of it duplicates code that has been hardened by tens of thousands of production deployments.

---

## Common Pitfalls

### Pitfall 1: `versionchange` handler attached after first DB read

**What goes wrong:** A consumer (e.g. `useLiveQuery` in `useDatabase.ts`) calls into Dexie before `db.on('versionchange', ...)` is registered. Dexie's built-in default (close + `console.warn`) runs instead. The React tree holds references to query results that suddenly point at a closed connection — white-screen crash when next render reads them.

**Why it happens:** JavaScript module evaluation order. If the handler attachment is moved to `main.tsx` or `App.tsx` (where it would be inside a `useEffect`), it runs AFTER React hydration, which has already triggered `useLiveQuery` calls.

**How to avoid:** Keep the handler attachment at module top-level inside `database.ts`, immediately after the `db.version().stores().upgrade()` chain. Module evaluation is synchronous and happens before any importer can call into the singleton. (D-11 locks this; this pitfall is why.)

**Warning signs:** A `db.on('versionchange', ...)` registration that's inside `useEffect`, `componentDidMount`, or a top-level `async function init()` block.

### Pitfall 2: `modify()` promise not returned

**What goes wrong:** `upgrade(tx => { tx.table('jobs').toCollection().modify(...) })` — no `return`. Dexie thinks the upgrade callback resolved synchronously and marks v6 as applied while `modify()` is still iterating. The next `db.jobs.toArray()` returns a mix of `tags: []` and `tags: undefined` rows.

**Why it happens:** Arrow-function shorthand with braces drops the implicit return; easy to miss in code review.

**How to avoid:** Mirror the existing v5 block at `database.ts:57` verbatim — it has `return tx.table('jobs').toCollection().modify(...)`. Lint rule `@typescript-eslint/no-floating-promises` would catch this but isn't enabled in the project.

**Warning signs:** During UAT, scrolling through saved jobs in JobsManager reveals inconsistent `tags` state across rows.

### Pitfall 3: jsdom doesn't support IndexedDB

**What goes wrong:** A Vitest test that tries to instantiate Dexie and run a real migration fails with `ReferenceError: indexedDB is not defined` or `TypeError: indexedDB.open is not a function`.

**Why it happens:** jsdom (the Vitest environment configured in `vitest.config.ts`) provides DOM APIs but does NOT implement IndexedDB. The existing `costCalc.test.ts` and `threeMfParser.test.ts` tests are pure-function tests with no DB touch.

**How to avoid:** Do NOT write a Vitest test that opens Dexie or runs the v6 migration end-to-end. The migration callback can be UNIT-tested as a pure function — extract the row-modify logic (`job => { if (!Array.isArray(job.tags)) job.tags = [] }`) and test that the function correctly mutates a plain object. Reserve the actual migration check for manual UAT (DevTools → Application → IndexedDB → 3DCosterDB → jobs table) which IS testable in a real browser.

**Alternative if a true migration test is desired in the future:** add `fake-indexeddb` as a devDependency and wire it in `vitest.config.ts` via `setupFiles`. Out of scope for Phase 12.

**Warning signs:** A proposed task says "write Vitest test that opens Dexie and asserts schema is v6."

### Pitfall 4: Module-side-effect order in test environment

**What goes wrong:** A Vitest test that imports anything from `src/db/database.ts` causes the module to evaluate `new Dexie(...)` at import time — under jsdom this throws (no `indexedDB`) and fails the test load, even if the test itself doesn't touch Dexie.

**Why it happens:** ES module top-level side effects run unconditionally on first import. `database.ts` does `const db = new Dexie('3DCosterDB')` at module top-level.

**How to avoid:** Never `import { db } from '../db/database'` from a Vitest test that runs under jsdom. If a test needs to reference type-only exports from a module that side-effect-imports Dexie, use `import type { ... }` (which `verbatimModuleSyntax: true` in `tsconfig.app.json` enforces). Phase 12 type tests can run by importing directly from `src/types.ts` which has zero runtime side effects.

**Warning signs:** A test file failing on import with an `indexedDB is not defined` stack frame from `node_modules/dexie/...`.

### Pitfall 5: A user with manually-edited IndexedDB has `tags: "string"` instead of an array

**What goes wrong:** The migration runs `job.tags = ?? []`-style and now `job.tags` is `"some-string"` — Array methods (`.filter`, `.map`) throw at read time in Phase 15.

**Why it happens:** IndexedDB has no schema enforcement at the JS layer; a user with DevTools and curiosity can write any value. The `??` operator only catches `null`/`undefined`.

**How to avoid:** Use `Array.isArray(job.tags)` as the guard (CONTEXT specifics line 113 — already chosen). This handles `null`, `undefined`, `"string"`, `42`, `{}`, etc. all equivalently. Code: `if (!Array.isArray(job.tags)) job.tags = [];`

**Warning signs:** A migration body using `job.tags ??= []` or `job.tags = job.tags ?? []`.

### Pitfall 6: TypeScript `verbatimModuleSyntax` requires `import type` for type-only imports

**What goes wrong:** Adding `import { JobCustomer } from './types'` (without `type`) to a future file produces `TS1484: 'JobCustomer' is a type and must be imported using a type-only import`. Phase 12 doesn't add imports — but Phases 13–16 will, and the planner should know.

**Why it happens:** `verbatimModuleSyntax: true` is set in `tsconfig.app.json:13`. The existing pattern is `import type { ... } from '...'` (see `useDatabase.ts:4`).

**How to avoid:** When future phases import `JobCustomer`, use `import type { JobCustomer } from '../types'`. Not Phase 12's problem, but worth flagging for downstream phases.

### Pitfall 7: `tsc --noEmit` lets sneaky errors through; `tsc -b` doesn't

**What goes wrong:** Developer verifies locally with `tsc --noEmit` (the Teshu-style command from memory) and sees green. CI runs `tsc -b` (per `package.json` build script) and fails on `noUnusedLocals` / `noUnusedParameters`.

**Why it happens:** Project-level CLAUDE.md memory rule: "always use `tsc -b` (not `tsc --noEmit`) for TypeScript verification." Build script is `vitest run --coverage && tsc -b && vite build && node scripts/assert-bundle-size.mjs`.

**How to avoid:** Plan tasks MUST verify with `tsc -b`, not `--noEmit`. (CLAUDE.md memory rule from Teshu project applies to all 3DCoster-adjacent work — confirmed via memory load.)

**Warning signs:** A task `<verify>` block calling `tsc --noEmit`.

---

## Runtime State Inventory

> Phase 12 IS a migration phase (schema v5 → v6). This section is REQUIRED.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | IndexedDB database `3DCosterDB` — `jobs` table with existing user records on schema v5 (some users may have 10–500 jobs). `settings` table contains JSON-stringified `userProfile` blob. | Code edit: v6 upgrade callback backfills `tags = []` on existing job records. No action needed for `userProfile` blob — `getUserProfile(defaultValue)` already merges missing keys on read (D-02). |
| **Live service config** | None — no external services. App is fully local-only. | None — verified by reading `package.json` (no Supabase/Firebase/API clients) and CLAUDE.md memory ("all v1.1 work is free-tier, local-only; no Supabase, no API calls"). |
| **OS-registered state** | None for web build. Tauri desktop app stores app state inside its own user-data directory, but there is no OS-level registration of the `3DCosterDB` schema version. | None — verified by reading `src-tauri/` structure (Tauri wraps the same Vite bundle; same IndexedDB instance per browser/webview profile). |
| **Secrets / env vars** | None — phase 12 doesn't add or rename any env vars. | None — verified by reading `package.json` (no `.env`-reading dependencies in dev scripts touched by this phase). |
| **Build artifacts / installed packages** | None — phase 12 adds zero new packages. The existing `node_modules/dexie` is unchanged. | None — verified via package.json diff (no dependency changes). |

**The canonical question — what runtime systems still have old state after every file edit?**

Answer: only the IndexedDB `jobs` table in users' browsers. That state IS migrated by the v6 upgrade callback. After the upgrade runs, every existing job has `tags: []` and the other new fields stay undefined (read-side fallback handles them). Users with no existing jobs jump straight to v6 with an empty DB.

---

## Environment Availability

> Skipped — Phase 12 has no external dependencies (no CLI tools, services, runtimes beyond Node/npm/Vite/Tauri already verified by v1.0–v1.1 shipping). Verified via `package.json` read and CLAUDE.md project instructions.

---

## Validation Architecture

> `workflow.nyquist_validation: true` in `.planning/config.json` (read at research time). Section is REQUIRED.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 (jsdom environment) |
| Config file | `vitest.config.ts` (existing — `include: ['src/**/*.test.ts']`, jsdom env) |
| Quick run command | `npm test -- --run src/types.test.ts` (or whatever test files Phase 12 adds — currently zero unit tests for the schema layer) |
| Full suite command | `npm test` (runs `vitest run`); `tsc -b` for compile gate |
| TypeScript compile command | `tsc -b` (per CLAUDE.md project memory — NOT `--noEmit`) |
| Build gate | `npm run build` = `lint-no-raw-html && vitest run --coverage && tsc -b && vite build && assert-bundle-size` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCHEMA-01 (a) | TypeScript types compile: `PrintJob` has 5 new optional fields, `UserProfile` has 2 new optional fields, `JobCustomer` exported | TypeScript compile check | `tsc -b` | YES — `tsc -b` exists |
| SCHEMA-01 (b) | v6 upgrade callback backfills `tags = []` on existing jobs | Unit test (pure function) | `npm test -- --run src/db/migrations.test.ts` (after extracting migrator into a pure function) — OR manual UAT in DevTools | ❌ Wave 0 — needs new test file OR manual checkpoint task |
| SCHEMA-01 (c) | v6 upgrade is idempotent — closing + reopening the app does not re-run the upgrade callback | Manual UAT | Open DevTools → Application → IndexedDB → 3DCosterDB; verify version = 6; reload; re-verify version still 6 with no console errors | N/A — manual |
| SCHEMA-01 (d) | Existing v5 jobs load with `tags: []` and other new fields `undefined` | Manual UAT | Pre-seed a v5 IndexedDB record (or use an existing user's DB), update bundle, reload, inspect `jobs` records in DevTools | N/A — manual checkpoint task |
| SCHEMA-02 (a) | `db.on('versionchange', () => window.location.reload())` registered before `export { db }` | Compile-time grep | `grep -E "db\.on\('versionchange'" src/db/database.ts` in a verify step | YES — grep is universally available |
| SCHEMA-02 (b) | Two tabs both on v5; tab A loads v6 bundle → tab B auto-reloads | Manual UAT | Open app in two tabs side-by-side on the OLD bundle (v5); deploy/load the new bundle in tab A; observe tab B reloads within ~1s | N/A — manual checkpoint task |

### Sampling Rate

- **Per task commit:** `tsc -b` (catches all type errors on `PrintJob` / `UserProfile` / `JobCustomer` immediately)
- **Per wave merge:** `npm test && tsc -b` (full Vitest + types)
- **Phase gate:** `npm run build` green (= lint + test + tsc + vite build + bundle-size assertion) AND manual UAT checkpoints for SCHEMA-01 (b)(c)(d) and SCHEMA-02 (b)

### Wave 0 Gaps

- [ ] **OPTIONAL:** Extract the migrator's row-modify logic into a pure function exported from `src/db/database.ts` (e.g. `export function backfillTagsOnJob(job: Record<string, unknown>) { if (!Array.isArray(job.tags)) job.tags = []; }`) and unit-test it at `src/db/migrations.test.ts`. This converts SCHEMA-01 (b) from manual to automated.
  - **Tradeoff:** Adds a one-line export that's only consumed by tests. Aesthetically minor pollution; benefit is real automation. **Recommendation: planner picks.** If skipped, SCHEMA-01 (b) becomes a `checkpoint:human-verify` task with the DevTools check.
- [ ] **REQUIRED:** A `checkpoint:human-verify` task for SCHEMA-02 (b) — the multi-tab reload UAT cannot be automated without Playwright multi-tab orchestration (not installed). Manual two-tab check is the right gate.
- [ ] **REQUIRED:** A `checkpoint:human-verify` task for SCHEMA-01 (c)(d) — IndexedDB inspection in DevTools to confirm schema version = 6 and existing records show `tags: []`.

*Framework install: none — Vitest is already configured.*

---

## Code Examples

Verified patterns from the existing codebase + official Dexie docs.

### Complete v6 migration block (drop-in for `src/db/database.ts`)

```typescript
// Source: src/db/database.ts:49–71 (existing v5 — verified working in production since 2026-04-15)
// Source: https://dexie.org/docs/Version/Version.upgrade().html
db.version(6).stores({
  // Schema strings identical to v5 — no new indexes (D-04: tags filter is in-memory)
  materials: 'id, category, brand, filamentType, currency',
  printers: 'id, name',
  printerInstances: 'id, printerConfigId, nickname',
  jobs: 'id, name, createdAt, printerInstanceId',
  sales: 'id, jobId, soldAt',
  settings: 'key',
}).upgrade(tx => {
  // Backfill tags=[] so Phase 15 readers can call Array methods without guards.
  // All other new fields (customer/taxRate/taxAmount/quoteNumber on PrintJob;
  // defaultTaxRate/nextQuoteNumber on UserProfile) stay undefined and are
  // handled by read-side defaults (e.g. getUserProfile fallback at line 124).
  return tx.table('jobs').toCollection().modify(job => {
    if (!Array.isArray(job.tags)) job.tags = [];
  });
});

// Reload this tab if another tab loads a newer schema (SCHEMA-02 / D-10 / D-11).
// Without this, Dexie's default closes the connection and console.warn()s, which
// crashes the React tree via useLiveQuery references.
db.on('versionchange', () => {
  window.location.reload();
});

export { db };
```

### `JobCustomer` interface + `PrintJob` / `UserProfile` extensions (for `src/types.ts`)

```typescript
// Add JobCustomer above PrintJob (planner discretion; inline is also fine per D-discretion).
// Source: CONTEXT.md D-08 — fields locked.
export interface JobCustomer {
  name?: string;
  email?: string;
  address?: string;  // Freeform multi-line; PDF prints verbatim
  company?: string;
}

// Existing PrintJob (lines 139–175) gets 5 new fields. Grouping suggestion below
// matches CONTEXT.md "Claude's Discretion": customer near top, tax near sellingPrice,
// quoteNumber near bottom. Adjust as planner sees fit.
export interface PrintJob {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;

  // Customer details (Phase 14 reads/writes)
  customer?: JobCustomer;

  // Tags (Phase 15 reads/writes)
  tags?: string[];

  // Print parameters
  filaments: FilamentUsage[];
  printTimeHours: number;
  printerInstanceId: string;

  // Model costs
  modelCost: number;
  modelCostPerUnit?: boolean;
  authorMinPrice?: number;
  modelUrl?: string;

  // Post-processing
  prepTimeMinutes: number;
  postProcessingMinutes: number;
  materialsUsed: MaterialUsage[];

  // Risk
  failureRate: number;

  // Calculated costs
  costPerUnit: number;

  // Pricing
  sellingPrice: number;
  taxRate?: number;     // Phase 13: per-job override (percent)
  taxAmount?: number;   // Phase 13: computed from sellingPrice * taxRate

  // Break-even tracking
  copiesSold: number;

  // Notes
  notes?: string;

  // Quote numbering (Phase 16) — assigned on first PDF gen, then reused (D-05)
  quoteNumber?: number;
}

// Existing UserProfile (lines 195–212) gets 2 new fields.
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
  defaultTaxRate?: number;

  // Quote numbering (Phase 16) — first quote ever is #1 (D-06); read via `?? 1`
  nextQuoteNumber?: number;
}
```

### Pure-function migrator (optional, for Wave 0 unit-test gap)

```typescript
// OPTIONAL — extract the row-modify body into an exported pure function so it
// can be unit-tested under jsdom without touching IndexedDB. Planner picks
// whether to do this or treat SCHEMA-01 (b) as a manual checkpoint.

// In src/db/database.ts:
export function backfillTagsOnJob(job: Record<string, unknown>): void {
  if (!Array.isArray(job.tags)) job.tags = [];
}

// Then the upgrade block becomes:
//   return tx.table('jobs').toCollection().modify(backfillTagsOnJob);

// And src/db/migrations.test.ts:
import { describe, it, expect } from 'vitest';
import { backfillTagsOnJob } from './database';

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
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Implicit single-filament `filamentId` + `filamentGrams` on PrintJob | `filaments: FilamentUsage[]` | v1.0 Phase 01 (shipped 2026-04-15) | Multi-material jobs supported; v5 migration converted all existing records |
| Dexie v5 schema | Dexie v6 schema | Phase 12 (this work) | Adds 5 optional fields to PrintJob, 2 to UserProfile, new JobCustomer interface; backfills `tags = []` |
| No multi-tab schema-upgrade coordination | `db.on('versionchange', () => window.location.reload())` | Phase 12 (this work) | First time the app has ever shipped this guard; previous v1→v5 bumps happened pre-launch when no users had open tabs to conflict with |
| Confirm-prompt reload (Dexie's official example pattern) | Plain reload (no confirm) | Phase 12 (D-10) | Modern SPA UX — users don't expect or want a `confirm()` blocking dialog from the app shell |

**Not deprecated in this phase:**
- The v1–v5 chain stays intact; v6 is appended.
- `getUserProfile(defaultValue)` keeps its existing fallback-merge behavior.
- All 9 consumer files of `PrintJob` / `UserProfile` continue to type-check (additive optional fields only).

---

## Project Constraints (from CLAUDE.md)

Extracted from `.claude/CLAUDE.md` (project-checked), `~/.claude/CLAUDE.md` (user-global), and project memory.

| Constraint | Source | Phase 12 Compliance |
|------------|--------|---------------------|
| Use `tsc -b` (NOT `tsc --noEmit`) for TypeScript verification | User-global CLAUDE.md (Teshu rule applies to all projects) | All verify steps in plan tasks MUST use `tsc -b` |
| Project port is 4173 for `npm run dev` | Project CLAUDE.md | Plans don't need to spawn a dev server; if they do for UAT, port 4173 |
| Code-review-graph MCP tools BEFORE Grep/Glob/Read | Project CLAUDE.md (worktree-level) | Planner / verifier should use graph tools first when exploring blast radius |
| Tools/functions called by LLMs MUST have docstring examples (2–3 input/output pairs) | User-global CLAUDE.md | Phase 12 doesn't add LLM tools — N/A |
| Scripts go in `scripts/`, never `tmp/` | User-global CLAUDE.md | Phase 12 adds no scripts; N/A |
| Don't use arbitrary numbers — either find the data or say "no data" | User-global CLAUDE.md | Phase 12 has no numeric defaults requiring justification; `nextQuoteNumber` defaults to 1 (D-06) which is a documented design choice, not a fabricated number |
| Stop after 2 failed attempts on the same approach; ask the user | User-global CLAUDE.md | Plan-phase should respect this if the migration UAT fails |
| NEW badge ONLY for user-facing features | Project memory | Phase 12 is INVISIBLE to users — NO badge, NO `features.ts` entry (already noted in CONTEXT "Out of scope") |
| Refinement vs. contradiction working-style note | Project memory | If user clarifies during plan-phase, frame as refinement |

---

## Sources

### Primary (HIGH confidence)

- `node_modules/dexie/dist/dexie.d.ts:480–508` (read directly) — confirms `DexieVersionChangeEvent`, `DbEventFns`, `DbEvents` signatures; `db.on('versionchange', fn)` is fully typed
- `node_modules/dexie/dist/dexie.d.ts:852–855` — confirms `version(versionNumber)`, `open(): PromiseExtended<Dexie>` signatures
- `src/db/database.ts:49–71` (read directly) — verified working v5 migration block (template for v6)
- `src/db/database.ts:124–130` — confirmed `getUserProfile(defaultValue)` fallback-merge behavior
- `src/types.ts:139–175` (read directly) — confirmed current `PrintJob` shape; insertion sites identified
- `src/types.ts:195–212` (read directly) — confirmed current `UserProfile` shape
- `src/hooks/useDatabase.ts` (read directly) — sole consumer of `db`; no changes needed (Phase 12 hook updates are deferred to 13–16)
- `src/main.tsx` (read directly) — entry point; no Phase 12 changes needed (database.ts is module-loaded by hook chain on App mount)
- `vitest.config.ts` (read directly) — confirmed Vitest 4.1.4 + jsdom + `src/**/*.test.ts` include glob
- `package.json` (read directly) — confirmed Dexie 4.2.1, Vitest 4.1.4, TS 5.9.3; build script `vitest run --coverage && tsc -b && vite build`
- `tsconfig.app.json` (read directly) — confirmed `strict`, `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax: true`
- [Dexie official docs: Dexie.on.versionchange](https://dexie.org/docs/Dexie/Dexie.on.versionchange) — verbatim official reload example, default-behavior documentation
- [Dexie official docs: Dexie.on.blocked](https://dexie.org/docs/Dexie/Dexie.on.blocked) — verbatim "before this event the other window receives versionchange" timing
- [Dexie official docs: Version.upgrade()](https://dexie.org/docs/Version/Version.upgrade().html) — confirms `return tx.table(...).modify(...)` pattern
- [Dexie official docs: Tutorial Design](https://dexie.org/docs/Tutorial/Design#database-versioning) — confirms idempotency-by-version-number and "stores definition must list ALL tables" convention
- `.planning/phases/01-data-foundation/01-PLAN.md` + `01-RESEARCH.md` (read directly) — established the "return modify() promise", "no deprecated stubs", "delete on stored fields" patterns inherited here

### Secondary (MEDIUM confidence)

- [W3C IndexedDB API spec — versionchange semantics](https://www.w3.org/TR/IndexedDB/) — confirms in-flight transactions complete before connection closes; explicit close() is the safe response to versionchange
- WebSearch results — confirmed Dexie's default behavior ("close + console.warn") and the "blocked" event firing after "versionchange" if the receiving tab doesn't close

### Tertiary (LOW confidence)

- None — all critical claims are backed by Primary or Secondary sources.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Existing users have 10–500 saved jobs (basis for D-04 "no `*tags` index needed") | Don't Hand-Roll / Pitfalls | If users actually have 5000+ jobs, the in-memory filter in Phase 15 may have visible lag. Mitigation already in CONTEXT deferred: revisit if telemetry shows it. Not blocking. |
| A2 | jsdom 29.0.2 still lacks IndexedDB support | Pitfall 3 | If jsdom HAS added IndexedDB support recently (unlikely — historically unsupported), the "no Dexie tests" advice is overly cautious. Test would be valuable. Risk: low — planner can verify by attempting one test and observing the error. |
| A3 | The `Array.isArray` guard handles all manually-edited IndexedDB tags-field corruption modes | Pitfall 5 | Defensive guard is correct for any non-array value; risk only if a future Phase 15 reader assumes specific array-element types. That's a Phase 15 concern, not Phase 12. |
| A4 | Module-top-level `db.on('versionchange', ...)` attachment is sufficient (no race with implicit `db.open()`) | Pitfall 1 / D-11 | Module evaluation is synchronous in ES modules; the handler attaches before any importer can call into the singleton. Verified by Dexie docs' official example pattern. |

If this table is empty: all claims are verified or cited — no user confirmation needed.

The 4 assumptions above are low-risk and do not block planning. They are documented for transparency, not as decisions requiring user input.

---

## Open Questions

1. **Should the migration row-modify body be extracted into a pure exported function for unit testing?**
   - What we know: Vitest + jsdom can't run a full Dexie migration test, but a pure-function unit test of the row-modify logic is trivial.
   - What's unclear: Whether the planner values the unit-test coverage enough to add a one-line module export.
   - Recommendation: Planner picks. If yes → extract `backfillTagsOnJob` and unit-test it. If no → SCHEMA-01 (b) becomes a `checkpoint:human-verify` task for DevTools inspection. Both are valid.

2. **Should `JobCustomer` live above `PrintJob` or inline near it?**
   - What we know: CONTEXT D-discretion lets the planner pick. Existing pattern in `types.ts` is "interface above the consumer" (e.g. `FilamentUsage` at line 131 sits above `PrintJob` at 139).
   - What's unclear: Stylistic only.
   - Recommendation: Place `JobCustomer` immediately above `PrintJob` (matches existing `FilamentUsage` pattern). Avoids inline definition clutter.

3. **Should the v6 block include a one-line comment explaining `versionchange`?**
   - What we know: CONTEXT D-discretion biases yes.
   - What's unclear: Comment phrasing only.
   - Recommendation: Yes — include a 1–2 line comment explaining "reload this tab if another tab loads a newer schema; without this Dexie's default crashes the React tree." See Code Examples section for suggested phrasing.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and in active use; no new dependencies; versions confirmed via package.json read
- Architecture: HIGH — migration pattern is identical to existing v1–v5 in `database.ts`; v5 block is the verified template; Dexie official docs confirm the upgrade + versionchange patterns verbatim
- Pitfalls: HIGH — all 7 pitfalls are derived from official Dexie docs, the existing codebase, or W3C IndexedDB spec; the jsdom/IndexedDB pitfall is well-known and cross-verified
- Validation: HIGH — Vitest config is already in place; the framework can run pure-function tests; manual UAT checkpoints are the appropriate gate for actual IndexedDB inspection
- Multi-tab `versionchange` semantics: HIGH — confirmed via Dexie official docs (Dexie.on.versionchange + Dexie.on.blocked pages), W3C IDB spec, and the installed `dexie.d.ts` type definitions

**Research date:** 2026-05-20
**Valid until:** 2026-06-20 (stable stack — Dexie 4.x has not had a major release since 2024; TypeScript 5.9.x is stable)

---

## RESEARCH COMPLETE

**Phase:** 12 - Schema Foundation
**Confidence:** HIGH

### Key Findings

- All 11 locked decisions (D-01 through D-11) are confirmed to match Dexie's official recommendations — no decision needs revision
- The v5 block at `src/db/database.ts:49–71` is a verified, drop-in template for v6 (only the `modify()` body and version number change)
- `db.on('versionchange', () => window.location.reload())` is documented by Dexie as the recommended SPA pattern; the plain-reload (no `confirm()`) variant matches D-10
- Module-top-level attachment of the `versionchange` handler (D-11) is correct and safe — Dexie's `db.open()` is lazy and fires only on first table access, after module evaluation completes
- `Array.isArray(job.tags)` is the correct defensive guard (vs `??=`) — handles manually-edited IndexedDB with non-array `tags` values
- jsdom does NOT support IndexedDB; full migration tests cannot run in Vitest. SCHEMA-01 (b)(c)(d) and SCHEMA-02 (b) require manual UAT checkpoints. SCHEMA-01 (b) CAN be partially automated by extracting the row-modify body into a pure exported function — planner's call
- All 9 consumers of `PrintJob` / `UserProfile` continue to type-check unchanged (additive optional fields only)
- Zero new package installs required — Phase 12 uses only Dexie 4.2.1, TypeScript 5.9.3, and Vitest 4.1.4, all already installed

### File Created

`.planning/phases/12-schema-foundation/12-RESEARCH.md`

### Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | All libraries already installed; versions verified via package.json read; no new dependencies |
| Architecture | HIGH | v5 migration block is a working template; Dexie docs confirm every pattern verbatim |
| Pitfalls | HIGH | All 7 pitfalls derived from official docs, installed type defs, or the existing codebase |
| Multi-tab semantics | HIGH | Dexie + W3C IDB spec + dexie.d.ts cross-verified |

### Open Questions

1. Whether to extract the row-modify body into a pure unit-testable function (Wave 0 gap — planner picks)
2. JobCustomer placement (above PrintJob recommended; planner's discretion per D-discretion)
3. Whether to include a code comment on the versionchange handler (recommended yes per D-discretion bias)

### Ready for Planning

Research complete. The plan-phase can proceed directly. All 11 CONTEXT decisions are validated against authoritative sources; the only remaining choices are stylistic (comment placement, optional unit-test extraction) and explicitly delegated to Claude's discretion in CONTEXT.md.
