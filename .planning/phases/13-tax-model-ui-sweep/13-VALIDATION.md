---
phase: 13
slug: tax-model-ui-sweep
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-21
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
| 13-XX-NN | XX | N | TAX-05 | — | n/a | unit | `npx vitest run src/utils/costCalc.test.ts -t "rate is 0"` | ❌ W0 | ⬜ pending |
| 13-XX-NN | XX | N | TAX-05 | — | n/a | unit | `npx vitest run src/utils/costCalc.test.ts -t "UK 20%"` | ❌ W0 | ⬜ pending |
| 13-XX-NN | XX | N | TAX-05 | — | n/a | unit | `npx vitest run src/utils/costCalc.test.ts -t "AU 10%"` | ❌ W0 | ⬜ pending |
| 13-XX-NN | XX | N | TAX-05 | — | n/a | unit | `npx vitest run src/utils/costCalc.test.ts -t "EU-average"` | ❌ W0 | ⬜ pending |
| 13-XX-NN | XX | N | TAX-05 | — | n/a | unit | `npx vitest run src/utils/costCalc.test.ts -t "centime rounding"` | ❌ W0 | ⬜ pending |
| 13-XX-NN | XX | N | TAX-05 | — | n/a | unit | `npx vitest run src/utils/costCalc.test.ts -t "order-of-operations"` | ❌ W0 | ⬜ pending |
| 13-XX-NN | XX | N | TAX-05 | — | n/a | grep | `! grep -n "it.todo" src/utils/costCalc.test.ts` | ✅ existing | ⬜ pending |
| 13-XX-NN | XX | N | TAX-03 | — | n/a | unit | `npx vitest run src/utils/taxResolution.test.ts -t "US region default"` | ❌ W0 | ⬜ pending |
| 13-XX-NN | XX | N | TAX-03 | — | n/a | unit | `npx vitest run src/utils/taxResolution.test.ts -t "EU average"` | ❌ W0 | ⬜ pending |
| 13-XX-NN | XX | N | TAX-03 | — | n/a | unit | `npx vitest run src/utils/taxResolution.test.ts -t "manual (unknown region)"` | ❌ W0 | ⬜ pending |
| 13-XX-NN | XX | N | TAX-03 | — | n/a | unit | `npx vitest run src/utils/taxResolution.test.ts -t "is stale"` | ❌ W0 | ⬜ pending |
| 13-XX-NN | XX | N | TAX-03 | — | n/a | unit | `npx vitest run src/utils/taxResolution.test.ts -t "is fresh"` | ❌ W0 | ⬜ pending |
| 13-XX-NN | XX | N | TAX-01 | — | n/a | manual UAT | n/a — visual: Settings → Costs & Rates → Default Tax Rate field present | n/a | ⬜ pending |
| 13-XX-NN | XX | N | TAX-02 | — | n/a | manual UAT | n/a — visual: per-job tax row override persists across job reopen | n/a | ⬜ pending |
| 13-XX-NN | XX | N | TAX-04 | — | n/a | manual UAT | n/a — visual: "Tax (X%)" row appears after sellingPrice; hidden when rate = 0; total = sellingPrice + taxAmount | n/a | ⬜ pending |
| 13-XX-NN | XX | N | TAX-03 | — | n/a | manual UAT | n/a — visual: US user sees marketplace-facilitator tooltip; unknown region shows "enter manually" | n/a | ⬜ pending |
| 13-XX-NN | XX | N | UI-08 | — | n/a | grep | `node scripts/check-compact-coverage.cjs` (or inline grep — planner picks) — every numeric `<Input>` in CostCalculator, AssetLibrary, JobsManager, PrinterSettings has `compact` | ❌ W0 (script) or grep | ⬜ pending |
| 13-XX-NN | XX | N | UI-09 | — | n/a | manual code review | n/a — descriptive `<p>` text below numeric inputs removed; `<InfoTooltip>` present on labels | n/a | ⬜ pending |
| 13-XX-NN | XX | N | UI-10 | — | n/a | grep | `! grep -rE 'NewBadge feature="(per-unit-licensing|author-min-price|<other-stale-keys>)"' src/` | n/a | ⬜ pending |
| 13-XX-NN | XX | N | UI-10 | — | n/a | grep | `grep -c "new Date(" src/features.ts` returns exactly 3 (fresh entries only) | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

> **Planner directive:** Replace placeholder `13-XX-NN` IDs with actual `13-{plan-num}-{task-num}` once PLAN.md is generated. The 20 rows above are the minimum coverage — planner may add rows for additional implementation tasks but may not delete any.

---

## Wave 0 Requirements

- [ ] `src/utils/taxResolution.test.ts` — new Vitest spec; covers 5 branches of `resolveTaxRate` + `isRateStale` boundary cases (stale, fresh, invalid date)
- [ ] `src/utils/taxResolution.ts` — new file; exports `resolveTaxRate`, `tooltipForSource`, `isRateStale`, `TaxRateSource` discriminated union, `ResolveTaxRateInput` interface
- [ ] `src/data/taxRates.ts` — new static data file; exports `TAX_RATES` readonly typed array (27 EU members + UK/AU/CA/US), `EU_AVERAGE_RATE = 21` constant, `TaxRateEntry` interface
- [ ] Activate `it.todo` at `src/utils/costCalc.test.ts:444` — convert to `it('tax/VAT applies after subtotal — activated in v1.2', ...)` with 6 assertions covering: rate=0, UK 20%, AU 10%, EU-average 21%, centime rounding (12.50 × 23% → 2.88), order-of-operations guard
- [ ] No framework install needed — Vitest 4.1.4 already in `package.json` and `vitest.config.ts` already exists at repo root (v1.1 Phase 10 infrastructure)

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

- [ ] All planner-generated tasks have `<automated>` verify or Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (3 new files + 1 activation listed above)
- [ ] No watch-mode flags (`vitest run`, not `vitest`)
- [ ] Feedback latency < 15s (quick); < 30s (full)
- [ ] `nyquist_compliant: true` set in frontmatter once planner has filled task IDs

**Approval:** pending
