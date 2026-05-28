# Roadmap: 3DCoster v1.3 — Hardening

**Milestone:** v1.3 Hardening
**Defined:** 2026-05-25
**Phase range:** 18–25 (v1.2 ended at Phase 17)
**Requirements:** 51 total across 10 categories — see [REQUIREMENTS.md](REQUIREMENTS.md)
**Coverage:** 51/51 — 100%

**Driver:** [v1.2-CODE-AUDIT.md](v1.2-CODE-AUDIT.md) + [v1.2-TECH-DEBT.md](v1.2-TECH-DEBT.md). No new user-facing features in this milestone.

**Constraints encoded in this roadmap:**

- All phases are FREE tier — no paid-tier work in this milestone
- All phases are LOCAL-ONLY — no backend, no Supabase, no API calls
- No new user-facing features — every REQ closes an audit finding
- `<Modal>` primitive (Phase 19) is foundational for many a11y closures AND for the JobsManager decomposition's `<RecordSaleModal>` extraction (Phase 22) — must ship before Phase 22 starts
- `useCustomerPicker` hook (Phase 22) is the only way to cleanly close H2, H9, H10 — Phase 22 hard-gates these hygiene findings
- All 4 Nyquist contracts (Phase 24) are doc-only and can run in parallel
- Phase 25 is a "everything else" batch — order it last so accumulated work surfaces any unexpected interactions

**Phase structure rationale (coarse granularity):**
The 51 requirements cluster into 8 natural delivery boundaries driven by theme cohesion and dependency:

1. **Phase 18 (Tauri fix)** — XS, no deps, ships first to close the desktop CRITICAL fast
2. **Phase 19 (Modal primitive + a11y)** — foundational primitive + 10-surface migration; closes 2 CRITICAL + most A11Y
3. **Phase 20 (Dexie atomicity)** — independent data-integrity audit pass; closes HIGH data-loss path
4. **Phase 21 (CSV + URL security)** — independent security batch; closes HIGH formula-injection
5. **Phase 22 (JobsManager decomposition + perf)** — biggest scope; depends on Phase 19's Modal primitive; closes complexity + duplication + perf
6. **Phase 23 (Test coverage)** — adds 3 Customer-UI tests + reveals the email-lowercase divergence bug; runs after Phase 22 if components are refactored, OR independent otherwise
7. **Phase 24 (Nyquist contracts + Phase 13 visual UAT + Phase 18 review carryover)** — doc-only + small WR fixes, parallel-safe with code phases
8. **Phase 25 (Doc + hygiene + polish + bundle health)** — final cleanup batch; ordered last so accumulated v1.3 work informs it

---

## Phases

- [x] **Phase 18: Tauri fs:scope fix** — Reconcile `fs:scope` with unrestricted `save()` dialog so desktop users can save PDFs anywhere
- [x] **Phase 19: Modal primitive + a11y migration** — Build `<Modal>` (role=dialog, aria-modal, focus-trap, focus-return, useId-labeled), migrate 10 modal surfaces, plus virtualized-list ARIA + InfoTooltip useId + close-button labels + form-label pairing + CollapsibleSection aria-controls fix (completed 2026-05-26)
- [x] **Phase 20: Dexie atomicity audit** — Wrap `addSale` in transaction; move `createQuote` nextQuoteNumber read inside transaction; fix `backfillQuotesFromJobs` currency hardcode; defensive trio (parsePositiveNumber, versionchange async close, getSetting validator) (completed 2026-05-26)
- [x] **Phase 21: CSV + URL security** — `sanitizeCsvCell()` helper across export paths; validate `job.modelUrl` as http(s) before rendering; add formula-injection + Unicode test cases (completed 2026-05-27)
- [x] **Phase 22: JobsManager decomposition + perf** — Extract `<RecordSaleModal>`, `<SaleRow>`, `useCustomerPicker` hook; centralize `PICKER_VISIBLE_LIMIT`; extract `SearchIcon`; pre-compute `getBreakEvenInfo` Map; memoize `calculateMarketplaceFee`; `useDynamicRowHeight` key in CustomerLibrary (completed 2026-05-27)
- [ ] **Phase 23: Test coverage hardening** — Author 3 Customer-UI test files (catches email-lowercase divergence bug); add `fake-indexeddb` for real-Dexie migration test; retype dbJobsPutSpy; discuss + split DUP-02 packed contract
- [x] **Phase 24: Nyquist contracts + Phase 13 visual UAT + Phase 18 review carryover** — `/gsd:validate-phase` for 13, 15, 15.1, 17; complete Phase 13 8-item visual contract UAT; close Phase 18 review WR-01/02/03 (test fragility, `@tauri-apps/api` dedupe, tighter `forbidden path` match) (completed 2026-05-25)
- [x] **Phase 25: Doc + hygiene + polish + bundle health** — Doc state lag (D6/D7); HYG-01 generatingJobIds slot; HYG-04 onQuoteCreated; HYG-05 image5 comment; HYG-10 stale todo cleanup; POL-01..POL-04 (CustomerLibrary alignment, CSV template button, autotable cast, overflow-menu close); QuoteStatusPill aria; Rollup circular-chunk fix; vendor chunk classification (optional) (completed 2026-05-26)

