---
phase: 20-dexie-atomicity-audit
created: 2026-05-26
status: ready_to_research
---

# Phase 20: Dexie Atomicity Audit — Context

## Domain

Every multi-store Dexie mutation in `useDatabase.ts` and the v7→v8 upgrade path runs atomically — no half-applied state survives a tab close, thrown exception, or mid-transaction connection close. Hardening-only milestone: no user-visible behavior changes. Six audit findings (DATA-01..06) close.

## Canonical Refs

Every downstream agent MUST read these before acting on this phase.

- [.planning/ROADMAP.md](.planning/ROADMAP.md) — Phase 20 success criteria, suggested plan breakdown (~4 plans)
- [.planning/REQUIREMENTS.md](.planning/REQUIREMENTS.md) — DATA-01..DATA-06 traceability (lines 36–41); each closes a specific [v1.2-CODE-AUDIT.md](.planning/milestones/v1.2-CODE-AUDIT.md) finding
- [.planning/milestones/v1.2-CODE-AUDIT.md](.planning/milestones/v1.2-CODE-AUDIT.md) — Original audit findings #4, #11, #12, #23, #24, #25 (severity rationale)
- [src/hooks/useDatabase.ts](src/hooks/useDatabase.ts) — `addSale` at line 572, `deleteSale` ~585, `updateSale` ~603, `createQuote` at line 841. The existing Convert-to-Sale transaction (line ~762 area) is the reference pattern to mirror.
- [src/db/database.ts](src/db/database.ts) — `versionchange` handler at line 133, `getSetting<T>` at line 138, typed getters at lines 163–203
- [src/db/backfill.ts](src/db/backfill.ts) — `backfillQuotesFromJobs` at line 187 (currently hardcodes currency in the v7→v8 path at line 124 of database.ts)
- [src/utils/csvHelpers.ts](src/utils/csvHelpers.ts) — `parsePositiveNumber` at line 398; 9 call sites at lines 213, 214, 229, 232, 235, 241, 242, 268
- User standing rules (auto-memory) — `[[feedback_reconcile_legacy_data]]` applies to DATA-03

## Carrying Forward From Prior Decisions

