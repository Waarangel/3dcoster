# Roadmap: 3DCoster v1.2 — Quote-to-Customer

**Milestone:** v1.2 Quote-to-Customer
**Defined:** 2026-05-20
**Phase range:** 12–16 (v1.1 ended at Phase 11)
**Requirements:** 25 total (SCHEMA-01–02, TAX-01–05, CUST-01–02, TAGS-01–04, DUP-01–02, PDF-01–05, ETSY-01–02, UI-08–10)
**Coverage:** 25/25 — 100%

**Constraints encoded in this roadmap:**
- All phases are FREE tier — no paid-tier work in this milestone
- All phases are LOCAL-ONLY — no backend, no Supabase, no API calls
- Phase 12 (schema) is foundational: every other phase depends on the Dexie v6 migration landing first
- Phase 16 (PDF) cannot start until both Phase 13 (Tax) and Phase 14 (Customer) are merged — the PDF must render a complete tax row and customer block from day one
- `build.modulePreload: false` in `vite.config.ts` is mandatory before Phase 16 ships — without it Vite generates `<link rel="modulepreload">` for the lazy PDF chunk and silently defeats the 300 KB gz budget win
- Tax applies to `sellingPrice`, not `subtotal` — the existing `it.todo` in `costCalc.test.ts` is the activation point and must be the first thing activated in Phase 13

**Phase structure rationale (coarse granularity):**
The 25 requirements cluster into five natural delivery boundaries driven by hard dependencies:
1. Schema migration unblocks all data fields — must ship alone to be testable before field consumers are written
2. Tax + UI sweep cohere because both touch CostCalculator and Settings forms — applying the `compact`/`InfoTooltip` sweep once while those files are open avoids double-touching them
3. Customer details + Etsy helper cohere because both add collapsible sections to the cost calculator screen — same file, same UI pattern, same one-time forms sweep for new fields
4. Tags + search + quick duplicate cohere because all three are JobsManager work (tag chip filter, search bar, and duplicate row action live in the same component)
5. PDF is last by hard constraint — it assembles the tax row, customer block, and job data all built in phases 13–15

UI-08/09/10 all fold into Phase 13 (touches CostCalculator, Settings, AssetLibrary, JobsManager, PrinterSettings, UserProfileModal, and GcodeImport in the same pass). Phase 13's plans 03–06 cover the NewBadge prune + features.ts registry edit alongside the form sweep — same files, same review window (CONTEXT D-17).

---

## Phases

- [x] **Phase 12: Schema Foundation** — Dexie v5→v6 migration adds v1.2 fields and wires the multi-tab reload guard (completed 2026-05-21)
- [x] **Phase 13: Tax Model + UI Sweep** — Three-layer tax (region → Settings → per-job), tax breakdown row, unit tests, and compact/InfoTooltip sweep on touched forms (completed 2026-05-21)
- [ ] **Phase 14: Customer Details + Etsy Helper** — Customer fields on jobs, display in JobsManager, Etsy ToS collapsible checklist, and features.ts dead-badge cleanup
- [ ] **Phase 15: Tags, Search + Quick Duplicate** — Tag input + chip filter + free-text search in JobsManager, virtualized-list cache fix, and one-click duplicate with PII reset
- [ ] **Phase 16: Printable PDF Quote** — Lazy-loaded jsPDF quote generation, CI modulePreload assertion, font strategy, 300 KB gate verification

---

## Phase Details

### Phase 12: Schema Foundation
**Goal**: The Dexie database is on v6 with all v1.2 fields available, and a second browser tab opening after a schema upgrade reloads cleanly instead of crashing
**Depends on**: Phase 11 (v1.1 complete)
**Requirements**: SCHEMA-01, SCHEMA-02
**Success Criteria** (what must be TRUE):
  1. A saved job from v1.0 or v1.1 opens without error after the v6 upgrade — the job record loads with `tags: []` backfilled and all other new fields absent (undefined), and the app renders normally
  2. The v6 upgrade callback in `database.ts` sets `tags = []` on all existing job records; accessing `job.tags` on any loaded job never throws `TypeError: Cannot read properties of undefined`
  3. Opening the app in a second browser tab after one tab has triggered the v6 migration causes the second tab to reload automatically rather than displaying a blank white screen — `db.on('versionchange', () => window.location.reload())` is present in `database.ts`
  4. TypeScript types reflect all new optional fields on `PrintJob` (`tags?: string[]`, `customer?: JobCustomer`, `taxRate?: number`, `taxAmount?: number`) and `UserProfile` (`defaultTaxRate?: number`, `nextQuoteNumber?: number`) with no compilation errors