---

## Phase Details

### Phase 18: Tauri fs:scope fix

**Goal**: A desktop user can pick any path in the PDF save dialog (Desktop, Documents, anywhere the dialog allows) and the write succeeds without a Tauri scope-denied error
**Depends on**: None (independent)
**Requirements**: DESK-01
**Success Criteria** (what must be TRUE):

  1. `src-tauri/capabilities/default.json` `fs:scope` either broadens to `$HOME/**` OR the `save()` dialog call in `src/pdf/generateQuotePdf.ts` passes a `defaultPath` scoped to `$DOWNLOAD` AND documents the restriction in the dialog/error copy
  2. Manual UAT in `npm run tauri:dev`: pick Desktop as save location, file writes successfully (or, if the alternative fix is taken, the dialog only allows Downloads-scoped paths and the user knows why)
  3. The change does not broaden surface for any other Tauri command (only `fs:scope` for `writeFile` is touched)
  4. `npm run build && npm run tauri build` exits 0

**Plans**: 1 plan
  - [x] 18-01: Replace fs:scope with per-permission inline scope on fs:allow-write-file ($HOME/**/*) + defensive try/catch around writeFile in generateQuotePdf.ts (with new unit test) + manual UAT (3 positive flows + negative control) — COMPLETE 2026-05-25

**UI hint**: no (configuration change)

### Phase 19: Modal primitive + a11y migration

**Goal**: Every modal in the codebase declares as a dialog to screen readers, traps focus while open, returns focus on close, and labels all form inputs correctly. The shared `<Modal>` primitive enforces this for every current and future modal surface
**Depends on**: None
**Requirements**: A11Y-01, A11Y-02, A11Y-03, A11Y-04, A11Y-05, A11Y-06, A11Y-07, A11Y-08, HYG-09 (modal hook absorption)
**Success Criteria** (what must be TRUE):

  1. `src/components/ui/Modal.tsx` exists with props `{ isOpen, onClose, title, children, size? }` and produces markup: a backdrop wrapping a card with `role="dialog"`, `aria-modal="true"`, `aria-labelledby={titleId}` where `titleId = useId()` and the `<h3 id={titleId}>{title}</h3>` is rendered automatically
  2. The `<Modal>` primitive on mount focuses the first focusable child via a ref; on `onClose` restores focus to the previously-active element captured on mount
  3. While open, `Tab` and `Shift+Tab` cycle within focusable descendants of the modal (no escape to background page); `Escape` invokes `onClose`
  4. 10 modal surfaces migrated: `PrintQuoteModal`, `SettingsModal`, `UserProfileModal`, `CustomerEditModal`, `CustomerCsvImportModal`, `DeclineQuoteModal`, `MaintenanceAlertModal`, `CsvImportModal`, plus the 3 inline `JobsManager` overlays (Record Sale, Delete Job confirm, Delete Sale confirm). Each migration deletes ~15–30 lines of boilerplate per surface
  5. `InfoTooltip` uses `useId()` for its content `<span>` id — opening 6+ tooltips simultaneously in SettingsModal produces 6+ unique ids in DOM
  6. react-window virtualized lists (`JobsManager`, `CustomerLibrary`, `AssetLibrary`) have `role="list"` + `aria-rowcount={totalCount}` on the container and `role="listitem"` on each row's outer `<div>`. `AssetLibrary` desktop table parent has `role="grid"`
  7. `SettingsModal` and `UserProfileModal` close buttons have `aria-label="Close"`
  8. Every `<label>` in the Record Sale modal form grid and `CustomerEditModal` form grid is paired with its `<input>` via `htmlFor`/`id` — `Input`, `Textarea`, `Select` primitives auto-generate `id` via `useId()` and accept an optional explicit `id` override
  9. `CollapsibleSection` body element is always rendered with `hidden={!open}` (or CSS toggle) so `aria-controls` references a real DOM id

