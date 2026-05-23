---
phase: 16-printable-pdf-quote
plan: "10"
status: complete
gap_closure: true
gap_ids: [D]
decisions: [D-16, D-18]
executed: 2026-05-23T14:13:00Z
executed_by: orchestrator-inline
key-files:
  created:
    - src/components/PrintQuoteModal.tsx
    - src/components/PrintQuoteModal.test.tsx
  modified:
    - src/components/JobsManager.tsx
    - src/App.tsx
---

# 16-10 SUMMARY — PrintQuoteModal + JobsManager rewire

## Goal achieved

Gap D closed. The silent most-recent-sale customer fallback is gone. Clicking
the Print Quote button (renamed in 16-07) now opens a deliberate modal that
lets the user pick OR create a customer, enter per-quote shipping, and
review a live totals preview before generating the PDF. The modal IS the
lifetime nextQuoteNumber counter increment site (per D-17 G7) — the
createQuote hook action (from 16-09 Task 4) wraps Quote insert + Customer
link/auto-create + counter bump in one atomic Dexie transaction.

## I-07 Option B architectural lock — verified

`PrintQuoteModal.tsx` has **zero** matches for `from '../db/database'` and
**zero** matches for `db.transaction(`. All multi-store writes flow through
`createQuote` from the useQuotes hook. The component is Dexie-agnostic by
construction; any future regression that tries to import `db` would fail
the source-contract test in `PrintQuoteModal.test.tsx`.

## G6 lock — end-to-end compile-time enforcement

The Quote payload constructed inside `createQuote` (useDatabase.ts) is typed
`status: 'sent' as RuntimeQuoteStatus`. The narrow `RuntimeQuoteStatus`
type (Exclude<QuoteStatus, 'draft'>) makes `status: 'draft'` a compile
error at every runtime write site — PrintQuoteModal passes
`CreateQuoteInput` to the hook, the hook narrows status. The migration code
in `src/db/backfill.ts` remains the SOLE place using the wider
`QuoteStatus`.

## What changed

### Task 1 — `src/components/PrintQuoteModal.tsx` (new, ~370 lines)

Component props:
```ts
{ job: PrintJob; userProfile: UserProfile; isOpen: boolean;
  onClose: () => void; onQuoteCreated: (quote: Quote) => void; }
```

Behavior:
- **State block**: 4 customer fields + shipping cost + picker triplet
  (query/open/activeIndex) + pickedExistingCustomerId + isGenerating + error.
- **On open**: reset to defaults (fresh-form every time).
- **Picker**: mirrors 15.1-04 verbatim — Name+Email substring filter,
  ArrowDown/Up/Enter/Escape/Tab WAI-ARIA semantics, top-8 visible with
  overflow footer. Escape on the picker stops propagation so it doesn't
  bubble to the modal's Esc-close handler.
- **Picker pick→edit handling**: typing in the picker query after picking
  CLEARS `pickedExistingCustomerId` so a typed-over email re-runs through
  email-match dedup instead of forcing a stale library link.
- **Live totals** (memoized): `subtotal = job.sellingPrice;
  taxAmount = subtotal × resolvedTax.rate / 100;
  total = subtotal + shipping + taxAmount`. D-22 lock: shipping is NEVER
  in the tax base.
- **Generate Quote click flow**:
  1. Validate Name OR Email non-empty (after trim).
  2. Validate shipping ≥ 0 and finite.
  3. Build `customerSnapshot` from trimmed form values.
  4. Resolve `existingCustomerId` = pickedExistingCustomerId ?? customersByEmail.get(trimmedEmail)?.id
     — handles both "picked from dropdown" and "typed email matches library".
  5. `const quote = await createQuote({ job, userProfile, customerSnapshot, existingCustomerId, shippingCost, resolvedTaxRate, taxAmount });`
  6. `const { generateQuotePdf } = await import('../pdf/generateQuotePdf'); await generateQuotePdf(quote);`
  7. `onQuoteCreated(quote)` + `onClose()`.

