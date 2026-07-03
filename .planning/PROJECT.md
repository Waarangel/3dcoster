# 3DCoster

## What This Is

3DCoster is a 3D printing cost calculator that helps hobbyists and small businesses accurately price their prints. It runs as a web app (Vercel) and desktop app (Tauri), storing all data locally in IndexedDB. The core application is free forever — paid tiers (when launched) cover white-label branding, hosted infrastructure, live marketplace/accounting integrations, and automation/AI.

## Core Value

Accurate cost calculation for 3D prints so users can price jobs correctly, maintain profitability, and present professional quotes to their customers — from a free, local-first tool.

## Last Shipped Milestone: v1.9 Hardening — 2026-07-03

4 phases (34–37), 11 plans, **14/15 requirements** (PERF-11 reverted as a pricing regression → v2.0). Code: 102 commits / 115 files / +11,713 −1,291 since `v1.8.0`. Web deployed + desktop tag `v1.9.0` same day.

**Key wins:**
- Asset-Library scoped reset — fixed silent custom-category data-loss; deleted defaults stay deleted (persisted `seedState`)
- Marketplace-fee correctness — fixed fees FX-converted (~150× JPY fix); quoted margin/profit folded to NET of fees (`pricingInterlink.ts`); break-even netted
- A11Y Tier 4 closed (A11Y-10..15) — roving-tabindex App + Settings tabs, shared `ConfirmModal`, role=alert errors, carousel pause/reduced-motion
- Perf: JobsManager quotes subscriptions 160 → 1; O(1) `materialsById` lookups
- Security: npm audit 19 → 0 CVEs, WHATWG URL parser, Tauri fs scope narrowed, 3MF zip-bomb guards
- Papercuts: PWA Reload works on uncontrolled pages; ScrollToTop; edit-job scroll-to-banner
- Process: 2 release-diff review passes + 5-lens app audit + full UAT; review caught + reverted the PERF-11 regression tests missed

Full delivery map: [milestones/v1.9-ROADMAP.md](milestones/v1.9-ROADMAP.md). Review artifacts: `v1.9-RELEASE-REVIEW.md`, `v1.9-AUDIT.md`, `v1.9-UAT-CHECKLIST.md`.

<details>
<summary>v1.3 Hardening SHIPPED 2026-05-28 (collapsed)</summary>

10 phases (18–26), 43 plans, 56 tasks, 53 requirements satisfied (100%), audit verdict: **passed**. Code: 54 src files changed, +13,221 / −4,266 LOC over 322 commits in 4 days.

**Key wins:**
- `<Modal>` primitive + 10-surface a11y migration (Phase 19) — A11Y-01..A11Y-08 + HYG-09
- JobsManager decomposed 2067 → 1474 LOC via `RecordSaleModal` + `SaleRow` + `useCustomerPicker` + `useAllSales` (Phase 22)
- Dexie atomicity sweep + transactional safety on `addSale`/`createQuote`/v9 upgrade (Phase 20)
- CSV formula-injection + javascript: URL sanitization (Phase 21)
- Break-even formula reconciliation between Calculator and JobsManager (Phase 22.1, inserted)
- Test coverage hardening: 3 Customer-UI test files + real-Dexie migration test via `fake-indexeddb` (Phase 23)
- Tauri 2.11.x upgrade eliminating dual-copy `@tauri-apps/api` (Phase 18 + 24)
- 8 VALIDATION.md files brought to Nyquist-compliant state + REQUIREMENTS.md doc-lag sync + CustomerCsvImportModal layout parity (Phase 26 cleanup)

Full delivery map: [milestones/v1.3-ROADMAP.md](milestones/v1.3-ROADMAP.md). Audit: [milestones/v1.3-MILESTONE-AUDIT.md](milestones/v1.3-MILESTONE-AUDIT.md).

</details>

<details>
<summary>v1.2 Quote-to-Customer SHIPPED 2026-05-25 (collapsed)</summary>

3DCoster grew from a personal cost calculator into a complete quote-to-customer tool. Users can attach customer details to sales, manage a Customer Library with CSV bulk import, generate lazy-loaded PDF quotes with proper tax handling (three-layer model), tag and search their job history, and self-check Etsy ToS compliance — all local-first, all free-tier.