**Plans**: 6 plans
  - [x] 19-01-PLAN.md — `<Modal>` primitive + tests (foundation; closes A11Y-01, A11Y-02, HYG-09)
  - [x] 19-02-PLAN.md — Input/Textarea/Select primitives auto-id via useId() (A11Y-07 foundation)
  - [x] 19-03-PLAN.md — InfoTooltip useId() + CollapsibleSection always-rendered hidden body (A11Y-04, A11Y-08)
  - [x] 19-04-PLAN.md — Migrate 5 modals batch 1: PrintQuoteModal, SettingsModal, UserProfileModal, CustomerEditModal, MaintenanceAlertModal (A11Y-03, A11Y-06, A11Y-07)
  - [x] 19-05-PLAN.md — Migrate 5 modals batch 2: CustomerCsvImportModal, DeclineQuoteModal, CsvImportModal, plus the 3 JobsManager inline overlays + Record Sale label pairing (A11Y-03, A11Y-07)
  - [x] 19-06-PLAN.md — Virtualized-list ARIA + VoiceOver UAT for the entire a11y surface (A11Y-05)

**UI hint**: yes

### Phase 20: Dexie atomicity audit

**Goal**: Every multi-store Dexie mutation in `useDatabase.ts` runs atomically — no half-applied state survives a tab close or thrown exception mid-write
**Depends on**: None
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06
**Success Criteria** (what must be TRUE):

  1. Standard `addSale` callback in `useDatabase.ts:572` wraps `db.sales.add(sale)` and the `db.jobs.put({ ...job, copiesSold })` in a single `db.transaction('rw', db.sales, db.jobs, ...)` — matches the existing Convert-to-Sale pattern
  2. `createQuote` reads `userProfile.nextQuoteNumber` from `db.settings.get('userProfile')` inside the transaction; React state argument is no longer used for the increment. A two-tab UAT confirms two near-simultaneous quote creations produce distinct quote numbers
  3. `backfillQuotesFromJobs` upgrade callback reads `currency` from the settings record via `tx.table('settings').get('userProfile')` inside the upgrade transaction; backfilled Quote rows reflect the user's actual currency (not hardcoded USD)
  4. `parsePositiveNumber` accepts `0` only via an explicit opt-in (renamed or `allowZero` parameter); printer wattage/purchasePrice import paths surface a validation error on `0`
  5. `versionchange` handler in `database.ts` becomes `async () => { await db.close(); window.location.reload(); }` — no IDB connection close while transactions in-flight
  6. `getSetting<T>` adds a runtime schema validator (Zod OR hand-rolled) at the JSON-parse boundary; fall back to `defaultValue` on structural mismatch (not just JSON parse failure)
  7. All existing tests pass; new tests added for the addSale transaction boundary + createQuote no-collision contract

**Plans:** 4/4 plans complete
  - [x] 20-01-PLAN.md — addSale + deleteSale + updateSale transactional wraps (DATA-01) — Wave 1
  - [x] 20-02-PLAN.md — createQuote tx-scoped settings read + two-tab UAT (DATA-02) — Wave 2 (depends on 20-01 for shared test file)
  - [x] 20-03-PLAN.md — backfillQuotesFromJobs currency forward fix + v9 reconcile schema bump (DATA-03) — Wave 2 (HARD depends on 20-04 — v9 schema bump requires async versionchange handler)
  - [x] 20-04-PLAN.md — Defensive trio: parsePositiveNumber allowZero + async versionchange + getSetting structural validator (DATA-04, DATA-05, DATA-06) — Wave 1 (MUST merge before 20-03)

**UI hint**: no

### Phase 21: CSV + URL security

**Goal**: Exported CSVs cannot trigger formula injection in Excel/LibreOffice; user-entered `modelUrl` values cannot create stored XSS payloads via `javascript:` URLs
**Depends on**: None
**Requirements**: SEC-01, SEC-02, SEC-03
**Success Criteria** (what must be TRUE):

  1. `src/utils/csvHelpers.ts` exports `sanitizeCsvCell(value: string): string` that prefixes a leading `'` to any string starting with `=`, `+`, `-`, or `@`; `generateExportCsv` and any other CSV export path applies this to every string cell BEFORE passing to PapaParse
  2. `src/components/JobsManager.tsx:585` (and any other render site of `job.modelUrl` as an `<a href>`) validates the URL starts with `http://` or `https://` before rendering as an anchor; otherwise renders as plain text OR is omitted; a `<title>` attribute warns if URL was rejected
  3. `customerCsv.test.ts` adds 4+ test cases: formula-injection in `name`, `notes`; Unicode in `name`, `notes` (e.g. `Müller`, `张三`, emoji-in-notes) — locks parser pass-through; locks render behavior with sanitization layer
  4. A new `csvHelpers.test.ts` covers `sanitizeCsvCell` with all 4 trigger chars + a passthrough case for safe strings
  5. Manual UAT: export a customer CSV with `=HYPERLINK("https://example.com","click")` as the name; open in Excel/Numbers; the cell shows the literal string, not a clickable link
  6. Manual UAT: enter `javascript:alert(1)` as a job's Model URL; the JobsManager row shows the string as text, not as a clickable link