**Plans**: 4 plans
- [x] 12-01-PLAN.md — Extend `src/types.ts` with `JobCustomer` interface, 5 new `PrintJob` optional fields, and 2 new `UserProfile` optional fields (Wave 1, autonomous)
- [x] 12-02-PLAN.md — Extract `backfillTagsOnJob` pure helper into `src/db/backfill.ts` and unit-test it under jsdom (Wave 1, autonomous)
- [x] 12-03-PLAN.md — Add the Dexie v6 migration block and `db.on('versionchange', ...)` reload handler in `src/db/database.ts` (Wave 2, autonomous; depends on 12-02)
- [x] 12-04-PLAN.md — `npm run build` gate + real-browser UAT for v5→v6 migration and multi-tab reload (Wave 3, has checkpoint:human-verify; depends on 12-01, 12-02, 12-03)

### Phase 13: Tax Model + UI Sweep
**Goal**: Users can set, override, and see a tax rate on every job with correct rounding and order-of-operations, backed by a region default — and all currency/numeric inputs across touched forms use the compact/InfoTooltip pattern in one pass
**Depends on**: Phase 12
**Requirements**: TAX-01, TAX-02, TAX-03, TAX-04, TAX-05, UI-08, UI-09, UI-10
**Success Criteria** (what must be TRUE):
  1. User can set a default tax rate in Settings (Pricing tab); new jobs seed the tax row from this rate; the rate persists across sessions
  2. User can override the tax rate per job in the cost calculator; the per-job override is saved with the job and displayed when the job is reopened
  3. When the user has no Settings default and no per-job override, the tax row is seeded from `src/data/taxRates.ts` keyed by the user's currency/region — the region rate is shown alongside its `rateAsOf` date; US region shows 0% with a marketplace-facilitator note; an unknown region shows "enter manually" (never silently defaults to 0%)
  4. A "Tax (X%)" line appears in the cost breakdown after `sellingPrice`; the total displayed is `sellingPrice + taxAmount`; the tax row is hidden when rate is 0%
  5. The `calculateTax` unit tests in `costCalc.test.ts` pass: rate=0, EU/UK/AU rates, `rate=0.23 price=12.50 → taxAmount=2.88` (centime-rounding test), and the order-of-operations guard that asserts `taxAmount !== subtotal × rate` when depreciation > 0 — the existing `it.todo` is activated (not skipped)
  6. All currency, percentage, and numeric inputs in CostCalculator, AssetLibrary, JobsManager, PrinterSettings, and import modals use the `compact` prop on `<Input>`; descriptive placeholder text is replaced with `<InfoTooltip>` next to the label, with placeholders showing example values only
**Plans**: 6 plans
- [x] 13-01-PLAN.md — Create taxRates data + taxResolution util + tests (Wave 1, autonomous)
- [x] 13-02-PLAN.md — Append calculateTax + activate it.todo (Wave 1, autonomous)
- [x] 13-03-PLAN.md — SettingsModal Default Tax Rate field + InfoTooltip migrations + compact sweep (Wave 1, autonomous)
- [x] 13-04-PLAN.md — AssetLibrary + JobsManager + PrinterSettings UI sweep + AssetLibrary NewBadge cleanup (Wave 1, autonomous)
- [x] 13-05-PLAN.md — CostCalculator per-job Tax UI + Tax row + persistence + sweep + NewBadge cleanup (Wave 2, autonomous; depends on 13-01, 13-02)
- [x] 13-06-PLAN.md — UI-10 final cleanup: UserProfileModal + GcodeImport NewBadge removal + features.ts registry prune (Wave 3, autonomous; depends on 13-03, 13-04, 13-05)
**UI hint**: yes

