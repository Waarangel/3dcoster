---
phase: 16-printable-pdf-quote
plan: "11"
status: complete
gap_closure: true
gap_ids: [F]
decisions: [D-19]
executed: 2026-05-23T14:20:00Z
executed_by: orchestrator-inline
key-files:
  created:
    - src/components/JobsManager.test.tsx
  modified:
    - src/components/JobsManager.tsx
---

# 16-11 SUMMARY — Recent Quotes section + status pills + back-ref link

## Goal achieved

Gap F closed. The user can now SEE quote lifecycle states from the same
screen where they manage jobs and sales. Each expanded job accordion grows
a Recent Quotes section (above Recent Sales) that lists per-job quotes
with status pills (Sent / Accepted / Declined / Converted), one-click status
transitions (Mark Accepted / Mark Declined / Reopen), and a back-reference
link on Sale rows that scrolls to the originating Quote row.

## What changed

### `src/components/JobsManager.tsx` — three inline subcomponents added

**QuoteStatusPill** — small color-mapped status pill:
| Status | Pill |
|--------|------|
| `sent` | gray (`bg-slate-700 text-slate-300`) |
| `accepted` | green (`bg-emerald-700/30 text-emerald-300`) |
| `declined` | red (`bg-red-700/30 text-red-300`) |
| `converted` | blue (`bg-blue-700/30 text-blue-300`) |
| `draft` | amber (unreachable in runtime — defensive map for type-exhaustiveness) |

**RecentQuotesSection** (`exported` for test access) — per-job section:
- Calls `useQuotes()` itself. Dexie's `useLiveQuery` dedupes the underlying
  emitter so multiple expanded JobCards share the same liveQuery observer —
  the hook call inside each subcomponent doesn't cost an extra subscription
  to Dexie.
- Filters out `status === 'draft'` rows (G6 lock — legacy migration-only).
- Returns `null` entirely when the visible-quote count is zero (D-19: no
  "No quotes yet" empty-state noise).
- Renders quotes sorted by `sentAt` desc.
- Wraps content in `<section>` with an `aria-labelledby` heading.
- Stops click propagation so accordion-row click handlers don't fight.

**QuoteRow** (inline, takes a Quote) — single-row layout:
- Bold top line: `Q-NNNN · {customerSnapshot.name || customerSnapshot.email || 'No customer'}`
- Muted second line: `{formatRelativeDate(sentAt)} · {formatCurrency(total, currency)}`
  where `total = sellingPrice + shippingCost + taxAmount` from the snapshot,
  currency from `quote.lineItemsSnapshot.currency` (no prop chain extension
  required — snapshot carries currency per D-17 G4)
- Status pill (right side)
- Action buttons by status:
  - `sent` → `[Mark Accepted]` + `[Mark Declined]`
  - `accepted` → `[Convert to Sale]` (**DISABLED** with title="Convert to Sale lands in plan 16-12") + `[Mark Declined]`
  - `declined` → `[Reopen]`
  - `converted` → no buttons; renders `→ Sale on {formatRelativeDate(convertedAt)}` instead
- Has `id="quote-row-{quote.id}"` for the back-ref scroll target
- Mobile-first: `flex-col sm:flex-row` so the pill + buttons stack below the
  date line at narrow widths

**Status transition handlers** (inline closures inside RecentQuotesSection):
- Mark Accepted → `updateQuote({ ..., status: 'accepted', decisionAt: new Date() })`
- Mark Declined → `updateQuote({ ..., status: 'declined', decisionAt: new Date() })`
- Reopen → `updateQuote({ ..., status: 'sent', decisionAt: undefined })`

Single Dexie row update per click; useLiveQuery re-renders the section
automatically. No optimistic UI, no local state.

**SaleBackRefLink** (`exported` for test access) — tiny back-ref link:
- Looks up the linked Quote via `useQuotes().quotesByJobId.get(jobId)?.find(...)`
- On anomaly (Quote deleted, linkedQuote undefined): returns `null` —
  per CLAUDE.md "act like a senior developer", don't render a broken link
- Otherwise renders `← Q-NNNN` blue link that calls
  `scrollIntoView({ behavior: 'smooth', block: 'center' })` on the matching
  `quote-row-{id}` element
- Uses the `// allow-raw-html: inline back-ref link, not a CTA` exemption
  per 15.1-04 precedent (Button primitive's `min-h-[44px]` would dwarf the
  Sale row)

**Integration into JobCard**:
- `<RecentQuotesSection jobId={job.id} />` inserted immediately above the
  existing Recent Sales block in the expanded view
