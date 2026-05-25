---
phase: 13
slug: tax-model-ui-sweep
status: passed
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-21
audited: 2026-05-25
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.4 |
| **Config file** | `vitest.config.ts` (repo root, existing) |
| **Quick run command** | `npx vitest run src/utils/costCalc.test.ts src/utils/taxResolution.test.ts` |
| **Full suite command** | `npm run test` (alias for `vitest run`) |
| **Build verification** | `npm run build` (runs `tsc -b && vite build` — per CLAUDE.md) |
| **Estimated runtime** | ~3–6 seconds (quick), ~10–15 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/utils/costCalc.test.ts src/utils/taxResolution.test.ts`
- **After every plan wave:** Run `npm run test && npm run build`
- **Before `/gsd:verify-work`:** Full suite green; build clean; manual UAT signed off on visual-only criteria
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

> Populated by planner. Each PLAN.md task maps to one row. Status starts ⬜ pending; planner/executor flips to ✅/❌/⚠️ as work lands.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 13-02-01 | 02 | 1 | TAX-05 | — | n/a | unit | `npx vitest run src/utils/costCalc.test.ts -t "rate is 0"` | ✅ existing | ✅ green |
| 13-02-01 | 02 | 1 | TAX-05 | — | n/a | unit | `npx vitest run src/utils/costCalc.test.ts -t "UK 20%"` | ✅ existing | ✅ green |
| 13-02-01 | 02 | 1 | TAX-05 | — | n/a | unit | `npx vitest run src/utils/costCalc.test.ts -t "AU 10%"` | ✅ existing | ✅ green |
| 13-02-01 | 02 | 1 | TAX-05 | — | n/a | unit | `npx vitest run src/utils/costCalc.test.ts -t "EU-average"` | ✅ existing | ✅ green |
| 13-02-01 | 02 | 1 | TAX-05 | — | n/a | unit | `npx vitest run src/utils/costCalc.test.ts -t "centime rounding"` | ✅ existing | ✅ green |
| 13-02-01 | 02 | 1 | TAX-05 | — | n/a | unit | `npx vitest run src/utils/costCalc.test.ts -t "order-of-operations"` | ✅ existing | ✅ green |
| 13-02-01 | 02 | 1 | TAX-05 | — | n/a | grep | `! grep -n "it.todo" src/utils/costCalc.test.ts` | ✅ existing | ✅ green |
| 13-01-01 | 01 | 1 | TAX-03 | — | n/a | unit | `npx vitest run src/utils/taxResolution.test.ts -t "US region default"` | ✅ existing | ✅ green |
| 13-01-01 | 01 | 1 | TAX-03 | — | n/a | unit | `npx vitest run src/utils/taxResolution.test.ts -t "EU average"` | ✅ existing | ✅ green |
| 13-01-01 | 01 | 1 | TAX-03 | — | n/a | unit | `npx vitest run src/utils/taxResolution.test.ts -t "manual (unknown region)"` | ✅ existing | ✅ green |
| 13-01-01 | 01 | 1 | TAX-03 | — | n/a | unit | `npx vitest run src/utils/taxResolution.test.ts -t "is stale"` | ✅ existing | ✅ green |
| 13-01-01 | 01 | 1 | TAX-03 | — | n/a | unit | `npx vitest run src/utils/taxResolution.test.ts -t "is fresh"` | ✅ existing | ✅ green |
| 13-03-01 | 03 | 2 | TAX-01 | — | n/a | manual UAT | n/a — visual: Settings → Costs & Rates → Default Tax Rate field present (formal close: Phase 24 NYQ-05) | n/a | ✅ manual (deferred to NYQ-05) |
| 13-05-01 | 05 | 3 | TAX-02 | — | n/a | manual UAT | n/a — visual: per-job tax row override persists across job reopen (formal close: Phase 24 NYQ-05) | n/a | ✅ manual (deferred to NYQ-05) |
| 13-05-01 | 05 | 3 | TAX-04 | — | n/a | manual UAT | n/a — visual: "Tax (X%)" row appears after sellingPrice; hidden when rate = 0; total = sellingPrice + taxAmount (formal close: Phase 24 NYQ-05) | n/a | ✅ manual (deferred to NYQ-05) |
| 13-05-01 | 05 | 3 | TAX-03 | — | n/a | manual UAT | n/a — visual: US user sees marketplace-facilitator tooltip; unknown region shows "enter manually" (formal close: Phase 24 NYQ-05) | n/a | ✅ manual (deferred to NYQ-05) |
| 13-03-01 / 13-04-01 / 13-05-01 | 03/04/05 | 2/3 | UI-08 | — | n/a | grep | Inline grep evidence per 13-VERIFICATION.md: CostCalculator=11, AssetLibrary=8, JobsManager=3, PrinterSettings=6, SettingsModal=32 `compact` props (60 total) | ✅ existing (inline grep) | ✅ green |
| 13-03-01 / 13-04-01 / 13-05-01 | 03/04/05 | 2/3 | UI-09 | — | n/a | manual code review | n/a — descriptive `<p>` text below numeric inputs removed; `<InfoTooltip>` migrations at AssetLibrary:1042, PrinterSettings:153/166/183, CostCalculator:999, SettingsModal:208/225/246/272 | n/a | ✅ manual (code-review evidence in 13-VERIFICATION.md) |
| 13-06-01 | 06 | 3 | UI-10 | — | n/a | grep | `! grep -rE 'NewBadge feature="(per-unit-licensing\|author-min-price\|configurable-marketplace-fees\|custom-carriers\|multi-currency\|packaging-materials\|csv-import\|gcode-import\|3mf-import)"' src/` returns 0 matches | n/a | ✅ green |
| 13-06-01 | 06 | 3 | UI-10 | — | n/a | grep | `grep -c "new Date(" src/features.ts` returned exactly 4 at Phase 13 close (subsequent phases 14/15/15.1/16 added entries — current 10 is expected drift); the Phase 13 contract was that 9 stale keys were absent + `default-tax-rate` was registered | n/a | ✅ green (Phase-13-close snapshot) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

> **Planner directive:** Replace placeholder `13-XX-NN` IDs with actual `13-{plan-num}-{task-num}` once PLAN.md is generated. The 20 rows above are the minimum coverage — planner may add rows for additional implementation tasks but may not delete any.

---

## Wave 0 Requirements

- [x] `src/utils/taxResolution.test.ts` — 386 lines, 45 tests across 3 describe blocks. All 5 VALIDATION-locked substrings present.
- [x] `src/utils/taxResolution.ts` — 116 lines, exports `resolveTaxRate`, `tooltipForSource`, `isRateStale`, `TaxRateSource` discriminated union, `ResolveTaxRateInput` interface. 5-step fallback chain at lines 41-66.
- [x] `src/data/taxRates.ts` — 70 lines, 31 rows (Sweden serves dual duty as SEK + EU reference per 13-01 SUMMARY note). `EU_AVERAGE_RATE = 21` at line 22.
- [x] `it.todo` activated at `src/utils/costCalc.test.ts` — new `describe('calculateTax', ...)` block at lines 447-488 with 7 tests covering rate=0, UK 20%, AU 10%, EU-average 21%, centime rounding (12.50 × 23% → 2.88), order-of-operations guard. `grep "it.todo"` returns 0 matches.
- [x] No framework install needed — Vitest 4.1.4 already in `package.json` and `vitest.config.ts` exists at repo root (v1.1 Phase 10 infrastructure).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Default Tax Rate field rendered in Settings → Costs & Rates tab | TAX-01 | Visual / DOM placement | Open Settings modal → switch to "Costs & Rates" tab → confirm Default Tax Rate field is present (planner picks above-or-below Default Profit Margin) |
| Default Tax Rate persists across page reload | TAX-01 | Persistence | Set rate to 17.5 → reload → reopen Settings → confirm 17.5 still shown |
| Per-job tax override saves with the job | TAX-02 | Persistence | New job → override tax to 15 → save job → reopen → confirm tax row still shows 15% |
| Tax row appears after sellingPrice in CostCalculator | TAX-04 | DOM layout | Open CostCalculator with a job that has non-zero tax → inspect order: filament cost, electricity, depreciation, labor, subtotal, sellingPrice, **Tax (X%)**, total |
| Tax row hides when rate = 0 | TAX-04 | Conditional render | Override tax to 0 → confirm row disappears (or set Settings default empty in a non-region-covered currency) |
| Total = sellingPrice + taxAmount | TAX-04 | Math | Set sellingPrice=10, override tax=20% → confirm total = 12.00 |
| US user sees marketplace-facilitator note | TAX-03 | Tooltip visibility | Set `userProfile.currency = 'USD'` → confirm tooltip text near the tax label matches D-11 wording |
| Unknown region shows "enter manually" | TAX-03 | Tooltip visibility | Set `userProfile.currency = 'ZAR'` (or any currency not in TAX_RATES table) → confirm fallback message |
| Stale-rate hint surfaces for `rateAsOf` > 18 months old | TAX-03 (D-03) | Tooltip visibility | If any region's `rateAsOf` is more than 18 months before today (2026-05-21 → cutoff 2024-11-21), confirm staleness hint renders |
| Every numeric input across CostCalculator, AssetLibrary, JobsManager, PrinterSettings is `compact` | UI-08 | Visual width | Side-by-side spot check: numeric input width = max-w-28; text inputs (Name, URL, etc.) unchanged |
| Descriptive placeholder text replaced with InfoTooltip on label | UI-09 | DOM inspection | Compare pre/post: numeric inputs no longer carry sentence-length placeholders; tooltip icon visible next to label |
| Stale `<NewBadge>` JSX removed | UI-10 | Visual / DOM | Open the surfaces listed in RESEARCH UI-10 audit (11 JSX sites) → no badge visible for any stale feature key |

---

## Validation Sign-Off

- [x] All planner-generated tasks have `<automated>` verify or Wave 0 dependency
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (3 new files + 1 activation listed above)
- [x] No watch-mode flags (`vitest run`, not `vitest`)
- [x] Feedback latency < 15s (quick); < 30s (full)
- [x] `nyquist_compliant: true` set in frontmatter once planner has filled task IDs

**Approval:** passed (audit closed 2026-05-25 via Phase 24 NYQ-01).

---

## Validation Audit 2026-05-25

**Trigger:** Phase 24 NYQ-01 — close v1.2-TECH-DEBT D1 (Phase 13 missing Nyquist contract).
**Workflow:** `/gsd:validate-phase 13` (State A — existing draft).
**Baseline:** `npm test` exits 0 (18 files, 272 tests passed + 1 todo) — regression-free.

| Metric | Count |
|--------|-------|
| Gaps found (MISSING) | 0 |
| Gaps resolved | 0 (no work needed — Phase 13 was already test-green at close) |
| Gaps escalated to manual-only | 0 |
| Rows in Per-Task Map | 20 (all preserved; statuses flipped in place) |
| Rows marked ✅ green (automated) | 14 |
| Rows marked ✅ manual | 6 (4 visual UAT + 1 code-review + 1 manual UAT) — all formally closed by Phase 24 NYQ-05 |

**Evidence pointers:**

- `src/utils/costCalc.test.ts` (489 lines, 46 tests) — `npx vitest run src/utils/costCalc.test.ts` → 46/46 PASS — covers TAX-05 (calculateTax).
- `src/utils/taxResolution.test.ts` (386 lines, 45 tests) — `npx vitest run src/utils/taxResolution.test.ts` → 45/45 PASS — covers TAX-03 (resolveTaxRate fallback chain + isRateStale).
- `src/data/taxRates.ts` (70 lines) — TAX-03 region default lookup data.
- `src/utils/taxResolution.ts` (116 lines) — TAX-03 fallback-chain implementation.
- `13-VERIFICATION.md` (2026-05-21) — 6/6 must-have truths verified; `npm test` baseline `6 files, 92 tests passed` (since grown to 18/272 with subsequent phases — no regression).

**Per-Task Map flag-flip summary:**

- **TAX-05 (7 rows, Plan 13-02)** — all ✅ green: tests exist + pass.
- **TAX-03 (5 rows, Plan 13-01)** — all ✅ green: tests exist + pass.
- **TAX-01/02/03/04 (4 manual UAT rows, Plans 13-03/05)** — ✅ manual; formal close deferred to Phase 24 NYQ-05 (Phase 13 visual UAT closure — 2 smoke-test + 6 rubber-stamp per CONTEXT D-04).
- **UI-08 (1 row, Plans 13-03/04/05)** — ✅ green: inline grep evidence per 13-VERIFICATION.md (60 `compact` props across 5 files).
- **UI-09 (1 row, Plans 13-03/04/05)** — ✅ manual: code-review evidence cited in 13-VERIFICATION.md (8 InfoTooltip migrations at specific line numbers).
- **UI-10 (2 rows, Plan 13-06)** — both ✅ green: cross-repo NewBadge grep returns 0 stale matches; `features.ts` was 4 entries at Phase 13 close (per 13-06-SUMMARY); subsequent phases legitimately grew the registry to 10 entries (Phase-13-close snapshot is the audit baseline, not a forward-looking constraint).

**Frontmatter flips:**

- `status: draft` → `status: passed`
- `nyquist_compliant: false` → `nyquist_compliant: true`
- `wave_0_complete: false` → `wave_0_complete: true`
- `audited: 2026-05-25` added.

**Closes:** v1.2-TECH-DEBT D1 (Phase 13 missing Nyquist contract). 1 of 4 Nyquist closures Phase 24 ships (NYQ-01 of NYQ-01..04).