**Plans**: ~3 plans
  - 21-01: sanitizeCsvCell + csvHelpers.test.ts + apply to export paths
  - 21-02: modelUrl validation + render fallback
  - 21-03: customerCsv.test.ts edge-case additions

**UI hint**: no

### Phase 22: JobsManager decomposition + perf

**Goal**: `JobsManager.tsx` is no longer a 2,099-line god-component. The Record Sale form is its own modal, the customer picker is a reusable hook, and the per-job render path is O(1) lookup instead of recomputation
**Depends on**: Phase 19 (uses `<Modal>` primitive)
**Requirements**: HYG-02, HYG-03, HYG-06, HYG-07, HYG-08, PERF-01, PERF-02, PERF-03, PERF-04, PERF-07
**Success Criteria** (what must be TRUE):

  1. `src/components/RecordSaleModal.tsx` exists, owns its own state and `handleRecordSale` logic, accepts props `{ job, userProfile, userCurrency, shippingConfig, editingSale, convertingFromQuote, isOpen, onClose, onSaved? }` (customers/customersByEmail removed from the prop surface per D-06 — RecordSaleModal subscribes to useCustomers internally), and uses the Phase 19 `<Modal>` primitive
  2. `src/components/JobsManager.tsx` shrinks by at least 400 lines (target: under 1,500 lines total); the inline Record Sale `{showSaleForm && (...)}` block is replaced by `<RecordSaleModal isOpen={...} {...} />`
  3. `src/hooks/useCustomerPicker.ts` exists, exposes `{ query, open, activeIndex, visibleCustomers, filteredCustomers, setQuery, setOpen, setActiveIndex, handleKeyDown, reset }`, and is consumed by BOTH `<RecordSaleModal>` and `<PrintQuoteModal>` — no duplicate state triplet or memos remain in either consumer
  4. `PICKER_VISIBLE_LIMIT = 8` lives in one place (`useCustomerPicker.ts` OR `src/utils/format.ts`) and is imported wherever needed; the JobsManager inline comment about "centralized here" is updated or removed accordingly
  5. `SearchIcon` SVG lives at `src/components/ui/icons/SearchIcon.tsx`; `JobsManager` and `CustomerLibrary` import it
  6. `<SaleRow>` extracted from `<JobCard>` as a standalone testable component for the per-sale `<details>` accordion
  7. `getBreakEvenInfo` is replaced by a `useMemo`-ed `Map<string, BreakEvenInfo>` keyed by job id; `JobsManager` render and `rowProps` look up via `breakEvenMap.get(job.id)` in O(1). The non-virtualized branch's per-job inline call is gone
  8. `calculateMarketplaceFee` called exactly once per render of the sale form (stored in a `const`); hoisted to module scope (no React closures)
  9. `CustomerLibrary` `useDynamicRowHeight` invoked with `key: searchQuery` — search-result row heights invalidate correctly
  10. (Optional) Global `useSales()` call in `JobsManager` lifted to a parent or `useDatabase` hook so the subscription is shared, not duplicated alongside the scoped query
  11. All existing tests pass; the JobsManager test file's mount works against the decomposed structure; a new `RecordSaleModal.test.tsx` covers the form's golden path + edit + convert-from-quote modes

**Plans**: 6 plans (authored 2026-05-27 — see [phases/22-jobsmanager-decomposition-perf/](phases/22-jobsmanager-decomposition-perf/))
  - [x] 22-01-PLAN.md — useCustomerPicker hook + tests + PICKER_VISIBLE_LIMIT centralize (HYG-08, HYG-02) — Wave 1
  - [x] 22-02-PLAN.md — SearchIcon extract to src/components/ui/icons/SearchIcon.tsx + delete both local copies (HYG-03) — Wave 1
  - [x] 22-03-PLAN.md — Extract <RecordSaleModal> from JobsManager + migrate PrintQuoteModal to useCustomerPicker (HYG-06, HYG-08) — Wave 2, depends_on [22-01]
  - [x] 22-04-PLAN.md — Extract <SaleRow> from <JobCard>; relocate SaleFromQuoteSubtext (HYG-07) — Wave 2
  - [x] 22-05-PLAN.md — Perf bundle: breakEvenMap + computeBreakEvenInfo hoist + calculateMarketplaceFee module-scope + memo + CustomerLibrary row-height key (PERF-01/02/03/04) — Wave 3, depends_on [22-03]
  - [x] 22-06-PLAN.md — useAllSales hook lift + JobsManager dedup + test mock update + manual UAT (PERF-07) — Wave 4, depends_on [22-03, 22-05]

**UI hint**: yes (no visible UI change; testable via existing tests + new modal test)

### Phase 22.1: Break-even formula reconciliation (INSERTED)