**Shipped** (7 phases, 45 plans, 6 days): Three-layer tax model · Per-Sale customer details · Customer Library (inserted Phase 15.1) with CSV import + combobox picker · Edit-in-place tags + free-text search · Printable PDF quote flow with Quote ↔ Sale linkage and Convert-to-Sale · Etsy ToS helper conditional on `marketplace === 'etsy'` · Dexie v5→v6→v7→v8 migrations · UI consistency sweep + `features.ts` registry pruned.

Full delivery map: [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md). Audit: [milestones/v1.2-MILESTONE-AUDIT.md](milestones/v1.2-MILESTONE-AUDIT.md) (verdict: `tech_debt` — 0 blockers, 7 deferred items, all rolled into v1.3).

</details>

<details>
<summary>Original v1.2 target features (archived)</summary>

**Goal:** Turn 3DCoster from a personal cost calculator into a tool that produces professional, customer-ready quotes — with proper tax handling, customer details, an organized job library, and a real PDF deliverable.

**Target features:**
- Tax / VAT on jobs — three-layer model: region/country lookup default → Settings override → per-job override (activates the existing `it.todo` in `costCalc.test.ts`)
- Customer details on jobs — optional name / email / address persisted per saved job
- Editable tags + filter/search on `JobsManager` — user-defined string tags, chip filter, free-text search across title/customer/tags
- Printable PDF quote — client-side PDF library (jspdf / pdf-lib / react-pdf — chosen during plan-phase research), **lazy-loaded** to stay under Phase 11's 300 KB gz main-chunk gate; free tier renders "Made with 3DCoster" footer (white-label deferred to paid tier)
- Quick duplicate — one-click duplicate of a saved job in `JobsManager`
- Etsy ToS compliance helper — inline checklist / guidance for sellers, surfaced on the job edit screen and the PDF
- UI consistency sweep — Input `compact` rollout, `<InfoTooltip>` replacing descriptive placeholders, `features.ts` dead-badge cleanup

**Shipped variations:** TAGS-02 chip filter withdrawn (redundant with TAGS-03 search). DUP-01 row-action UI withdrawn-from-v1.2 (deferred to v1.4+); helper DUP-02 ships standalone for future consumers. Customer details moved from PrintJob → Sale mid-UAT (D-21). Etsy section gated on marketplace=etsy (D-22). Customer Library (Phase 15.1) inserted mid-milestone. Phase 17 inserted as closure for PDF-04 Rollup chunk-ordering regression surfaced by audit.

</details>

## Current Milestone: v2.0 Cost-Truth & Insight

**Goal:** Turn 3DCoster from a calculator into a cost-truth engine and launch the business — deeper cost realism, decision-grade insights, the hosted/Pro tier with a GDPR-compliant legal foundation, the new brand, and a guided first-run.

**Scope decision (2026-07-03): FULL VISION in one milestone**, sequenced foundation → free-floor insight wave → backend/Pro launch crescendo.

**Target features:**
- **Foundation:** CostCalculator God-component split (+ PERF-11 done right), tab-in-URL routing (fixes browser-Back exiting `/app`)
- **Cost realism (moat):** empirical failure-cost engine (per printer × material failure rates folded into true cost) · time-of-use electricity modeling · abrasive wear + maintenance amortization
- **Insight & decisions:** true hourly wage + product profitability ranking · printer payback/ROI tracker (retrospective P&L) · what-if margin sensitivity simulator
- **Connected cost:** filament-price → catalog reprice alerts · **instant-quote share link** (free local floor via in-browser mesh-volume estimate; Pro hosted quote page — the backend anchor)
- **Maker-life:** spool lifecycle/moisture tracking · hobby→business tax-threshold tracker
- **Architecture:** local-network / file-based sync (multi-device WITHOUT a backend — the headline differentiator)
- **Launch bundle:** hosted/Pro backend tier (floor & ceiling model) · **GDPR cookie-consent banner (granular, revocable) + EU-compliant privacy policy + Terms** · marketing-site redesign ("Cost-Truth Dark", `test/design-skills-experiment`) · **guided first-run onboarding (Tier 3.1 — headline UX)**
- **Small carry-ins:** `etsy_offsite_ad` in RecordSaleModal picker; candidates as scope allows: TAGS-F4 tag colors, DUP-F1 duplicate-job UI, customer CSV export

