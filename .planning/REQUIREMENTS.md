# Requirements: 3DCoster v1.2 — Quote-to-Customer

**Defined:** 2026-05-20
**Core Value:** Turn 3DCoster from a personal cost calculator into a tool that produces professional, customer-ready quotes — with proper tax handling, customer details, an organized job library, and a real PDF deliverable.

## v1.2 Requirements

Requirements for milestone v1.2. Each maps to exactly one roadmap phase. All requirements sit on the FREE side of the free/paid line per [docs/ROADMAP.md](../docs/ROADMAP.md) "Guiding Principle" (2026-05-19).

### Schema (Dexie v5 → v6 foundation)

- [ ] **SCHEMA-01**: Dexie v5→v6 migration adds optional fields to `PrintJob` (`tags?: string[]`, `customer?: JobCustomer`, `taxRate?: number`, `taxAmount?: number`) and to `UserProfile` (`defaultTaxRate?: number`, `nextQuoteNumber?: number`); existing v1.0/v1.1 jobs load without error (upgrade callback backfills `tags = []`)
- [ ] **SCHEMA-02**: A `versionchange` handler (`db.on('versionchange', () => window.location.reload())`) is wired in `database.ts`; opening a second tab after a schema upgrade reloads the first tab cleanly instead of throwing the white-screen crash

### Tax (three-layer model: region → Settings → per-job)

