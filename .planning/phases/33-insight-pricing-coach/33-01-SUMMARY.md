---
phase: 33-insight-pricing-coach
plan: 01
status: complete
requirements: [SC1, SC5, SC6]
date: 2026-06-24
---

# 33-01 — Cost-allocation visualization — SUMMARY

## What shipped
A "where does my money go" stacked %-bar + legend in the calculator's **Cost Breakdown** section, driven by a pure, fully-tested util.

- **`src/utils/costAllocation.ts`** — pure, React-free. `buildCostAllocation(input)` re-shapes the already-computed cost components (filament, supplies, labor, electricity, depreciation, nozzle wear, model cost, packaging, shipping) into ordered `{key,label,value,pct,color}` segments. **No new cost math.** Integer percents normalized with **largest-remainder** so they sum to exactly 100 (bar + legend can't drift from CSS rounding). `total <= 0 → []` (the SC1 0-guard); negative/NaN treated as 0. Exports `buildCostAllocation`, `AllocationSegment`, `COST_ALLOCATION_COLORS` (one color source of truth for bar + swatch).
- **`src/utils/costAllocation.test.ts`** — 6 cases: sum-to-100, largest-remainder (three thirds → 34/33/33), 0-guard `[]`, single 100% segment, defensive NaN/negative, stable order + color.
- **`src/components/CostCalculator.tsx`** — `costAllocation` memo over the existing component values; renders the slim stacked bar (inline `width:%` + `backgroundColor`, rounded, `title`/`aria-label` per segment) + a wrapping legend, **only when the array is non-empty**. Presentational divs/spans only (passes `lint:no-raw-html`).
- **`src/features.ts`** — `'cost-allocation'` registered (2026-06-24, re-confirm date at v2.0 tag). NEW badge attached as an absolute overlay on the heading (no reflow).

## Verification
- `vitest` util tests: 6/6 pass (incl. 0-guard + sum-to-100).
- `tsc -b` clean; `lint:no-raw-html` pass; **full `npm run build` green** (coverage + bundle/PDF gates).
- **Live smoke** (insight worktree on :4173): filament+grams job → bar segments **97% + 3% = 100%**, legend matched the bar exactly, NEW badge overlaid absolutely (no reflow); **Clear → bar disappeared** (0-guard).

## SC mapping
- **SC1** ✅ accurate per-component %, sums to 100, degrades to nothing at total 0 (unit + live proven).
- **SC5** ✅ pure client render, no network/account.
- **SC6** ✅ tsc + tests + build gates green; NEW badge + features.ts entry.

## Decisions / notes
- **Failure adjustment excluded** from the bar (it's a multiplier on the subtotal, not a discrete component) — avoids double-counting, per the plan.
- Percents are **integers** (largest-remainder); a real-but-tiny component can read 0% in the legend — acceptable/honest.
- Allocation spans both per-unit consumables AND fixed-amortized components (depreciation/nozzle/model) for a full "cost composition" picture, per the SPEC interfaces.

## Built on
Branch `feat/insight-pricing-coach` (off `feat/v1.8-inventory-reports` — latest calculator), NOT the stale redesign branch. Cost-Truth Dark theming to be applied when the redesign reconciles at v2.0 launch.
