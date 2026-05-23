# Phase 16: Printable PDF Quote - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-22
**Phase:** 16-printable-pdf-quote
**Areas discussed:** Visual style + layout, Quote number format + Tax label, Notes/Terms section source, Font + filename + Generate-PDF placement

---

## Visual style + layout

### Q1.1 — Overall aesthetic

| Option | Description | Selected |
|--------|-------------|----------|
| Print-shop minimal (B&W, structured) | Pure black-on-white. Ruled lines, bold section headings, no accent colors. Closest to Stripe/QuickBooks. Prints fine on B&W lasers. No design risk. | ✓ |
| Subtle 3DCoster accent | Black-on-white + thin blue line under header + colored Total row. Hint of brand. | |
| Branded card-style (airy, colored) | Rounded blocks, colored backgrounds, generous padding. Modern but heavy ink, 2+ pages. | |
| Skip — use your judgment | Defer to planner/research. | |

**User's choice:** Print-shop minimal — locked as D-01.
**Notes:** Aesthetic anchor for the rest of the area.

### Q1.2 — Header design

| Option | Description | Selected |
|--------|-------------|----------|
| Wordmark only — '3DCoster' top-left, 'QUOTE' top-right | Bold sans-serif wordmark + QUOTE/quote# stack + thin rule. ~50pt height. | ✓ |
| Wordmark + tagline + ruled band | Wordmark + small italic tagline + thicker rule with quote#/date right. ~80pt height. | |
| Reserve a slot for a logo image now | Logo placeholder structure shipping with text fallback. | |

**User's choice:** Wordmark only — locked as D-02.
**Notes:** Matches D-01 minimal aesthetic; smallest header footprint; no logo asset exists.

### Q1.3 — Section order