- **Reconcile legacy data, not forward-only fixes** (from user's standing rules): every schema/behavior change touching a derived field must ship with a one-time reconcile helper. Applied to DATA-03.

## Code Context

### Relevant Files

- `src/hooks/useDatabase.ts` — three non-atomic sale mutations (addSale, deleteSale, updateSale) sharing the `sales.X + jobs.put` pattern. Convert-to-Sale path already transactional, used as the template.
- `src/db/database.ts` — single-line `versionchange` handler; six typed getters wrapping `getSetting<T>`.
- `src/db/backfill.ts` — pure-helper `backfillQuotesFromJobs(jobs, sales): Quote[]` called by the v7→v8 upgrade. Currency parameter is the missing piece.
- `src/utils/csvHelpers.ts` — single `parsePositiveNumber` helper, scoped to file (not exported). 9 call sites across material and printer CSV import paths.

### Existing Patterns

- **Convert-to-Sale transaction** (the reference pattern): `db.transaction('rw', db.sales, db.jobs, db.quotes, ...)` with an async function that does both writes. Already tested.
- **`createQuote` transaction** (line 841): already opens a `db.transaction('rw', db.quotes, db.customers, db.settings)` but reads `userProfile.nextQuoteNumber` from a React state arg passed in, not from inside the tx.
- **`useLiveQuery` reactivity**: changes to `db.sales` and `db.jobs` already retrigger consumer hooks. Transactions don't change this behavior.

## Locked Decisions

### 1. Atomicity wrap scope: all 3 sale mutations

`addSale` (DATA-01), `deleteSale`, and `updateSale` will each be wrapped in `db.transaction('rw', db.sales, db.jobs, ...)`. Matches the phase goal ("every multi-store mutation atomic"), not just DATA-01's letter. The three mutations share the identical bug class — partial write if the tab closes between awaits — and the fix pattern is copy/paste with delta math adjusted per mutation.

The existing Convert-to-Sale transaction is the template. Test coverage extends to all three (not just addSale per the success criteria).

### 2. `parsePositiveNumber` API: `allowZero?: boolean` parameter (DATA-04)

```ts
function parsePositiveNumber(
  value: string | undefined,
  opts?: { allowZero?: boolean },
): number | null
```

Default behavior rejects `0` (closes the LOW finding for printer `wattage` and `purchasePrice` accepting nonsensical zero data). The few call sites where `0` is semantically valid (e.g., `packageCost` for free packaging) opt in with `{ allowZero: true }`. Single function, no rename churn. Call sites that explicitly say `{ allowZero: true }` self-document why zero is accepted there.

**Call-site audit (9 sites in csvHelpers.ts):**

| Line | Field | allowZero? |
|------|-------|------------|
| 213 | `purchasePrice` | no |
| 214 | `wattage` | no |
| 229 | `lifespan` | no |
| 232 | `nozzleCost` | no |
| 235 | `nozzleLifespan` | no |
| 241 | `packageCost` | yes (free packaging is real) |
| 242 | `unitsPerPackage` | no |
| 268 | `lifespan` (material) | no |

Researcher should confirm this audit before planner writes the patch.

### 3. `getSetting<T>` validator: hand-rolled per-key validators (DATA-06)

`getSetting<T>` gets a new optional third parameter, a type predicate:

```ts
export async function getSetting<T>(
  key: string,
  defaultValue: T,
  validator?: (parsed: unknown) => parsed is T,
): Promise<T> {
  const setting = await db.settings.get(key);
  if (!setting) return defaultValue;
  try {
    const parsed = JSON.parse(setting.value);
    if (validator && !validator(parsed)) return defaultValue;
    return parsed as T;
  } catch {
    return defaultValue;
  }
}
```

Each typed getter (`getPrinter`, `getElectricity`, `getLabor`, `getUserProfile`, `getShipping`, `getMarketplaceFees`) passes its own hand-rolled `is`-predicate. No new dependency. Six small validators co-located with each type. Existing codebase style (TypeScript discriminated unions, no schema library) is preserved.

When a validator rejects, return `defaultValue` silently. Log a `console.warn` in dev mode (`import.meta.env.DEV`) so corruption is observable during development. Production stays silent.

### 4. DATA-03 reconcile: schema bump v8→v9 + upgrade-callback reconcile

Two-part ship:

**Part A — Forward fix (DATA-03 strict):**
`backfillQuotesFromJobs` upgrade callback reads `currency` from `tx.table('settings').get('userProfile')` inside the upgrade transaction. Currency parameter threaded through to the pure helper.

**Part B — Reconcile (legacy data per standing rule):**
New v9 schema bump whose upgrade callback walks `db.quotes`, reads the user's current `userProfile.currency` from settings, and re-stamps any quote where `lineItemsSnapshot.currency === 'USD'` AND the user's actual currency ≠ 'USD'. Runs once per device atomically. Integrates with the existing Dexie migration test infrastructure that Phase 23's TEST-04 will harden with `fake-indexeddb`.

Idempotent by construction (rerunning produces no-op if currencies already match). Logs the reconcile count in dev for observability.

**Triggers `versionchange` in other tabs:**
The reload-on-versionchange will fire. Coordinates with DATA-05's `async versionchange` handler — by the time v9 ships, the new handler will be in place (DATA-05 is in plan 20-04, same phase). Plan order matters: 20-04 (defensive trio including versionchange) ships before 20-03 (currency reconcile) OR they ship together in one bundle.

### 5. `createQuote` transaction body (DATA-02)

Implementation note for the planner: the existing `createQuote` already owns the transaction (line 841). The fix is moving the `nextQuoteNumber` read from the input argument to a `tx.table('settings').get('userProfile')` call inside the transaction body. The React state `userProfile` is still useful for currency / defaultTaxRate but `nextQuoteNumber` reads from the DB tx-scoped snapshot.

Concurrent-tab test: two near-simultaneous `createQuote` calls should produce distinct quote numbers. Existing test infrastructure (Vitest + jsdom) cannot reliably exercise this — needs real IDB. Defer the automated test to Phase 23 (TEST-04 adds `fake-indexeddb`). For Phase 20, document the manual two-tab UAT in the plan and verify it once during execution.

### 6. `versionchange` handler (DATA-05)

```ts
db.on('versionchange', async () => {
  await db.close();
  window.location.reload();
});
```

Awaits `db.close()` so in-flight transactions complete (or rollback cleanly) before the reload. No UI change — silent reload matches current UX.

## Open Questions for Researcher

- Does Dexie's `db.transaction('rw', ...)` accept a closure that returns a Promise from `db.jobs.put`? (Yes per the existing Convert-to-Sale pattern, but confirm no API drift across Dexie versions.)
- Can the `tx.table('settings')` inside an upgrade callback safely call `.get('userProfile')` synchronously, or must it await? (Upgrade callbacks are async; confirm the read pattern.)
- Is there a Dexie idiom for "run upgrade callback only when X condition" so the v9 reconcile is a no-op when not needed (e.g., user was always non-USD and never had the bug)?

## Deferred Ideas

- **Zod integration** (rejected for DATA-06): if more validation surfaces appear (form input, API responses, richer CSV import validation), revisit Zod as a single-dep choice. Today's surface is too narrow.
- **Typed-key registry for validators** (rejected): less call-site code but harder to grep; revisit if validator count grows beyond ~6.
- **Settings shape versioning** (out of scope): when a settings shape changes meaningfully (not just adding optional fields), users with old shape need migration. Today this is implicit — old fields stay; new fields default. A formal `version` field per setting could lock contracts but is overkill for current scale.

## Scope Boundaries

**In scope (Phase 20):**
- DATA-01: 3 sale mutations transactional
- DATA-02: `createQuote` reads `nextQuoteNumber` inside tx
- DATA-03: `backfillQuotesFromJobs` reads currency from settings + v9 reconcile bump
- DATA-04: `parsePositiveNumber` with `allowZero` param + call-site updates
- DATA-05: `async versionchange` handler
- DATA-06: `getSetting` validator parameter + 6 hand-rolled validators
- All existing tests pass; new tests for the addSale transaction boundary (the deleteSale + updateSale boundary tests reuse the same pattern)

**Out of scope (deferred to other phases):**
- `fake-indexeddb` integration and the real-Dexie migration test for the v9 reconcile (Phase 23, TEST-04)
- Concurrent-tab automated test for `createQuote` no-collision contract (Phase 23, needs `fake-indexeddb`)
- Zod or other schema-library adoption
- Refactoring useDatabase.ts further (decomposition is Phase 22 territory)
- Customer-UI tests (Phase 23, TEST-01..03)
