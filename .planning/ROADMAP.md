# Roadmap: 3DCoster v1.2 — Quote-to-Customer

**Milestone:** v1.2 Quote-to-Customer
**Defined:** 2026-05-20
**Phase range:** 12–16 (v1.1 ended at Phase 11)
**Requirements:** 30 total (SCHEMA-01–02, TAX-01–05, CUST-01–02, CL-01–05, TAGS-01–04, DUP-01–02, PDF-01–05, ETSY-01–02, UI-08–10)
**Coverage:** 30/30 — 100%

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
- [x] **Phase 14: Customer Details + Etsy Helper** — Customer fields on sold work (revised mid-UAT to per-Sale per D-21), Recent Sales accordion with customer block, conditional Etsy ToS collapsible checklist (gated on marketplace=etsy per D-22), and features.ts dead-badge audit holds (completed 2026-05-22)
- [ ] **Phase 15: Tags, Search + Quick Duplicate** — Tag input + chip filter + free-text search in JobsManager, virtualized-list cache fix, and one-click duplicate with PII reset (initial round shipped with 4 gaps 2026-05-24; Round 1 closed A/C/D, Round 2 closing Gap E — edit-in-place title + inline chip strip)
- [x] **Phase 15.1: Customer Library (INSERTED)** — Customers as first-class assets: new Customers tab with CRUD + virtualized list + CSV bulk import + combobox picker in the Record Sale modal (with email-match auto-link). Dexie v6→v7 introduces a dedicated `customers` store; per-Sale customer remains a by-value snapshot for byte-identical historical sales (completed 2026-05-22)
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
**Plans**: 4 plans
- [x] 14-01-PLAN.md — CollapsibleSection primitive + types.ts etsyChecks extension + features.ts 2 new entries (Wave 1, autonomous)
- [x] 14-02-PLAN.md — Etsy data file etsyToS.ts + Etsy CollapsibleSection card on CostCalculator + etsyChecks 6-site state wiring (Wave 2, autonomous; depends on 14-01)
- [x] 14-03-PLAN.md — Customer CollapsibleSection card on CostCalculator + JobsManager subline + expanded-panel Customer block + customer 6-site state wiring (Wave 3, autonomous; depends on 14-01, 14-02) — superseded mid-UAT by D-21..D-24 rewrite (commits `eca103b`, `c56870f`, `5ec4aa7`)
- [x] 14-04-PLAN.md — UAT + UI-10 audit + features.ts grep gate + verification record (Wave 4, has checkpoint:human-verify; depends on 14-01, 14-02, 14-03) — closed 2026-05-22 with user-approved scope reversal landing D-21..D-24
**UI hint**: yes

