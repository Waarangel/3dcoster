# Phase 40: Insight Layer - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-08
**Phase:** 40-insight-layer
**Areas discussed:** Product grouping & ranking, Payback math (revenue vs profit), What-if simulator shape, Phase 33 branch fate

---

## Product grouping & ranking

| Option | Description | Selected |
|--------|-------------|----------|
| Normalized title | Trimmed, case-insensitive title grouping; deterministic, no false merges | ✓ |
| Fuzzy grouping | Similarity clustering; catches variants but risks false merges + arbitrary threshold | |
| Per-job rows | No grouping; bestsellers scatter across rows | |

| Option | Description | Selected |
|--------|-------------|----------|
| Sold jobs, actual profit | Rank only products with ≥1 sale, real prices net of fees; unsold listed separately | ✓ |
| All jobs, modeled profit | Suggested price as proxy; mixes real and hypothetical | |
| Both, clearly split | Proven vs Modeled sections; doubles UI surface | |

| Option | Description | Selected |
|--------|-------------|----------|
| Aggregate + target | Headline hourly wage + optional Settings target showing gap | ✓ |
| Aggregate stat only | No target comparison, zero new Settings | |
| Per-product column too | Wage column in ranking; two per-hour rates risk confusion | |

| Option | Description | Selected |
|--------|-------------|----------|
| All-time + period picker | All-time default, reuse v1.8 Reports picker | ✓ |
| All-time only | No period selection this phase | |
| Trailing 12 months default | Recency-weighted; sparse for new users | |

**User's choice:** Recommended option in all four questions.

---

## Payback math (revenue vs profit)

| Option | Description | Selected |
|--------|-------------|----------|
| Net profit | Cumulative net profit vs purchase price; correct ROADMAP wording | ✓ |
| Revenue, as written | Literal ROADMAP; optimistic, contradicts Cost-Truth | |
| Show both | Net-profit verdict + revenue secondary line | |

| Option | Description | Selected |
|--------|-------------|----------|
| Actual date + projection + toast | Full research pattern incl. one-time "paid for itself" toast | ✓ |
| Actual date + projection, no toast | Same math, no celebration | |
| Current standing only | No dates/projection | |

| Option | Description | Selected |
|--------|-------------|----------|
| Subtract both | Maintenance costs AND failure scrap per printer folded into ROI | ✓ |
| Maintenance only | Skip failure scrap attribution | |
| Neither | Job economics only | |

| Option | Description | Selected |
|--------|-------------|----------|
| Inline CTA + honest labels | "Add purchase price" CTA; unlinked sales in an "Unassigned" line | ✓ |
| Hide incomplete printers | Cleaner but undiscoverable | |
| You decide | Planner picks | |

**User's choice:** Recommended option in all four questions.
**Notes:** ROADMAP success criterion 2 ("revenue") flagged as imprecise during discussion; CONTEXT D-05 records the correction. Toast-system-not-yet-live dependency noted in D-06.

---

## What-if simulator shape

| Option | Description | Selected |
|--------|-------------|----------|
| Both surfaces | JobsManager row icon action + Insights tab job picker, one component | ✓ |
| Insights tab only | Undiscoverable from jobs | |
| JobsManager row only | Insights tab loses a headline feature | |

| Option | Description | Selected |
|--------|-------------|----------|
| Live values + delta vs saved | Delta chips against saved job's numbers | ✓ |
| Live values only | No baseline comparison | |
| Side-by-side columns | Heaviest UI; research differentiator | |

| Option | Description | Selected |
|--------|-------------|----------|
| 3 sliders, ephemeral | Required trio only; closing discards | ✓ |
| Add 'Save as scenario' | DUP-02 duplication with suffix | |
| More sliders too | Selling price + labor rate added | |

| Option | Description | Selected |
|--------|-------------|----------|
| Shared Modal | Phase 19 primitive, a11y free | ✓ |
| Embedded Insights panel | Inline; ties row entry to tab switch | |
| You decide | Planner picks after sketch | |

**User's choice:** Recommended option in all four questions.

---

## Phase 33 branch fate

| Option | Description | Selected |
|--------|-------------|----------|
| Port utils into 40 | Cherry-pick 3 pure utils + tests; calculator-UI wiring NOT re-attached; branch retired | ✓ |
| Port everything incl. calculator UI | Re-attach coach + %-bar to new sections; scope expansion | |
| Leave parked, build fresh | Duplicate profit/hr logic + painful rebase later | |

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, with provenance | $1–5/hr benchmark grading in ranking, InfoTooltip citing source | ✓ |
| Relative ranking only | Top/bottom quartile vs user's own products | |
| You decide | Planner re-checks sourcing | |

| Option | Description | Selected |
|--------|-------------|----------|
| Retire + archive docs | Copy Phase 33 planning docs to main marked "absorbed into Phase 40"; delete branch; update ROADMAP note | ✓ |
| Keep branch until 40 ships | Safety net, lingering confusion | |
| You decide | Executor handles hygiene | |

**User's choice:** Recommended option in all three questions.

---

## Claude's Discretion

- Insights tab internal layout, empty states, NEW-badge placement
- Slider ranges/steps/reset/keyboard a11y details
- `insights.ts` module decomposition + ported-util integration
- Break-even projection formula (explainable, no black-box smoothing)
- Target-wage Settings field placement
- ROADMAP D-05 wording-update mechanics

## Deferred Ideas

- "Save as new scenario" simulator duplication (DUP-02 helper exists)
- Selling-price / labor-rate sliders
- Per-product hourly-wage column
- Fuzzy product grouping
- Pricing coach + cost-allocation %-bar calculator UI → Phase 45 launch polish
- Maintenance cost trend chart (carried from Phase 39 deferred list)
