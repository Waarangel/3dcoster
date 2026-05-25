# Requirements: 3DCoster v1.3 — Hardening

**Defined:** 2026-05-25
**Core Value:** Close every actionable finding from the v1.2 code + tech-debt audit so v1.4+ feature work ships on a clean foundation: no CRITICAL accessibility, security, or data-integrity gaps, no missing test coverage on the customer surface, no orphaned hygiene from gap-closure rounds, and all four missing Nyquist contracts backfilled.

**Source of truth:** [v1.2-CODE-AUDIT.md](v1.2-CODE-AUDIT.md) (31 severity-classified findings) + [v1.2-TECH-DEBT.md](v1.2-TECH-DEBT.md) (7 milestone-audit deferrals + 12 hygiene + 4 test debt items).

## v1.3 Requirements

Requirements for milestone v1.3. Each maps to one or more audit findings. All requirements sit on the FREE side of the free/paid line per [docs/ROADMAP.md](../docs/ROADMAP.md) "Guiding Principle" (2026-05-19). No new user-facing features — this is a hardening pass.

### Desktop / Tauri

- [x] **DESK-01**: Tauri `fs:scope` and `save()` dialog reconciled — desktop user can save a PDF anywhere the dialog allows without `writeFile` throwing a scope-denied error. Fix is one of: broaden `fs:scope` to `$HOME/**`, OR pass a `defaultPath` scoped to `$DOWNLOAD` and document the restriction. Closes [CODE-AUDIT #1](v1.2-CODE-AUDIT.md) (CRITICAL).

### Accessibility (A11Y)

- [ ] **A11Y-01**: A `<Modal>` primitive in `src/components/ui/` declares `role="dialog"`, `aria-modal="true"`, and `aria-labelledby` pointing to a `useId()`-generated header id. Closes [CODE-AUDIT #2](v1.2-CODE-AUDIT.md) (CRITICAL).
- [ ] **A11Y-02**: The `<Modal>` primitive traps focus while open (Tab/Shift+Tab cycles within modal) and restores focus to the trigger element on close. Closes [CODE-AUDIT #3](v1.2-CODE-AUDIT.md) (CRITICAL).
- [ ] **A11Y-03**: 10 modal surfaces migrate to the `<Modal>` primitive — `PrintQuoteModal`, `SettingsModal`, `UserProfileModal`, `CustomerEditModal`, `CustomerCsvImportModal`, `DeclineQuoteModal`, `MaintenanceAlertModal`, `CsvImportModal`, plus the 3 inline overlays in `JobsManager` (Record Sale form, Delete Job confirm, Delete Sale confirm). Closes [CODE-AUDIT #19](v1.2-CODE-AUDIT.md).
- [ ] **A11Y-04**: `InfoTooltip` uses `useId()` for its content `id` — multiple visible tooltips on the same screen (e.g., 6+ on SettingsModal Costs & Rates tab) have unique ids. Closes [CODE-AUDIT #8](v1.2-CODE-AUDIT.md) (HIGH).
- [ ] **A11Y-05**: react-window virtualized lists (`JobsManager`, `CustomerLibrary`, `AssetLibrary`) declare `role="list"` + `aria-rowcount={totalCount}` on the `<List>` container, and each row's outer `<div>` has `role="listitem"`. The `AssetLibrary` desktop table path gets `role="grid"` or `role="table"` on its parent. Closes [CODE-AUDIT #9](v1.2-CODE-AUDIT.md) (HIGH).
- [ ] **A11Y-06**: `SettingsModal` and `UserProfileModal` close buttons add `aria-label="Close"` — every other modal already has this. Closes [CODE-AUDIT #10](v1.2-CODE-AUDIT.md) (HIGH).
- [ ] **A11Y-07**: Every `<label>` in the Record Sale modal and `CustomerEditModal` form grids is paired with its `<input>` via `htmlFor`/`id` (auto-generated via `useId()` in the `Input`/`Textarea`/`Select` primitives). Closes [CODE-AUDIT #20](v1.2-CODE-AUDIT.md) (MEDIUM).
- [ ] **A11Y-08**: `CollapsibleSection` body element is always rendered (with `hidden={!open}` or CSS toggle) so `aria-controls` never references a missing `id`. Closes [CODE-AUDIT #21](v1.2-CODE-AUDIT.md) (MEDIUM).
- [ ] **A11Y-09**: `QuoteStatusPill` adds `aria-label="Status: {Pending|Sale|Declined}"`; Declined-pill text contrast meets WCAG AA on `bg-slate-700`. Closes [CODE-AUDIT #22](v1.2-CODE-AUDIT.md) (MEDIUM).

### Security (SEC)

- [ ] **SEC-01**: A `sanitizeCsvCell()` helper escapes leading `=`, `+`, `-`, `@` with a `'` prefix; applied to every cell in `generateExportCsv` and any other CSV export path. Closes [CODE-AUDIT #5](v1.2-CODE-AUDIT.md) (HIGH).
- [ ] **SEC-02**: `job.modelUrl` is validated to start with `http://` or `https://` before rendering as an `<a href>`; otherwise renders as plain text or is omitted. Closes [CODE-AUDIT #6](v1.2-CODE-AUDIT.md) (HIGH).
- [ ] **SEC-03**: `customerCsv.test.ts` adds test cases for formula-injection strings (`=HYPERLINK(...)`, `+CMD`, `@SUM()`) and Unicode (`Müller`, `张三`, emoji-in-notes) — locks pass-through behavior in the parser before the export path adds escaping. Closes [CODE-AUDIT #15](v1.2-CODE-AUDIT.md) (MEDIUM).

### Data integrity (DATA)

- [ ] **DATA-01**: Standard `addSale` callback in `useDatabase.ts` wraps `db.sales.add` and the `job.copiesSold` bump in a single `db.transaction('rw', db.sales, db.jobs, ...)` — matches the Convert-to-Sale pattern. Closes [CODE-AUDIT #4](v1.2-CODE-AUDIT.md) (HIGH).
- [ ] **DATA-02**: `createQuote` reads `nextQuoteNumber` from `db.settings.get('userProfile')` INSIDE the transaction, not from the React state argument. Eliminates concurrent-tab quote-number collisions. Closes [CODE-AUDIT #11](v1.2-CODE-AUDIT.md) (MEDIUM).
- [ ] **DATA-03**: `backfillQuotesFromJobs` upgrade callback reads `currency` from the settings record inside the upgrade transaction; never hardcodes `'USD'`. Non-USD users see correct currency on backfilled quotes. Closes [CODE-AUDIT #12](v1.2-CODE-AUDIT.md) (MEDIUM).
- [ ] **DATA-04**: `parsePositiveNumber` returns `null` for `num <= 0` (rename to `parseStrictlyPositiveNumber` OR accept `allowZero?: boolean`). Printer `wattage` and `purchasePrice` reject `0` and surface a validation error. Closes [CODE-AUDIT #23](v1.2-CODE-AUDIT.md) (LOW).
- [ ] **DATA-05**: `versionchange` handler wraps reload in `async () => { await db.close(); window.location.reload(); }` — no aborted-in-flight transactions. Closes [CODE-AUDIT #24](v1.2-CODE-AUDIT.md) (LOW).
- [ ] **DATA-06**: `getSetting<T>` adds runtime validation at the JSON-parse boundary (Zod or hand-rolled schema check). Falls back to `defaultValue` on structural mismatch, not just on JSON parse failure. Closes [CODE-AUDIT #25](v1.2-CODE-AUDIT.md) (LOW).

### Test coverage (TEST)

- [ ] **TEST-01**: `CustomerEditModal.test.tsx` exists. Covers: Add vs Edit hydration, Name-OR-Email validation, Escape close, submit-disable during save, error recovery, **and the email-lowercase divergence** (currently the modal does NOT lowercase email on save while `customerCsv.ts` does — this test should lock the desired behavior, which is to lowercase). Closes [CODE-AUDIT #7](v1.2-CODE-AUDIT.md) part 1.
- [ ] **TEST-02**: `CustomerCsvImportModal.test.tsx` exists. Covers: upload non-CSV → WR-06 error, upload valid CSV → preview step, dedup-mode toggle, row selection/deselect, confirm import call shape. Closes [CODE-AUDIT #7](v1.2-CODE-AUDIT.md) part 2.
- [ ] **TEST-03**: `CustomerLibrary.test.tsx` exists. Covers: search-filter behavior, delete confirmation flow, edit-modal open/close, empty state, sort order (`lastUsedAt desc` with undefined-first per CL-01). Closes [CODE-AUDIT #7](v1.2-CODE-AUDIT.md) part 3.
- [ ] **TEST-04**: `fake-indexeddb` added as devDependency; `database.migrations.test.ts` promoted to a real-Dexie upgrade test that opens a v7 fixture and asserts `db.quotes.toArray()` post-upgrade. Closes [CODE-AUDIT #27](v1.2-CODE-AUDIT.md) (LOW).
- [ ] **TEST-05**: `dbJobsPutSpy` in `JobsManager.test.tsx` retyped to `vi.fn<(job: PrintJob) => Promise<void>>()`. Closes [CODE-AUDIT #26](v1.2-CODE-AUDIT.md) (LOW).
- [ ] **TEST-06**: DUP-02 D-15 locked contract split into 6 named `it` blocks within a single `describe("DUP-02 D-15 locked contract")` — preserves the lock semantics while improving CI error messages. **Discussion required:** original test comment says "Do NOT modify these assertions"; discuss-phase confirms the intent allows refactoring shape while preserving assertion text. Closes [CODE-AUDIT #28](v1.2-CODE-AUDIT.md) (LOW).

### Hygiene (HYG)

- [ ] **HYG-01**: `generatingJobIds` permanently-empty `Set<string>` removed from `JobsManager` state + `JobRowProps` + `rowProps` + `JobCard.isGeneratingPdf`. EITHER derive loading state at the parent from `printQuoteModalState !== null && state.job.id === job.id`, OR delete the slot entirely. Closes [TECH-DEBT H1](v1.2-TECH-DEBT.md) (MEDIUM).
- [ ] **HYG-02**: `PICKER_VISIBLE_LIMIT = 8` centralized into a shared module (`src/utils/format.ts` or new `src/components/customerPickerConfig.ts`); imported by `JobsManager` and `PrintQuoteModal`. Closes [TECH-DEBT H2](v1.2-TECH-DEBT.md) (MEDIUM).
- [ ] **HYG-03**: `SearchIcon` SVG extracted to `src/components/ui/icons/SearchIcon.tsx`; imported by `JobsManager` and `CustomerLibrary`. Closes [TECH-DEBT H3](v1.2-TECH-DEBT.md) (MEDIUM).
- [ ] **HYG-04**: `onQuoteCreated` prop on `PrintQuoteModal` either made optional (and dropped at the call site) OR removed entirely. Closes [TECH-DEBT H4](v1.2-TECH-DEBT.md) (LOW).
- [ ] **HYG-05**: `ImageCarousel.tsx` gains a one-line comment explaining why `image5.png` is absent (retired during which phase, why). Closes [TECH-DEBT H5](v1.2-TECH-DEBT.md) (LOW).
- [ ] **HYG-06**: `<RecordSaleModal>` extracted from `JobsManager` to `src/components/RecordSaleModal.tsx` — owns its own state, `handleRecordSale` logic, customer-picker integration, and uses the v1.3 `<Modal>` primitive. JobsManager.tsx shrinks by ~400 lines. Closes [TECH-DEBT H6 + H7](v1.2-TECH-DEBT.md) (HIGH).
- [ ] **HYG-07**: `<SaleRow>` extracted from `<JobCard>` for the per-sale `<details>` accordion. Closes [TECH-DEBT H8](v1.2-TECH-DEBT.md) (MEDIUM).
- [ ] **HYG-08**: `useCustomerPicker(customers)` hook in `src/hooks/useCustomerPicker.ts` consolidates the picker state triplet + filtered/visible memos + `handlePickerKeyDown`. Used by both `<RecordSaleModal>` (from HYG-06) and `<PrintQuoteModal>`. Closes [TECH-DEBT H9 + H10](v1.2-TECH-DEBT.md) (MEDIUM).
- [ ] **HYG-09**: `useModalReset(isOpen, resetFn)` + `useEscapeToClose(isOpen, onClose)` hooks extracted OR absorbed into the `<Modal>` primitive built for A11Y-01. CSV modals stop duplicating reset/Escape boilerplate. Closes [TECH-DEBT H11](v1.2-TECH-DEBT.md) (LOW).
- [ ] **HYG-10**: `.planning/todos/ui-consistency-sweep.md` audited against current code; either marked closed + moved to `.planning/archive/` OR updated to reflect remaining work. Closes [TECH-DEBT H12](v1.2-TECH-DEBT.md) (LOW).

### Documentation (DOC)

- [ ] **DOC-01**: `.planning/milestones/v1.2-REQUIREMENTS.md` Traceability table rows for `TAGS-01` and `TAGS-04` flipped from `Pending (outstanding-pending-...)` to `Complete`. Closes [TECH-DEBT D7](v1.2-TECH-DEBT.md) (LOW).
- [ ] **DOC-02**: `.planning/milestones/v1.2-REQUIREMENTS.md` archive header confirmed to document the CUST-01/CUST-02 wording drift; if missing, add it. (The wording itself stays — Phase 17 D-07 explicitly scoped it out of closure.) Closes [TECH-DEBT D6](v1.2-TECH-DEBT.md) (LOW).

### Performance (PERF)

- [ ] **PERF-01**: `getBreakEvenInfo` results pre-computed into a `useMemo`-ed `Map<string, BreakEvenInfo>` keyed by job id; `JobsManager` render and `rowProps` look up in O(1). Eliminates the double-call per render and the all-rows re-render on any sale write. Closes [CODE-AUDIT #16 + #29](v1.2-CODE-AUDIT.md) (MEDIUM + LOW).
- [ ] **PERF-02**: `calculateMarketplaceFee` called once per render in the sale form (stored in a `const`), not three times. Closes [CODE-AUDIT #17](v1.2-CODE-AUDIT.md) (MEDIUM).
- [ ] **PERF-03**: `calculateMarketplaceFee` hoisted to module scope (pure function, no closures). Closes [CODE-AUDIT #31](v1.2-CODE-AUDIT.md) (LOW).
- [ ] **PERF-04**: `useDynamicRowHeight` in `CustomerLibrary` accepts `key: searchQuery` so cache invalidates on search change. Closes [CODE-AUDIT #18](v1.2-CODE-AUDIT.md) (MEDIUM).
- [ ] **PERF-05**: Rollup `Circular chunk: vendor -> react-vendor -> vendor` warning resolved — `vite.config.ts manualChunks` routes all `react-*` packages into `react-vendor` explicitly. Build emits no chunk-graph warnings. Closes [TECH-DEBT D12](v1.2-TECH-DEBT.md) (LOW).
- [ ] **PERF-06**: Vendor chunk classification reviewed; opportunistic size reduction where safe (e.g., split out infrequently-used libs from `vendor`). Non-blocking — only if Phase 11's perf-gate philosophy can be cleanly extended. Closes [TECH-DEBT D13](v1.2-TECH-DEBT.md) (LOW; optional).
- [ ] **PERF-07**: `useSales()` global call (`const { sales: allSales } = useSales()`) lifted to a parent or `useDatabase` hook so the global liveQuery subscription is shared, not duplicated alongside the scoped query. Closes [CODE-AUDIT #30](v1.2-CODE-AUDIT.md) (LOW; optional — accept if extraction adds more friction than it removes).

### Nyquist contracts (NYQ)

- [x] **NYQ-01**: `.planning/phases/13-tax-model-ui-sweep/13-VALIDATION.md` completed — `status: passed`, `nyquist_compliant: true`, `wave_0_complete: true`. Run `/gsd:validate-phase 13`. Closes [TECH-DEBT D1](v1.2-TECH-DEBT.md).
- [x] **NYQ-02**: `.planning/phases/15-tags-search-quick-duplicate/15-VALIDATION.md` authored. Run `/gsd:validate-phase 15`. Closes [TECH-DEBT D2](v1.2-TECH-DEBT.md).
- [x] **NYQ-03**: `.planning/phases/15.1-customer-library/15.1-VALIDATION.md` authored. Run `/gsd:validate-phase 15.1`. Closes [TECH-DEBT D3](v1.2-TECH-DEBT.md).
- [x] **NYQ-04**: `.planning/phases/17-close-gap-pdf-04-fix-rollup-circular-chunk-that-defeats-jspd/17-VALIDATION.md` authored. Likely trivially satisfied by the existing 8-gate build chain + new `scripts/assert-no-static-pdf-import.mjs` gate. Run `/gsd:validate-phase 17`. Closes [TECH-DEBT D4](v1.2-TECH-DEBT.md).
- [x] **NYQ-05**: Phase 13 visual-contract 8 UAT items completed; `13-VERIFICATION.md` flipped from `human_needed` to `passed`. (4 days in production + 4+ phases stacked on top without bug reports gives confidence; this is the formal close.) Closes [TECH-DEBT D5](v1.2-TECH-DEBT.md).

### Polish (POL)

- [ ] **POL-01**: `CustomerLibrary` row layout — "Last used" text vertically centered with Edit/Delete action buttons. ~5 min CSS fix. Closes [TECH-DEBT D10](v1.2-TECH-DEBT.md) (LOW).
- [ ] **POL-02**: `CustomerCsvImportModal` adds a "Customer template" download button via a new `generateSampleCustomerCsv()` helper (mirrors `generateSampleCsv` for materials/printers). Tracked in `.planning/todos/customer-csv-template-download.md`. Closes [TECH-DEBT D11](v1.2-TECH-DEBT.md) (LOW).
- [ ] **POL-03**: `(doc as any).lastAutoTable.finalY` cast in `src/pdf/generateQuotePdf.ts` replaced with a module augmentation:
  ```ts
  declare module 'jspdf' {
    interface jsPDF { lastAutoTable: { finalY: number } }
  }
  ```
  Cast disappears. Closes [CODE-AUDIT #14](v1.2-CODE-AUDIT.md) (MEDIUM).
- [ ] **POL-04**: Pending Quote overflow menu (`QuoteRow` in `JobsManager`) gains an outside-click/Escape close handler — `useEffect` registers a `mousedown` document listener while open. Closes [CODE-AUDIT #13](v1.2-CODE-AUDIT.md) (MEDIUM).

## v2 / Future Requirements

Deferred to a future milestone (these are FEATURES, not v1.3 hardening fixes).

### Tags (v1.3+ product candidates, NOT debt)

- **TAGS-F4**: Tag color options (raised + self-deferred during Round 2 UAT — see [TECH-DEBT D8](v1.2-TECH-DEBT.md))

### Duplicate (v1.3+ product candidates, NOT debt)

- **DUP-F1**: DUP-01 row-action UI in a richer surface (job-detail panel or batch-action menu — see [TECH-DEBT D9](v1.2-TECH-DEBT.md)). DUP-02 helper + locked 7-case Vitest contract already ship and are ready for consumption.

### Carry-over from v1.2 future requirements

All TAX-F*, CUST-F*, CL-F*, TAGS-F*, PDF-F*, ETSY-F* items from [milestones/v1.2-REQUIREMENTS.md](milestones/v1.2-REQUIREMENTS.md) remain deferred — v1.3 is hardening-only.

## Out of Scope

Explicitly excluded from v1.3. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Any new user-facing feature | v1.3 is hardening only — no new visible value |
| Tag color picker (TAGS-F4) | Feature candidate, not debt |
| DUP-01 row-action UI (DUP-F1) | Feature candidate; helper is ready for v1.4+ surface |
| Refactoring beyond audit findings | "If it's not in the audit, leave it alone" |
| Vendor chunk size reduction beyond Rollup warning fix | PERF-06 is optional; aggressive splitting risks regression |
| Light/dark theme toggle | Locked dark-only since v1.1 |
| Backend / Supabase / hosted sync | Paid tier (v2.0+) |
| Marketing-page redesign | Calculator-app scope only |

## Traceability

Which phases cover which requirements. Filled by gsd-roadmapper.

| Requirement | Phase | Severity (audit) | Status |
|-------------|-------|------------------|--------|
| DESK-01 | Phase 18 | CRITICAL | Not started |
| A11Y-01 | Phase 19 | CRITICAL | Not started |
| A11Y-02 | Phase 19 | CRITICAL | Not started |
| A11Y-03 | Phase 19 | MEDIUM | Not started |
| A11Y-04 | Phase 19 | HIGH | Not started |
| A11Y-05 | Phase 19 | HIGH | Not started |
| A11Y-06 | Phase 19 | HIGH | Not started |
| A11Y-07 | Phase 19 | MEDIUM | Not started |
| A11Y-08 | Phase 19 | MEDIUM | Not started |
| A11Y-09 | Phase 25 | MEDIUM | Not started |
| SEC-01 | Phase 21 | HIGH | Not started |
| SEC-02 | Phase 21 | HIGH | Not started |
| SEC-03 | Phase 21 | MEDIUM | Not started |
| DATA-01 | Phase 20 | HIGH | Not started |
| DATA-02 | Phase 20 | MEDIUM | Not started |
| DATA-03 | Phase 20 | MEDIUM | Not started |
| DATA-04 | Phase 20 | LOW | Not started |
| DATA-05 | Phase 20 | LOW | Not started |
| DATA-06 | Phase 20 | LOW | Not started |
| TEST-01 | Phase 23 | HIGH | Not started |
| TEST-02 | Phase 23 | HIGH | Not started |
| TEST-03 | Phase 23 | HIGH | Not started |
| TEST-04 | Phase 23 | LOW | Not started |
| TEST-05 | Phase 23 | LOW | Not started |
| TEST-06 | Phase 23 | LOW (discuss) | Not started |
| HYG-01 | Phase 25 | MEDIUM | Not started |
| HYG-02 | Phase 22 | MEDIUM | Not started (absorbed by useCustomerPicker hook) |
| HYG-03 | Phase 22 | MEDIUM | Not started (absorbed by JobsManager decomp) |
| HYG-04 | Phase 25 | LOW | Not started |
| HYG-05 | Phase 25 | LOW | Not started |
| HYG-06 | Phase 22 | HIGH | Not started |
| HYG-07 | Phase 22 | MEDIUM | Not started |
| HYG-08 | Phase 22 | MEDIUM | Not started |
| HYG-09 | Phase 19 | LOW | Not started (absorbed by Modal primitive) |
| HYG-10 | Phase 25 | LOW | Not started |
| DOC-01 | Phase 25 | LOW | Not started |
| DOC-02 | Phase 25 | LOW | Not started |
| PERF-01 | Phase 22 | MEDIUM/LOW | Not started |
| PERF-02 | Phase 22 | MEDIUM | Not started |
| PERF-03 | Phase 22 | LOW | Not started |
| PERF-04 | Phase 22 | MEDIUM | Not started |
| PERF-05 | Phase 25 | LOW | Not started |
| PERF-06 | Phase 25 | LOW (optional) | Not started |
| PERF-07 | Phase 22 | LOW (optional) | Not started |
| NYQ-01 | Phase 24 | — | Not started |
| NYQ-02 | Phase 24 | — | Not started |
| NYQ-03 | Phase 24 | — | Not started |
| NYQ-04 | Phase 24 | — | Not started |
| NYQ-05 | Phase 24 | — | Not started |
| POL-01 | Phase 25 | LOW | Not started |
| POL-02 | Phase 25 | LOW | Not started |
| POL-03 | Phase 25 | MEDIUM | Not started |
| POL-04 | Phase 25 | MEDIUM | Not started |

**Coverage:**
- v1.3 requirements: **51 total** across 10 categories
- Severity breakdown: 3 CRITICAL · 7 HIGH · 14 MEDIUM · 12 LOW · 5 Nyquist (doc) · 6 absorbed/optional
- Mapped to phases: 51
- Unmapped: 0

---

*Requirements defined: 2026-05-25 — driven by [v1.2-CODE-AUDIT.md](v1.2-CODE-AUDIT.md) + [v1.2-TECH-DEBT.md](v1.2-TECH-DEBT.md)*
*v1.3 is a hardening milestone — no new user-facing features. Every REQ traces back to an audit finding.*
*Phase numbering continues from v1.2 — first phase is **Phase 18***