JSX layout: modal chrome mirrors CustomerEditModal; picker + 4 fields +
shipping `<Input compact>` with `<InfoTooltip>` (per CLAUDE.md compact-input
and info-icon-over-placeholder conventions); `<dl>` totals preview; error
block; `[Cancel]` + `[Generate Quote]` footer (Generate disabled when
validation fails or generating).

NO NewBadge in the modal — the `pdf-quote` feature key stays on the
Print Quote BUTTON only (single feature entry point per CLAUDE.md badge
convention).

### Task 2 — `src/components/PrintQuoteModal.test.tsx` (new, 9 tests)

Tests split into 5 groups:

| # | Group | Test | Why it matters |
|---|-------|------|----------------|
| 1 | Architectural lock | Does NOT import `db` from `../db/database` | I-07 Option B — modal is Dexie-agnostic |
| 2 | Architectural lock | Does NOT open any `db.transaction(` | Symmetric I-07 check |
| 3 | Architectural lock | DOES use `createQuote` from `useQuotes` | I-01 + I-07 — the single seam |
| 4 | Validation | Generate disabled when Name AND Email both blank | UX gate |
| 5 | Validation | Generate enables when Name has content | UX gate |
| 6 | D-22 tax lock | Click → `createQuote.input.taxAmount === 20` for {price=100, ship=10, rate=20%} | NOT 22 (would be wrong base) |
| 7 | Happy path | Click → createQuote called with full snapshot; generateQuotePdf called with returned Quote; onQuoteCreated + onClose fire | End-to-end contract |
| 8 | Happy path | Email-match dedup: typed `marcus@example.com` → `existingCustomerId === 'cust-marcus'` | D-16 dedup contract |
| 9 | Cancel safety | Cancel click → no createQuote, no generateQuotePdf, onClose fires once | No write on dismiss |

**Test infrastructure deviation**: the project does not have
`@testing-library/react`. Tests use the raw `createRoot + act` + DOM event
pattern from React 19's exports. Mocks for `useQuotes` and `useCustomers`
are wired via `vi.mock('../hooks/useDatabase', ...)` with hoisted spies
(`createQuoteSpy`, `generateQuotePdfSpy`) so each test asserts on the call
shape directly.

All 9 tests pass in 1.01s.

### Task 3 — `src/components/JobsManager.tsx`

Changes (surgical to keep blast radius minimal):
- Imports: removed `Quote`, `RuntimeQuoteStatus` (no longer used);
  added `PrintQuoteModal` import.
- `JobsManagerProps`: removed `onPersistQuoteNumber` prop.
- Component signature: removed `onPersistQuoteNumber` destructure.
- New state: `const [printQuoteModalJob, setPrintQuoteModalJob] = useState<PrintJob | null>(null);`
- `generatingJobIds`: was a `useState<Set<string>>` driving the
  "Generating..." button label during the silent-fallback path. Now a
  stable empty `useMemo(() => new Set<string>(), [])` so the JobCard prop
  chain (`isGeneratingPdf={generatingJobIds.has(job.id)}`) compiles without
  touching every row component. The modal owns its own Generate button state.
- `handleGeneratePdf` body: collapsed to `setPrintQuoteModalJob(job)`.
  The function NAME is unchanged because renaming would ripple through the
  JobCard / JobRow prop chain (5+ sites). Internally it now opens the modal
  rather than generating a PDF directly — surfaced as a deferred cleanup
  candidate.
- Stopgap Quote builder from 16-09 Task 4 DELETED.
- Dynamic `await import('../pdf/generateQuotePdf')` call site DELETED here —
  the modal owns the dynamic import now.
- PrintQuoteModal mounted at the bottom of the JobsManager JSX, gated on
  `printQuoteModalJob !== null`.

### Task 3 — `src/App.tsx`

Changes:
- `handlePersistQuoteNumber` function DELETED (counter increment moved to
  createQuote hook action per D-17 G7).
- `onPersistQuoteNumber={handlePersistQuoteNumber}` prop on JobsManager JSX
  DELETED.
