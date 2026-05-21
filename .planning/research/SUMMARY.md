# Research Summary — v1.2 Quote-to-Customer

**Project:** 3DCoster
**Milestone:** v1.2 Quote-to-Customer
**Phase numbering:** Continues from v1.1 — phases start at **Phase 12**
**Researched:** 2026-05-20
**Confidence:** HIGH (architecture + pitfalls from source files); MEDIUM (PDF bundle sizes — disputed across files; flag for Phase 19 plan)

---

## TL;DR

Eight decisions and gotchas the roadmapper must have at a glance:

1. **PDF is the only hard-blocked feature.** It cannot start until Tax (Phase 13) and Customer (Phase 14) are both merged. Everything else (tags, duplicate, Etsy helper, UI sweep) is parallelizable after the Dexie v6 schema lands in Phase 12.
2. **jsPDF bundle size is disputed.** STACK says ~95 KB gz (lazy chunk). FEATURES says ~229 KB gz. PITFALLS says ~348 KB uncompressed (~120–150 KB gz). All three are potentially correct — they measure different things (minzipped, gz, and uncompressed respectively). Phase 19 plan-phase must run `npm run analyze` and measure the actual emitted chunk before the library is locked. This is a verification task, not a decision.
3. **`build: { modulePreload: false }` is mandatory in `vite.config.ts` before PDF ships.** Without it, Vite generates `<link rel="modulepreload">` tags for the lazy PDF chunk at build time, and browsers prefetch it on page load — silently restoring the 150–350 KB cost the lazy-load was supposed to defer. The 300 KB gz gate does NOT catch this because it only measures `index-*.js`. Add a CI assertion: `grep "modulepreload" dist/index.html` must not reference the pdf chunk.
4. **`db.on('versionchange', () => window.location.reload())` must land in the Dexie v6 migration phase.** Without it, users with two tabs open get a hard white-screen crash when one tab upgrades the DB schema and the other tab's Dexie instance sees a version it doesn't recognize.
5. **Tax math goes on `sellingPrice`, not `subtotal`.** `taxAmount = Math.round(sellingPrice × rate × 100) / 100`. The existing `it.todo('tax/VAT applies after subtotal — activates in v1.2')` in `costCalc.test.ts` is the activation point. Applying tax before depreciation/nozzle is added to the selling price is a silent pricing error.
6. **Etsy June 10 2025 policy change: third-party / Thingiverse / Printables prints are now prohibited even with a commercial licence.** The compliance helper must present rules as "as of [date] — verify at etsy.com/legal/creativity" with a live link, not a static ruleset.
7. **US tax rate in the region table must be 0% with a marketplace-facilitator note,** not a state rate. Etsy collects and remits US sales tax in most states — a seller adding their own tax line creates a double-tax.
8. **No fuse.js, no fuzzy search library, no pdf-lib (abandoned), no `sales-tax` npm package, no `@react-pdf/renderer`, no light-mode toggle.** Resolved negatives — do not reopen.

---

## Recommended Stack

Two npm packages are the only new additions for the entire milestone:

| Package | Version | Chunk | gz size (estimated) | Purpose |
|---------|---------|-------|---------------------|---------|
| `jspdf` | `^4.2.1` | Lazy (PDF-only) | 95–150 KB gz | PDF document generation |
| `jspdf-autotable` | `^3.8.x` | Same lazy chunk | ~15 KB gz | Line-item table in PDF |

VAT/GST rates ship as `src/data/taxRates.ts` — a static `Record<string, VatRegion>` with ISO country codes, rates, and `rateAsOf` dates per entry. Zero runtime dependency. Tag search is `Array.filter` + `String.includes` — no library.

**Vite import rule:** jsPDF must NEVER appear in a static import at module level. Dynamic `import('jspdf')` inside the click handler only. See STACK.md §2 for the exact code shape including the `jspdf-autotable` ESM pattern (`autoTable(doc, {...})` not `doc.autoTable(...)`).

**Font strategy (unresolved — see Open Questions):** Inter Regular + Bold subset TTFs (~40 KB each). STACK recommends fetching from `/public/fonts/` at PDF generation time. PITFALLS flags a Tauri CORS risk (M-05) and recommends base64-embedding in the lazy chunk. Phase 19 planner must test both in `tauri:dev`.

---

## Feature Categories