### Phase 14: Customer Details + Etsy Helper
**Goal**: Users can attach optional customer details to a saved job, see the customer name in JobsManager, and check their Etsy compliance from the same screen — with stale NewBadge entries cleaned up
**Depends on**: Phase 12
**Requirements**: CUST-01, CUST-02, ETSY-01, ETSY-02
**Success Criteria** (what must be TRUE):
  1. A collapsible "Customer" section on the cost calculator accepts name, email, address (freeform), and optional company name; all fields are optional and the section is collapsed by default
  2. Customer name and email are visible on the saved-job row in JobsManager; full address appears only on the PDF (Phase 16)
  3. A collapsible "Selling on Etsy?" section on the cost calculator displays the `EtsyToSHelper` checklist sourced from `src/data/etsyToS.ts`; each checklist item is checkable by the user for self-review purposes
  4. The Etsy section displays a `policySummaryAsOf` date and a live link to `https://www.etsy.com/legal/creativity/`; a prominent disclaimer reads "Etsy's policies change — this is a reminder, not legal advice"; the checklist items do NOT appear on the customer PDF
  5. UI-10 has been completed by Phase 13 (CONTEXT D-17 fold-in); Phase 14 verifies the audit holds — `src/features.ts` still contains only the 4 fresh entries Phase 13 left, and no new stale `<NewBadge>` JSX has been introduced in CUST/ETSY work. If Phase 13's audit was complete, this criterion is a no-op verification step.
**Plans**: TBD
**UI hint**: yes

### Phase 15: Tags, Search + Quick Duplicate
**Goal**: Users can tag, filter, and search their saved jobs, and duplicate any job in one click — with all existing JobsManager virtualization remaining stable during filter/search changes
**Depends on**: Phase 12
**Requirements**: TAGS-01, TAGS-02, TAGS-03, TAGS-04, DUP-01, DUP-02
**Success Criteria** (what must be TRUE):
  1. User can add comma-separated tags to a saved job; tags are lowercased, trimmed, deduplicated, and capped at a maximum count; they persist as `tags: string[]` on the job record
  2. JobsManager shows a multi-select chip filter sourced from all tags in use across saved jobs; selecting one or more chips filters the list with AND logic
  3. A free-text search input in JobsManager filters by case-insensitive substring match across job title, customer name, and tags simultaneously
  4. When the filter or search changes, the virtualized list scrolls to the top and the `useDynamicRowHeight` cache is invalidated — no stale row heights or collapsed/overlapping cards after filtering; the cache key encodes `selectedJobId + filterTagKey + searchQuery`
  5. User can quick-duplicate a saved job from a row action in JobsManager; the duplicate appears immediately in the list; a unit test asserts that `duplicateJob(job).customer === undefined` (PII reset), and that `id`, `createdAt`, and `copiesSold` are reset to new values
**Plans**: TBD
**UI hint**: yes