| Option | Description | Selected |
|--------|-------------|----------|
| Standard invoice order (Recommended) | Header → [Quote#+dates LEFT][Customer RIGHT] → items → totals → notes → footer. 99% case. | ✓ |
| Customer-first prominence | Customer block full-width before quote#. Wastes horizontal space. | |
| Compact single-column | Everything stacked. Easier layout but looks less professional. | |

**User's choice:** Standard invoice order — locked as D-03.

### Q1.4 — Line items

| Option | Description | Selected |
|--------|-------------|----------|
| Collapsed (Recommended) | One row: 'Custom 3D print — {jobTitle} (qty:N) — {price}'. No cost breakdown. | ✓ |
| Itemized cost breakdown | Material/Electricity/Labor/Depreciation/Wear/Post-processing/Profit as rows. Exposes margin. | |
| Hybrid — collapsed line + optional notes | Single row, optional print-details in Notes. | |

**User's choice:** Collapsed — locked as D-04.
**Notes:** Protects seller's cost structure; matches the B2C invoicing idiom.

---

## Quote number format + Tax label

### Q2.1 — Quote number display

| Option | Description | Selected |
|--------|-------------|----------|
| Q-0042 (4-digit zero-padded with Q prefix) | 'Q-0042'. Counter stays integer; padding + Q display-only. | ✓ |
| 0042 (bare number, no prefix) | Minimal. Risk of confusion with invoice/order #. | |
| Q-2026-0042 (year-prefixed) | Forces yearly reset decision. More moving parts. | |
| Skip — use Q-0042 | Defer with sensible default. | |

**User's choice:** Q-0042 — locked as D-05.
**Notes:** Counter is lifetime (no yearly reset). Matches the existing types.ts:294 `?? 1` seed.

### Q2.2 — Tax label

| Option | Description | Selected |
|--------|-------------|----------|
| Region-aware: VAT / GST / IVA / Sales Tax / Tax | Mapping from UserProfile.address.country. ~30 LOC. Most professional. | ✓ |
| Universal 'Tax' | Always 'Tax'. Zero region logic. Feels generic to EU sellers. | |
| User-configurable in Settings | UserProfile.taxLabel free text. Most flexible but overkill for v1. | |

**User's choice:** Region-aware — locked as D-06.
**Notes:** Helper `taxLabelFor(countryCode)` lives in `src/utils/taxResolution.ts` (tax stack home).

### Q2.3 — 0% tax behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Hide Tax row only — show Subtotal + Total | Clearest math chain. Matches most invoice tools. | ✓ |
| Hide Tax row AND Subtotal — just show Total | Maximally compact. Looks weird with multi-item; rarely needed since D-04 collapses to 1 item. | |
| Show '0%' row anyway | Some compliance regimes need this. Contradicts ROADMAP. | |

**User's choice:** Hide Tax row only — locked as D-07.
**Notes:** Tax row label includes the rate inline when shown (e.g., `VAT (19%): €22.80`).

---

## Notes/Terms section source

### Q3.1 — Data model

| Option | Description | Selected |
|--------|-------------|----------|
| Layered: defaultTerms + per-job notes | UserProfile.defaultTerms (boilerplate) + PrintJob.notes (per-job). Two subsections. | ✓ |
| Per-job free-text only | PrintJob.notes only. No new fields. Smallest scope. | |
| Templates / presets | UserProfile.termsTemplates array + picker. Biggest scope. Overkill for v1. | |

**User's choice:** Layered — locked as D-08.
**Notes:** Mirrors the 3-layer tax pattern (default + per-job). Each subsection omitted if empty; both empty → omit area entirely.

### Q3.2 — defaultTerms edit location

| Option | Description | Selected |
|--------|-------------|----------|
| Existing UserProfileModal (Recommended) | Textarea next to address/labor (business-defaults grouping). No new modal. | ✓ |
| Existing SettingsModal | Wrong fit — Settings is app config; defaultTerms is business identity. | |
| New dedicated 'PDF settings' subsection | Premature for one field. Revisit when v2 white-label adds more. | |

**User's choice:** UserProfileModal — locked as D-09.

---

## Font + filename + Generate-PDF placement

### Q4.1 — Font strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Bundle base64 in the lazy chunk (Recommended) | Noto Sans regular+bold Latin+Latin-Ext (~80 KB gz) in lazy chunk. Fully offline. | ✓ |
| Fetch from /public/fonts/ at PDF time | Smaller lazy chunk but Tauri csp + asset scope changes. Worse offline. | |
| jspdf default font + warn on missing glyph | Helvetica Latin-1 only. VIOLATES success criterion #5. | |

**User's choice:** Bundle base64 — locked as D-10.
**Notes:** Researcher confirms during research: (a) Latin+Latin-Ext covers €/accented; (b) final base64 file size; (c) subset tool.

### Q4.2 — Filename pattern

| Option | Description | Selected |
|--------|-------------|----------|
| Quote-Q-0042-AliceTest.pdf | Quote-{quoteNumber}-{customerNameSlug}.pdf. Customer slug ASCII-safe, max 30 chars. | ✓ |
| Quote-Q-0042.pdf | No customer name. Simpler, predictable. | |
| 3DCoster-Quote-Q-0042.pdf | Brand prefix. Helps customer's downloads folder but longer. | |

**User's choice:** Quote-Q-0042-AliceTest.pdf — locked as D-11.
**Notes:** Drop the slug when customer block is omitted: `Quote-Q-0042.pdf`.

### Q4.3 — Generate PDF button placement

| Option | Description | Selected |
|--------|-------------|----------|
| Cost calc bottom (next to Save) + JobsManager accordion (Recommended) | Calc: next to Save, disabled when sellingPrice<=0. JobsManager: inside expanded accordion. | ✓ |
| Cost calc bottom + JobsManager row-level | PDF icon-button on every collapsed row. Adds visual noise. | |
| Dedicated PDF action area in both | New Export section. Premature for one export action. | |

**User's choice:** Calc bottom + JobsManager accordion — locked as D-12.

---

## Claude's Discretion

- Exact module path for the PDF generator (utility-vs-component organization).
- Vite chunk-naming for the PDF chunk.
- Whether Noto Sans base64 is a separate module or inlined in `generateQuotePdf.ts`.
- `formatQuoteNumber(n)` helper signature and home file.
- Tauri save-dialog API specifics (researcher confirms during research).
- `jspdf-autotable` vs hand-rolled rect/text for the totals block.

## Deferred Ideas

- PDF preview modal before download (v1.3+).
- Tauri save-dialog UX polish (folder memory, default folder).
- Quote-template / preset system (v2 white-label).
- White-label / logo upload / custom footer (paid tier, v2.0+).
- Configurable valid-until window.
- Per-customer or yearly quote-number reset.
- Translation of PDF UI strings (Tax label exception via D-06).
- Cost-breakdown line items mode (B2B / government bid use case).

---

# Extension Discussion — 2026-05-23

**Date:** 2026-05-23
**Trigger:** UAT (plan 16-05 Task 2) surfaced 8 gaps. User verdict: "extend Phase 16 to cover everything."
**Areas discussed:** Quote UI scope, Convert flow, Shipping placement, Snapshot scope, Quote modal UX, Status transitions, quoteNumber migration
**Carrying forward:** Phase 15.1 Customer entity + picker; Phase 14 D-21 customer-fields-editable; Phase 15.1 D-04 by-value snapshot rule.

---

## G1 — Quote UI scope (per-job vs top-level tab)

| Option | Description | Selected |
|--------|-------------|----------|
| Per-job Recent Quotes section only (Recommended) | Mirror Recent Sales inside the JobsManager accordion. Smallest scope, matches existing pattern, ships fastest. Top-level Quotes tab deferred to v1.3 if usage signals demand. | ✓ |
| Per-job section + top-level Quotes tab | Full parity with Customers tab. Outstanding quotes visible across all jobs in one place. Materially more work (new route, filtering, possibly pagination). | |
| Top-level Quotes tab only (skip per-job) | Single Quotes surface, no per-job repetition. Cleaner conceptually but loses the "what's outstanding for this product?" job-anchored view. | |

**User's choice:** Per-job only — locked as D-19. Top-level Quotes tab explicitly deferred to v1.3 in the extension out-of-scope list.

---

## G2 — Convert Quote → Sale flow

| Option | Description | Selected |
|--------|-------------|----------|
| Open Record Sale modal pre-populated from Quote snapshot (Recommended) | Reuses existing Record Sale modal; user confirms/adjusts; on save, Sale is written AND Quote is marked converted with convertedToSaleId. One step, one chance to catch quote drift. | ✓ |
| Silent conversion — Sale created directly from Quote snapshot | Click Convert → Sale appears, Quote auto-marks converted. Fastest path. Loses the opportunity to adjust if reality differed (discounts, partial shipments). | |
| Two-step: small confirm dialog → then silent create | Halfway point — confirms intent without re-confirming details. | |

**User's choice:** Pre-populated Record Sale modal — locked as D-20.

---

## G3 — shippingCost placement

| Option | Description | Selected |
|--------|-------------|----------|
| On the Quote (Recommended) | Quote.shippingCost set at quote-creation. Different quotes for the same job can have different shipping. Mirrors customer per-quote. Aligns with by-value snapshot rule. | ✓ |
| On PrintJob — inherited into quote, overridable | PrintJob.shippingCost default, Quote.shippingCost optional override. Most flexible. Adds form complexity. | |
| On PrintJob only — same for every quote | Symmetric to today's PrintJob.taxRate. Simplest form. Inflexible (international shipping, tiered rates). | |

**User's choice:** On the Quote — locked as D-15 (PDF row) + D-17 (schema field).

---

## G4 — Quote PDF snapshot scope

| Option | Description | Selected |
|--------|-------------|----------|
| Snapshot ALL priced + identity fields (Recommended) | Quote stores: sellingPrice, shipping, resolvedTaxRate, notes, terms, customer (deep copy), countryAtSendTime. PDF reads only from Quote — reproducible byte-for-byte. Strict by-value, matches 15.1 D-04 + 14 D-21. | ✓ |
| Snapshot priced fields, terms read fresh | Lighter snapshot. Historical PDFs drift if user updates defaultTerms. | |
| Read everything fresh from PrintJob + UserProfile | Smallest data footprint. Breaks historical reproducibility. | |

**User's choice:** Snapshot everything — locked as D-17 (`Quote.lineItemsSnapshot` carries `notes`, `terms`, `countryAtSendTime` in addition to numeric fields).

---

## G5 — Print Quote click → PDF flow

| Option | Description | Selected |
|--------|-------------|----------|
| Print Quote opens a modal — pick customer + shipping + preview totals — then Generate (Recommended) | Click Print Quote → modal with: customer combobox (reuses 15.1's typeahead), shipping input, live totals preview, Generate button. Click Generate → Quote written status='sent', PDF downloads. One audit-ready step. | ✓ |
| Inline picker on the accordion, then PDF auto-downloads | Inline section on the accordion. Contradicts G3 (shipping is per-quote, so needs an entry point per click). | |
| Two-step: pick customer → small modal for shipping → PDF | Heavier click count for what could be one modal. | |

**User's choice:** Single modal — locked as D-18 (PrintQuoteModal).

---

## G6 — Status transitions after PDF generation

| Option | Description | Selected |
|--------|-------------|----------|
| PDF download = 'sent'; user manually marks accepted/declined (Recommended) | Generate → Quote status='sent'. Recent Quotes row has [Mark Accepted] [Mark Declined] [Convert to Sale] buttons. Simplest mental model. | ✓ |
| PDF download = 'draft'; user explicitly clicks 'Mark Sent' before status can advance | More granular — lets you regenerate without committing. Adds one click per real quote. | |
| Three states only: draft / sent / converted | Lightest model. Loses "who declined / who's outstanding" — conflicts with user's UAT report. | |

**User's choice:** sent on generation; manual decision buttons — locked as D-19 (row UI) + D-17 (status enum).

---

## G7 — PrintJob.quoteNumber migration

| Option | Description | Selected |
|--------|-------------|----------|
| Move to Quote.quoteNumber; backfill existing jobs into synthetic Quotes (Recommended) | Quote owns the field. For each PrintJob with quoteNumber: create Quote with status='converted' if it has sales, else 'draft'. PrintJob.quoteNumber stays as deprecated read-only field for one phase. Cleanest long-term model. | ✓ |
| Keep on PrintJob; Quote table just references it | Quote.printJobId points at PrintJob, PrintJob still owns quoteNumber. Simpler now but creates ownership split. | |
| Move to Quote.quoteNumber; DON'T backfill | Hard cut. Acceptable since the feature is brand-new. Simplest migration. | |

**User's choice:** Move + backfill — locked as D-17 v7→v8 migration (one Dexie upgrade callback, two synthetic-Quote variants based on whether the source job has sales).

---

## Out-of-Scope Reaffirmation

The following came up during gap-list discussion but stay deferred:

- **Top-level Quotes tab** — deferred to v1.3 (G1 lock).
- **Quote PDF preview before download** — same as Phase 16 original deferred.
- **Per-jurisdiction shipping-tax handling** — D-22 explicitly locks tax base to sellingPrice only.
- **E-sign / email-the-quote integrations** — still v2.0+ territory.
- **Soft-delete / archive workflow for Quotes** — delete is permanent (matches Customer delete pattern, by-value snapshots make this safe).
- **Quote PDF visual differences from current** — same template; "QUOTE" label stays; the user can tell quotes from invoices by the document title.

## Claude's Discretion (Extension)

- Migration scoping: one plan (schema + backfill) vs two plans (schema-only then backfill) — planner picks based on backfill risk.
- PrintQuoteModal mobile layout (375px width budget).
- Whether to refactor `generateQuotePdf` to take `Quote` argument vs materialize a temp quote at the call site — strong recommendation: refactor cleanly (1 caller after D-13).
- NewBadge feature key on the renamed "Print Quote" button — keep `pdf-quote`, do NOT bump feature date (rename is polish, not a new feature).
- `assert-no-static-jspdf.mjs` audit count update — `await import('../pdf/generateQuotePdf')` drops from 2 → 1.
- Migration test fixture organization.

