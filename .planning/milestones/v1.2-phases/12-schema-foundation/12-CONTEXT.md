# Phase 12: Schema Foundation - Context

**Gathered:** 2026-05-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Migrate the Dexie database from v5 to v6, adding all optional fields needed by the rest of v1.2 (`tags`, `customer`, `taxRate`, `taxAmount`, `quoteNumber` on `PrintJob`; `defaultTaxRate`, `nextQuoteNumber` on `UserProfile`) and define the supporting TypeScript types. Wire the multi-tab `versionchange` reload guard in `database.ts` so a second tab opened after the upgrade reloads instead of crashing. v1.0/v1.1 jobs must continue to load — only `tags = []` is backfilled; every other new field stays undefined on existing records.

**In scope:**
- `db.version(6).stores(...).upgrade(...)` block in `src/db/database.ts` (schema string unchanged; only the modify-callback backfill differs)
- `db.on('versionchange', () => window.location.reload())` registered after the db is constructed
- TypeScript additions to `PrintJob` (`tags?: string[]`, `customer?: JobCustomer`, `taxRate?: number`, `taxAmount?: number`, `quoteNumber?: number`) and `UserProfile` (`defaultTaxRate?: number`, `nextQuoteNumber?: number`) in `src/types.ts`
- New `JobCustomer` interface in `src/types.ts`: `{ name?: string; email?: string; address?: string; company?: string }`
- v6 upgrade `modify()` returns its promise (matches v5 Phase 01 pattern); only mutates `job.tags`

**Out of scope:**
- Tax UI / Settings tax rate / region lookup (Phase 13)
- Customer form section / JobsManager customer column (Phase 14)
- Tag input / chip filter / search (Phase 15)
- PDF generation / quote number assignment (Phase 16)
- Reading `taxRates.ts` or any region data — that's Phase 13
- NEW badge — schema-only work, invisible to the user (per the user-facing-only badge rule)
- Multi-entry indexing on `tags` (rejected — see D-04)

</domain>

<decisions>
## Implementation Decisions

### Schema Migration
- **D-01:** Bump Dexie version from 5 to 6 in `src/db/database.ts`. The schema string for every table stays identical to v5 — no new indexes, no removed indexes (see D-04). Dexie still requires the `.version(6).stores(...).upgrade(...)` block to register the version bump and run the upgrade callback.
- **D-02:** The `upgrade(tx => ...)` callback backfills only `tags = []` on existing `jobs` records. Every other new field (`customer`, `taxRate`, `taxAmount`, `quoteNumber` on PrintJob; `defaultTaxRate`, `nextQuoteNumber` on UserProfile) stays undefined on existing data. UserProfile lives in `settings` table as a JSON-stringified value — it does NOT need migration because `getUserProfile(defaultValue)` already falls back to the default if a key is missing on the parsed object.
- **D-03:** The `modify()` call returns its promise (matches the v5 Phase 01 pattern that v1.0 used). This ensures the upgrade transaction waits for every record to be visited before Dexie reports v6 as ready.

### Indexing
- **D-04:** Do NOT add `*tags` multi-entry index to the jobs schema string. At 10–500 saved jobs (the realistic upper bound for hobbyist sellers), in-memory `Array.filter` filtering in Phase 15 is <1ms and avoids reindex-on-migration risk. Schema string stays `'id, name, createdAt, printerInstanceId'`.

### Quote Number Storage
- **D-05:** Add `quoteNumber?: number` to `PrintJob` in v6. The field is undefined until the user generates a PDF for that job for the first time (Phase 16). At PDF generation time: read `userProfile.nextQuoteNumber ?? 1`, assign it to `job.quoteNumber`, persist the job, then increment `userProfile.nextQuoteNumber`. Regenerating the PDF for the same job reuses the stored `job.quoteNumber` — no double-issue.
- **D-06:** `UserProfile.nextQuoteNumber` defaults to 1 when undefined (the first quote ever issued is `#1`, not `#0`).
- **D-07:** Note: `quoteNumber?: number` on `PrintJob` is ADDED beyond the SCHEMA-01 field list. SCHEMA-01 only lists `tags`, `customer`, `taxRate`, `taxAmount`. Adding `quoteNumber` is a natural extension of the locked counter design — the alternative (always re-incrementing on every PDF regenerate) is a UX bug. Plan-phase should call this out explicitly in PLAN.md but treat it as in-scope for Phase 12 since the field MUST land in v6 schema before Phase 16 starts.