- [ ] **TAX-01**: User can set a default tax rate in Settings (Pricing tab) as a percentage; this rate seeds the tax row on new jobs
- [ ] **TAX-02**: User can override the tax rate per job in the cost calculator; the override persists with the saved job
- [ ] **TAX-03**: When the user has no Settings default and no per-job override, the tax rate is read from `src/data/taxRates.ts` (static region lookup keyed off the user's currency/region) — including each country's `rateAsOf` date for stale-data signaling; US defaults to 0% with a marketplace-facilitator note
- [ ] **TAX-04**: A "Tax (X%)" line appears in the cost breakdown after `sellingPrice`; total = `sellingPrice + taxAmount`. Tax row hides at 0%
- [ ] **TAX-05**: `calculateTax(sellingPrice, ratePercent)` is unit-tested for rate=0, EU/UK/AU rates, two-decimal rounding (rate=23%, price=12.50 → 2.88), and the order-of-operations guard (tax computed on `sellingPrice`, not `subtotal` — assertion fails if depreciation > 0 and `taxAmount === subtotal × rate`). Activates the existing `it.todo` in `costCalc.test.ts`

### Customer details

- [ ] **CUST-01**: User can attach optional customer details (name, email, address, optional company name) to a saved job via a collapsible "Customer" section on the cost calculator
- [ ] **CUST-02**: Customer name + email display on the saved-job row in JobsManager; full address is visible on the PDF only

### Tags + filter/search

- [ ] **TAGS-01**: User can add free-text tags to a saved job via a comma-separated input; tags are lowercased, trimmed, deduped, capped (max-count guard), and persist as `tags: string[]`
- [ ] **TAGS-02**: JobsManager shows a multi-select chip filter sourced from the set of tags in use across saved jobs; selecting one or more chips filters the list with AND logic
- [ ] **TAGS-03**: JobsManager shows a free-text search input that filters by case-insensitive substring match across job title, customer name, and tags
- [ ] **TAGS-04**: The react-window virtualized list scrolls to top and resets its `useDynamicRowHeight` cache when the filter or search changes (no stale-height regression)

### Quick duplicate

- [ ] **DUP-01**: User can quick-duplicate a saved job from JobsManager with a single row action; the duplicate appears in the list immediately
- [ ] **DUP-02**: An explicit-allowlist `duplicateJob()` function inherits cost inputs / tags / notes but RESETS `id` (new `crypto.randomUUID()`), `createdAt` (now), `customer` (undefined — PII reset), `taxRate` (undefined — falls back to current region/Settings default), `copiesSold` (0), and sale records. Unit test asserts `duplicateJob(job).customer === undefined`

### Printable PDF quote

- [ ] **PDF-01**: User can generate a printable PDF quote from a saved job via a "Generate PDF" button on the cost calculator and JobsManager; PDF downloads via browser save (web) and Tauri file dialog (desktop)
- [ ] **PDF-02**: The PDF contains: 3DCoster header, quote number (auto-incremented per user, persisted in `UserProfile.nextQuoteNumber`), valid-until date (default +30 days), customer block (omitted if empty), line items, Subtotal / Tax / Total, notes/terms section, and "Made with 3DCoster — 3dcoster.vercel.app" footer
- [ ] **PDF-03**: `jspdf` + `jspdf-autotable` load only via dynamic `import()` triggered by the "Generate PDF" button; no static `import 'jspdf'` appears anywhere in `src/`
- [ ] **PDF-04**: `vite.config.ts` sets `build.modulePreload: false`; a CI assertion (`scripts/assert-no-pdf-preload.mjs`) greps `dist/index.html` for any `modulepreload` referencing the pdf chunk and fails the build if matched
- [ ] **PDF-05**: Main app chunk remains under 300 KB gzipped after the PDF library is added — the existing Phase 11 `scripts/assert-bundle-size.mjs` continues to pass

### Etsy ToS compliance helper

- [ ] **ETSY-01**: User sees an "Etsy compliance" collapsible section on the cost calculator with a checklist sourced from `src/data/etsyToS.ts` (covering original design, no third-party templates, IP/copyright, production-partner disclosure, AI disclosure)
- [ ] **ETSY-02**: The Etsy section displays a `policySummaryAsOf` date and a direct link to `https://www.etsy.com/legal/creativity/`; the checklist content does NOT render on the customer PDF

### UI consistency sweep (continues UI-XX from v1.1)

- [ ] **UI-08**: Currency / numeric / percentage inputs across CostCalculator, AssetLibrary, JobsManager, PrinterSettings, and import modals use the `compact` prop on the shared `<Input>` primitive (max-w-28)
- [ ] **UI-09**: Descriptive placeholder text is replaced with `<InfoTooltip text="..." />` next to the label across the same forms; placeholders show example values only
- [ ] **UI-10**: `src/features.ts` is audited — stale `<NewBadge>` JSX consumers past `NEW_FEATURE_MAX_AGE_DAYS` are removed; entries with zero JSX hits are pruned from the registry

## v2 / Future Requirements

Deferred to a future milestone.

### Tax

- **TAX-F1**: Geo-based tax lookup API (live VAT/GST rate refresh) — breaks offline-first; deferred indefinitely
- **TAX-F2**: US per-state sales tax table — Etsy is marketplace facilitator in most states; reopens only if seller-collected jurisdictions become common

### Customer

- **CUST-F1**: Customer database / CRM tab — saving customers as reusable records instead of inline-on-job; scope explosion, deferred to a later "Sales Pipeline" milestone

### Tags

- **TAGS-F1**: Tag autocomplete from prior jobs (locked decision: v1.2 ships plain comma-separated input only)
- **TAGS-F2**: Tag chips rendered on the customer PDF
- **TAGS-F3**: Tag-carry on Quick duplicate becomes user-configurable (currently always carries)

### PDF

- **PDF-F1**: White-label PDF quote (no "Made with 3DCoster" footer, custom logo) — paid tier, v2.0+
- **PDF-F2**: Multi-page PDF templates / customizable layouts — conflicts with white-label paid tier positioning
- **PDF-F3**: E-signature on PDF — legal liability, deferred indefinitely

### Etsy

- **ETSY-F1**: Conditional checklist (only show items relevant to the product type) — v1.2 ships static; conditional logic deferred to v1.3

## Out of Scope

Explicitly excluded from v1.2. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| White-label PDF (no footer, custom logo) | Paid tier (v2.0+) — Stimalo line |
| Customer database / CRM tab | Scope explosion; defer to dedicated milestone |
| Geo-based tax lookup API | Breaks offline-first design constraint |
| `@react-pdf/renderer` / `pdf-lib` | pdf-lib abandoned (last published 2021); @react-pdf/renderer too heavy (~450 KB gz) and React-version compat issues |
| `fuse.js` / `minisearch` / any fuzzy-search lib | Job count (10–500) doesn't justify the 8.6 KB gz cost; fuzzy match on user tags produces false positives |
| Light / system theme toggle | Locked in v1.1 — app ships dark-only by design |
| Tag autocomplete | Deferred to v1.3 — v1.2 ships plain comma-separated input only |
| US per-state sales tax | Etsy is marketplace facilitator in most states; would create double-tax |
| E-signature on PDF | Legal liability |
| Multi-page PDF templates | Conflicts with white-label paid-tier positioning |
| Tag chips on customer PDF | Internal organization concept, not customer-facing |
| `sales-tax` / `node-sales-tax` npm | Node-first; data last updated June 2023; static `src/data/taxRates.ts` is leaner |
| Backend / sync / Supabase | Free-tier v1.2 stays local-only per PROJECT.md free/paid line |
| Marketing-page redesign | Polish pass is scoped to the calculator app + JobsManager + Settings |

## Traceability

Which phases cover which requirements. Filled by gsd-roadmapper.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SCHEMA-01 | Phase 12 | Pending |
| SCHEMA-02 | Phase 12 | Pending |
| TAX-01 | Phase 13 | Pending |
| TAX-02 | Phase 13 | Pending |
| TAX-03 | Phase 13 | Pending |
| TAX-04 | Phase 13 | Pending |
| TAX-05 | Phase 13 | Pending |
| UI-08 | Phase 13 | Pending |
| UI-09 | Phase 13 | Pending |
| CUST-01 | Phase 14 | Pending |
| CUST-02 | Phase 14 | Pending |
| ETSY-01 | Phase 14 | Pending |
| ETSY-02 | Phase 14 | Pending |
| UI-10 | Phase 14 | Pending |
| TAGS-01 | Phase 15 | Pending |
| TAGS-02 | Phase 15 | Pending |
| TAGS-03 | Phase 15 | Pending |
| TAGS-04 | Phase 15 | Pending |
| DUP-01 | Phase 15 | Pending |
| DUP-02 | Phase 15 | Pending |
| PDF-01 | Phase 16 | Pending |
| PDF-02 | Phase 16 | Pending |
| PDF-03 | Phase 16 | Pending |
| PDF-04 | Phase 16 | Pending |
| PDF-05 | Phase 16 | Pending |

**Coverage:**
- v1.2 requirements: 25 total
- Mapped to phases: 25
- Unmapped: 0

---
*Requirements defined: 2026-05-20*
*Traceability filled: 2026-05-20*
*Phase numbering continues from v1.1 — first phase is **Phase 12***
