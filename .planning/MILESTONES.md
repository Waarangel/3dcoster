# 3DCoster Milestones

Reverse-chronological log of shipped GSD milestones. Each entry summarizes what shipped; full detail lives in `.planning/milestones/v[X.Y]-ROADMAP.md` and `v[X.Y]-REQUIREMENTS.md`.

Note: GSD milestone versions (v1.2 Quote-to-Customer) are decoupled from the **desktop release tag stream** (`v1.2.0`..`v1.2.4`, `v1.3.0`..`v1.3.1`). Desktop releases ship continuously as features land; GSD milestones gate scope at the planning layer.

---

## v1.8 Inventory & Sales Reporting

**Shipped:** 2026-06-25 (desktop tag `v1.8.0`)
**Phases:** 6 GSD phases (27–32) — numbering continued after the post-v1.3 lapse
**Process:** full 3-reviewer release-diff review (`v1.7.0..HEAD`) — 0 CRITICAL, 3 HIGH cleared; web deployed + desktop tagged same day with explicit user OK

### Delivered

Two free-tier "floor" features plus accumulated fixes:

1. **Material inventory tracking (#20)** — `stockEvents` ledger foundation, deduct-on-job stock with self-correction on edit/delete, `StockBadge` low/out-of-stock indicators, per-material low-stock threshold, calculator "won't finish this print" short-by-N hint, filament stock shown in spools, included in backups.
2. **PDF sales report (#33)** — dedicated top-level **Reports** tab; month/quarter/year/YTD/custom ranges; live revenue/fees/profit preview with marketplace breakdown; branded PDF + per-sale CSV; FX-converted with "—" for missing rates.
3. **Smaller fixes** — inline search in the filament picker, Bambu PLA Pure in the catalog, off-by-100× rate warnings (electricity/fuel/lifespan), one-click Clear, save-resets-for-next-job, consistent icon buttons, and the US fuel-price per-gallon conversion fix.

> **Note:** v1.4–v1.7 shipped **ad-hoc outside GSD** (management lapsed after v1.3 Phase 26, 2026-05-28). Desktop tags `v1.4.x`–`v1.7.0`. Not retro-recorded here as formal GSD milestones; see PROJECT.md Context for the summary.

---

## v1.3 Hardening

**Shipped:** 2026-05-28
**Phases:** 10 (18, 19, 20, 21, 22, 22.1, 23, 24, 25, 26) — includes inserted Phase 22.1 (Break-even reconciliation) + closure Phase 26 (v1.3 cleanup)
**Plans:** 43
**Tasks:** 56
**Requirements:** 53 total — 53 satisfied (100%)
**Timeline:** 2026-05-25 → 2026-05-28 (4 days, 322 commits)
**Code delta:** 54 src files changed, +13,221 / −4,266 LOC (`src/`, `src-tauri/`, excluding tests + lockfiles)
**Audit:** [passed](milestones/v1.3-MILESTONE-AUDIT.md) — 0 blockers, 4 accepted deferrals carried into v1.4 backlog

### Delivered

A hardening pass driven by the v1.2 code audit + tech debt review. No new user-facing features — every requirement closed an audit finding (a11y, security, atomicity, perf, hygiene, polish, test coverage). The biggest moves: `<Modal>` primitive migration across 10 surfaces, JobsManager decomposition from 2067 → 1474 LOC, Dexie atomicity sweep, CSV formula-injection sanitization, real-Dexie migration test via fake-indexeddb, Tauri 2.11.x upgrade.

### Key Accomplishments

1. **WAI-ARIA `<Modal>` primitive + 10-surface a11y migration (Phase 19)** — Hand-rolled focus trap, portal rendering, scroll-lock, dev-mode single-modal guard, 17 Vitest contract tests. Migration absorbs 60+ LOC of duplicate boilerplate per surface. Closes A11Y-01, A11Y-02, A11Y-03, A11Y-04, A11Y-05, A11Y-06, A11Y-07, A11Y-08, HYG-09.
2. **JobsManager decomposition (Phase 22)** — JobsManager.tsx shrinks from 2067 LOC → 1474 LOC via 6 surgical extractions: `<RecordSaleModal>` (600 LOC), `<SaleRow>` (80 LOC), `useCustomerPicker` hook (state triplet + 60-LOC keyDown handler shared with `PrintQuoteModal`), `<SearchIcon>` deduplication, `useAllSales()` hook (PERF-07), `breakEvenMap` per-row pre-compute. Zero behavioral change; 416 → 466 tests stay green.
3. **Dexie atomicity sweep (Phase 20)** — `addSale` wrapped in `db.transaction('rw', ...)`; `createQuote` nextQuoteNumber read moved inside the same transaction; v9 upgrade callback reads currency from `tx.table('settings')`; `parsePositiveNumber` rejects 0 by default; `versionchange` handler closes async and reloads; `getSetting<T>` accepts a validator with 6 typed predicates. Closes DATA-01 through DATA-06.
4. **CSV + URL security (Phase 21)** — `sanitizeCsvCell` prefixes `'` to any cell starting with `=`/`+`/`-`/`@`; applied universally at all 4 `Papa.unparse` call sites in `csvHelpers.ts`. `isSafeHttpUrl` guards the only `<a href={job.modelUrl}>` render site in `JobsManager.tsx`. 8 unit tests for `sanitizeCsvCell` + 16 for `isSafeHttpUrl` + 5 parser-passthrough regression locks for Unicode + formula-injection in `customerCsv.test.ts`. Closes SEC-01, SEC-02, SEC-03.
5. **Break-even formula reconciliation (Phase 22.1, inserted)** — JobsManager break-even pill formula brought into byte-equivalence with the Calculator widget; `reconcileFixedCostsAtSave` pure helper snapshots `{depreciation, nozzleWear}` onto saved jobs via a WR-01-hardened `useEffect` in `useCustomers`. Round-trip test (4 `it()` cases) locks agreement. Closes DATA-07 + PERF-08.
6. **Test coverage hardening (Phase 23)** — First Customer-UI test files: `CustomerEditModal.test.tsx` (7 it, locks D-01 email-lowercase), `CustomerCsvImportModal.test.tsx` (6 it across 5 describes), `CustomerLibrary.test.tsx` (7 it including CL-01 sort lock). `fake-indexeddb@^6.2.5` devDep enables real-Dexie v7→v8 migration test (`database.migrations.test.ts`) with the D-17 G7 3-job → 2-quote contract enforced at the actual transaction boundary. Closes TEST-01 through TEST-06.
7. **Nyquist contracts + Phase 13 UAT closure (Phase 24)** — VALIDATION.md backfilled for Phase 13, 15, 15.1, 17 (v1.2 carryover); Phase 13's 8 deferred visual-contract UAT items closed via 2 smoke tests + 6 rubber-stamped items with in-prod evidence note; Phase 18 Tauri version skew resolved by bumping Rust crate to 2.11.x (eliminates dual-copy `@tauri-apps/api`). Closes NYQ-01 through NYQ-05.
8. **Tauri fs:scope fix + desktop hardening (Phase 18 + 24-06)** — Per-permission inline-scoped `fs:allow-write-file` with `$HOME/**` ACL; PDF generation no longer fails silently on desktop with a forbidden-path error. Tauri 2.11.x upgrade in Phase 24-06 eliminates the two nested `@tauri-apps/api` copies Phase 18 carried as known debt. Closes DESK-01.
9. **Doc + polish + bundle health (Phase 25)** — `QuoteStatusPill` `aria-label="Status: {label}"` + Declined contrast bump to text-slate-200/bg-slate-700 (4.6:1 WCAG AA); QuoteRow overflow menu closes on outside-click + Escape (POL-04); `PrintQuoteModal.onQuoteCreated` made optional (HYG-04); `CustomerLibrary` "Last used" CSS centering fix; `CustomerCsvImportModal` Customer template download button + `generateSampleCustomerCsv` helper (POL-02). Closes A11Y-09, DOC-01, DOC-02, HYG-01, HYG-04, HYG-05, HYG-10, PERF-05, PERF-06, POL-01 through POL-04.
10. **v1.3 audit cleanup (Phase 26)** — Closes all 8 tech_debt items the v1.3 audit flagged: 4 VALIDATION.md frontmatter flips (Phase 18/20/22/22.1 → `status: passed, nyquist_compliant: true, wave_0_complete: true`), 4 VALIDATION.md backfills (Phase 19/23/24/25, mining VERIFICATION.md observable truths for per-task maps), REQUIREMENTS.md DATA-07/PERF-08 sync to `[x] Complete`, and `CustomerCsvImportModal` layout parity with asset modal (template block above upload zone, `👥 Customer template` emoji label). Verdict flipped tech_debt → passed. Closes DOC-03, DOC-04, POL-05.

### Known Deferred (4 accepted carryovers, documented in audit)

- **Phase 19 VoiceOver UAT** — Structural a11y complete and unit-tested; screen-reader announcement phrasing not confirmed. Deferred to v1.4+ per user decision at Phase 19 wrap-up.
- **Customer CSV export feature (Phase 21 SC#5 gap)** — Phase 21's success criterion #5 specified a formula-injection UAT for a customer-list CSV export that was never built. `sanitizeCsvCell` is wired and ready when the feature lands. User deprioritized 2026-05-28 during Phase 21 HUMAN-UAT.
- **1 `it.todo` in `CostCalculator.test.tsx`** — Pre-dates Phase 23 (commit `b7c3961` from Phase 16, D-13). Not a Phase 23 regression; carried unchanged.
- **Pre-v1.3 carryovers** — Phase 04 (jobs-display) + Phase 09 (skeleton-loading) VERIFICATION.md remain `human_needed` from the v1.0/v1.1 era. Phase 15/17/20 CONTEXT.md `open_questions` populated during planning; phases shipped successfully despite them. 5+ milestone cycles of in-prod evidence with zero regression reports.

### Process Notes

- **Phase 22.1 inserted mid-milestone** to close a break-even formula divergence between Calculator and JobsManager that surfaced during Phase 22 HUMAN-UAT. Demonstrates the "insert urgent work as decimal phase" pattern paying off — kept v1.3 scope coherent without renumbering downstream phases.
- **Phase 26 inserted at milestone close** to flip the audit verdict from `tech_debt` to `passed` before tagging. 4 parallel-safe plans dispatched in 5 minutes (1 plan had a worktree isolation hiccup — agent committed to orchestrator branch instead; work was correct, no recovery needed).
- **Nyquist VALIDATION.md backfill pattern (Phase 26-02)** — proved that the per-task validation map can be authored cheaply as a pointer document citing VERIFICATION.md observable truths verbatim, rather than re-executing verification. Useful pattern for closing Nyquist debt on already-shipped phases.
- **3DCoster project total:** v1.0 + v1.1 + v1.2 + v1.3 = 47 phases, 110+ plans, ~30 months of dev compressed into ~5 weeks of GSD-orchestrated execution.

### Archives

- [v1.3-ROADMAP.md](milestones/v1.3-ROADMAP.md) — phase-by-phase delivery map
- [v1.3-REQUIREMENTS.md](milestones/v1.3-REQUIREMENTS.md) — frozen REQUIREMENTS.md snapshot
- [v1.3-MILESTONE-AUDIT.md](milestones/v1.3-MILESTONE-AUDIT.md) — closure audit (passed verdict)

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