### Phase 15: Tags, Search + Quick Duplicate
**Goal**: Users can tag, filter, and search their saved jobs, and duplicate any job in one click — with all existing JobsManager virtualization remaining stable during filter/search changes
**Depends on**: Phase 12
**Requirements**: TAGS-01, TAGS-02, TAGS-03, TAGS-04, DUP-01, DUP-02
**Success Criteria** (what must be TRUE):
  1. User can add comma-separated tags to a saved job; tags are lowercased, trimmed, deduplicated, and capped at a maximum count; they persist as `tags: string[]` on the job record
  2. ~~JobsManager shows a multi-select chip filter sourced from all tags in use across saved jobs; selecting one or more chips filters the list with AND logic~~ — **WITHDRAWN 2026-05-24** per user product feedback (chip strip redundant with TAGS-03 search); see `.planning/phases/15-tags-search-quick-duplicate/15-VERIFICATION.md` Gap C
  3. A free-text search input in JobsManager filters by case-insensitive substring match across job title, customer name, and tags simultaneously
  4. When the filter or search changes, the virtualized list scrolls to the top and the `useDynamicRowHeight` cache is invalidated — no stale row heights or collapsed/overlapping cards after filtering; the cache key encodes `selectedJobId + searchQuery` (narrowed from tri-key to bi-key after SC#2 withdrawal)
  5. ~~User can quick-duplicate a saved job from a row action in JobsManager; the duplicate appears immediately in the list;~~ **(row-action UI WITHDRAWN 2026-05-24 per Gap D — DUP-01 deferred to v1.3+)** — narrowed to: a `duplicateJob()` helper exists in `src/utils/duplicateJob.ts` with a locked unit test asserting `duplicateJob(job).customer === undefined` (PII reset), and that `id`, `createdAt`, and `copiesSold` are reset to new values (DUP-02 — passes 7/7 cases including the D-15 contract); see `.planning/phases/15-tags-search-quick-duplicate/15-VERIFICATION.md` Gap D
**Plans**: 12 plans (6 original + 5 gap-closure Round 1 + 1 gap-closure Round 2)
- [x] 15-01-PLAN.md — normalizeTagsOnJob pure helper in src/db/backfill.ts + 6 Vitest cases (D-02 + D-12) — TAGS-01 reconcile foundation (Wave 1, autonomous)
- [x] 15-02-PLAN.md — duplicateJob + nextCopyName pure helpers in src/utils/duplicateJob.ts + D-15 locked test contract + by-value isolation tests (D-08 + D-09 + D-15) — DUP-02 (Wave 1, autonomous, LOCKED post-ship)
- [x] 15-03-PLAN.md — parseTagsInput shared parser in src/db/backfill.ts + CostCalculator tag input field with NewBadge label-inline (D-01 + D-02 + D-13) — TAGS-01 input surface a (Wave 2, autonomous; depends on 15-01)
- [x] 15-04-PLAN.md — JobsManager sticky sub-header (search bar + chip filter + AND logic + 250ms debounce + filter-empty-state) + extend useDynamicRowHeight cache key to pipe-delimited tri-key (D-03 + D-04 + D-05 + D-06 + D-10 + D-14) — TAGS-02 + TAGS-03 + TAGS-04 (Wave 2, autonomous; depends on 15-01)
- [x] 15-05-PLAN.md — JobsManager JobCard tag chips + inline tag editor + [⋯] overflow menu with Duplicate + post-duplicate scroll/highlight + features.ts 3 entries + useJobs init wiring of normalizeTagsOnJob (D-07 + D-11 + D-12 + D-13) — TAGS-01 surface b + DUP-01 (Wave 3, autonomous; depends on 15-01, 15-02, 15-03, 15-04)
- [x] 15-06-PLAN.md — Automated chain (tsc + vitest + build) + human UAT against all 5 ROADMAP Success Criteria + all 15 D-XX decisions + VERIFICATION.md (Wave 4, checkpoint:human-verify; depends on 15-01..15-05) — verdict `gaps-found` (4 gaps A/B/C/D)
- [x] 15-07-PLAN.md — **Gap A**: Remove CostCalculator tag input row (Wave 5 of gap closure, autonomous; gap_closure: true; files: src/components/CostCalculator.tsx)
- [x] 15-08-PLAN.md — **Gap D**: Remove `[⋯]` overflow menu + post-duplicate ring + features.ts `quick-duplicate` entry; DUP-02 helper + tests preserved byte-identically (Wave 5 of gap closure, autonomous, parallel-safe with 15-07; gap_closure: true; files: src/components/JobsManager.tsx, src/features.ts)
- [x] 15-09-PLAN.md — **Gap C**: Remove chip-filter row + selectedChips/tagCounts/jobsAfterChipFilter memos; narrow useDynamicRowHeight cache key from tri-key to pipe-delimited bi-key; rename "Clear filters" → "Clear search" (Wave 6 of gap closure, autonomous; depends on 15-08; gap_closure: true; files: src/components/JobsManager.tsx)
- [x] 15-10-PLAN.md — **Gap B**: Replace pencil-button tag editor with title-click inline panel (title + tags in one panel) + hover Tag icon affordance; re-target `feature="tags"` NewBadge to overlay the hover Tag icon; add explicit chevron-button for accordion selection toggle (Wave 7 of gap closure, autonomous; depends on 15-08, 15-09; gap_closure: true; files: src/components/JobsManager.tsx)
- [x] 15-11-PLAN.md — Gap-closure Round 1 verification: automated chain + human UAT against Gap A/B/C/D surfaces; verdict approved-with-gaps — Gaps A/C/D closed, Gap B reopens as Gap E (Wave 8 of gap closure, checkpoint:human-verify; depends on 15-07..15-10; gap_closure: true; files: .planning/phases/15-tags-search-quick-duplicate/15-VERIFICATION.md, .planning/STATE.md)
- [ ] 15-12-PLAN.md — **Gap E** (Round 2): Replace Plan-15-10 dropped-down panel with edit-in-place title + inline chip strip with hover ✕ + `+` add-tag affordance with usage-suggesting placeholder + tag cap of 10. Round 2 D-16/D-17/D-18 lock overflow strategy (wrap), add-tag input width (narrow 12ch), Tag icon + NewBadge anchor (preserved). Component tests (4 cases — a/b/c/d) appended. (Wave 1 of Round 2, autonomous; depends on 15-10; gap_closure: true; gap_closure_round: 2; files: src/components/JobsManager.tsx, src/components/JobsManager.test.tsx)
**UI hint**: yes

### Phase 15.1: Customer Library (INSERTED)
**Goal**: Customers as first-class assets — new main nav tab with CRUD, bulk CSV import, and a dropdown picker (or add-new inline) in the Record Sale modal. Unblocks the "pick a saved customer" workflow Phase 16 (PDF Quote) will draw on so quotes can be generated for a chosen customer without retyping fields. Customer Library uses its own Dexie store; per-Sale customer remains a snapshot of values at sale time (not a foreign-key reference) so historical sales never mutate when a Customer record is later edited.
**Depends on**: Phase 14 (Sale.customer shape exists) + Phase 15 (Tags/Search patterns may inform the picker UI)
**Requirements**: CL-01, CL-02, CL-03, CL-04, CL-05
**Success Criteria** (what must be TRUE):
  1. A new top-level "Customers" tab in the main nav lets users view a virtualized list of saved Customer records (Name, Email, Company, Address, Notes, last-used date) with create/edit/delete affordances. The Notes field captures buyer-bound quirks/preferences (already added to `JobCustomer` in a Phase 14 post-closure follow-up on 2026-05-22; the library inherits the field for free)
  2. Bulk CSV import: user drops a CSV with name/email/company/address columns; preview screen shows N rows + validation errors per row; on confirm, new Customer records are written to a dedicated Dexie store; existing customers (matched by email case-insensitive) are skipped or updated per user choice
  3. The Record Sale modal Customer block grows a "Select existing customer" combobox above the 4 fields; picking a saved customer fills the 4 fields (still editable — the saved Customer is the source, the per-Sale snapshot is the copy); "Add new" inline saves to the library on submit
  4. Historical sales' `sale.customer` payloads are NEVER mutated when a Customer library record is later edited — the per-sale snapshot is by-value, not a foreign-key reference (audit: a unit test edits a customer record then asserts the corresponding sale's customer field is byte-identical to its pre-edit value)
  5. The new Customer store sits alongside existing Material / Printer / etc. stores in a Dexie version bump (v6 → v7) with a migration step that backfills nothing (the store starts empty; D-18 schema-extension pattern does not apply — this is a new STORE, not a new field on existing records)