### JobCustomer Type Shape
- **D-08:** `JobCustomer = { name?: string; email?: string; address?: string; company?: string }`. Address is a freeform string (multi-line textarea in Phase 14's UI), NOT a structured object. Rationale: matches the casual-seller use case (Etsy buyers, local pickups), PDF prints it verbatim with no join logic, future structured upgrade is non-breaking because we can parse on read if needed.
- **D-09:** All four fields are optional. No runtime validation in the type — Phase 14 may add light input validation (e.g. email regex) but the type itself is permissive.

### versionchange UX
- **D-10:** Plain `db.on('versionchange', () => window.location.reload())` exactly as SCHEMA-02 specifies. No toast, no countdown, no setTimeout wrapper. The tab visibly reloads — that IS the signal. Adding a notice would couple a UI primitive to the database layer and introduce a race condition if the user navigates during the delay.
- **D-11:** Register the `versionchange` handler immediately after `new Dexie(...)` and `.version().stores()` chain, before `db.open()` implicitly fires. The handler must be attached for the lifetime of the page (no cleanup needed — the page reload IS the cleanup).

### Claude's Discretion
- Exact comment style in `database.ts` (the v5 block has terse inline comments — match that)
- Order of new fields within the `PrintJob` interface (group with semantically related existing fields: customer near `name`, tax near `sellingPrice`, quoteNumber separate near the bottom)
- Whether to extract `JobCustomer` into its own block above `PrintJob` or place it inline near `PrintJob` — planner picks
- TypeScript declaration approach — straight optional-field additions to the existing interfaces (matches the v1.0 Phase 01 "no deprecated stubs" pattern; no V6 augment type needed)
- Whether to add a one-line `versionchange` comment in `database.ts` explaining why the reload exists — bias toward yes (the line is not self-explanatory)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope + requirements
- `.planning/ROADMAP.md` (Phase 12 entry) — Goal + 4 success criteria + foundation-for-all-v1.2-phases note
- `.planning/REQUIREMENTS.md` — SCHEMA-01 (field list + `tags = []` backfill), SCHEMA-02 (versionchange handler)
- `.planning/PROJECT.md` — v1.2 Key Decisions table (tax three-layer, PDF lazy-load, tags scope, white-label deferred)
- `.planning/STATE.md` — pending todo: "Phase 12 plan-phase must decide quote number storage location" (resolved by D-05)

### Source files to modify
- `src/db/database.ts` — add `db.version(6).stores(...).upgrade(...)` block (mirror the v5 pattern at lines 49–71); add `db.on('versionchange', ...)` after the db is constructed
- `src/types.ts:139–175` — extend `PrintJob` interface with 5 new optional fields (see D-02, D-05)
- `src/types.ts:195–212` — extend `UserProfile` interface with `defaultTaxRate?: number` and `nextQuoteNumber?: number`
- `src/types.ts` — add new `JobCustomer` interface per D-08

### Migration pattern reference
- `src/db/database.ts:49–71` — v5 upgrade block is the template (Dexie v5 → v6 follows the same shape)
- `.planning/phases/01-data-foundation/` (v1.0) — original schema migration phase; established the "clean removal, no deprecated stubs" and "modify() returns promise" patterns inherited here

### Adjacent context
- `src/db/database.ts:124–130` — `getUserProfile`/`setUserProfile` already handle missing keys via the `defaultValue` parameter; new UserProfile fields don't need explicit migration
- `.planning/codebase/ARCHITECTURE.md` §Database Layer — `db` is imported only by `src/hooks/useDatabase.ts`; no other consumers need updating

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **v5 upgrade pattern** (`src/db/database.ts:49–71`): `db.version(N).stores({...}).upgrade(tx => { return tx.table(...).toCollection().modify(...) })`. Copy this shape for v6 — only the `modify()` body changes (`job.tags = job.tags ?? []` instead of the v5 filaments backfill).
- **`getUserProfile` fallback** (`src/db/database.ts:124–130`): Already accepts a `defaultValue` and merges missing keys via `getSetting` → JSON.parse → defaultValue path. New `UserProfile` fields don't require explicit migration because the call sites in `useDatabase.ts` always pass a full default object.
- **`PrintJob` interface** (`src/types.ts:139–175`): Stable, well-organized. New fields slot in as additional optional properties — no nested-object refactor needed.

### Established Patterns
- **Optional-field additions, no deprecated stubs** (v1.0 Phase 01 decision): When a schema field is added, just add it with `?:`. No `@deprecated` markers, no transition-phase optional/required dance. Existing data either has the field or doesn't — TypeScript narrowing + runtime defaults handle both.
- **Schema strings stay minimal** (Dexie convention used through v1–v5): Only fields that are queried via `where()` or used as compound keys appear in the schema string. `tags`, `customer`, etc. are read-after-load and don't need indexes.
- **`upgrade()` returns the modify-promise**: Established in v1.0 Phase 01 (logged in STATE.md). Repeat for v6 — without the return, Dexie may mark the version complete before every row has been visited, especially on large IndexedDB stores.

### Integration Points
- `src/db/database.ts` — only file that imports Dexie directly. The v6 block goes immediately after the existing v5 block.
- `src/types.ts` — all interface changes happen here; no other file declares these types.
- `src/hooks/useDatabase.ts` — does NOT need changes in Phase 12. Hooks read full records; new optional fields are silently accessible. Phase 13/14/15/16 hook updates (e.g. consuming `tags`) are out of scope.
- `src/main.tsx` — entry point that constructs the app. The `versionchange → reload` handler is wired inside `database.ts`, not here — `database.ts` is imported eagerly via the hook layer on app boot, so the handler attaches before any UI renders.

</code_context>

<specifics>
## Specific Ideas

- The v6 upgrade body is intentionally tiny: `return tx.table('jobs').toCollection().modify(job => { if (!Array.isArray(job.tags)) job.tags = []; })`. The `Array.isArray` guard is defensive — protects against a user who manually edited their IndexedDB.
- `versionchange` handler attachment site matters: put it right after `const db = new Dexie(...)` + the `db.version(N).stores(...)` chain, BEFORE the `export { db }`. That way every consumer of the `db` singleton gets the handler attached automatically — no need to call any "initialize" function.
- The plan-phase MUST add a one-paragraph note in PLAN.md flagging that `quoteNumber?: number` on `PrintJob` is added beyond SCHEMA-01's explicit list (with the rationale from D-07). This keeps the requirements traceability clean.
- Manual UAT for SCHEMA-02 (multi-tab reload): open the app in two browser tabs side-by-side BEFORE the v6 migration (so both are on v5), then load the updated build in tab A → tab B should auto-reload within a second.

</specifics>

<deferred>
## Deferred Ideas

- **Multi-entry index on `tags` (`*tags` in schema string)** — rejected per D-04. Revisit if a future telemetry pass shows individual users with 5000+ jobs (unlikely for hobbyist segment).
- **Structured customer address (street/city/postal/country)** — rejected per D-08. Could reopen alongside the deferred Customer Database / CRM tab milestone (CUST-F1).
- **`versionchange` UX polish (toast + countdown, or block-DB-writes pattern)** — rejected per D-10. Could revisit if support tickets reveal users confused by the reload, but the current spec matches Dexie's official recommendation.
- **Index on `customer.email`** — not added; no current query pattern requires it. If the future Customer DB milestone (CUST-F1) lands, indexing happens in that schema bump, not retroactively.
- **Type-level email validation for `JobCustomer.email`** — `email?: string` only; TypeScript template-literal email validation is overkill and brittle. Runtime validation belongs in Phase 14's form.

</deferred>

---

*Phase: 12-schema-foundation*
*Context gathered: 2026-05-20*