**Goal:** The CostCalculator "Break-even Units" widget and the JobsManager break-even pill compute the same number for the same job. Calculator's formula wins — break-even fixed costs = `modelCost + printerDepreciation + nozzleWear` (not `modelCost` only as JobsManager currently does). Existing IndexedDB jobs are reconciled in place so the change isn't forward-only.

**Why now**: User-surfaced during Phase 22 UAT — Calculator says "1 unit to recover $21.81 in fixed costs" but JobCard's pill uses `modelCost / profitPerUnit` and shows a different number, so users save a job under one mental model and read it back under another.

**Depends on**: Phase 22 (broader cumulative refactor must be settled first; this phase modifies `computeBreakEvenInfo` and the PrintJob schema)
**Requirements**: TBD (pending discuss-phase — likely 1 PERF/CORRECT requirement + 1 DATA migration requirement)

**Success Criteria** (what must be TRUE):

  1. `PrintJob` carries a `fixedCostsAtSave: { depreciation: number; nozzleWear: number }` snapshot (or equivalent — discuss-phase locks the exact shape); fields are optional and the Dexie schema string is unchanged (non-indexed extension per the D-18 pattern used in Phase 14)
  2. `CostCalculator` writes both fields on Save (new) and Update (edit) — see `CostCalculator.tsx:589` / `:625`
  3. `JobsManager.tsx`'s `computeBreakEvenInfo` (line 45) uses `job.modelCost + (job.fixedCostsAtSave?.depreciation ?? legacyBackfill) + (job.fixedCostsAtSave?.nozzleWear ?? legacyBackfill)` as the break-even numerator
  4. A one-time reconcile helper (analog to `backfillQuotesFromJobs` from Phase 16) populates `fixedCostsAtSave` on every legacy PrintJob, computing depreciation+nozzleWear from the saved `printerInstanceId × printTimeHours × failureRate`. Reconcile runs on app startup behind an idempotent flag (Dexie meta row or app-state key) so it executes once per user, never silently re-runs, and ships with a unit test
  5. The Calculator's "Break-even Units" displayed number === the JobsManager pill's `breakEvenCopies` for the same job (after save+reload) — locked by a small test that round-trips a job through save → backfill → render
  6. Folded-in fixes from Phase 22 code review: WR-02 (`RecordSaleModal` hydration `useEffect` drops `job.sellingPrice` from deps with a Pitfall 3 comment), WR-01 (dead `userProfile` prop removed from `RecordSaleModalProps`)
  7. `npx tsc -b` clean; full vitest suite passes; the round-trip test from #5 passes
  8. Manual UAT: existing user data shows the corrected break-even pill values after one reload (with no surprise data-loss or NaN)

**UI hint**: yes (the break-even pill value changes for some jobs — the Calculator widget number stays the same)

**Plans:** 4/4 plans complete

Plans:
- [x] 22.1-01-PLAN.md — Schema extension (PrintJob.fixedCostsAtSave) + reconcileFixedCostsAtSave helper (Path B faithful reconstruction) + 4 Vitest cases + useJobs() module-flag wire-up (DATA-07) — Wave 1
- [x] 22.1-02-PLAN.md — CostCalculator writes snapshot on Save+Update + JobsManager computeBreakEvenInfo numerator widened + 3 PERF-08 round-trip tests (TDD: tests first, formula change second) (PERF-08) — Wave 2, depends_on [22.1-01]
- [x] 22.1-03-PLAN.md — Phase 22 code-review carry-overs: WR-01 dead-prop removal (userProfile from RecordSaleModalProps + JobsManager callsite) + WR-02 hydration dep array narrowed with Pitfall 3 comment + WR-02 regression test (TDD ordering) — Wave 2, depends_on [22.1-01]
- [x] 22.1-04-PLAN.md — Manual UAT: pre-flight tsc-b/npm-test gates + dev server on port 4173 + Phase 22 Complex Test job verification + NaN/Infinity/undefined sweep + reload-idempotency check + RecordSaleModal smoke (PERF-08, DATA-07) — Wave 3, depends_on [22.1-01, 22.1-02, 22.1-03], autonomous=false

### Phase 23: Test coverage hardening

