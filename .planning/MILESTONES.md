# 3DCoster Milestones

Reverse-chronological log of shipped GSD milestones. Each entry summarizes what shipped; full detail lives in `.planning/milestones/v[X.Y]-ROADMAP.md` and `v[X.Y]-REQUIREMENTS.md`.

Note: GSD milestone versions (v1.2 Quote-to-Customer) are decoupled from the **desktop release tag stream** (`v1.2.0`..`v1.2.4`, `v1.3.0`..`v1.3.1`). Desktop releases ship continuously as features land; GSD milestones gate scope at the planning layer.

---

## v1.2 Quote-to-Customer

**Shipped:** 2026-05-25
**Phases:** 7 (12, 13, 14, 15, 15.1, 16, 17) — includes inserted Phase 15.1 (Customer Library) + closure Phase 17 (PDF-04 fix)
**Plans:** 45
**Requirements:** 30 total — 28 satisfied, 2 withdrawn (TAGS-02 chip filter, DUP-01 row action)
**Timeline:** 2026-05-20 → 2026-05-25 (6 days)
**Code delta:** 110 files changed, +19,883 / −1,968 LOC (excluding `.planning/`)
**Audit:** [tech_debt](milestones/v1.2-MILESTONE-AUDIT.md) — 0 blockers, 7 documented deferred items

### Delivered

3DCoster grew from a personal cost calculator into a tool that produces customer-ready PDF quotes — with three-layer tax handling, a first-class Customer Library, tags + search on the job library, and an Etsy ToS compliance helper.

### Key Accomplishments

1. **Three-layer tax model** — region default (`taxRates.ts`) → Settings override → per-job override; `calculateTax(sellingPrice, ratePercent)` unit-tested with order-of-operations guard (tax on `sellingPrice`, not `subtotal`)
2. **Customer details on sales** — per-Sale customer fields (name/email/address/company/notes) with Edit + Delete affordances; mid-UAT scope reversal moved customer from PrintJob → Sale (D-21)
3. **Customer Library (inserted Phase 15.1)** — Customers tab with virtualized list, CSV bulk import (Skip/Update duplicates), combobox picker in Record Sale with email auto-link; per-Sale snapshot stays by-value so historical sales never mutate when a library record is edited
4. **Tags + search + edit-in-place** — free-text tags (lowercased/trimmed/deduped/capped at 10) with edit-in-place title row + inline chip strip; JobsManager search across title/customer/tags; virtualized-list cache key narrowed to pipe-delimited bi-key (TAGS-02 chip filter withdrawn 2026-05-24 as redundant with search)
5. **Printable PDF Quote** — lazy-loaded jsPDF generation (300 KB gz main-chunk gate intact); PrintQuoteModal with customer picker; Recent Quotes accordion with status pills (Accepted/Declined/Reopen); Convert-to-Sale flow with transactional Sale ↔ Quote linkage; Dexie v7→v8 migration introduces Quote interface
6. **Etsy ToS compliance helper** — conditional collapsible section gated on `marketplace === 'etsy'` (D-22); checklist sourced from `etsyToS.ts` with policy-summary date and link; never renders on customer PDF
7. **Schema migrations** — Dexie v5→v6→v7→v8 across the milestone (v6: optional fields; v7: customers store; v8: quotes store); `versionchange` reload handler eliminates multi-tab white-screen crash
8. **UI consistency sweep + features.ts cleanup** — `compact` `<Input>` prop rolled across 5 components; `<InfoTooltip>` replaces descriptive placeholders; `features.ts` pruned from 12 → 4 fresh entries; UI-10 audit complete
9. **PDF-04 closure (Phase 17)** — Rollup `manualChunks` reordered so `/src/pdf/` + `/jspdf/` checks fire before `node_modules` catch-all; new `scripts/assert-no-static-pdf-import.mjs` build-output CI gate prevents regression; PrintQuoteModal tax now uses `calculateTax()` helper (byte-identical to CostCalculator)

### Known Deferred (7 tech-debt items, documented in audit)

- **Nyquist contracts missing:** Phase 13 (draft), Phase 15, Phase 15.1, Phase 17 — run `/gsd:validate-phase <N>` to close
- Phase 13 visual-contract UAT items (8 deferred at phase wrap-up; phase verification at `human_needed`)
- Phase 14 REQUIREMENTS.md wording vs shipped surface for CUST-01/CUST-02 (Phase 17 D-07 scoped out)
- Tag color options (v1.3+)
- DUP-01 row-action UI (v1.3+ richer surface — job-detail panel or batch-action menu)
- Customer CSV importer missing template-download button (v1.3+; deferred Phase 16 UAT item N)
- Customer Library 'Last used' not vertically centered with action buttons (pre-existing CSS; v1.3+)
- Rollup circular-chunk build warning (`vendor → react-vendor → vendor`; non-blocking; v1.3+)
- Vendor chunk size 598 KB raw / 179 KB gz (within Vite default threshold; v1.3+ if perf gates extend)

### Archives

- [v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md) — phase-by-phase delivery map
- [v1.2-REQUIREMENTS.md](milestones/v1.2-REQUIREMENTS.md) — frozen REQUIREMENTS.md snapshot
- [v1.2-MILESTONE-AUDIT.md](milestones/v1.2-MILESTONE-AUDIT.md) — closure audit (tech_debt verdict)

---

## v1.1 Polish & Foundation (pre-GSD-archive)

**Shipped:** 2026-05-20 — phases 7–11 (shared `ui/` primitives + empty states + skeletons + cost-calc Vitest suite + Phase 11 perf budget with 300 KB gz gate). Not archived under this index — the milestone was closed before `/gsd:complete-milestone` was first run on this project. Phase artifacts remain under `.planning/phases/07-styling-primitives-pass` through `.planning/phases/11-performance-optimization`.

## v1.0 Multi-Material Support (pre-GSD-archive)

**Shipped:** 2026-04-15 — phases 1–6 (filaments[] array, slicer G-code import, 3MF multi-plate import, per-filament density fix for nozzle wear). Not archived under this index. Phase artifacts remain under `.planning/phases/01-data-foundation` through `.planning/phases/06-3mf-multi-plate-project-import`.