**Table stakes:**
- Subtotal / Tax / Total three-row breakdown (S) — tax row hides at 0%
- Customer name + email on job (S) — minimum for a sendable quote
- Quote number auto-incremented (S) — resets on duplicate
- Valid-until date on PDF (S) — default 30 days
- Free-text search across job list (S) — title + customer + tags
- Quick duplicate of saved jobs (S) — allowlist copy function, see C-04

**Differentiators:**
- Three-layer tax model region→Settings→per-job (M) — all three layers ship together, no partial
- Lazy-loaded PDF quote with "Made with 3DCoster" footer (M) — white-label deferred to paid v2.0+
- Tags + chip multi-select filter (S) — AND logic; free-text also searches tags
- Etsy ToS compliance helper (M) — live link + disclaimer, "as of [date]" pattern

**Anti-features (out of scope):**
- Customer database / CRM tab — scope explosion
- Geo-based tax lookup API — breaks offline-first
- Tag autocomplete — deferred to v1.3 (locked decision)
- E-signature on PDF — legal liability
- Multi-page PDF templates — conflicts with white-label paid tier
- Light/dark/system theme toggle — locked in v1.1

---

## Architecture Decisions

**Schema delta: Dexie v5 → v6.** `PrintJob` gains four optional fields: `tags?: string[]`, `customer?: JobCustomer`, `taxRate?: number`, `taxAmount?: number`. `UserProfile` gains `defaultTaxRate?: number`. No new Dexie indexes. v6 upgrade callback sets `tags = []` on existing jobs; all other fields are safely absent for old records. `db.on('versionchange', () => window.location.reload())` must be added in this same phase.

**Tax math entry point.** Tax is NOT part of `calculateCost()`. New helper `calculateTax(sellingPrice, ratePercent)` in `costCalc.ts`. Order of operations: `subtotal → failureAdjusted → + depreciation + nozzleWear → sellingPrice → taxAmount = Math.round(sellingPrice × rate × 100) / 100`. Resolution order: `job.taxRate ?? profile.defaultTaxRate ?? TAX_RATES[country] ?? 0`.

**PDF component shape.** Two-level lazy loading: route `/quote/:jobId` → `React.lazy(() => import('./components/QuoteRenderer'))` → `pdfExport.ts` dynamically imported only on button click. `CalcInput` and `CostBreakdown` gain zero new fields.

**Tag filter pattern.** `useState` in `JobsManager` for `selectedTags` and `searchQuery`. `useMemo` filter over `useLiveQuery` result. `useDynamicRowHeight` cache key must encode `selectedJobId + filterTagKey + searchQuery` to avoid stale height cache after filter changes (Pitfall M-02). Tag parse: `split(',').map(trim).map(toLowerCase).filter(Boolean)` + `Set` dedup + max-count guard.

**New files:** `src/data/taxRates.ts`, `src/data/etsyToS.ts`, `src/components/EtsyToSHelper.tsx`, `src/components/QuoteRenderer.tsx`, `src/utils/pdfExport.ts`.

---

## Critical Gotchas (PITFALLS)

**C-03 (Showstopper) — modulePreload silently defeats lazy PDF.** Add `build: { modulePreload: false }` to `vite.config.ts`. Add CI assertion: `grep "modulepreload" dist/index.html` must not reference the PDF chunk. Owner: Phase 19.

**C-05 (Showstopper) — multi-tab PWA DB version crash.** `db.on('versionchange', () => window.location.reload())` in `database.ts`. Owner: Phase 12.

**C-01 — Tax on wrong base.** Tax on `sellingPrice`, not `subtotal`. Activation test in `costCalc.test.ts` must assert `taxAmount !== subtotal × rate` when depreciation > 0. Owner: Phase 13.

**C-04 — Quick duplicate PII leak + DB crash.** Explicit allowlist `duplicateJob()` function. Explicitly sets `customer: undefined`, `id: crypto.randomUUID()`, `createdAt: new Date()`, `copiesSold: 0`. Unit-test that `duplicate.customer === undefined`. Owner: Phase 17.

**C-02 — Floating-point tax rounding.** `Math.round(sellingPrice × rate × 100) / 100`. Never `toFixed` for intermediates. Never derive tax by subtraction. Test: `rate=0.23, price=12.50` → `2.88`. Owner: Phase 13.