- Inside each Recent Sales row's `<summary>`, conditionally render
  `<SaleBackRefLink convertedFromQuoteId={...} jobId={...} />` next to the
  customer name when `sale.convertedFromQuoteId` is set

### `src/components/JobsManager.test.tsx` — 9 tests

| # | Test | Asserts |
|---|------|---------|
| 1 | Zero quotes → section hidden | No "Recent Quotes" heading in DOM |
| 2 | Only 'draft' quote → section hidden | G6 lock — draft is migration-only |
| 3 | 4 statuses → all 4 pill labels present | Sent/Accepted/Declined/Converted |
| 4 | Mark Accepted click | updateQuote payload status='accepted' + decisionAt: Date |
| 5 | Mark Declined click | updateQuote payload status='declined' + decisionAt: Date |
| 6 | Reopen click on declined | status='sent' + decisionAt: undefined |
| 7 | Convert to Sale on accepted | button rendered + disabled=true (plan 16-12 wires) |
| 8 | Back-ref link present when Quote exists | renders `← Q-0007` |
| 9 | Back-ref data anomaly | renders nothing, no `<button>` |

Test infrastructure: `createRoot + act + DOM events` (project has no
`@testing-library/react`). Mocks for `useQuotes`, `useCustomers`, `useSales`
wired via `vi.mock('../hooks/useDatabase', ...)` so each test controls the
`quotesFixture` array directly.

## Acceptance criteria — all ✓

| Check | Result |
|-------|--------|
| `grep -c "Recent Quotes" src/components/JobsManager.tsx` | **2** ✓ (heading + ARIA label id) |
| `grep -c "QuoteStatusPill" src/components/JobsManager.tsx` | **3** ✓ |
| `grep -c "quotesByJobId" src/components/JobsManager.tsx` | **4** ✓ |
| `grep -c "Mark Accepted" src/components/JobsManager.tsx` | **2** ✓ |
| `grep -c "Mark Declined" src/components/JobsManager.tsx` | **3** ✓ |
| `grep -c "Convert to Sale" src/components/JobsManager.tsx` | **2** ✓ (button label + title hint) |
| `grep -c "scrollIntoView" src/components/JobsManager.tsx` | **1** ✓ |
| `grep -c "convertedFromQuoteId" src/components/JobsManager.tsx` | **5** ✓ |
| `grep -c "formatQuoteNumber" src/components/JobsManager.tsx` | **≥1** ✓ |
| JobsManager.test.tsx exists with `≥9` `it(...)` | **9** ✓ |
| `npx tsc -b` | exit 0 ✓ |
| `npx vitest run` (full suite) | **213 passed, 1 todo** (was 204 pre-plan) ✓ |
| `node scripts/lint-no-raw-html.mjs` | exit 0 ✓ |
| `node scripts/assert-no-static-jspdf.mjs` | exit 0 ✓ |

## Architectural notes

1. **Subcomponents inline (vs sibling file)**: opted to keep `QuoteStatusPill`,
   `RecentQuotesSection`, `QuoteRow`, and `SaleBackRefLink` inline in
   JobsManager.tsx rather than extract to `src/components/RecentQuotesSection.tsx`.
   Rationale: they only consume JobsManager-local data flows; extraction
   would require exporting + importing without buying decoupling.
   Surfaced as a potential future refactor when the file size warrants it.

2. **useQuotes called in subcomponents**: each `RecentQuotesSection` /
   `SaleBackRefLink` mount calls `useQuotes()` itself rather than receiving
   quotes via props. This keeps JobCard's prop chain unchanged (5+ sites
   that would otherwise need updating) and Dexie's `useLiveQuery` dedupes
   the underlying emitter so multiple expanded JobCards share the same
   subscription cost.

3. **Currency from snapshot (D-17 G4)**: each QuoteRow reads currency from
   `quote.lineItemsSnapshot.currency` rather than via a userProfile prop.
   This honors the strict by-value snapshot rule — the displayed currency
   is the one captured when Generate Quote fired, not the user's current
   setting (which may have changed in the interim).

4. **Convert to Sale wired in plan 16-12**: the button renders with
   `disabled={true}` and a tooltip explaining the next plan. Per CLAUDE.md
   "act like a senior developer", don't pretend the action works when it
   doesn't — disable it explicitly and surface the reason.

## Commits

- `4b5f6d8`: feat(16-11): Recent Quotes section + status transitions + Sale back-ref link (D-19)
- `a3f6b5e`: test(16-11): 9 tests for Recent Quotes section + status transitions + back-ref
- (this SUMMARY commit)

## Self-Check: PASSED
