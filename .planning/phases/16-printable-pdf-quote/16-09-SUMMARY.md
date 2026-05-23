---
phase: 16-printable-pdf-quote
plan: "09"
status: complete
gap_closure: true
gap_ids: [C, E]
decisions: [D-15, D-17, D-22]
executed: 2026-05-23T13:57:00Z
executed_by: orchestrator-inline
key-files:
  created:
    - src/db/database.migrations.test.ts
  modified:
    - src/types.ts
    - src/db/backfill.ts
    - src/db/backfill.test.ts
    - src/db/database.ts
    - src/hooks/useDatabase.ts
    - src/pdf/generateQuotePdf.ts
    - src/pdf/generateQuotePdf.test.ts
    - src/components/JobsManager.tsx
---

# 16-09 SUMMARY — Quote interface + Dexie v8 + generateQuotePdf refactor

## Goal achieved

Schema foundation for the entire gap-closure extension landed in one wave.
The `Quote` entity is now a first-class type with the strict by-value
snapshot rule enforced at the compiler. Dexie v8 with the `quotes` store +
backfill migration is wired. The PDF generator now reads ONLY from the
snapshot — the signature change `generateQuotePdf(quote: Quote)` makes any
cross-read into PrintJob/UserProfile a compile error. The `useQuotes` hook
exposes the read surface plan 16-11 will consume, plus the transactional
`createQuote` action plan 16-10 will call instead of importing `db` directly.

The G6 lock ("runtime never writes status='draft'") is enforced at the type
level via `RuntimeQuoteStatus = Exclude<QuoteStatus, 'draft'>` — every NEW
Quote constructor declares its payload status as the narrow type, so
TypeScript refuses 'draft' at the call site. The migration helper in
`src/db/backfill.ts` is the sole module allowed to use the wider
`QuoteStatus` (it legitimately needs to emit 'draft' for the v7→v8 backfill).

## What changed

### Task 1 — Types (`src/types.ts`)

- `QuoteStatus = 'sent' | 'accepted' | 'declined' | 'converted' | 'draft'` (full enum, includes 'draft')
- `RuntimeQuoteStatus = Exclude<QuoteStatus, 'draft'>` (narrow enum — the G6 compile-time guard)
- `Quote` interface with the exact D-17 G4 shape:
  - `id`, `quoteNumber` (required), `printJobId`, `customerId?`
  - `customerSnapshot: JobCustomer` (by-value)
  - `lineItemsSnapshot`: `{ jobTitle, sellingPrice, shippingCost, resolvedTaxRate, taxAmount, currency, notes, terms, countryAtSendTime? }`
  - `status: QuoteStatus` (wider type so legacy 'draft' rows can be READ; runtime writes are narrowed at the payload type)
  - `createdAt`, `sentAt`, `decisionAt?`, `convertedAt?`, `convertedToSaleId?`
- `Sale.convertedFromQuoteId?: string` added (D-20 prep for plan 16-11/12)
- `PrintJob.quoteNumber` marked `@deprecated` (post-v8 the source of truth is `Quote.quoteNumber`)

### Task 2 — Migration helper + locked fixture tests

`src/db/backfill.ts`:
- New pure helper `backfillQuotesFromJobs(jobs, sales): Quote[]`
- Sole module allowed to write `status: 'draft'` (the migration use case)
- For each PrintJob with `quoteNumber`: ≥1 Sale → 'converted'; else → 'draft'
- PrintJobs without quoteNumber: skipped
- O(jobs + sales) — sales pre-indexed by jobId for O(1) lookup per job
- Currency sentinel: backfilled rows default to 'USD' (no UserProfile access inside upgrade callback); the runtime UI never re-renders these rows so the wrong-currency path is unreachable

`src/db/backfill.test.ts`:
- D-17 G7 locked 3-job → 2-quote fixture (jobA converted, jobB draft, jobC skipped)
- 7 tests covering: count, converted shape, draft shape, skipped job, lineItemsSnapshot lift, multi-sale most-recent rule, legacy `Sale.customerName` fallback

`src/db/database.migrations.test.ts` (new):
- Migration-boundary test using the documented fallback (pure-helper boundary, not real Dexie upgrade — fake-indexeddb is not a devDep)
- 2 tests: locked-fixture pipeline + non-idempotency lock

### Task 3 — Dexie v8 + useQuotes hook