**Explicitly DECLINED (do not re-add):** print-farm queue/scheduling optimizer; live competitor-price scraping (manual paste-a-price is the acceptable substitute).

**Key context:** All v2.0 feature detail stays INTERNAL until launch (public /roadmap untouched — don't tip competitors). Existing seeds: `feat/insight-pricing-coach` branch (Phase 33) + redesign branch. Pro price anchor: 3DPrintQuote at €9.90/mo. Free-forever promise holds — every cost-model improvement ships to the free floor.

## Requirements

### Validated (shipped)

**Core (pre-GSD):**
- ✓ Single-filament cost calculation per job
- ✓ Printer depreciation and nozzle wear calculation
- ✓ Job save/edit/delete with break-even tracking
- ✓ Sales recording with marketplace fee calculation
- ✓ Session storage form persistence
- ✓ Post-processing materials tracking (consumables, finishing)
- ✓ Asset library with CSV import/export
- ✓ Multi-currency (18 currencies) + regional unit auto-switching
- ✓ PWA / offline support + Tauri desktop builds

**v1.0 Multi-Material Support (shipped 2026-04-15):**
- ✓ Multiple filaments per job with per-filament weight and cost tracking
- ✓ G-code import (Bambu Studio, PrusaSlicer, Cura, OrcaSlicer, SuperSlicer, IdeaMaker)
- ✓ Auto-match each imported filament independently
- ✓ Per-filament price override persisted on saved jobs
- ✓ Nozzle wear uses correct per-material density (fixed pre-existing PLA-only bug)
- ✓ Dexie migration to `filaments[]` array (single-filament jobs preserved)
- ✓ JobsManager displays all filaments per job
- ✓ 3MF Multi-Plate Project Import (Bambu `tray_info_idx` mapping)

**Outside-milestone single features:**
- ✓ Default profit margin setting (2026-05-18) — user-configurable in Settings → Pricing
- ✓ Printer maintenance alerts (500h intervals)

**v1.1 Polish & Foundation (shipped 2026-05-20):**
- ✓ Shared `src/components/ui/` primitives used across 14 main components; grep-based lint guard + pre-commit hook (Phase 7)
- ✓ Empty-state components with CTAs on Asset library / Jobs / Printer Settings (Phase 8)
- ✓ Skeleton loading components shown during initial IndexedDB load (Phase 9)
- ✓ Vitest unit-test coverage for cost-calculation logic — material, electricity, depreciation, nozzle wear, labor, failure rate (Phase 10)
- ✓ vite `manualChunks` splits vendor (react-vendor / dexie-vendor / vendor) + JobsManager and AssetLibrary virtualization via react-window v2; 300 KB gz build gate enforced (Phase 11)

**v1.2 Quote-to-Customer (shipped 2026-05-25):**
- ✓ **SCHEMA-01/02** — Dexie v5→v6 adds optional `tags[]` / `customer` / `taxRate` / `taxAmount` on `PrintJob` and `defaultTaxRate` / `nextQuoteNumber` on `UserProfile`; `versionchange` reload handler eliminates multi-tab white-screen crash (Phase 12)
- ✓ **TAX-01..TAX-05** — three-layer tax model (region default → Settings → per-job override); `calculateTax(sellingPrice, ratePercent)` unit-tested incl. order-of-operations guard (Phase 13)
- ✓ **UI-08/09/10** — `compact` `<Input>` rollout + `<InfoTooltip>` replaces descriptive placeholders; `features.ts` pruned from 12 → 4 fresh entries (Phase 13)
- ✓ **CUST-01/02 + ETSY-01/02** — per-Sale customer fields (mid-UAT D-21 reversal) + Etsy ToS helper gated on `marketplace === 'etsy'` (D-22) (Phase 14)
- ✓ **TAGS-01/03/04** — free-text tags (lowercase/trim/dedupe/cap-10) with edit-in-place inline chip strip; JobsManager search across title/customer/tags; bi-key cache invalidates virtualized-list rows on filter change (Phase 15) — **TAGS-02 withdrawn** (chip filter superseded by search 2026-05-24)
- ✓ **DUP-02** — `duplicateJob()` helper with locked 7-case Vitest contract (PII reset, by-value isolation) (Phase 15) — **DUP-01 withdrawn-from-v1.2** (UI deferred to v1.3+ richer surface)
- ✓ **CL-01..CL-05** — Customers tab with virtualized list + CSV bulk import (Skip/Update duplicates) + Record Sale combobox picker with email auto-link; per-Sale snapshot stays by-value (Phase 15.1)
- ✓ **PDF-01..PDF-05** — lazy-loaded jsPDF quote (300 KB gz gate intact) with PrintQuoteModal + Recent Quotes accordion + Convert-to-Sale flow; Dexie v7→v8 introduces Quote interface; PDF-04 closed by Phase 17 manualChunks reorder + CI gate
- ✓ **NYQ-01..NYQ-05** — Nyquist validation contracts authored for Phases 13/15/15.1/17 + Phase 13 visual UAT closed (2 IndexedDB smoke tests + 6 rubber-stamped against phases 14-17 in-prod evidence); Phase 18 review carryover WR-01/02/03 also closed (collapsed forbidden-path test, Tauri 2.11.x crate + `@tauri-apps/api ^2.11.0` dedup, `startsWith('forbidden path:')` anchored matcher) (Phase 24)
- ✓ **DOC-01, DOC-02, HYG-01, HYG-04, HYG-05, HYG-10, A11Y-09, POL-01..POL-04, PERF-05, PERF-06** — Doc-state lag closed (TAGS-01/04 flipped, CUST-01/02 wording-drift archive note); JobsManager hygiene (`generatingJobIds` slot removed, `onQuoteCreated` made optional, image5 absence comment, `ui-consistency-sweep` audit); CustomerLibrary row alignment + CSV template download; jspdf module augmentation replaces `(doc as any)` cast; QuoteRow overflow menu outside-click + Escape; QuoteStatusPill `aria-label` + Declined-pill contrast; Rollup circular-chunk warning eliminated by routing all `react-*` packages (incl. `scheduler`) into `react-vendor` (Phase 25)

### Validated — v1.3 Hardening (shipped 2026-05-28)

All 53 v1.3 requirements satisfied. Snapshot: [milestones/v1.3-REQUIREMENTS.md](milestones/v1.3-REQUIREMENTS.md).

- ✓ **DESK-01** — Tauri `fs:scope` fix (Phase 18)
- ✓ **A11Y-01..A11Y-08, HYG-09** — `<Modal>` primitive + 10-surface migration with focus trap, scroll-lock, useId-labeled fields, virtualized-list ARIA, CollapsibleSection always-rendered (Phase 19)
- ✓ **DATA-01..DATA-06** — Dexie atomicity sweep: `addSale` + `createQuote` + v9 upgrade wrapped in `db.transaction('rw',...)`; `parsePositiveNumber` rejects 0; async `versionchange` close; `getSetting<T>` validator (Phase 20)
- ✓ **DATA-07** — `reconcileFixedCostsAtSave` WR-01-hardened useEffect snapshots `{depreciation, nozzleWear}` on saved jobs (Phase 22.1)
- ✓ **SEC-01..SEC-03** — `sanitizeCsvCell` at all 4 Papa.unparse boundaries; `isSafeHttpUrl` render-time guard for `job.modelUrl`; customerCsv parser-passthrough regression locks (Phase 21)
- ✓ **HYG-02, HYG-03, HYG-06, HYG-07, HYG-08, PERF-01..PERF-04, PERF-07** — JobsManager decomposition: `<RecordSaleModal>`, `<SaleRow>`, `useCustomerPicker`, `<SearchIcon>`, `breakEvenMap` pre-compute, `useAllSales` hook; JobsManager.tsx 2067 → 1474 LOC (Phase 22)
- ✓ **PERF-08** — JobsManager break-even pill formula brought into byte-equivalence with the Calculator widget; round-trip test locks it (Phase 22.1)
- ✓ **TEST-01..TEST-06** — `CustomerEditModal.test.tsx` (7 it, locks D-01), `CustomerCsvImportModal.test.tsx` (6 it), `CustomerLibrary.test.tsx` (7 it + CL-01 sort lock), `database.migrations.test.ts` promoted to real-Dexie via `fake-indexeddb`, `dbJobsPutSpy` retyped `any` → `PrintJob`, DUP-02 split into 6 named `it()` (Phase 23)
- ✓ **NYQ-01..NYQ-05** — VALIDATION.md backfilled for Phase 13/15/15.1/17; Phase 13 visual UAT closed with 2 smoke tests + 6 in-prod rubber-stamps; Phase 18 review WR-01/02/03 closed (collapsed forbidden-path test, Tauri 2.11.x dedup, `startsWith('forbidden path:')` matcher) (Phase 24)
- ✓ **A11Y-09, DOC-01, DOC-02, HYG-01, HYG-04, HYG-05, HYG-10, PERF-05, PERF-06, POL-01..POL-04** — Doc-state lag closed (TAGS-01/04 flipped, CUST-01/02 archive note); JobsManager hygiene (`generatingJobIds` slot removed, `onQuoteCreated` made optional, image5 absence comment, `ui-consistency-sweep` audit); CustomerLibrary row alignment; CSV template download; jspdf module augmentation; QuoteRow overflow menu outside-click + Escape; QuoteStatusPill `aria-label` + Declined contrast (Phase 25)
- ✓ **DOC-03, DOC-04, POL-05** — v1.3 audit cleanup: 8 VALIDATION.md files Nyquist-compliant (Phase 18/20/22/22.1 flipped, Phase 19/23/24/25 backfilled); REQUIREMENTS.md DATA-07/PERF-08 sync; CustomerCsvImportModal layout parity with asset modal — template block above upload zone with `👥 Customer template` label (Phase 26)

### Validated — v1.9 Hardening (shipped 2026-07-03)

14/15 requirements satisfied (PERF-11 deferred). Snapshot: [milestones/v1.9-REQUIREMENTS.md](milestones/v1.9-REQUIREMENTS.md).

- ✓ **FIX-01..FIX-04** — PWA Reload on uncontrolled pages; ScrollToTop nav; styled Reset-all confirm; edit-job scroll-to-banner (Phase 34)
- ✓ **A11Y-10..A11Y-15** — Settings roving-tabindex arrow nav (WCAG Crit); form-error role=alert + aria-invalid/describedby (WCAG Crit); icon-button labels; FilamentSelector accessible name; 24×24 tag-chip targets; AA cleanups (Phase 35)
- ✓ **PERF-09, PERF-10** — useQuotes lifted to JobsManager parent (160→1 subscriptions); materialsById O(1) Map (Phase 36)
- ⚠️ **PERF-11** — REVERTED (dep-trim desynced profit/margin on consecutive same-field edits — caught by release review, not tests). Deferred to v2.0 with the CostCalculator split.
- ✓ **HYG-11, HYG-12** — index-mutation immutability fixes; Promise.all batched init reads; validated narrowing over `as` casts (Phase 37)
- ✓ **Plus review/audit/UAT-driven fixes outside the requirement set:** scoped Asset-Library reset (data-loss), deleted-defaults persistence (`seedState`), marketplace-fee FX conversion + net-of-fees margin (`pricingInterlink.ts`), stock atomicity + cascade, npm audit 0 CVEs, Tauri fs scope, 3MF zip-bomb guards, shared `ConfirmModal`, App main-tab roving tabindex

### Out of Scope (carried forward)

- White-label PDF quote (paid tier, v2.0+) — only the free-tier "Made with 3DCoster" footer ships in v1.x
- Live marketplace / accounting integrations (Etsy API, QuickBooks, etc.) — paid tier
- Hosted sync / multi-device sync — paid tier
- E2E tests (Playwright / Cypress) — separate later milestone
- Light/dark/system theme toggle — app ships dark-only by design (decision locked in v1.1)
- Tag autocomplete from prior jobs (deferred — v1.2 shipped editable string tags + free-text search only; chip filter was tried and removed)
- Geo-based tax lookup API (breaks offline-first design constraint)
- US per-state sales tax table (Etsy is marketplace facilitator in most states; would create double-tax)
- E-signature on PDF (legal liability)
- Customer-bound metrics / dashboards (future Sales Pipeline milestone)

## Context

- v1.0 (Multi-Material Support) shipped 2026-04-15 across 6 phases
- Default Profit Margin shipped 2026-05-18 (single-feature, outside milestone)
- v1.1 (Polish & Foundation) shipped 2026-05-20 across Phases 7–11
- v1.2 (Quote-to-Customer) shipped 2026-05-25 across Phases 12–17 (7 phases, 45 plans, 6 days). Mid-milestone insertions: Phase 15.1 (Customer Library) and Phase 17 (PDF-04 closure)
- **v1.3 (Hardening) shipped 2026-05-28** across Phases 18–26 (10 phases, 43 plans, 4 days). Mid-milestone insertions: Phase 22.1 (Break-even formula reconciliation surfaced during Phase 22 UAT) and Phase 26 (v1.3 audit cleanup before tag). Final main bundle 56.5 KB gzipped (down from v1.2's 61.5 KB)
- **v1.4–v1.7 shipped ad-hoc (GSD management lapsed after v1.3)** — desktop release tags `v1.4.x`–`v1.7.0`; notable: CSV export + public roadmap (v1.5), backup/restore + jobs totals bar + 3dcoster.com + CSP (v1.6), Linux desktop builds + 12 printers/add-custom-printer + calculator correctness fixes + i18n grouping (v1.7.0, 2026-06-19)
- **v1.8 (Inventory & Sales Reporting) shipped 2026-06-25** — GSD revived; Phases 27–32. Material inventory tracking (#20: stockEvents ledger, deduct-on-job, low-stock badges/hints) + PDF sales report (#33: dedicated Reports tab, month/quarter/year/YTD/custom, branded PDF + CSV) + filament-picker search + Bambu PLA Pure + off-by-100× rate warnings + fuel-price per-gallon fix. Tagged `v1.8.0`; full 3-reviewer release-diff review (0 CRITICAL)
- **v1.9 (Hardening) shipped 2026-07-03** — Phases 34–37 (4 phases, 11 plans, ~7 days incl. 1-week review/UAT hold). 14/15 requirements + review/audit-driven data-loss, fee-FX, and security fixes. Tagged `v1.9.0`; 2 release-diff review passes + 5-lens app audit + full UAT
- Current codebase: **819 Vitest tests across 64 files**, 0 npm CVEs; main chunk 72.8 KB gzipped (300 KB gate intact)
- Phase numbering continues — next phase is **Phase 38** (Phase 33 lives on the in-flight `feat/insight-pricing-coach` branch)
- Roadmap: [ROADMAP.md](ROADMAP.md) (collapsed milestone-grouped index) + [milestones/v1.9-ROADMAP.md](milestones/v1.9-ROADMAP.md) (latest full delivery map)
- Free/paid principle: "Free for the person; paid when the tool wears your brand to your customers, or works while you sleep"
- Codebase map: `.planning/codebase/`
- Desktop release tags decoupled from GSD milestones — v1.2 work shipped to users under `v1.2.0`..`v1.2.4` + `v1.3.0`..`v1.3.1` desktop tags as features landed

## Constraints

- **Tech stack**: React 18 + TypeScript + Vite + Tailwind + Dexie.js (no changes to stack)
- **No backend**: All data local — schema changes via Dexie migrations
- **Backward compat**: All v1.0 jobs/sales must continue to work after v1.1 schema changes
- **Free forever promise**: Core calculator + every cost-model improvement stays free
- **Port**: Dev server runs on port 4173 (pinned in `vite.config.ts`)
- **NEW Badge rule**: Every new feature gets a NEW badge — register in `src/features.ts`, place as absolute overlay (never inline that disrupts layout)

## Key Decisions

| Decision | Rationale | Milestone | Outcome |
|----------|-----------|-----------|---------|
| Replace `filamentId`/`filamentGrams` with `filaments[]` array | Clean model, avoids two code paths | v1.0 | ✓ Shipped |
| Per-filament weight (not ratio-based) | Most accurate, maps to slicer output | v1.0 | ✓ Shipped |
| Single row default, "+" to add more | Keeps single-filament UX (majority case) | v1.0 | ✓ Shipped |
| Auto-match per filament on import | Form is the review step | v1.0 | ✓ Shipped |
| Max 16 filament rows | Matches Bambu AMS Hub max capacity | v1.0 | ✓ Shipped |
| Export `getMaterialDensity` for nozzle wear | Fixes pre-existing PLA-only bug | v1.0 | ✓ Shipped |
| Default profit margin in `UserProfile` | Same shape as `laborHourlyRate` (personal pricing default) | 2026-05-18 | ✓ Shipped |
| Free/paid line = branding + hosted + integrations + automation | Stimalo / Obsidian / Cal.com / Tailscale convergence | 2026-05-19 | Adopted |
| Free-tier-first milestone arc (v1.1–v1.6 free, then v2.0 paid) | Maximize free value before paying backend complexity tax | 2026-05-19 | Adopted |
| v1.1 = Polish & Foundation (not Quote-to-Customer) | Foundation-first compounds across 5+ subsequent milestones; foundation-last creates rework debt | v1.1 | ✓ Shipped 2026-05-20 |
| PDF quote: free with footer, white-label paid (white-label deferred to paid tier) | Stimalo line — peak willingness-to-pay moment + organic marketing | v1.2 | ✓ Shipped 2026-05-23 |
| Tax/VAT: region lookup default + Settings override + per-job override | Region table covers the 90% case (EU 27 + UK + AU + CA + US no-tax + etc.); Settings handles power users selling outside their region; per-job override handles edge cases. Three layers ship together — no half-feature. | v1.2 | ✓ Shipped 2026-05-21 |
| PDF quote rendered via client-side PDF library, lazy-loaded | Real .pdf download (vs print dialog) gives a better seller UX; library lazy-loaded so Phase 11's 300 KB gz main-chunk gate stays intact. | v1.2 | ✓ Shipped 2026-05-23 (jsPDF + jsPDF-autotable; gate closed by Phase 17 D-01 Rollup manualChunks reorder) |
| Tags ship as editable strings + chip filter + free-text search (no autocomplete, no PDF chips) | Minimum viable tag UX — covers organize + recall. Autocomplete and PDF tag rendering deferred until tag usage signals demand. | v1.2 | ⚠️ Revised: chip filter withdrawn 2026-05-24 (redundant with search); shipped as edit-in-place tags + free-text search only |
| UI consistency sweep folded into v1.2 (not standalone milestone) | Pending todo `ui-consistency-sweep.md` is small and touches the same forms v1.2 adds fields to — better to apply once than twice. | v1.2 | ✓ Shipped 2026-05-21 (Phase 13; features.ts pruned 12→4) |
| Customer details location: per-Sale (not per-PrintJob) | Mid-UAT reversal D-21: a job is a thing you make, a sale is a transaction with a customer. Customer fields belong on the transaction. | v1.2 | ✓ Shipped 2026-05-22 (Phase 14) |
| Etsy ToS section gated on `marketplace === 'etsy'` (not always-visible) | Mid-UAT reversal D-22: users selling on other marketplaces shouldn't see Etsy-specific noise. Gating keeps the helper precise. | v1.2 | ✓ Shipped 2026-05-22 (Phase 14) |
| Customer Library inserted as Phase 15.1 (between 15 and 16) | Record Sale modal screamed for a real customer picker — typing the same name + email on every sale was the wrong UX. Customers become first-class assets with a dedicated Dexie store. | v1.2 | ✓ Shipped 2026-05-22 (Phase 15.1) |
| Customer Library snapshots are by-value on Sale (not foreign-key) | Editing a library Customer must never mutate historical sales — protects audit trail. Locked by unit test that edits a library fixture then asserts byte-identical pre/post on the Sale's customer field. | v1.2 | ✓ Shipped 2026-05-22 (Phase 15.1 CL-05) |
| DUP-01 row-action UI withdrawn-from-v1.2; DUP-02 helper ships standalone | Single-item overflow `[⋯]` was the wrong pattern (labelless + floating NEW badge confusing). Deferred to v1.3+ richer surface; helper preserved with locked 7-case Vitest contract for future consumers. | v1.2 | ⚠️ Revised 2026-05-24: helper shipped, UI deferred |
| Phase 17 closure phase for PDF-04 + tax rounding divergence | `/gsd:audit-milestone v1.2` surfaced Rollup chunk-ordering regression (defeating PDF-04 lazy-load) and tax-rounding divergence between PrintQuoteModal and CostCalculator. Inserted as closure phase rather than ship with known blocker. | v1.2 | ✓ Shipped 2026-05-25 (added `scripts/assert-no-static-pdf-import.mjs` CI gate) |
| `<Modal>` primitive shipped FIRST in v1.3 (Phase 19), before JobsManager decomposition (Phase 22) | Phase 22 depends on `<RecordSaleModal>` extraction, which depends on a stable Modal primitive. Foundation-first prevents extracting a component built on doomed boilerplate. | v1.3 | ✓ Shipped 2026-05-26 (17 Vitest contract tests; 10-surface migration with zero behavioral change) |
| Email-lowercase canonicalized at save (D-01 in Phase 23) | Phase 23 Customer-UI tests surfaced a real bug: `CustomerEditModal` saved emails as-typed while `customerCsv.ts` lowercased — same logical customer would have two library entries. Resolved by canonicalizing at save in the modal + reconcileCustomerEmailLowercase backfill. | v1.3 | ✓ Shipped 2026-05-28 |
| `fake-indexeddb` for migration test scoped per-file only (D-04 in Phase 23) | Global injection via `vitest.setup.ts` would expose all 28+ existing tests to the IDB shim and risk cross-test contamination. Per-file `import 'fake-indexeddb/auto'` keeps the blast radius to `database.migrations.test.ts`. | v1.3 | ✓ Shipped 2026-05-28 |
| Tauri Rust crate upgraded to 2.11.x (over JS-side dedupe workaround) | Phase 18 carried two nested `@tauri-apps/api` copies as known debt. Phase 24-06 evaluated three options: (a) pin JS plugins, (b) bump Rust crate, (c) document dual-copy. Chose (b) — `tauri 2.11.x` + `@tauri-apps/api ^2.11.0` eliminates the duplication at the dependency root rather than papering over it. | v1.3 | ✓ Shipped 2026-05-25 |
| Phase 22.1 inserted mid-milestone for break-even formula reconciliation | Phase 22 HUMAN-UAT surfaced that the JobsManager break-even pill formula diverged from the Calculator widget on the same job. Inserted as decimal phase (22.1) rather than expanding Phase 22 scope. Reconciled at the snapshot layer (`fixedCostsAtSave` on saved jobs) so future Calculator changes propagate without backfill. | v1.3 | ✓ Shipped 2026-05-27 (PERF-08 round-trip test locks agreement) |
| Phase 26 inserted as v1.3 closure cleanup before tagging | `/gsd:audit-milestone v1.3` returned `tech_debt` (no blockers, 8 doc-state items). Inserted Phase 26 to flip those items rather than ship `tech_debt`. 4 parallel-safe plans completed in 5 minutes, audit re-ran clean. Pattern: cleanup phase before tag if audit verdict has fixable items. | v1.3 | ✓ Shipped 2026-05-28 (verdict flipped `tech_debt` → `passed`) |
| Customer CSV export deferred to v1.4+ | Phase 21 SC#5 specified a UAT for customer CSV export, but the export feature was never built — only `sanitizeCsvCell` shipped. Surfaced during Phase 21 HUMAN-UAT 2026-05-28. User deprioritized; backlog item rather than scope expansion. | v1.3 | ⚠️ Deferred 2026-05-28 |
| Deleted defaults STICK (persisted `seedState` flags) | Founder decision 2026-06-26: re-seeding deleted default materials/printers on every reload silently overrode user intent. Per-row catalog top-up preserves new catalog additions without resurrecting deletions. | v1.9 | ✓ Shipped 2026-07-03 |
| Marketplace fee FOLDS into net margin (not shown gross) | Founder decision 2026-06-26: the profit a seller is quoted must be the profit they keep. Closed-form `pricingInterlink.ts`; no-marketplace path proven byte-identical. | v1.9 | ✓ Shipped 2026-07-03 |
| PERF-11 reverted + deferred to v2.0 | Release-diff review caught the dep-trim desyncing profit/margin on consecutive same-field edits — a regression the source-contract tests couldn't see. Correct fix belongs with the CostCalculator God-component split (audit 6.1). | v1.9 | ⚠️ Reverted 2026-06-26; → v2.0 |
| Asset reset scoped to the active view | UAT surfaced silent data-loss: resetting from a custom-category view cleared ALL materials. Reset All keeps custom categories; per-category reset clears only that category. | v1.9 | ✓ Shipped 2026-07-03 |
| v1.9 held ~1 week for review + UAT before tag | Founder gate 2026-06-26: build-green ≠ reviewed. The hold caught a pricing regression, a data-loss bug, and 19 CVEs before any user saw them. | v1.9 | ✓ Validated — keep the gate |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-03 — v2.0 Cost-Truth & Insight milestone opened (full-vision scope confirmed by founder). Note: PROJECT.md doc-reconciliation for v1.4–v1.7 remains deferred (post-v1.3 GSD lapse) — Context section captures the shipped summary.*
