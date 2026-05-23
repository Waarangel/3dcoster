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