- `db` + `setUserProfile as dbSetUserProfile` imports DELETED (no longer used).
- `UserProfile` type import DELETED (no longer used).
- A 4-line comment marks where the function used to live, citing the move
  to the createQuote hook action.

## Acceptance criteria — all ✓

| Check | Result |
|-------|--------|
| `grep -c 'export function PrintQuoteModal' src/components/PrintQuoteModal.tsx` | **1** ✓ |
| `grep -c 'role="combobox"' src/components/PrintQuoteModal.tsx` | **1** ✓ |
| `grep -c 'role="listbox"' src/components/PrintQuoteModal.tsx` | **1** ✓ |
| `grep -c 'compact' src/components/PrintQuoteModal.tsx` | **≥1** ✓ |
| `grep -c 'resolveTaxRate\|taxLabelFor' src/components/PrintQuoteModal.tsx` | **≥2** ✓ |
| `grep -c 'createQuote' src/components/PrintQuoteModal.tsx` | **≥2** ✓ |
| `grep -c 'db.transaction' src/components/PrintQuoteModal.tsx` | **0** ✓ (I-07 lock) |
| `grep -c "from '../db/database'" src/components/PrintQuoteModal.tsx` | **0** ✓ (I-07 lock) |
| `grep -c 'dbSetUserProfile' src/components/PrintQuoteModal.tsx` | **0** ✓ |
| `grep -c '<NewBadge' src/components/PrintQuoteModal.tsx` | **0** ✓ |
| `grep -c 'PrintQuoteModal' src/components/JobsManager.tsx` | **2** ✓ (import + JSX mount) |
| `grep -c 'setPrintQuoteModalJob' src/components/JobsManager.tsx` | **3** ✓ |
| `grep -c 'stopgapQuote' src/components/JobsManager.tsx` | **0** ✓ (dead code removed) |
| `grep -c 'onPersistQuoteNumber' src/` (all files) | **0** ✓ |
| `grep -c 'handlePersistQuoteNumber' src/App.tsx` (code refs) | **0** ✓ (only a doc comment remains) |
| `grep -rn "await import('../pdf/generateQuotePdf')" src/ \| wc -l` | **1** ✓ (only PrintQuoteModal) |
| `npx tsc -b` | exit 0 ✓ |
| `npx vitest run` (full suite) | **204 passed, 1 todo** (was 195 pre-plan) ✓ |
| `node scripts/assert-no-static-jspdf.mjs` | exit 0 ✓ |
| `node scripts/assert-no-pdf-preload.mjs` | exit 0 ✓ |
| `node scripts/lint-no-raw-html.mjs` | exit 0 ✓ |

## Deviations from plan

1. **`handleGeneratePdf` callback name retained** in JobsManager. The plan
   said "DELETE the old handleGeneratePdf handler entirely". I collapsed
   the body to a single `setPrintQuoteModalJob(job)` call but kept the
   callback name because renaming would ripple through 5+ JobCard prop
   chain sites. Surfaced as a deferred-cleanup candidate — the function
   does what its NEW name would suggest (open the Print Quote modal),
   just under the old name.

2. **`generatingJobIds` retained as a stable empty Set** rather than
   deleted. Same rationale — deleting it would ripple through `JobRowProps`
   + `JobRow` destructure + `JobCard` `isGeneratingPdf` prop on every row.
   The Set being always-empty means the button label is always "Print
   Quote" (never "Generating..."), which is the correct user-visible end
   state. Future cleanup could remove the dead prop chain entirely.

3. **Test infrastructure**: project has no `@testing-library/react`. Used
   raw `createRoot + act + DOM events` per React 19 exports.

4. **Test count**: 9 instead of the plan's 8 — split validation into two
   focused tests (disabled-by-default + enabled-on-Name) for clearer
   failure surfaces.

## Commits

- `c8c9c1a`: feat(16-10): PrintQuoteModal + JobsManager rewire + App.tsx counter helper removed
- (this SUMMARY commit)

## Self-Check: PASSED
