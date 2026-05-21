# Feature Research — v1.2 Quote-to-Customer

**Domain:** 3D printing cost calculator → professional quote tool
**Researched:** 2026-05-20
**Confidence:** HIGH (features 1-6), MEDIUM (PDF bundle sizes — Bundlephobia unreachable, relied on indirect sources)

---

## Feature Landscape

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Subtotal / Tax / Total breakdown on quote | Every invoice tool from Wave to Xero shows this three-row summary | S | Tax row must conditionally hide when rate = 0% to avoid "Tax: $0.00" noise |
| Customer name + email on job | The minimum a seller needs to email a quote | S | Name + email alone is enough for MVP; rest is differentiator |
| Tax-exclusive display (subtotal + tax line + total) | US norm; Etsy seller base is heavily US/UK/AU-based | S | Tax-inclusive is a display concern on the PDF, not the model |
| Quote number / unique ID | Every professional quote has one; used for reference in emails and disputes | S | Can be auto-generated (JOB-001 style counter) |
| Valid-until / expiry date on PDF quote | Protects seller from honouring stale pricing | S | Sensible default: 30 days from issue date |
| Free-text search across job list | Any list with >10 items needs search; users expect it on titles at minimum | S | Extend to customer name + tags once those fields exist |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Three-layer tax model (region default → Settings override → per-job override) | Covers 90 % of sellers automatically; power users and edge-cases handled without leaving the app | M | Region lookup table ships with EU-27 + UK + AU + CA + US (0 %) rates. Settings override covers sellers who operate outside their region. Per-job override covers B2B reverse-charge, export zero-rate, and "this customer has a tax exemption certificate" |
| Tax-inclusive vs tax-exclusive mode on PDF | EU B2C law requires prices include VAT in displayed consumer prices; US B2C prices are always tax-exclusive | M | Model stores exclusive subtotal + rate; PDF rendering switches display mode based on region or per-job flag. Reverse-charge and zero-rate override suppresses the tax line with a note ("Reverse charge applies" / "Export — zero-rated") |
| Etsy ToS compliance checklist built into job screen | No competitor (OctoPrint, Printpal, 3DPCC) addresses this; Etsy tightened 3D-print rules June 10 2025 — template-printed items now banned | M | See full checklist breakdown in the Etsy section below |
| Printable PDF quote with "Made with 3DCoster" footer | Turns the tool into organic marketing; every quote sent is a brand impression. Free-tier footer deferred to paid white-label in v2.0 | M | Lazy-loaded PDF lib to protect Phase 11's 300 KB gz main-chunk gate |
| Tags + chip filter | No other free 3D-print calculator has a job organiser with tag facets | S | Free-text search + chip multi-select is the standard SaaS pattern (Notion, Linear, GitHub Issues) |
| Quick duplicate | Useful for repeat/similar jobs (same customer, same printer, different colour) | S | One-click "Duplicate" from the job row context menu is the industry standard (Zoho Invoice, Invoice Ninja); carries most fields, resets date and quote number |

### Anti-Features (Commonly Requested, Often Problematic)

| Anti-Feature | Why Requested | Why Problematic | Alternative |
|--------------|---------------|-----------------|-------------|
| Customer database / CRM tab | Sellers want to recall customer details for repeat orders | Entire new data model, navigation, CRUD surface; scope explosion; paid CRM tools (HoneyBook, Bonsai) do this better | Store customer fields on the job itself; let search surface past jobs by customer name — that IS the history |
| Tax autocomplete from address (geo lookup) | US has 12 000+ tax jurisdictions — Avalara/TaxJar integrate with this | Requires external API (paid, privacy-sensitive), backend, and maintenance; overkill for a local-first free tool | Region-table default covers the 99 % case; per-job override handles the rest |
| Tag autocomplete from prior jobs | Reduces typos, surfaces reusable tags | Requires indexing all tag strings across all jobs on every keypress; adds complexity for unclear gain at small-corpus sizes | Ship free-text tags now; add autocomplete in v1.3 if usage data shows tag fragmentation (PROJECT.md decision already locked) |
| Signature field on PDF quote | Freelance tools (Bonsai, HoneyBook) have e-sign | E-sign is a legal/compliance surface with liability implications; out of scope for a free local-first tool | Note in PDF footer: "To accept, reply to this email" |
| Multi-page PDF with design templates | Invoice Ninja / Bonsai offer branded templates | Template engine adds large surface area; conflicts with white-label deferred to v2.0 paid tier | Single clean layout with consistent branding; white-label template system is a paid-tier differentiator |
| Line-item quantity column on quote | Real invoicing tools have QTY × unit price | 3DCoster quote is a single-job estimate, not a multi-SKU order form; adding QTY column misrepresents what the tool calculates | Surface filament breakdown (material × grams × price) as the line-items analogue — this is what differentiates 3DCoster from a generic invoice |

