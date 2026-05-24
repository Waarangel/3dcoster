---
phase: 16-printable-pdf-quote
verified: 2026-05-23T19:00:00Z
status: gaps_found
score: 3/5 — gap-closure landed for A-H (plans 16-06..16-12); UAT surfaced 4 new Phase 16 gaps (I-L) + 2 Phase 15.1 follow-ups (M-N). Finding L is a fundamental D-19 reframe that may invalidate parts of plans 16-11/16-12.
verified_by: automated + human-uat
gaps:
  - id: A
    severity: ux
    title: Remove "Generate PDF" from CostCalculator
    resolved_by: 16-06
  - id: B
    severity: ux
    title: Rename "Generate PDF" → "Print Quote" + proper button styling in JobsManager
    resolved_by: 16-07
    note: Rename landed; STYLING NOT FIXED — see gap I (Print Quote button has no visible bg)
  - id: C
    severity: scope
    title: Add Shipping line — PDF Total must equal Subtotal + Shipping + Tax
    resolved_by: 16-09
  - id: D
    severity: scope
    title: Customer picker before quote generation (pick existing / enter new)
    resolved_by: 16-10
    note: Picker landed; SEARCH SOURCE TOO NARROW — see gap K (picker should include Sale-only customers)
  - id: E
    severity: scope
    title: Quote entity with lifecycle (draft/sent/accepted/declined/converted)
    resolved_by: 16-09
    note: Entity landed; LIFECYCLE UX REFRAME — see gap L (user wants single merged view, not parallel lists with status pills)
  - id: F
    severity: scope
    title: Quote list view + per-customer quote-vs-sale status badges
    resolved_by: 16-11
    note: Section landed; REFRAME REQUESTED — see gap L (merge into Recent Sales, drop status lifecycle)
  - id: G
    severity: scope
    title: Convert Quote → Sale action
    resolved_by: 16-12
    note: Convert flow landed; works mechanically but the "Converted" badge concept is on the chopping block per gap L
  - id: H
    severity: bug
    title: Saved job.taxRate stores override, not resolved rate — PDF drops tax row when field blank
    resolved_by: 16-08
  - id: I
    severity: ux
    title: Print Quote button has no visible background — bg-slate-700 (secondary) blends into accordion card
    found_by: human-uat 2026-05-23
    surface: src/components/JobsManager.tsx (JobCard accordion action row)
    detail: |
      Plan 16-07 set `variant="secondary"` per CONTEXT D-14. In practice
      `bg-slate-700` is identical to the accordion's `bg-slate-700/50` card
      background, so the Print Quote button reads as plain text — fails the
      same affordance test that flagged the original ghost styling. Adjacent
      buttons (Record Sale: green, Edit: blue, Delete: red-tinted) all pop.
    fix_options:
      - Add a border to the secondary variant globally
      - Use `variant="primary"` for Print Quote (blue) and bump Edit to a different style
      - Add a new neutral-with-border variant
  - id: J
    severity: ux
    title: Recent Quotes row looks clickable (hover affordance) but onClick does nothing
    found_by: human-uat 2026-05-23
    surface: src/components/JobsManager.tsx (QuoteRow inline subcomponent)
    detail: |
      The <li> has bg-slate-800 + rounded styling that reads like a clickable
      tile, but there's no onClick handler. User expects click to do
      SOMETHING — likely either regenerate the PDF or open a "view quote
      details" surface. Currently only the action buttons (Mark Accepted /
      Mark Declined / Convert to Sale) are interactive.
    fix_options:
      - Add onClick that re-generates the Quote PDF (idempotent — same Quote, no counter bump)
      - Remove the clickable affordance (no hover styling — make it visibly inert)
      - Add a small "View PDF" action button to the action row
  - id: K
    severity: ux/data
    title: PrintQuoteModal customer picker only searches db.customers (library), not Sale-only customers
    found_by: human-uat 2026-05-23
    surface: src/components/PrintQuoteModal.tsx
    detail: |
      User typed "Logan" into the picker. Logan is clearly a customer on a
      Sale row (visible in Recent Sales: "Logan and Sean / logan@fleetstreet.com /
      Fleet Street Barber"), but the picker says "No saved customers match".
      Cause: Logan is only present as a Sale.customer snapshot; he is NOT in
      the Customer Library (db.customers). Either (a) Phase 15.1's D-06
      auto-create never fired for him (pre-15.1 Sale?), or (b) the picker's
      data source is too narrow.
      
      User's mental model: "any customer I've ever interacted with should be
      findable". The current picker matches Phase 15.1's library-only design,
      but that surfaced this expectation gap.
    fix_options:
      - Picker queries union of db.customers + unique Sale.customer snapshots
      - One-time backfill: scan all Sales, auto-create library Customers for any
        whose name/email isn't already in db.customers
      - Both
  - id: L
    severity: scope/architecture (BLOCKING REFRAME)
    title: Recent Quotes should be merged into Recent Sales — drop the status lifecycle
    found_by: human-uat 2026-05-23
    surface: src/components/JobsManager.tsx (RecentQuotesSection + QuoteRow + status pills) — affects plans 16-09 (status enum), 16-11 (section + handlers), 16-12 (Convert + back-ref)
    detail: |
      Verbatim user feedback: "I'm not sure why Recent Quotes is separate
      from Recent Sales. We just need the quote associated with the sale.
      Not sure what converted is either. We need to know per customer if
      they have an active quote or not. That's it."
      
      The current architecture (D-17/D-18/D-19/D-20) treats Quotes as
      first-class entities with a 4-state lifecycle (sent/accepted/declined/
      converted) surfaced as colored pills. The user's model is much simpler:
      
      - A Sale may have an originating Quote attached
      - Per-customer summary: "has active quote? Y/N"
      - Lifecycle states (sent/accepted/declined/converted) are not meaningful
        product surface — just internal state at most
      
      Implications if accepted:
      - Recent Quotes section in JobsManager → REMOVED (or collapsed to a
        single inline indicator per Sale row)
      - Status pills (Sent/Accepted/Declined/Converted) → REMOVED
      - Mark Accepted / Mark Declined / Reopen handlers → REMOVED
      - "Converted" badge + "→ Sale on {date}" annotation → REMOVED (Sale
        row already shows the date, and the back-ref link from gap K covers
        the Quote→Sale link)
      - Convert to Sale flow → SIMPLIFIED (no status flip needed; just
        Sale.convertedFromQuoteId = quote.id on save)
      - Quote.status field → may still exist for audit purposes but isn't
        UI-surfaced beyond "active vs. consumed"
      
      Decision needed via /gsd:discuss-phase 16 — this is a CONTEXT-extension
      reframe of D-17/D-18/D-19/D-20.
    fix_options:
      - Accept reframe → discuss-phase → new plans 16-14..16-N to revert
        Recent Quotes section, simplify Convert, etc.
      - Defer reframe → keep current architecture, fix gaps I/J/K, ship as-is
      - Hybrid → drop the status pills + Recent Quotes UI; keep the Quote
        entity + status field for audit; surface only "active quote: Q-NNNN"
        inline next to relevant Sales / on the job header
  - id: M
    severity: ux (Phase 15.1 follow-up, NOT Phase 16)
    title: Customer Library "Last used: yesterday" text not vertically centered with Edit/Delete buttons
    found_by: human-uat 2026-05-23
    surface: src/components/CustomerLibrary.tsx
    detail: |
      Minor CSS issue on the Customer Library row layout — pre-existing,
      not introduced by Phase 16. Tracked here for cross-phase backlog
      visibility.
  - id: N
    severity: ux (Phase 15.1 follow-up, NOT Phase 16)
    title: Customer CSV importer missing template download (Materials importer has one)
    found_by: human-uat 2026-05-23
    surface: src/components/CustomerCsvImportModal.tsx
    detail: |
      src/components/CsvImportModal.tsx (assets/printers importer) provides
      "📦 Materials template" and "🖨️ Printers template" download buttons via
      generateSampleCsv(). CustomerCsvImportModal.tsx has no equivalent.
      Asymmetric UX — pre-existing Phase 15.1 gap. Tracked here for
      cross-phase backlog visibility.
deferred:
  - L  # blocking reframe — needs /gsd:discuss-phase before any further code
---

# Phase 16: Printable PDF Quote — Verification Report

**Phase Goal:** Users can generate a professional PDF quote from any saved job — client-side, lazy-loaded, with Unicode glyph support, region-aware tax labels, layered Notes/Terms, and a working Tauri native save dialog. Quote numbers auto-assign and persist per job.

**Automated chain run:** 2026-05-23T11:19:00Z
**Human UAT run:** 2026-05-23T15:25:00Z
**Status:** GAPS FOUND — UAT surfaced product-scope gap (D–G), two UX issues (A–B), one missing feature (C), and one pre-existing bug (H). The PDF generator itself is correct; the gap is the surrounding quote workflow.

---

## Automated Verification Chain

All commands run in agent worktree at commit `025f07a` (Phase 16 wave 3 complete).

| # | Command | Exit Code | Key Output |
|---|---------|-----------|------------|
| 1 | `npm run build` | **0** | All 7 build gates pass (lint-no-raw-html, assert-no-static-jspdf, vitest --coverage, tsc -b, vite build, assert-bundle-size, assert-no-pdf-preload). 13 test files, 181 tests passed. |
| 2 | `ls -lh dist/assets/` | 0 | `pdf-D3YXHD0a.js` (150K raw / **77.89 KB gz**); `index-D3AjJ3H_.js` (231K raw / **54.8 KB gz** — well under 300 KB gate) |
| 3 | `grep -c "^\s*'[a-z-]*': new Date(" src/features.ts` | 0 | **8** (7 prior + `pdf-quote` entry dated 2026-05-23) |
| 4 | `grep -rn "<NewBadge feature=\"pdf-quote\""` | 0 | **2 matches** — `src/components/CostCalculator.tsx:69` + `src/components/JobsManager.tsx:194` |
| 5 | `grep -rn "from 'jspdf'" src/` | 0 | **1 match** — `src/pdf/generateQuotePdf.ts:6` only (gate excludes `src/pdf/`) |
| 6 | `grep -rn "from 'jspdf-autotable'" src/` | 0 | **1 match** — `src/pdf/generateQuotePdf.ts:7` only |
| 7 | `grep -rn "await import('../pdf/generateQuotePdf')" src/` | 0 | **2 matches** — `src/components/CostCalculator.tsx:704` + `src/components/JobsManager.tsx:781` |
| 8 | `grep -rn "doc.html\|doc.autoTable" src/pdf/` | 0 | **0 matches** — no HTML injection vector, no v3 `doc.autoTable()` antipattern |
| 9 | `grep -rE "onPersistQuoteNumber\?:" src/components/` | 0 | **0 matches** — callback is REQUIRED (no `?:`) in both CostCalculator + JobsManager props |
| 10 | `vitest run` | **0** | **Test Files 13 passed (13) — Tests 181 passed (181)** — Duration 1.92s |

**Build gate chain order:** `lint-no-raw-html` → `assert-no-static-jspdf` → `vitest --coverage` → `tsc -b` → `vite build` → `assert-bundle-size` → `assert-no-pdf-preload`

---

## Static Audits

| Audit | Expected | Actual | Result |
|-------|----------|--------|--------|
| `features.ts` pdf-quote entry count | 8 entries | 8 entries | **PASS** |
| NewBadge `pdf-quote` JSX consumers | 2 (CostCalculator + JobsManager) | 2 | **PASS** |
| `from 'jspdf'` import locations | 1 (src/pdf/ only) | 1 — `generateQuotePdf.ts:6` | **PASS** |
| `from 'jspdf-autotable'` import locations | 1 (src/pdf/ only) | 1 — `generateQuotePdf.ts:7` | **PASS** |
| `await import('../pdf/generateQuotePdf')` call sites | 2 | 2 | **PASS** |
| `doc.html` antipattern count | 0 | 0 | **PASS** |
| `doc.autoTable` v3 antipattern count | 0 | 0 | **PASS** |
| `onPersistQuoteNumber?:` optional callback | 0 (must be REQUIRED) | 0 | **PASS** |

**Static audit gate: 8/8 PASS — CLEAR**

---

## Bundle Size

Build output from `npm run build` (vite build + assert-bundle-size):

| Chunk | Raw Size | Gzipped | Status |
|-------|----------|---------|--------|
| `dist/assets/index-D3AjJ3H_.js` (main) | 236.41 KB | **56.11 KB** | **PASS** (< 300 KB gate) |
| `dist/assets/pdf-D3YXHD0a.js` (lazy) | 154.01 KB | **77.89 KB** | **PASS** (lazy chunk, off main bundle) |
| `dist/assets/react-vendor-BjrgHrA8.js` | 190.94 KB | 59.94 KB | — |
| `dist/assets/vendor-D0PHvUlr.js` | 970.80 KB | 298.93 KB | — (vendor chunk, not gated) |
| `dist/assets/dexie-vendor-BqEUIn46.js` | 97.08 KB | 32.43 KB | — |

**`dist/index.html` modulepreload check:** No `modulepreload` links found — PDF chunk is purely lazy-loaded. Gate `assert-no-pdf-preload.mjs` exits 0. **PASS**

---

## Requirement Status (Final)

| Requirement | Description | Automated | UAT | Final |
|-------------|-------------|-----------|-----|-------|
| **PDF-01** | "Generate PDF" buttons exist, disabled when sellingPrice ≤ 0 | PASS | partial (button exists but wrong placement/naming — see A, B) | **partial** |
| **PDF-02** | PDF byte stream + section content correct | PASS | partial (PDF is correct but Total drops tax when job has blank tax field — see H) | **partial** |
| **PDF-03** | No static `from 'jspdf'` outside `src/pdf/` | PASS | n/a | **PASS** |
| **PDF-04** | `dist/index.html` has no `modulepreload` for pdf chunk | PASS | n/a | **PASS** |
| **PDF-05** | Main app chunk ≤ 300 KB gzipped | PASS | n/a | **PASS** |

**Score: 3/5 PASS, 2/5 partial.** The two partials are real and blocking ship; see UAT Failures.

---

## UAT Scenario Results

UAT was halted after the user identified a product-scope gap that extends beyond per-scenario verification. Per-scenario detail below is partial; the dominant signal is the gap list, not the scenario walkthrough.

| # | Scenario | Result | Notes |
|---|----------|--------|-------|
| 1 | Web PDF — no customer, no tax (CostCalculator) | n/a | Scenario obsoleted by gap A (Generate PDF should not exist on CostCalculator) |
| 2 | Web PDF — customer + EU tax + Notes/Terms (JobsManager) | n/a | Did not reach — UAT halted by gap H discovery |
| 3 | Web PDF — terms only, no notes | n/a | Did not reach |
| 4 | Web PDF — neither notes nor terms | n/a | Did not reach |
| 5 | Tauri desktop PDF + native save dialog | n/a | Did not reach |
| 6 | NewBadge non-regression | n/a | Did not reach |
| 7 | Quote number lifecycle | n/a | Did not reach |

The user's UAT pivoted from per-scenario PASS/FAIL to a product-design walkthrough of the quote flow — see UAT Failures.

---

## UAT Failures (Gap List)

The user's verbatim UAT findings, decomposed into 8 actionable gaps. Items A–B are quick UX fixes; C is a missing feature; D–G are a scope expansion (quote lifecycle); H is a pre-existing bug that Phase 16 surfaced.

### A. Remove "Generate PDF" from CostCalculator

**User report:** *"Generate PDF should not be on the Cost Calculator section since you can only create a quote from a saved job."*

**Why:** CostCalculator runs pre-save and pre-customer. A quote needs (at minimum) a saved job; in the extended scope (D–G) it also needs a chosen customer. The CostCalculator surface has no Sale context, so the button can only ever produce a customer-less PDF — which is exactly the v1.2 limitation that confused the UAT tester.

**Fix:** Delete the `GeneratePdfButton` from `src/components/CostCalculator.tsx` and its dynamic-import block. The single remaining `GeneratePdfButton` call site is in JobsManager.

**Files to touch:** `src/components/CostCalculator.tsx`, `src/components/CostCalculator.test.tsx` (remove the 4 GeneratePdfButton tests), `vite.config.ts` (`await import('../pdf/generateQuotePdf')` call-site count drops from 2 → 1; update audit expectations in any CI script if pinned).

**Severity:** UX. Blocking — keeps users out of the wrong flow.

---

### B. Rename "Generate PDF" → "Print Quote" + proper button styling

**User report:** *"On the My Jobs screen, the Generate PDF doesn't look like a button and should say 'Print Quote'."*

**Why:** The current button uses ghost styling and reads as a text link. "Print Quote" matches user mental model (this is a quote workflow, not a generic PDF export). Wording also unblocks B+E: once the button says "Print Quote", a "Quote" list/status surface (gap F) is the natural follow-on.

**Fix:** In `JobsManager.tsx` Generate PDF button — change label to "Print Quote" and use the standard secondary button variant (`<Button btnSize="…" variant="secondary">…</Button>` per project shared-UI conventions in `src/components/ui/Button.tsx`). Carry the NewBadge overlay through unchanged.

**Files to touch:** `src/components/JobsManager.tsx`, `src/components/CostCalculator.test.tsx` (drop in favor of a JobsManager.test.tsx integration test if not present).

**Severity:** UX. Blocking — current styling fails the affordance test.

---

### C. Add Shipping line — PDF Total must equal Subtotal + Shipping + Tax

**User report:** *"A quote should include tax and shipping. The user wants total cost, not just subtotal."*

**Tax baseline (already correct):** When a job has `taxRate > 0`, the PDF already shows a tax row between Subtotal and Total, and Total = Subtotal + Tax. This is implemented in `src/pdf/generateQuotePdf.ts:183-205`. See gap H for a related defect where the saved `job.taxRate` field can be empty even when the user has a default rate set.

**Why:** Shipping is a real cost. A quote without shipping understates what the customer will actually pay. The "total cost" anchor in the user's report makes this explicit: customers need to see the all-in number, not a misleading subtotal.

**Fix (data + PDF + UI):**
1. Add `shippingCost?: number` to `PrintJob` in `src/types.ts`.
2. Add a Shipping input to CostCalculator (or, post-gap-A, to the quote-creation surface introduced by gap D).
3. PDF generator: insert a "Shipping" row between Subtotal and Tax when `shippingCost > 0`, and update `total = subtotal + shipping + tax`. Update the 21 integration tests in `generateQuotePdf.test.ts` to cover: shipping-only, shipping-with-tax, no-shipping. Add at least one assertion that Total = Subtotal + Shipping + Tax.
4. CONTEXT.md D-07 currently only describes tax row hide/show. Extend it to D-07a (tax) + D-07b (shipping).

**Severity:** Missing feature. Blocking — current quote misrepresents cost to customer.

**Open question for discuss-phase:** Is shipping a per-job field (saved on PrintJob, like taxRate) or a per-quote field (entered at the moment of quote generation, like terms)? The latter is more flexible (different shipping for different customers/destinations) but ties into gap D (customer picker → maybe also shipping picker).

---

### D. Customer picker before quote generation (pick existing / enter new)

**User report:** *"When I click Generate PDF it automatically downloaded for the most recent customer. How do I generate a quote for a new customer?"*

**Why:** Today the JobsManager Print Quote path silently uses the most-recent sale's customer (`src/components/JobsManager.tsx` quote-handler block). That's a v1.2 stopgap, not a design. Quotes happen BEFORE a sale exists — a quote is sent to a *prospective* customer who, by definition, has not bought anything yet. So the most-recent-sale fallback is exactly the wrong default.

**Fix (new UX surface):**
1. Replace silent customer auto-selection with a modal (or inline section) presented when "Print Quote" is clicked.
2. Picker shows: (a) `[+ New customer]` action that opens an inline form (Name required; Email/Company/Address optional), (b) a list of existing customers attached to *any* prior sale or quote (deduplicated by email/name), (c) a "no customer" option that produces a customer-less PDF (preserves the v1.2 CostCalculator-style use case if anyone still wants it).
3. After picker → quote is generated with the selected customer in the Bill To block.
4. The picker should also feed the quote-entity write in gap E (so the quote carries a customer ref, not just a name string).

**Severity:** Scope expansion. Blocking — current behavior is wrong-by-default for the primary quote-to-prospect use case.

**Open question for discuss-phase:** Does the customer picker auto-save new customers to a `Customer` table, or just inline the name/email on the Quote and let dedup happen later? Today there is no standalone `Customer` table — customer fields live on `Sale` records (see `src/types.ts`). Standing this up properly (a Customer entity referenced from Sale, Quote, and any future surface) is itself a meaningful schema decision.

---

### E. Quote entity with lifecycle (draft / sent / accepted / declined / converted)

**User report:** *"There is also no way currently to tell which customers for a product have quotes and which are sales."*

**Why:** A quote is not a sale. It is a pre-sale artifact that may or may not become a sale. Today the data model has only `PrintJob` and `Sale` — there is no representation of "I sent a quote to this customer for $X, awaiting their decision." Without a Quote entity:
- Cannot list outstanding quotes
- Cannot mark a quote as accepted/declined
- Cannot distinguish "this customer received a quote" from "this customer bought" (gap F depends on this)
- Cannot convert a quote into a sale (gap G depends on this)
- Cannot snapshot quote line items at quote-send time (the PrintJob price could change after the quote was sent, but the quote PDF the customer holds is immutable — we need to track what was on it)

**Fix (schema + flows):**
1. Add a `Quote` table to the Dexie schema. Fields: `id`, `quoteNumber` (Q-NNNN, migrated from PrintJob.quoteNumber), `printJobId` (FK to PrintJob), `customerId` (FK if customer entity exists per gap D's open question — else inline `customerName`, `customerEmail`, etc.), `status: 'draft' | 'sent' | 'accepted' | 'declined' | 'converted'`, `lineItemsSnapshot` (the data the PDF was generated from — sellingPrice, taxRate, shippingCost, notes, terms at quote-send time), `convertedToSaleId?` (FK to Sale on conversion), `createdAt`, `sentAt?`, `decisionAt?`, `convertedAt?`.
2. Migration: existing PrintJob.quoteNumber field becomes a one-time backfill into a Quote row with status='converted' (for any job that has a sale) or status='draft' (for any job that has a quoteNumber but no sale).
3. Quote creation: gap D's customer picker writes a new Quote row alongside generating the PDF.
4. Quote status transitions: `draft → sent` (when PDF is generated, default), `sent → accepted/declined` (user action in gap F's quote list view), `accepted → converted` (user action in gap G).

**Severity:** Scope expansion. Blocking — D, F, G are unimplementable without this.

**Open question for discuss-phase:** Does the Quote table own its own line items, or reference PrintJob and snapshot only the moment-in-time price? The latter is simpler (one source of truth for the print details) but means the PDF must read both Quote AND PrintJob — and we must guard against PrintJob deletion. The former is more rigorous but doubles the data model. Recommended: snapshot only the priced fields (sellingPrice, taxRate, shippingCost, notes, terms) into `lineItemsSnapshot` — the human-readable "print name" and "filament weight" can be read fresh from PrintJob with a fallback to the snapshot if the job is gone.

---

### F. Quote list view + per-customer quote-vs-sale status badges

**User report:** *"There is also no way currently to tell which customers for a product have quotes and which are sales."*

**Why:** Once gap E exists, the user needs surfaces to *see* outstanding quotes. Today the JobsManager accordion shows Recent Sales; it does not show Recent Quotes. From a workflow standpoint: the user needs to know which prospective customers they're waiting on (status='sent'), which ones declined (status='declined' — might be worth re-engaging), and which are ready to convert (status='accepted').

**Fix (UI):**
1. Extend the JobsManager accordion with a "Recent Quotes" section parallel to "Recent Sales", showing quoteNumber, customer name, send date, status badge.
2. Add a status badge on the customer line within Recent Sales / Recent Quotes — e.g., "1x @ $60.00 (Marcus) [✓ Sale]" vs "Q-0042 (François Müller) [📤 Sent]" / "[✓ Accepted]" / "[✗ Declined]".
3. Optionally: a top-level "Quotes" tab in JobsManager that lists outstanding quotes across all jobs, sortable by send date / status / customer. (Decide in discuss-phase whether v1.2 includes this top-level view or just the per-job section.)

**Severity:** Scope expansion. UX-critical once E ships.

**Open question for discuss-phase:** Is the per-job Recent Quotes section sufficient for v1.2, or do we also want the top-level "Quotes" tab? The latter is materially more work (new route, new filtering, possibly pagination).

---

### G. Convert Quote → Sale action

**User report:** *"How do we convert a quote into a sale?"*

**Why:** This is the natural workflow: customer accepts the quote → user clicks a button → a Sale is created from the quote, the quote is marked `status: converted` and gets `convertedToSaleId`. Without this, the user has to manually duplicate the quote details into the existing Record Sale form, and the link between the quote and the resulting sale is lost.

**Fix (UI + data):**
1. On a quote with `status: accepted` (set by user via gap F's quote list), expose a "Convert to Sale" button.
2. On click: open the existing Record Sale modal pre-populated from the Quote snapshot (sellingPrice, customer, quantity, taxRate, shippingCost). User can adjust if reality differs from the quote (e.g., they ended up giving a small discount).
3. On Sale save: write the Sale as today, AND mark the quote `status: converted`, `convertedToSaleId: <new sale id>`, `convertedAt: now`. The Sale optionally gets a `convertedFromQuoteId` back-reference for audit.
4. After conversion, the JobsManager job card surfaces both the Sale (in Recent Sales) and the original Quote (in Recent Quotes, marked converted) — full audit trail.

**Severity:** Scope expansion. Blocking — without this, the quote workflow is open-loop.

**Open question for discuss-phase:** Does conversion require the user to re-confirm the customer + line items, or does it just create the Sale silently from the Quote snapshot? Silent is faster but loses an opportunity to catch quote drift (e.g., the customer agreed to a different price). Recommended: open the Record Sale modal pre-populated, so user can confirm or adjust in one step.

---

### H. Saved `job.taxRate` stores override, not resolved rate — PDF drops tax row when field is blank

**User report:** *"It looks like the quote isn't inheriting the default tax rate when the field is left blank."*

**Root cause:** In `src/components/CostCalculator.tsx`:

```ts
// Live preview correctly resolves through the fallback chain:
const tax = useMemo(() => resolveTaxRate({
  jobOverride: taxRateOverride,
  settingsDefault: userProfile.defaultTaxRate,
  currency: userCurrency,
  address: userProfile.address,
}), [taxRateOverride, userProfile.defaultTaxRate, userCurrency, userProfile.address]);
// → tax.ratePercent = 13 (resolved from userProfile.defaultTaxRate)
// → tax.taxAmount   = correct (computed from 13%)

// But the save block stores the raw override, not the resolved rate:
db.jobs.put({
  ...
  taxRate: taxRateOverride,   // ← BUG: undefined when field is blank
  taxAmount: tax.taxAmount,   // ← computed from 13%, so correct
})
```

In `src/pdf/generateQuotePdf.ts:183-185`:

```ts
const taxRate   = job.taxRate;        // undefined for blank-field jobs
const taxAmount = job.taxAmount;      // correct value (e.g., $X)
const showTax   = !!(taxRate && taxRate > 0 && taxAmount && taxAmount > 0);
//                       ^^^^^^^^^^^^^^^^^^^^
//                       fails — taxRate is undefined → showTax = false → no tax row
```

**Effect:** A user with `userProfile.defaultTaxRate = 13` who creates a job and leaves the tax field blank gets a PDF that shows no tax row at all and Total = Subtotal only. The customer is undercharged. This silently undermines every quote sent through the blank-field path.

**Why Phase 16 surfaced it:** CostCalculator's live preview always re-resolves from `userProfile.defaultTaxRate`, so the bug was invisible in the UI. The PDF generator is the first consumer that reads `job.taxRate` from the saved record — it's the canary that exposed the saved-state inconsistency.

**Fix (cleanest):** Save the resolved rate, not the override.

```diff
- taxRate: taxRateOverride,
+ taxRate: tax.ratePercent,
```

at `src/components/CostCalculator.tsx:634` and `:670`. Override semantics stay in form state (`taxRateOverride`), but the saved record reflects what was actually applied — mirroring how `taxAmount` already works.

**Tests:**
- New regression test: job saved with `taxRateOverride = undefined` + `userProfile.defaultTaxRate = 13` → saved `job.taxRate === 13`, `job.taxAmount > 0` (already passes), PDF must show "Tax (13%): $X.XX" row.
- New regression test: PDF generated for such a job has `Total === Subtotal + TaxAmount`, not `Subtotal` alone.

**Audit Phase 13 sales records:** The Sale model likely has the same defect (`sale.taxRate = override` vs `sale.taxRate = resolvedRate`). Sales invoice PDFs (if/when they're added) would hit the same bug. Worth a quick search during the extended phase: `grep -n "taxRate: taxRateOverride" src/` outside CostCalculator.

**Severity:** Pre-existing bug. Blocking — quotes generated through the blank-field path silently undercharge customers. Not a Phase 16 regression (the data model predates Phase 16) but Phase 16 is the right place to fix it because Phase 16 introduced the first consumer that reads `job.taxRate` from saved state.

---

## Recommended Next Step

The gap list spans (1) two pure UX fixes (A, B), (2) one missing feature (C — shipping), (3) a scope expansion adding a Quote lifecycle (D, E, F, G), and (4) one pre-existing schema bug (H). Items D–G change the data model meaningfully — they need a real `discuss-phase` round, not just `--gaps` planning, to lock down the open questions on (i) Customer entity vs inline strings (gap D), (ii) Quote snapshot vs reference semantics (gap E), (iii) per-job Recent Quotes vs top-level Quotes tab (gap F), and (iv) silent vs confirmed conversion (gap G).

Run **`/gsd-discuss-phase 16`** next. It will read this VERIFICATION.md, surface the open questions above, lock decisions into a revised `16-CONTEXT.md`, and only then route to `/gsd-plan-phase 16 --gaps`.

If the user later decides any of D–G are too big for Phase 16 (e.g., the Quote lifecycle ships in v1.3), the discuss-phase round is the right place to triage. Phase 16 could plausibly ship with just A, B, C, H — leaving D–G as a v1.3 milestone — IF the user is willing to accept that quotes use the "most-recent customer" fallback in the interim. The user's UAT verdict was that this is unacceptable; defaulting to the full extension is the safer read.

---

*Automated chain run: 2026-05-23T11:19:00Z by gsd-executor (Plan 16-05 Task 1)*
*Human UAT run: 2026-05-23T15:25:00Z by user (UAT halted at scope-gap discovery)*
*Phase: 16-printable-pdf-quote*