**Goal**: The Customer-UI surface has its first tests; the email-lowercase divergence bug between `CustomerEditModal` and `customerCsv.ts` is locked by test; migration tests run against real Dexie
**Depends on**: Phase 22 (if components are refactored as part of decomp; otherwise independent)
**Requirements**: TEST-01, TEST-02, TEST-03, TEST-04, TEST-05, TEST-06
**Success Criteria** (what must be TRUE):

  1. `src/components/CustomerEditModal.test.tsx` exists; covers Add vs Edit hydration from `initialCustomer`, Name-OR-Email validation, Escape close, submit-disable during save, error recovery, **AND** locks the desired email-lowercase behavior (whichever direction the discuss-phase chooses: align modal with parser OR align parser with modal)
  2. `src/components/CustomerCsvImportModal.test.tsx` exists; covers non-CSV file → WR-06 error, valid CSV → preview step transition, dedup-mode toggle, row selection/deselect, confirm import call shape
  3. `src/components/CustomerLibrary.test.tsx` exists; covers search filter, delete confirmation flow, edit modal open/close, empty state, sort order (`lastUsedAt desc` with undefined-first per CL-01)
  4. `fake-indexeddb` is in `devDependencies`; `src/db/database.migrations.test.ts` opens a real v7 Dexie fixture, runs the v7→v8 migration, asserts `db.quotes.toArray()` post-upgrade matches the locked D-17 G7 contract
  5. `JobsManager.test.tsx` `dbJobsPutSpy` retyped to `vi.fn<(job: PrintJob) => Promise<void>>()` — typo-detection restored for spy assertions
  6. DUP-02 D-15 contract test split into 6 named `it` blocks inside `describe("DUP-02 D-15 locked contract")`; assertion text unchanged; failure messages now name the specific property; **discuss-phase confirms the "Do NOT modify these assertions" comment intent allows shape refactoring**
  7. `npm test` passes with no skipped tests; coverage report shows non-zero coverage for the 3 new Customer-UI test files

**Plans**: ~4 plans
  - 23-01: CustomerEditModal.test.tsx (drives email-lowercase resolution)
  - 23-02: CustomerCsvImportModal.test.tsx + CustomerLibrary.test.tsx
  - 23-03: fake-indexeddb + real-Dexie migration test
  - 23-04: Test type fixes (dbJobsPutSpy) + DUP-02 split (after discuss)

**UI hint**: no

### Phase 24: Nyquist contracts + Phase 13 visual UAT + Phase 18 review carryover

**Goal**: All 4 missing/draft Nyquist contracts authored; Phase 13's `human_needed` verification status flipped to `passed` after the deferred visual-contract UAT is performed; Phase 18 code review warnings (WR-01/02/03) resolved so PDF error mapping and Tauri version pinning carry no fragility into v1.4
**Depends on**: None (parallel-safe with all code phases)
**Requirements**: NYQ-01, NYQ-02, NYQ-03, NYQ-04, NYQ-05
**Carryover findings**: [18-REVIEW.md](phases/18-tauri-fs-scope-fix/18-REVIEW.md) WR-01, WR-02, WR-03
**Success Criteria** (what must be TRUE):

  1. `.planning/phases/13-tax-model-ui-sweep/13-VALIDATION.md` has `status: passed`, `nyquist_compliant: true`, `wave_0_complete: true` (from `/gsd:validate-phase 13`)
  2. `.planning/phases/15-tags-search-quick-duplicate/15-VALIDATION.md` exists and is `nyquist_compliant: true`
  3. `.planning/phases/15.1-customer-library/15.1-VALIDATION.md` exists and is `nyquist_compliant: true`
  4. `.planning/phases/17-close-gap-pdf-04-fix-rollup-circular-chunk-that-defeats-jspd/17-VALIDATION.md` exists and is `nyquist_compliant: true` (likely trivially satisfied by existing 8-gate build chain + `scripts/assert-no-static-pdf-import.mjs`)
  5. Phase 13's 8 deferred visual-contract UAT items completed; `13-VERIFICATION.md` `status` flipped from `human_needed` to `passed` (4 days of in-prod use + 4+ subsequent phases stacked on top with zero bug reports gives high confidence this is a formality)
  6. **WR-01 (Phase 18)**: `src/pdf/generateQuotePdf.test.ts` forbidden-path test collapsed to a single `generateQuotePdf()` invocation with a combined regex (removes sticky-mock fragility against future `mockResolvedValueOnce` migration)
  7. **WR-02 (Phase 18)**: `@tauri-apps/api` version skew resolved — either (a) bump `@tauri-apps/plugin-fs` + `@tauri-apps/plugin-dialog` to versions whose `peerDep`/`deps` line up with the pinned `@tauri-apps/api` 2.10.x, OR (b) bump the Rust `tauri` crate to 2.11.x and re-pin `@tauri-apps/api` to ^2.11.0, OR (c) document the dual-copy as accepted with `npm dedupe` semantics validated. Result: only ONE copy of `@tauri-apps/api` ships in the built bundle (verify via `find dist -name '*.js' -exec grep -l '@tauri-apps/api/core' {} \;` or confirm `node_modules/@tauri-apps/plugin-{fs,dialog}/node_modules` is empty)
  8. **WR-03 (Phase 18)**: `src/pdf/generateQuotePdf.ts` forbidden-path substring check tightened from `msg.toLowerCase().includes('forbidden path')` to `msg.toLowerCase().startsWith('forbidden path:')` (the Rust `PathForbidden` error format is anchored and always has the colon; eliminates false-positive matches on unrelated errors containing the phrase)