---

## Per-Feature Deep Dive

### 1. Tax / VAT on Jobs

**Classification:** TABLE STAKES (subtotal/tax/total row) + DIFFERENTIATOR (three-layer model + tax-inclusive/exclusive toggle)
**Complexity:** M
**What "good" looks like:**
Every professional invoicing tool (FreshBooks, Xero, Wave, Bonsai) shows: Subtotal → Tax (rate%) → Total. The tax line conditionally hides at 0 % to avoid noise.

**Tax-inclusive vs tax-exclusive jurisdictions:**
- US/Canada: prices are tax-exclusive by convention. Sales tax is state/provincial, not federal. US federal rate = 0 %; state rates vary 0–10.25 %. Seller is responsible for collecting only in states where they have nexus (complex; not 3DCoster's problem — just let them enter the rate).
- EU B2C: prices must display tax-inclusive (VAT already in the shown price). On the invoice/quote, show VAT-inclusive price with a line "includes VAT at 20 %". EU VAT rates: 17–27 % by country. The EU One-Stop-Shop lets sellers report centrally.
- UK B2C: same as EU — prices must be VAT-inclusive for consumer-facing displays. Standard rate: 20 %.
- Australia GST: 10 %. Prices displayed to consumers must be GST-inclusive.
- B2B reverse charge (EU): invoice shows zero VAT, includes the note "Reverse charge applies — buyer accounts for VAT". Invoice must NOT show a VAT amount.
- Export/zero-rate: invoice shows 0 % with note "Export — zero-rated" or "Exempt supply".

**"No tax for this customer" handling:**
Three valid reasons: (a) seller is below VAT registration threshold (no VAT to charge), (b) B2B reverse charge, (c) export. The per-job override covers all three — seller sets rate to 0 % and can optionally add a note. 3DCoster should not try to enforce or auto-detect these — just provide the override field with a "reason" text input for the PDF.

**Three-layer model rationale:**
1. Region table default: covers the 90 % case without any seller configuration.
2. Settings override: covers sellers who operate in a region different from their detected locale, or who have a specific standard rate they always use.
3. Per-job override: covers edge cases (B2B, export, exempt customer, special scheme).
All three layers must ship together — a partial implementation (e.g., per-job only, no default) forces every seller to enter tax on every job.

**Dependency:** Tax model feeds the PDF quote (the three-row summary must render correctly). Tax model also activates the existing `it.todo` in `costCalc.test.ts`.

---

### 2. Customer Details on Jobs

**Classification:** TABLE STAKES (name + email minimum) + DIFFERENTIATOR (company + VAT ID on PDF for B2B)
**Complexity:** S

**Minimum useful field set (confirmed across HoneyBook, Bonsai, Zoho Invoice, FreshBooks):**
- Name (required for quote personalisation)
- Email (required to send the quote)
- Address line 1, City, State/Province, Postal code, Country (required for tax jurisdiction and formal quotes)
- Company name (optional — B2B)
- VAT / Tax ID (optional — B2B reverse charge reference on the PDF)
- Phone (optional — low value, sellers text via platform DMs anyway)
- Notes (optional — internal, not on PDF)

**What to include in 3DCoster v1.2:**
Ship: Name, Email, Address (single freeform textarea is fine for v1.2 — no city/state/postal split required yet). Company and VAT ID are valuable for the B2B reverse-charge use case but can be added as optional fields without breaking anything.

**How tools surface customer on the quote vs. job form:**
- Job form: collapsible "Customer" section, all fields optional, collapsed by default for existing users (no regressions).
- PDF quote: customer block top-right (or below header), shows Name / Company / Address / Email. If no customer details, the block is omitted — don't show empty boxes.

**Dependency:** Customer details feed the PDF. Address feeds the tax jurisdiction auto-suggest (if implemented — not in v1.2 scope).

---

### 3. Editable Tags + Filter/Search on JobsManager

**Classification:** DIFFERENTIATOR
**Complexity:** S

**Tag UX — free-text vs predefined:**
Free-text is the right call for v1.2 (confirmed in PROJECT.md decisions). Predefined tag sets require a management UI and upfront taxonomy decisions users don't want to make before they understand how they'll use tags. Linear, GitHub Issues, and Notion all ship free-text first, add smart suggestions later.

**Multi-select filter vs single:**
Multi-select chip filter is table stakes for any tag-based filter system. A single-select filter ("show only one tag at a time") frustrates users who tag across dimensions (e.g., "etsy" + "pending" simultaneously). Multi-select OR logic (show jobs with ANY selected tag) is the right default — AND logic is a power feature for v1.3.

**Search-as-you-type vs submit:**
Search-as-you-type is required. Any delay (submit-on-enter) on a local IndexedDB dataset is perceived as a bug. With virtualization already in place (Phase 11), filtering client-side on every keystroke is trivial.

**Search scope:** Title → Customer name → Tags (in that priority). User types "Alice" and sees jobs for Alice Green + jobs tagged "alice-project". This is the expected behaviour in tools like Notion.

**Tag rendering on job row:**
Pill/chip elements, max 3 visible + "+N more" overflow. Single word or short phrase chips are the industry norm. Tailwind `rounded-full bg-slate-700 text-slate-300 text-xs px-2 py-0.5` is the right pattern for the existing dark slate theme.

**Dependency:** Tags are stored on the job model (Dexie migration required). Tags feed the PDF (decision: not in v1.2 — chips not rendered on PDF per PROJECT.md scope lock).

---

### 4. Printable PDF Quote

**Classification:** DIFFERENTIATOR
**Complexity:** M (library selection + layout + lazy-loading)

**What a professional quote PDF contains (confirmed across Zoho Invoice, Invoice Ninja, Wave, FreshBooks, Billdu):**
1. Header: Seller name / logo (v1.2: no logo upload — text only), contact info, quote date
2. Quote number (e.g., "Quote #QT-0042")
3. Valid-until date (default: issue date + 30 days)
4. Customer block: Name, Company, Address, Email
5. Line items table: Description | Amount (for 3DCoster: "Print job — [title]" + filament breakdown rows)
6. Subtotal
7. Tax line (rate % + amount) — hidden if 0 %
8. Total (bold)
9. Notes / terms (optional freeform text seller can fill)
10. Footer: "Made with 3DCoster — 3dcoster.vercel.app" (free tier)

**Standard paper size:**
A4 is the international standard; US Letter is the US norm. The right approach for a global tool with EU-heavy user signals is A4 by default with the layout also fitting Letter (they differ by ~5 mm in width, ~12 mm in height — a well-padded layout works for both without switching).

**Localization:**
- Date format: use `Intl.DateTimeFormat` with the user's locale (already available from the existing multi-currency/region system).
- Currency symbol + number format: already in 3DCoster's multi-currency system — use the same formatters.
- Decimal/thousands separators vary (EU: 1.234,56 vs US: 1,234.56) — `Intl.NumberFormat` handles this.

**PDF library decision (for plan-phase confirmation):**
- jsPDF: ~229 KB gzip (confirmed via pkgpulse 2026 data). Imperative API. Needs jspdf-autotable plugin for tables. Framework-agnostic. Mature. Not tree-shakeable. Bundle delivered as lazy-loaded dynamic import chunk — 229 KB gz exceeds a single chunk recommendation but is acceptable since it's demand-loaded.
- @react-pdf/renderer: ~500 KB+ gzip based on historical issue data (Issue #632 reported 1.2 MB uncompressed; gzip roughly 40-50 % of that). JSX-based layout (ergonomic). Includes its own font subsystem. Significantly heavier than jsPDF.
- pdf-lib: ~100 KB gzip. Focused on editing/filling existing PDFs rather than generating from scratch. Less ergonomic for new document generation.

**Recommendation for plan-phase research:** jsPDF + jspdf-autotable is the weight-conscious choice. @react-pdf/renderer is ergonomic but likely ~2× the weight. Confirm exact bundle sizes during Phase 12/13 plan research before committing.

**Lazy-loading strategy:** Dynamic import triggered by "Download PDF" button click. React.lazy + Suspense or a manual `import()` call inside the click handler. The PDF generation chunk never touches the main bundle. This is the same code-splitting pattern already used for react-window in Phase 11.

**Dependency:** PDF quote depends on: customer details (for customer block), tax model (for subtotal/tax/total), job model (for line items). Tags on PDF are explicitly out of scope (PROJECT.md decision).

---

### 5. Quick Duplicate of Saved Jobs

**Classification:** TABLE STAKES (duplicating records is a standard CRUD affordance in every list-management tool)
**Complexity:** S

**Industry standard pattern (confirmed: Zoho Invoice, Invoice Ninja, Bonsai):**
"Duplicate" / "Clone" appears in the row context menu (three-dot or right-click menu). Single click creates the duplicate and either: (a) saves immediately and scrolls to it ("Duplicate and save") or (b) opens it for editing ("Duplicate and edit"). "Duplicate and edit" is marginally better UX — the user can change the customer name or price before committing. "Duplicate and save" risks creating a mess if the user doesn't notice the new record.

**What carries over:**
- All cost inputs (filaments, electricity, depreciation, labour, failure rate, markup)
- Customer details
- Tags
- Notes
- Settings-linked values (profit margin, printer, etc.) at the time of the original

**What resets:**
- Date → today's date
- Quote number → next auto-incremented number
- Sale record → none (the duplicate is a new unsold job)
- "Sold" status → false

**Where the action lives:**
Row context menu in JobsManager (three-dot button already exists or is a natural v1.2 addition). Keyboard shortcut is a v1.3 power-user feature — not needed for v1.2.

**Dependency:** Duplicate requires no other v1.2 features but benefits from: quote number auto-increment (if implemented with Tax/PDF) and customer details (so those also carry over).

---

### 6. Etsy ToS Compliance Helper

**Classification:** DIFFERENTIATOR
**Complexity:** M (content research + conditional logic)

**Why now:** Etsy's Creativity Standards update (effective June 10, 2025) specifically targeted 3D-printed items. The previous policy allowed "templated designs"; the new policy requires items to be "based on a seller's original design." This is the single biggest compliance trap for 3D-print Etsy sellers as of 2025. The source: Etsy Creativity Standards page (https://www.etsy.com/legal/creativity/), confirmed by third-party coverage in TCT Magazine and Value Added Resource (June 2025).

**Rules sellers trip over (sourced from Etsy legal pages and June 2025 coverage):**

1. **Original design requirement (CRITICAL — new June 2025):** Physical items produced with a 3D printer must be based on the *seller's own original design*. Printing from Thingiverse, Printables, or any third-party template — even with a commercial licence — is no longer allowed on Etsy. This overrides prior practice.

2. **Handmade / "Made by a Seller" disclosure:** Items must be genuinely handmade/hand-assembled by the seller in their personal shop or home. Must declare production method accurately.

3. **Production partner disclosure:** If anyone else assists in manufacturing (e.g., a print farm, outsourced finishing), they must be disclosed as a Production Partner in the shop's About section. The partner can be listed generically ("Local Print Shop") but must be listed.

4. **IP/copyright:** Using trademarked characters, brand names, or copyrighted designs without a licence is the most common cause of shop suspension (40 %+ of suspensions per Trademarkia 2025 analysis). Fan art of recognisable characters infringes even without using the name.

5. **Font and pattern licences:** Third-party fonts and patterns used in designs must have commercial licences. Free personal-use fonts embedded in a printed design are an infringement risk.

6. **AI-generated content (new June 2025):** Selecting "Made by" or "Handmade" categories while using AI-generated designs is an immediate violation. AI involvement must be disclosed in listing descriptions.

7. **Listing description transparency:** Must accurately describe the creative process, materials, and origin of the design.

8. **Prohibited items:** Etsy's prohibited items policy (effective until August 11, 2026 per the live policy page) applies. 3D-printed functional items that are also in Etsy's prohibited categories (weapons components, drug paraphernalia) are banned regardless of printing method.

**Format recommendation:**
An inline checklist on the job screen (not a modal) is better UX for compliance helpers. Modals interrupt the flow; an inline collapsible section ("Selling this on Etsy? Check these items") respects user attention. The checklist should be:
- Always visible when the job has a sales channel of "Etsy" or when user has a Settings flag "Etsy seller" (conditional on implementation).
- In v1.2 with no sales channel field: a static toggle/section the seller can expand on any job.
- Checklist items are static (not conditional on product type in v1.2 — conditional logic is a v1.3 enhancement once usage patterns are understood).

**Checklist items for v1.2 (prioritised by risk):**
- [ ] Design is my own original work (not from Thingiverse, Printables, or any third-party file — even with a commercial licence)
- [ ] No trademarked characters, brands, or logos without a valid licence
- [ ] No copyrighted designs (fonts, patterns, artwork) without commercial licences
- [ ] If using AI to generate/assist the design: disclosed in listing description
- [ ] If someone else helped manufacture it: Production Partner declared in shop About section
- [ ] Listing description accurately describes how the item was made
- [ ] Item is not in Etsy's Prohibited Items list

**On the PDF:** A note "Sold via Etsy" is appropriate if the job is tagged/marked as an Etsy sale. The full checklist does not belong on the customer PDF — it's internal seller guidance only.

**Dependency:** Etsy helper is self-contained for v1.2 (static checklist, no data dependencies on other v1.2 features). It uses tags indirectly if the user tags jobs as "etsy" — but the helper doesn't require tags to function.

---

### 7. UI Consistency Sweep

**Classification:** NOT a user-facing feature — internal polish only. No NEW badge. No features.ts entry.
**Complexity:** S (mechanical — apply patterns already defined in MEMORY.md)

**Scope (from ui-consistency-sweep.md):**
- Compact prop rollout: CostCalculator filament rows, pricing inputs, shipping override, failure rate; AssetLibrary edit form; JobsManager sale modal; PrinterSettings; CsvImport/GcodeImport numeric fields.
- InfoTooltip rollout: Replace any remaining descriptive placeholders (CostCalculator, AssetLibrary, PrinterSettings). Placeholders become bare example values.
- features.ts dead-badge cleanup: Remove JSX call sites for 10 expired features (past 14-day MAX_AGE). Prune features.ts keys with zero remaining JSX consumers.
- Flex-wrap uniform chunks: Apply `min-w-[160px]` to flex-wrap numeric input containers in forms added in v1.2.

**Regression risk assessment:**
- Compact prop: visual-only change (max-w-28 cap on number inputs). Cannot break logic. Risk: LOW.
- InfoTooltip: replaces placeholder text. Cannot break logic. Risk: LOW.
- features.ts cleanup: removes JSX that never renders (past MAX_AGE). Cannot affect visible UI. Risk: NONE.
- New v1.2 form sections: applying the patterns from day one means no retrofit needed later. Risk: NONE.

**Recommendation:** Fold sweep into the first v1.2 phase that touches each component (not a standalone phase). This avoids double-touching the same files.

---

## Feature Dependencies

```
Tax / VAT model
    └──required-by──> PDF Quote (subtotal/tax/total rows)
    └──required-by──> costCalc.test.ts it.todo (test activation)

Customer Details
    └──required-by──> PDF Quote (customer block)
    └──enhances──> Quick Duplicate (customer carries over)

Tags + Filter/Search
    └──enhances──> Free-text search scope (title + customer + tags)
    └──NOT required by PDF Quote (tags-on-PDF deferred per PROJECT.md)

Quick Duplicate
    └──carries-over──> Tax rate (per-job override)
    └──carries-over──> Customer Details
    └──resets──> Date, Quote Number, Sale Record

Etsy Compliance Checklist
    └──standalone (no hard dependencies on other v1.2 features)
    └──enhances──> Tags (user may tag jobs "etsy" to surface the helper)

UI Consistency Sweep
    └──must-run-alongside──> every v1.2 phase that touches existing forms
    └──NOT a standalone phase
```

### Dependency Notes

- **PDF Quote requires Tax model AND Customer Details:** Both must be in an earlier or same phase as the PDF generation feature. Shipping PDF without tax rows produces an incomplete and potentially misleading quote.
- **Tax model activates the existing it.todo:** The plan-phase researcher should confirm which test functions are stubbed and whether the three-layer model maps cleanly to the existing test structure.
- **Tags are independent of PDF:** The scope lock (no tags on PDF in v1.2) means tags can ship in any phase order without blocking PDF.
- **Etsy checklist is fully independent:** Can ship in any phase, but logically belongs near the job edit screen — same phase as Customer Details makes sense.
- **Quick Duplicate is independent:** No hard dependencies. Can ship in any phase. Logically belongs with JobsManager work (tags + search phase).

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Tax / VAT on jobs | HIGH | MEDIUM | P1 |
| Customer details | HIGH | LOW | P1 |
| PDF quote | HIGH | MEDIUM | P1 (blocked by tax + customer) |
| Tags + filter/search | HIGH | LOW | P1 |
| Quick duplicate | MEDIUM | LOW | P2 |
| Etsy ToS helper | MEDIUM | LOW-MEDIUM | P2 |
| UI consistency sweep | LOW (internal) | LOW | P1 (fold into other phases) |

---

## Suggested Phase Ordering for Roadmap

Based on dependencies:

**Phase A — Data foundation:** Tax model (three-layer) + Customer details on jobs (Dexie migration, form fields, Settings override). Activates it.todo test. No PDF yet.

**Phase B — JobsManager organisation:** Tags (model + chip filter + free-text search) + Quick duplicate + Etsy ToS helper checklist. UI sweep applied to all touched forms.

**Phase C — PDF quote:** Client-side PDF generation (lazy-loaded), pulling from tax model + customer details + job fields. Quote number auto-increment. Valid-until date. "Made with 3DCoster" footer.

This ordering means PDF is never built on incomplete data — it always has tax rows and a customer block to render. Each phase is independently shippable and testable.

---

## Competitor Feature Analysis

| Feature | OctoPrint / Printpal / 3DPCC (free calculators) | HoneyBook / Bonsai (freelance tools) | 3DCoster v1.2 approach |
|---------|------------------------------------------------|--------------------------------------|------------------------|
| Tax handling | None or manual field only | Full tax-exclusive/inclusive + B2B | Three-layer auto-default — superior to both |
| Customer details | None | Full CRM | Job-scoped fields — right-sized for the use case |
| PDF quote | None (screen print at best) | Branded, signable | Clean PDF with footer branding |
| Tag / search | None | Tag-based pipeline | Chip filter + search — better than any free calculator |
| Etsy compliance | None | Not applicable | Unique to 3DCoster — no direct competitor addresses this |
| Quick duplicate | None | Yes | Parity with freelance tools |

---

## Sources

- Etsy Creativity Standards (official, accessed 2026-05-20): https://www.etsy.com/legal/creativity/
- Etsy Prohibited Items Policy (effective until August 11, 2026): https://www.etsy.com/legal/prohibited/
- Etsy Creativity Standards June 2025 update coverage: https://www.valueaddedresource.net/etsy-creativity-standards-update-june-2025/
- Etsy 3D printing policy deep-dive: https://www.cubee3d.com/post/etsy-s-new-3d-printing-policy-2025-the-complete-guide-to-the-original-design-rule
- TCT Magazine on Etsy 3D print policy: https://www.tctmagazine.com/from-templates-to-originality-etsy-new-3d-printing-policy/
- EU VAT B2C vs B2B rules: https://www.taxually.com/blog/b2c-vs-b2b-sales-how-does-vat-apply
- EU reverse charge mechanism: https://marosavat.com/vat-news/vat-reverse-charge
- Tax inclusive vs exclusive — FreshBooks: https://www.freshbooks.com/hub/taxes/tax-inclusive-vs-tax-exclusive
- PDF library comparison 2026 — PkgPulse: https://www.pkgpulse.com/blog/react-pdf-vs-react-pdf-renderer-vs-jspdf-pdf-in-react-2026
- jsPDF bundle size (229.8 KB gzip, confirmed via PkgPulse 2026 data)
- @react-pdf/renderer bundle size (historically ~500 KB+ gzip based on GitHub Issue #632; confirm via Bundlephobia during plan-phase research)
- Professional quote anatomy: https://invoice-ninja.readthedocs.io/en/latest/quotes.html
- Tag/chip filter UX patterns: https://smart-interface-design-patterns.com/articles/badges-chips-tags-pills/
- Clone/duplicate invoice UX: https://www.zoho.com/us/invoice/help/quote/other-actions.html
- HoneyBook vs Bonsai customer fields: https://www.honeybook.com/blog/honeybook-vs-bonsai

---
*Feature research for: 3DCoster v1.2 Quote-to-Customer*
*Researched: 2026-05-20*
