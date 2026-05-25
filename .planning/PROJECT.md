# 3DCoster

## What This Is

3DCoster is a 3D printing cost calculator that helps hobbyists and small businesses accurately price their prints. It runs as a web app (Vercel) and desktop app (Tauri), storing all data locally in IndexedDB. The core application is free forever — paid tiers (when launched) cover white-label branding, hosted infrastructure, live marketplace/accounting integrations, and automation/AI.

## Core Value

Accurate cost calculation for 3D prints so users can price jobs correctly, maintain profitability, and present professional quotes to their customers — from a free, local-first tool.

## Current Milestone: v1.3 Hardening

**Goal:** Close every actionable finding from the v1.2 code + tech-debt audit so v1.4+ feature work ships on a clean foundation. No new user-facing features in this milestone — every requirement maps back to an audit finding.

**Driver:** [v1.2-CODE-AUDIT.md](v1.2-CODE-AUDIT.md) (31 severity-classified findings — 3 CRITICAL · 7 HIGH · 14 MEDIUM · 7 LOW) + [v1.2-TECH-DEBT.md](v1.2-TECH-DEBT.md) (12 hygiene + 4 test debt + 7 milestone-audit deferrals).

**Target phases:** 18–25 (8 phases, ~34 plans, ~5-7 working days)
- Phase 18: Tauri `fs:scope` fix (CRITICAL desktop bug)
- Phase 19: `<Modal>` primitive + 10-surface a11y migration (closes 2 CRITICAL + most A11Y)
- Phase 20: Dexie atomicity audit (closes HIGH data-integrity gaps)
- Phase 21: CSV + URL security (closes HIGH formula-injection + XSS)
- Phase 22: JobsManager decomposition + perf (biggest scope — extract RecordSaleModal + useCustomerPicker)
- Phase 23: Test coverage hardening (3 Customer-UI test files; catches email-lowercase divergence bug)
- Phase 24: Nyquist contracts + Phase 13 visual UAT (5 doc closures)
- Phase 25: Doc + hygiene + polish + bundle health (final batch)

Full delivery map: [ROADMAP.md](ROADMAP.md). Requirements: [REQUIREMENTS.md](REQUIREMENTS.md).

**Why this slot:** v1.2 shipped 7 phases over 6 days with 2 rounds of gap closure on Phase 15 and 2 extension cycles on Phase 16. The audit surfaced predictable gap-closure residue (large functions, duplicated picker logic, withdrawn-requirement orphans) alongside systemic accessibility gaps that were never addressed phase-by-phase. v1.3 cleans the slate before the next feature cycle — pays compounding interest on every v1.4+ change to the same surfaces.

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

## Next Milestone Goals: v1.4 TBD

Not yet defined. Will be scoped via `/gsd:new-milestone` after v1.3 Hardening ships, informed by customer-facing usage of v1.2 features.

**Carry-over feature candidates** (NOT in v1.3 — v1.3 is hardening-only):
- TAGS-F4 — tag color picker (raised + self-deferred in Phase 15 Round 2 UAT)
- DUP-F1 — DUP-01 row-action UI in a richer surface (job-detail panel or batch-action menu); helper DUP-02 + locked test contract are ready for consumption

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

### Active (v1.3 Hardening)

v1.3 is a hardening-only milestone — every REQ closes an audit finding from [v1.2-CODE-AUDIT.md](v1.2-CODE-AUDIT.md) or [v1.2-TECH-DEBT.md](v1.2-TECH-DEBT.md). 51 requirements across 10 categories tracked in [REQUIREMENTS.md](REQUIREMENTS.md); 8-phase delivery in [ROADMAP.md](ROADMAP.md).

Category summary (severity from audit):
- **DESK** (1): Tauri `fs:scope` fix — 1 CRITICAL
- **A11Y** (9): Modal primitive + focus trap + virtualized-list roles + label pairing — 2 CRITICAL + 3 HIGH + 4 MEDIUM
- **SEC** (3): CSV formula-injection escape + `modelUrl` validation — 2 HIGH + 1 MEDIUM
- **DATA** (6): Dexie atomicity in `addSale`/`createQuote`/`backfillQuotesFromJobs` + defensive trio — 1 HIGH + 2 MEDIUM + 3 LOW
- **TEST** (6): 3 Customer-UI test files + fake-indexeddb migration + DUP-02 split — 3 HIGH + 3 LOW
- **HYG** (10): JobsManager decomposition (`<RecordSaleModal>` + `<SaleRow>` + `useCustomerPicker` hook) + dead code cleanup — 1 HIGH + 4 MEDIUM + 5 LOW
- **DOC** (2): v1.2 archive doc-state lag — 2 LOW
- **PERF** (7): pre-computed maps + memoization + bundle health — 3 MEDIUM + 4 LOW
- **NYQ** (5): 4 missing/draft Nyquist contracts + Phase 13 visual UAT closure
- **POL** (4): Customer Library alignment, CSV template button, autotable cast, overflow-menu close — 2 MEDIUM + 2 LOW

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
- **v1.2 (Quote-to-Customer) shipped 2026-05-25** across Phases 12–17 (7 phases, 45 plans, 6 days). Mid-milestone insertions: Phase 15.1 (Customer Library) and Phase 17 (PDF-04 closure). Final main bundle 61.5 KB gzipped.
- Current codebase: ~22,777 LOC TypeScript/TSX in `src/`; Dexie schema at v8 (3 migrations within v1.2 alone: v6/v7/v8)
- v1.3 phase numbering continues — next phase is **Phase 18**
- Roadmap: [docs/ROADMAP.md](../docs/ROADMAP.md)
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
*Last updated: 2026-05-25 — v1.3 Hardening milestone scoped from the v1.2 code + tech-debt audit. 8 phases (18–25), 51 requirements, ~34 plans, ~5-7 working days of focused work. Every REQ closes an audit finding; no new user-facing features. Run `/gsd:plan-phase 18` to start.*