**Plans**: 5 plans
- [x] 15.1-01-PLAN.md — Foundation: `Customer` type + Dexie v7 `customers` store + `useCustomers()` hook + REQUIREMENTS update + by-value snapshot audit test (Wave 1, autonomous)
- [x] 15.1-02-PLAN.md — Customers tab UI: `CustomerLibrary.tsx` + `CustomerEditModal.tsx` + `App.tsx` tab wiring (Wave 2, autonomous; depends on 15.1-01)
- [x] 15.1-03-PLAN.md — CSV import: `src/utils/customerCsv.ts` + `CustomerCsvImportModal.tsx` + CustomerLibrary "Import CSV" wiring (Wave 2, autonomous; depends on 15.1-01)
- [x] 15.1-04-PLAN.md — Record Sale combobox picker + email-match auto-link + auto-create from typed values (Wave 3, autonomous; depends on 15.1-01, 15.1-02)
- [x] 15.1-05-PLAN.md — NEW badge wiring on Customers tab + final build gate + UAT verification (Wave 4, has checkpoint:human-verify; depends on 15.1-02, 15.1-03, 15.1-04)
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
**Plans**: 13 plans (5 original — shipped + UAT — plus 8 gap-closure plans authored 2026-05-23)
- [x] 16-01-PLAN.md — Wave 0: install jspdf + autotable + Tauri dialog/fs plugins; CI gate scripts; subset Noto Sans; test scaffolds (Wave 0, autonomous, SHIPPED)
- [x] 16-02-PLAN.md — Wave 1: pure utilities (formatQuoteNumber + customerNameSlug + taxLabelFor); UserProfile.defaultTerms; pdf-quote features.ts entry (Wave 1, autonomous, SHIPPED)
- [x] 16-03-PLAN.md — Wave 2: src/pdf/generateQuotePdf.ts full PDF generator + 21 integration tests (Wave 2, autonomous, SHIPPED)
- [x] 16-04-PLAN.md — Wave 3: Generate PDF buttons (CostCalculator + JobsManager); UserProfileModal defaultTerms; vite.config.ts modulePreload (Wave 3, autonomous, SHIPPED)
- [x] 16-05-PLAN.md — Wave 4: automated verification chain + UAT — surfaced 8 gaps (Wave 4, checkpoint, SHIPPED with gaps_found verdict)
- [x] 16-06-PLAN.md — Gap A / D-13: Remove Generate PDF from CostCalculator (Wave 0 of gap closure, autonomous; depends on 16-04)
- [x] 16-07-PLAN.md — Gap B / D-14: Rename JobsManager button to Print Quote + secondary variant (Wave 0 of gap closure, autonomous; depends on 16-04)
- [x] 16-08-PLAN.md — Gap H / D-21: Tax-fallback bug fix at CostCalculator save sites + Phase 13 Sale-write audit (Wave 1 of gap closure, autonomous; depends on 16-06, 16-07)
- [x] 16-09-PLAN.md — Gaps C+E / D-15+D-17+D-22: Quote interface + Dexie v7→v8 migration with locked backfill test + refactor generateQuotePdf to take Quote arg + Shipping row (Wave 2 of gap closure, autonomous; depends on 16-07, 16-08)
- [x] 16-10-PLAN.md — Gap D / D-16+D-18: PrintQuoteModal with customer picker + transactional Quote write + counter increment site moves here (Wave 3 of gap closure, autonomous; depends on 16-09)
- [x] 16-11-PLAN.md — Gap F / D-19: Recent Quotes section in JobsManager accordion + status pills + Mark Accepted/Declined/Reopen + back-ref link (Wave 4 of gap closure, autonomous; depends on 16-10)
- [x] 16-12-PLAN.md — Gap G / D-20: Convert to Sale with transactional Sale+Quote update (Wave 5 of gap closure, autonomous; depends on 16-11)
- [x] 16-13-PLAN.md — Gap-closure UAT: re-run 7 original scenarios + 7 new extension scenarios + decision-coverage verification (Wave 6 of gap closure, checkpoint; depends on 16-06..16-12)
**UI hint**: yes