**M-01 — VAT table staleness.** Per-country `rateAsOf` dates required. Slovakia 20%→23% Jan 2025; Estonia 22%→24% Jul 2025; Romania 19%→21% Aug 2025. Unknown country = "enter manually", not 0%. Owner: Phase 12/13.

**m-01 — Etsy ToS helper must use live-link + disclaimer pattern.** June 2025 policy change makes static rules actively dangerous. Show `policySummaryAsOf` date, prominent disclaimer, direct link to `https://www.etsy.com/legal/creativity/`. Owner: Phase 18.

**M-05 — Font CORS in Tauri.** Test font fetch in `tauri:dev` before writing font-loading code. Fall back to base64 embed in lazy chunk if fetch fails. Owner: Phase 19.

---

## Phase Dependency Order

Hard-sequential path to PDF:
```
Phase 12 (Dexie v6 migration + types)
  → Phase 13 (Tax/VAT)  ─┐
  → Phase 14 (Customer) ─┤ both required before PDF
                           ↓
                       Phase 19 (PDF QuoteRenderer)
```

After Phase 12 completes, Phases 13, 14, 15, 16, 17, and 18 are all parallelizable with each other.

**Suggested build order:**

| Phase | Feature | Hard deps |
|-------|---------|-----------|
| Phase 12 | Dexie v6 migration + types delta + `taxRates.ts` + `versionchange` handler | None |
| Phase 13 | Tax/VAT — `calculateTax()`, three-layer resolution, Settings, CostCalculator tax row, test activation | Phase 12 |
| Phase 14 | Customer details — `JobCustomer` fields in CostCalculator + JobsManager display | Phase 12 |
| Phase 15 | Tags + filter/search — tag input, chip filter, react-window scroll reset, tag parse guard | Phase 12 |
| Phase 16 | UI consistency sweep — `compact` Input, InfoTooltip, dead badge cleanup | Fold into 13–15 where forms overlap |
| Phase 17 | Quick duplicate — allowlist `duplicateJob()`, row button, PII unit test | Phase 12; after 13/14 ideally |
| Phase 18 | Etsy ToS helper — `etsyToS.ts`, `EtsyToSHelper.tsx`, live-link pattern | No data deps |
| Phase 19 | PDF QuoteRenderer — `/quote/:jobId`, lazy chunk, `modulePreload: false`, font strategy, CI assertion | **Phase 13 + Phase 14 both merged** |

---

## Open Questions for Plan-Phase

| Question | Owner phase | Resolution method |
|----------|-------------|-------------------|
| jsPDF actual gz chunk size (three researchers disagree) | Phase 19 | `npm install jspdf jspdf-autotable && npm run build && ls -lh dist/assets/pdf-*.js` |
| Font strategy: fetch vs base64 for Tauri | Phase 19 | Test `npm run tauri:dev`; fetch first, fall back to base64 if CORS/404 |
| Quote number storage location (`job.quoteNumber` vs `settings` counter) | Phase 12 | Must decide before v6 migration is written |
| VAT rate accuracy for `taxRates.ts` | Phase 12/13 | Verify against EC VAT Rates Table, HMRC, ATO, CRA — no LLM-generated values |
| jspdf-autotable ESM import pattern confirmation | Phase 19 | Test build in throwaway branch — CJS/ESM error only surfaces at runtime, not dev |

---

## What NOT to Add

fuse.js, minisearch, @react-pdf/renderer, pdf-lib, sales-tax/node-sales-tax, light/dark theme toggle, customer CRM tab, tag autocomplete, e-signature, geo tax lookup API, any backend, any sync. All are resolved negatives in the research — do not reopen.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | jsPDF choice sound; bundle size needs empirical measurement before Phase 19 |
| Features | HIGH | Confirmed against live competitors; Etsy policy from official source |
| Architecture | HIGH | All conclusions from direct source file inspection of actual codebase |
| Pitfalls | HIGH | All critical pitfalls from source files + verified external sources |

**Overall:** HIGH on all structural decisions; MEDIUM on PDF bundle size (requires empirical verification).

**Gaps:** jsPDF gz chunk size must be measured at build time. Font strategy for Tauri must be tested in `tauri:dev`. VAT rates must be verified against official government sources. Quote number schema placement must be decided before Phase 12 migration is written.

---

*Research completed: 2026-05-20 | Ready for roadmap: yes | Phase numbering: v1.2 starts at Phase 12*