**Plans**: 6 plans
  - [x] 24-01-PLAN.md — NYQ-01: `/gsd:validate-phase 13` State A flag flip (draft → passed)
  - [x] 24-02-PLAN.md — NYQ-02: `/gsd:validate-phase 15` State B reconstruction from 12 SUMMARYs
  - [x] 24-03-PLAN.md — NYQ-03: `/gsd:validate-phase 15.1` State B reconstruction from 5 SUMMARYs
  - [x] 24-04-PLAN.md — NYQ-04: `/gsd:validate-phase 17` State B trivial — inherits global guards
  - [x] 24-05-PLAN.md — NYQ-05: Phase 13 visual UAT closure — 2 smoke tests + rubber-stamp note
  - [x] 24-06-PLAN.md — Phase 18 WR-01/02/03 bundled hygiene plan — TS edits + Tauri 2.11.x bump (with conditional fallback)

**UI hint**: no (documentation + UAT)

### Phase 25: Doc + hygiene + polish + bundle health

**Goal**: Sweep up every remaining audit finding into one batch — doc-state lag, hygiene residue, polish items, low-priority defensive fixes, and bundle health
**Depends on**: Phases 19, 20, 21, 22, 23 complete (final cleanup pass — order matters so this catches any v1.3 work that exposes new doc lag)
**Requirements**: A11Y-09, DOC-01, DOC-02, HYG-01, HYG-04, HYG-05, HYG-10, PERF-05, PERF-06, POL-01, POL-02, POL-03, POL-04
**Success Criteria** (what must be TRUE):

  1. `.planning/milestones/v1.2-REQUIREMENTS.md` Traceability table rows for TAGS-01 + TAGS-04 read `Complete`; the archive header's note about CUST-01/CUST-02 wording drift is verified present (add if missing)
  2. `JobsManager` `generatingJobIds` permanently-empty `Set<string>` is gone; loading state for "Generating PDF" is either derived at the parent OR the prop is removed cleanly from `JobRowProps` + `rowProps` + `JobCardProps`
  3. `PrintQuoteModal` `onQuoteCreated` prop is either made optional (and call site argument dropped) OR removed entirely; the interface no longer requires a no-op
  4. `ImageCarousel.tsx` has a one-line comment explaining `image5.png` absence (when retired, why)
  5. `.planning/todos/ui-consistency-sweep.md` is either marked closed + moved to `.planning/archive/` OR updated to reflect remaining work
  6. `CustomerLibrary` row layout — "Last used" text is vertically centered with Edit/Delete buttons (CSS fix)
  7. `CustomerCsvImportModal` has a "Customer template" download button via new `generateSampleCustomerCsv()` helper; `.planning/todos/customer-csv-template-download.md` is marked closed + archived
  8. `src/pdf/generateQuotePdf.ts` no longer contains `(doc as any).lastAutoTable.finalY`; module augmentation in a `src/pdf/jspdf-augment.d.ts` (or co-located) declares the type
  9. `QuoteRow` overflow menu (Pending Quote actions) closes on outside click and on Escape; `useEffect` registers/unregisters a `mousedown` document listener while `overflowOpen`
  10. `QuoteStatusPill` adds `aria-label="Status: {Pending|Sale|Declined}"`; Declined-pill text contrast meets WCAG AA 3:1 on `bg-slate-700`
  11. Rollup `Circular chunk: vendor -> react-vendor -> vendor` warning is gone — `vite.config.ts manualChunks` routes all `react-*` packages into `react-vendor` explicitly; `npm run build` emits no chunk-graph warnings
  12. (Optional) Vendor chunk classification reviewed; opportunistic size reduction where the change is safe and the analyzer confirms benefit

**Plans**: 5 plans
  - [x] 25-01-doc-batch-PLAN.md — Doc-state housekeeping (DOC-01, DOC-02, HYG-10) — `.planning/` only
  - [x] 25-02-customer-ui-PLAN.md — CustomerLibrary alignment + CSV template button (POL-01, POL-02)
  - [x] 25-03-jobsmanager-hygiene-PLAN.md — JobsManager hygiene + a11y (HYG-01, HYG-04, HYG-05, POL-04, A11Y-09)
  - [x] 25-04-pdf-type-augmentation-PLAN.md — jspdf module augmentation (POL-03)
  - [x] 25-05-bundle-health-PLAN.md — vite.config.ts manualChunks + vendor review (PERF-05, PERF-06)

**UI hint**: yes (polish items + a11y additions are user-visible)