---

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 12. Schema Foundation | 4/4 | Complete    | 2026-05-21 |
| 13. Tax Model + UI Sweep | 6/6 | Complete    | 2026-05-21 |
| 14. Customer Details + Etsy Helper | 4/4 | Complete    | 2026-05-22 |
| 15. Tags, Search + Quick Duplicate | 11/12 | In Progress (Round 2 — Gap E) |  |
| 15.1. Customer Library (INSERTED) | 5/5 | Complete    | 2026-05-22 |
| 16. Printable PDF Quote | 12/13 | In Progress|  |

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
| TAGS-02 | Phase 15 | Tags (Withdrawn 2026-05-24) |
| TAGS-03 | Phase 15 | Tags |
| TAGS-04 | Phase 15 | Tags |
| DUP-01 | Phase 15 | Duplicate (Withdrawn-from-v1.2 2026-05-24) |
| DUP-02 | Phase 15 | Duplicate |
| CL-01 | Phase 15.1 | Customer Library |
| CL-02 | Phase 15.1 | Customer Library |
| CL-03 | Phase 15.1 | Customer Library |
| CL-04 | Phase 15.1 | Customer Library |
| CL-05 | Phase 15.1 | Customer Library |
| PDF-01 | Phase 16 | PDF |
| PDF-02 | Phase 16 | PDF |
| PDF-03 | Phase 16 | PDF |
| PDF-04 | Phase 16 | PDF |
| PDF-05 | Phase 16 | PDF |

**Mapped: 30/30** — no orphans

---

## Dependency Graph

```
Phase 12 (Schema Foundation)  <-- foundation for all v1.2 phases
  ├── Phase 13 (Tax Model + UI Sweep)     -- reads taxRate, defaultTaxRate from v6 schema
  ├── Phase 14 (Customer Details + Etsy)  -- reads customer from v6 schema; can parallel with 13
  └── Phase 15 (Tags, Search + Duplicate) -- reads tags from v6 schema; can parallel with 13+14

Phase 14 + Phase 15 → Phase 15.1 (Customer Library)
  └── adds Dexie v6→v7 `customers` store; combobox picker grafted into Phase 14's Record Sale modal

Phase 13 + Phase 14 both merged → required before:
  └── Phase 16 (PDF Quote)  -- must render correct tax rows AND customer block
```

**Parallelizable after Phase 12:** Phases 13, 14, and 15 are independent of each other.
**Phase 16 hard gate:** Both Phase 13 and Phase 14 must be merged before Phase 16 can start.
**Phase 15.1 hard gate:** Phases 14 (Sale.customer shape) and 15 (JobsManager Record Sale modal stable) must be merged before Phase 15.1 can start.

---

*Roadmap created: 2026-05-20*
*Phase 12 plans created: 2026-05-21*
*Phase 15.1 inserted: 2026-05-22 — CL-01..CL-05 authored during plan-phase*
*Phase 15 plans created: 2026-05-24 — 6 plans across 4 waves authored from 15-CONTEXT.md (D-01..D-15)*
*Phase 15 gap-closure plans created: 2026-05-24 — 5 plans (15-07..15-11) across waves 5-8 authored from 15-VERIFICATION.md Gap A/B/C/D + final gap-closure UAT*
*Phase 15 gap-closure Round 2 plan created: 2026-05-24 — 1 plan (15-12) authored from 15-VERIFICATION.md Gap E acceptance contract (Round 1 Gap B rejected at UAT; Round 2 resolves D-16/D-17/D-18 for edit-in-place surface)*
*Replaces: v1.1 Polish & Foundation roadmap (Phases 7–11, completed 2026-05-20)*
*Phase numbering continues from v1.1 — v1.2 phases start at Phase 12*