### Phase 16: Printable PDF Quote
**Goal**: Users can download a professional PDF quote from any saved job — generated entirely client-side, lazy-loaded so the main app bundle stays under 300 KB gz, with a "Made with 3DCoster" footer on the free tier
**Depends on**: Phase 13 (tax rows must be correct) + Phase 14 (customer block must exist)
**Requirements**: PDF-01, PDF-02, PDF-03, PDF-04, PDF-05
**Success Criteria** (what must be TRUE):
  1. Clicking "Generate PDF" on a saved job in the cost calculator or JobsManager downloads a PDF containing: the 3DCoster header, auto-incremented quote number (persisted in `UserProfile.nextQuoteNumber`), valid-until date (30 days from generation), customer block (omitted if no customer details), line items, Subtotal / Tax (hidden at 0%) / Total, notes/terms section, and "Made with 3DCoster — 3dcoster.vercel.app" footer
  2. `jspdf` and `jspdf-autotable` are never present in a static `import` statement anywhere in `src/`; both load only via dynamic `import()` triggered by the "Generate PDF" button click; `npm run build && grep -r "import.*jspdf" src/` returns no matches
  3. `vite.config.ts` contains `build: { modulePreload: false }`; the CI assertion script `scripts/assert-no-pdf-preload.mjs` greps `dist/index.html` for `modulepreload` referencing the pdf chunk and exits non-zero if found; this script runs as part of `npm run build`
  4. The main app chunk remains under 300 KB gzipped after jsPDF is added — `scripts/assert-bundle-size.mjs` passes; `npm run analyze` confirms the pdf chunk is a separate async file not included in `index-*.js` or the `vendor` chunk
  5. PDF generation works in both web (browser save dialog) and Tauri desktop (Tauri file dialog); font rendering handles non-ASCII characters (accented letters, € symbol) without garbled glyphs; the font strategy (fetch from `/public/fonts/` or base64 in lazy chunk) is confirmed working in `npm run tauri:dev` before the plan is closed
**Plans**: TBD
**UI hint**: yes

---

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 12. Schema Foundation | 4/4 | Complete    | 2026-05-21 |
| 13. Tax Model + UI Sweep | 6/6 | Complete   | 2026-05-21 |
| 14. Customer Details + Etsy Helper | 0/? | Not started | — |
| 15. Tags, Search + Quick Duplicate | 0/? | Not started | — |
| 16. Printable PDF Quote | 0/? | Not started | — |

---

## Coverage Map

| Requirement | Phase | Category |
|-------------|-------|----------|
| SCHEMA-01 | Phase 12 | Schema |
| SCHEMA-02 | Phase 12 | Schema |
| TAX-01 | Phase 13 | Tax |
| TAX-02 | Phase 13 | Tax |
| TAX-03 | Phase 13 | Tax |
| TAX-04 | Phase 13 | Tax |
| TAX-05 | Phase 13 | Tax |
| UI-08 | Phase 13 | UI Sweep |
| UI-09 | Phase 13 | UI Sweep |
| CUST-01 | Phase 14 | Customer |
| CUST-02 | Phase 14 | Customer |
| ETSY-01 | Phase 14 | Etsy |
| ETSY-02 | Phase 14 | Etsy |
| UI-10 | Phase 13 | UI Sweep |
| TAGS-01 | Phase 15 | Tags |
| TAGS-02 | Phase 15 | Tags |
| TAGS-03 | Phase 15 | Tags |
| TAGS-04 | Phase 15 | Tags |
| DUP-01 | Phase 15 | Duplicate |
| DUP-02 | Phase 15 | Duplicate |
| PDF-01 | Phase 16 | PDF |
| PDF-02 | Phase 16 | PDF |
| PDF-03 | Phase 16 | PDF |
| PDF-04 | Phase 16 | PDF |
| PDF-05 | Phase 16 | PDF |

**Mapped: 25/25** — no orphans

---

## Dependency Graph

```
Phase 12 (Schema Foundation)  <-- foundation for all v1.2 phases
  ├── Phase 13 (Tax Model + UI Sweep)     -- reads taxRate, defaultTaxRate from v6 schema
  ├── Phase 14 (Customer Details + Etsy)  -- reads customer from v6 schema; can parallel with 13
  └── Phase 15 (Tags, Search + Duplicate) -- reads tags from v6 schema; can parallel with 13+14

Phase 13 + Phase 14 both merged → required before:
  └── Phase 16 (PDF Quote)  -- must render correct tax rows AND customer block
```

**Parallelizable after Phase 12:** Phases 13, 14, and 15 are independent of each other.
**Phase 16 hard gate:** Both Phase 13 and Phase 14 must be merged before Phase 16 can start.

---

*Roadmap created: 2026-05-20*
*Phase 12 plans created: 2026-05-21*
*Replaces: v1.1 Polish & Foundation roadmap (Phases 7–11, completed 2026-05-20)*
*Phase numbering continues from v1.1 — v1.2 phases start at Phase 12*