---

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 18. Tauri fs:scope fix | 1/1 | Complete    | 2026-05-25 |
| 19. Modal primitive + a11y migration | 6/6 | Complete    | 2026-05-26 |
| 20. Dexie atomicity audit | 4/4 | Complete    | 2026-05-26 |
| 21. CSV + URL security | 3/3 | Complete    | 2026-05-27 |
| 22. JobsManager decomposition + perf | 6/6 | Complete    | 2026-05-28 |
| 22.1. Break-even formula reconciliation | 4/4 | Complete   | 2026-05-28 |
| 23. Test coverage hardening | 0/4 | Not started | — |
| 24. Nyquist contracts + Phase 13 visual UAT + Phase 18 review carryover | 6/6 | Complete    | 2026-05-25 |
| 25. Doc + hygiene + polish + bundle health | 5/5 | Complete    | 2026-05-26 |

**Total**: 8 phases, ~34 plans, ~5-7 working days of focused work.

---

## Coverage Map

See [REQUIREMENTS.md](REQUIREMENTS.md) Traceability table for the full requirement-to-phase map. Quick summary:

| Phase | Primary REQ categories | # of REQs |
|-------|------------------------|-----------|
| 18 | DESK | 1 |
| 19 | A11Y (8) + HYG-09 | 9 |
| 20 | DATA (6) | 6 |
| 21 | SEC (3) | 3 |
| 22 | HYG (5) + PERF (5) | 10 |
| 23 | TEST (6) | 6 |
| 24 | NYQ (5) | 5 |
| 25 | A11Y (1) + DOC (2) + HYG (4) + PERF (2) + POL (4) | 13 |

**Mapped: 51/53** (51 v1.3 REQs + 2 carry-over feature candidates TAGS-F4 + DUP-F1 explicitly out-of-scope)

---

## Dependency Graph

```
Phase 18 (Tauri fix)             <-- independent, ships first as quick CRITICAL closure
Phase 20 (Dexie atomicity)       <-- independent
Phase 21 (CSV + URL security)    <-- independent
Phase 24 (Nyquist contracts)     <-- independent, parallel-safe with all code phases

Phase 19 (Modal primitive)
  ├── foundation for Phase 22's <RecordSaleModal> extraction
  └── closes most A11Y on its own

Phase 22 (JobsManager decomposition + perf)  -- requires Modal primitive from Phase 19
  └── enables <RecordSaleModal> testability for Phase 23 component tests

Phase 23 (Test coverage)         -- runs after Phase 22 ideally (refactored components are easier to test cleanly), but independent if needed

Phase 25 (Doc + hygiene + polish + bundle health)  -- requires Phases 19, 20, 21, 22, 23 complete
  └── final cleanup batch; ordered last so any v1.3-induced doc lag surfaces here
```

**Parallelizable:** Phases 18, 20, 21, 24 can all run in parallel after milestone start. Phase 19 starts in parallel too but is the longer "trunk" path. Phase 22 starts after Phase 19's Modal primitive lands. Phase 23 starts after Phase 22 (or in parallel if its scope is just adding tests to existing files without component refactoring).

**Hard sequence:** Phase 19 → Phase 22 → Phase 23 → Phase 25.
**Soft sequence:** Phase 18 → (anywhere), Phase 20/21/24 → (anywhere), Phase 25 → last.

---

## Out of Scope (v1.3)

See [REQUIREMENTS.md "Out of Scope"](REQUIREMENTS.md#out-of-scope) for the full list. Key items:

- Any new user-facing feature
- TAGS-F4 (tag color picker) — v1.4+ feature candidate
- DUP-F1 (DUP-01 row-action UI in richer surface) — v1.4+ feature candidate
- Refactoring beyond audit findings — "if it's not in the audit, leave it alone"
- Backend / Supabase / paid-tier work

---

*Roadmap created: 2026-05-25 — driven by v1.2 audit findings.*
*Replaces: v1.2 Quote-to-Customer roadmap (Phases 12–17, shipped 2026-05-25 — see [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md))*
*Phase numbering continues from v1.2 — v1.3 phases start at Phase 18*

---

## Historical Milestones (collapsed)

- ✅ **v1.0 Multi-Material Support** — Phases 1–6 (shipped 2026-04-15) — pre-GSD-archive
- ✅ **v1.1 Polish & Foundation** — Phases 7–11 (shipped 2026-05-20) — pre-GSD-archive
- ✅ **v1.2 Quote-to-Customer** — Phases 12–17 (shipped 2026-05-25) — [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md)
- 🚧 **v1.3 Hardening** — Phases 18–25 (in progress, defined 2026-05-25) — THIS DOCUMENT
- 📋 **v1.4** — not yet defined; carry-over feature candidates from v1.2 (TAGS-F4 tag colors, DUP-F1 quick-duplicate UI) are first candidates