`src/db/database.ts`:
- Import `Quote` + `backfillQuotesFromJobs`
- Extend Dexie type intersection with `quotes: EntityTable<Quote, 'id'>`
- `db.version(8).stores({ ..., quotes: 'id, quoteNumber, status, printJobId, customerId, sentAt' })` with v7→v8 backfill upgrade callback
- `versionchange→reload` handler unchanged (Phase 12 SCHEMA-02 covers v8 multi-tab)

`src/hooks/useDatabase.ts`:
- Imports extended with `Quote`, `JobCustomer`, `RuntimeQuoteStatus`
- New `CreateQuoteInput` interface exported for PrintQuoteModal (plan 16-10) to construct against
- New `useQuotes()` hook mirroring `useCustomers` shape:
  - `quotes: Quote[]` (frozen, isLoading derived from liveQuery undefined)
  - `quotesByJobId: Map<string, Quote[]>` (O(1) per-job lookup for plan 16-11's Recent Quotes section)
  - CRUD: `addQuote / updateQuote / deleteQuote`
  - `createQuote(input): Promise<Quote>` — owns the multi-store Dexie transaction `(quotes + customers + settings)`:
    - existingCustomerId → bump that Customer's lastUsedAt
    - else if name OR email present → auto-create a Customer; capture id for Quote.customerId
    - add Quote (status: 'sent' typed RuntimeQuoteStatus → compiler refuses 'draft')
    - bump UserProfile.nextQuoteNumber via setUserProfile
  - Returns the freshly-written Quote so the caller can feed it directly to generateQuotePdf

### Task 4 — PDF refactor + JobsManager stopgap

`src/pdf/generateQuotePdf.ts`:
- New signatures: `generateQuotePdf(quote: Quote): Promise<void>` and `generateQuotePdfBytes(quote: Quote): Promise<Uint8Array>`
- `QuotePdfParams` interface deleted
- All five internal renderers (header, meta+customer, lineItems, totals, notes+terms) read EXCLUSIVELY from `quote.lineItemsSnapshot` + `quote.customerSnapshot` — no PrintJob, no UserProfile, no Sale
- `quote.quoteNumber!` → `quote.quoteNumber` (required by type)
- Throw on missing quoteNumber removed (unreachable post-refactor)
- **D-15 Shipping row**: rendered between Subtotal and Tax when `shippingCost > 0`; hidden when 0 (same hide-when-zero pattern as Tax row)
- **D-22 Tax base lock**: the snapshot's `taxAmount` is already correct (computed from `calculateTax(sellingPrice, rate)` at save time); the renderer just displays it. Total formula: `subtotal + shippingCost + taxAmount` — shipping is NEVER in the tax base
- Tauri save path unchanged

`src/pdf/generateQuotePdf.test.ts`:
- Single `makeQuote(overrides)` fixture replaces prior `makeJob + makeProfile + makeSale` trio
- `QuoteOverrides` shape allows deeply-partial overrides without re-supplying every field
- 25 tests total (was 21):
  - All 18 original tests updated to use the new signature + Quote fixture
  - "Throws when quoteNumber undefined" test removed (unreachable post-refactor)
  - D-15 shipping tests (3): omit when 0, render between Subtotal/Tax, Total includes shipping
  - D-22 tax-base lock test: sellingPrice=100 / shipping=10 / rate=20% → tax=20 (not 22) / total=130 (not 132)
  - D-17 G4 by-value snapshot test: countryAtSendTime='IT' renders VAT regardless of any other state (type system makes cross-read impossible)

`src/components/JobsManager.tsx`:
- Imports extended with `Quote`, `RuntimeQuoteStatus`
- `handleGeneratePdf` now constructs a stopgap Quote inline (typed `status: 'sent' as RuntimeQuoteStatus` — compiler refuses 'draft') and calls the new `generateQuotePdf(stopgapQuote)` signature
- `TODO(plan-16-10)` comment marks the stopgap for replacement by the PrintQuoteModal flow
- This stopgap is the sole reason JobsManager.tsx is in this plan's files_modified (BLOCKER I-02 fix — keeps wave-2 tsc green for the wave handoff)

## Compile-time G6 enforcement check (BLOCKER I-03)

The narrow `RuntimeQuoteStatus` is used at every new Quote construction site:
- `src/hooks/useDatabase.ts` `createQuote` action: `status: 'sent' as RuntimeQuoteStatus` ✓
- `src/components/JobsManager.tsx` stopgap: `status: 'sent' as RuntimeQuoteStatus` ✓
- The migration in `src/db/backfill.ts` is the SOLE site using the wider `QuoteStatus` (intentional — backfills 'draft') ✓

A hypothetical future commit that tries `status: 'draft'` at the createQuote payload site would produce a tsc error like:
`Type '"draft"' is not assignable to type 'RuntimeQuoteStatus'.`

This is type-level, not JSDoc/comment-only — exactly per the BLOCKER I-03 fix.

## Verification

| Gate | Result |
|------|--------|
| `grep -c 'export interface Quote ' src/types.ts` | **1** ✓ |
| `grep -c 'export type QuoteStatus' src/types.ts` | **1** ✓ |
| `grep -c 'export type RuntimeQuoteStatus' src/types.ts` | **1** ✓ |
| `grep -c "Exclude<QuoteStatus, 'draft'>" src/types.ts` | **1** ✓ |
| `grep -c 'convertedFromQuoteId' src/types.ts` | **1** ✓ |
| `grep -c '@deprecated Phase 16 gap closure' src/types.ts` | **1** ✓ |
| `grep -c 'export function backfillQuotesFromJobs' src/db/backfill.ts` | **1** ✓ |
| `grep -c 'db.version(8).stores' src/db/database.ts` | **1** ✓ |
| `grep -c 'EntityTable<Quote' src/db/database.ts` | **1** ✓ |
| `grep -c 'backfillQuotesFromJobs' src/db/database.ts` | **3** ✓ (import + reference docstring + call site) |
| `grep -c '^export function useQuotes' src/hooks/useDatabase.ts` | **1** ✓ |
| `grep -c 'quotesByJobId' src/hooks/useDatabase.ts` | **3** ✓ |
| `grep -c 'createQuote' src/hooks/useDatabase.ts` | **7** ✓ |
| `grep -c 'db.transaction' src/hooks/useDatabase.ts` | **1** ✓ |
| `grep -c 'RuntimeQuoteStatus' src/hooks/useDatabase.ts` | **6** ✓ |
| `grep -c 'QuotePdfParams' src/pdf/generateQuotePdf.ts` | **0** ✓ (interface deleted) |
| `grep -c 'userProfile:' src/pdf/generateQuotePdf.ts` | **0** ✓ |
| `grep -c 'Shipping' src/pdf/generateQuotePdf.ts` | **5** ✓ |
| `grep -c 'shippingCost' src/pdf/generateQuotePdf.ts` | **6** ✓ |
| `grep -c 'stopgapQuote\\|TODO(plan-16-10)' src/components/JobsManager.tsx` | **3** ✓ |
| `grep -c 'RuntimeQuoteStatus' src/components/JobsManager.tsx` | **3** ✓ |
| `npx tsc -b` | exit 0 ✓ |
| `npx vitest run src/pdf/generateQuotePdf.test.ts` | **25 passed** ✓ |
| `npx vitest run` (full suite) | **195 passed, 1 todo** (was 177 pre-plan) ✓ |
| `node scripts/assert-no-static-jspdf.mjs` | exit 0 ✓ |

## Commits

- `d1a479d`: feat(16-09): add Quote interface + QuoteStatus + RuntimeQuoteStatus types (D-17 G6)
- `2d320c3`: feat(16-09): add backfillQuotesFromJobs helper + locked D-17 G7 fixture tests
- `76063f6`: feat(16-09): Dexie v8 quotes store + useQuotes hook with createQuote action
- `646a308`: feat(16-09): refactor generateQuotePdf to (quote: Quote) + Shipping row + JobsManager stopgap
- (this SUMMARY commit)

## What downstream plans now inherit

Plan 16-10 (PrintQuoteModal): can `import { useQuotes } from '../hooks/useDatabase'` and
call `await createQuote(input)` to land a Quote + auto-create/link Customer + bump
`nextQuoteNumber` in one atomic Dexie transaction — without ever importing `db` directly.

Plan 16-11 (Recent Quotes section): `useQuotes().quotesByJobId.get(job.id)` is the
O(1) per-job lookup for the accordion; `updateQuote(quote)` handles the Mark Accepted/
Declined/Reopen status flips.

Plan 16-12 (Convert to Sale): the Quote patch in the convert transaction declares
`status: 'converted' as RuntimeQuoteStatus` so the compiler refuses 'draft' there too.

Plan 16-13 (UAT): every D-15, D-17, D-22 contract is now testable end-to-end.

## Self-Check: PASSED
