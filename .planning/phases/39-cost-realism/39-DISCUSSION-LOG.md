# Phase 39: Cost Realism - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-05
**Phase:** 39-cost-realism
**Areas discussed:** Failure logging & ledger, Empirical rate derivation, TOU tariff modeling, Maintenance & wear model

---

## Failure logging & ledger

**Q1: Where should the one-tap 'log failure' action live?**

| Option | Description | Selected |
|--------|-------------|----------|
| Job row + ledger (Recommended) | Icon action on each saved job row in JobsManager (pre-fills printer/material) PLUS a standalone "Log failure" button in the failure ledger view | ✓ |
| Job row only | Only from saved jobs — undercounts failures on prints never saved as jobs | |
| Calculator + job row | Also a "this print failed" action in the calculator — third surface to maintain | |

**Q2: Beyond % completion, printer, material — what else should a failure entry capture?**

| Option | Description | Selected |
|--------|-------------|----------|
| Reason category + notes (Recommended) | Fixed enum (adhesion, stringing/quality, clog, mechanical, power loss, other) + optional free-text notes | ✓ |
| Minimal only | Just the required trio + date | |
| Rich capture | Reason + notes + photo + wasted-cost override — slows one-tap, bloats IndexedDB | |

**Q3: Should logging a failure deduct wasted filament from v1.8 stock inventory?**

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, deduct by % (Recommended) | Deduct (job filament grams × % completion) via stockEvent; standalone failures skip unless grams entered | ✓ |
| No deduction | Bookkeeping only; inventory drifts optimistic | |
| Ask per entry | Checkbox per log — one more decision per entry | |

**Q4: Where should the failure history ledger live?**

| Option | Description | Selected |
|--------|-------------|----------|
| Reports tab section (Recommended) | "Failures" section inside the existing Reports tab | ✓ |
| Own top-level tab | Eighth tab for a niche diagnostic view | |
| Per-printer drill-in | Contextual but no all-up view over time | |

---

## Empirical rate derivation

**Q1: How should the empirical failure rate be computed?**

| Option | Description | Selected |
|--------|-------------|----------|
| Failures ÷ total attempts (Recommended) | failures ÷ (saved jobs + failures), all-time, per printer × material | ✓ |
| Weighted by % completion | Conflates rate with severity; severity already drives scrap cost | |
| Recent window only | Responsive but noisy at small samples; another knob | |

**Q2: Minimum sample size before showing the suggestion?**

| Option | Description | Selected |
|--------|-------------|----------|
| ≥5 attempts (Recommended) | Avoids absurd early suggestions; hidden below threshold | ✓ |
| ≥3 attempts | Research sketch's number; 1-in-3 shows a meaningless 33% | |
| ≥10 attempts | Trustworthy but casual users may never see the feature | |

**Q3: Fallback when the exact combo lacks data?**

| Option | Description | Selected |
|--------|-------------|----------|
| Printer-level fallback (Recommended) | One level: printer's all-materials rate, labeled with provenance | ✓ |
| Exact combo only | Purest signal; invisible for months in multi-material shops | |
| Cascade to global | Always shows something; global rate can mislead | |

**Q4: How do multi-material jobs interact with the engine?**

| Option | Description | Selected |
|--------|-------------|----------|
| Dominant filament (Recommended) | Pre-select highest-weight filament (changeable); suggestion keys off dominant filament in form | ✓ |
| All filaments in job | TPU-caused failure unfairly penalizes PLA's rate | |
| Printer-only for multi-mat | Throws away material signal for AMS users | |

---

## TOU tariff modeling

**Q1: How flexible should the tariff structure be?**

| Option | Description | Selected |
|--------|-------------|----------|
| Up to 3 bands (Recommended) | Flat default + up to 3 named bands with rate + daily window | ✓ |
| Simple peak/off-peak | Can't model 3-band plans (California SCE, Octopus) | |
| Full schedule grid | Per-day + seasonal — Settings becomes a spreadsheet | |

**Q2: How does print start time enter the calculator?**

| Option | Description | Selected |
|--------|-------------|----------|
| Optional time picker (Recommended) | Time-of-day only, shown when TOU configured; empty = flat rate | ✓ |
| Band dropdown instead | Discards the weighted calc for band-crossing prints | |
| Full date-time | Heavier input, zero extra accuracy under daily bands | |

**Q3: Show a TOU comparison nudge?**

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, inline hint (Recommended) | Cheapest start window + saving amount at the pricing moment | ✓ |
| No, just the cost | Users never learn what TOU setup buys | |
| Comparison in Reports | Nudge arrives after the decision moment | |

**Q4: What persists on a saved job when TOU was used?**

| Option | Description | Selected |
|--------|-------------|----------|
| Time + rate snapshot (Recommended) | Save start time AND weighted rate used (fixedCostsAtSave precedent); reconcile helper ships | ✓ |
| Start time only | Tariff edits silently reprice history — v1.9 regression class | |
| Calculator-only | Saved jobs lose derivation context | |

---

## Maintenance & wear model

**Q1: How should 'abrasive material' be determined?**

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-detect + override (Recommended) | Auto-flag CF/GF/glow/metal-fill patterns + per-material isAbrasive toggle | ✓ |
| User flag only | Most users won't set it; tracking stays empty | |
| Material-type table only | No user control for edge cases | |

**Q2: How does amortized $/hr interact with the existing flat maintenance-budget field?**

| Option | Description | Selected |
|--------|-------------|----------|
| Suggestion + Apply (Recommended) | Derived $/hr as hint beside manual field with one-click Apply; manual authoritative | ✓ |
| Auto-use when logged | Costs change without user action — silent-reprice class | |
| Separate line item | Double-counts unless user zeroes the flat field | |

**Q3: How should next-swap prediction work vs the 500h alert?**

| Option | Description | Selected |
|--------|-------------|----------|
| Per-part intervals (Recommended) | Per part-category interval from its own history; abrasive-hours accelerate nozzle projection; 500h alert stays as fallback | ✓ |
| Single pooled interval | Mixing nozzle + belt swaps = meaningless average | |
| Replace the 500h alert | Users with no log lose their only alert | |

**Q4: Where does the maintenance log UI live?**

| Option | Description | Selected |
|--------|-------------|----------|
| Printer settings drill-in (Recommended) | Per-printer Maintenance section: log + history + cumulative cost + abrasive-hours + prediction | ✓ |
| Reports tab with failures | Logging a swap far from where printers live | |
| Both surfaces | Two surfaces to build + keep consistent in one phase | |

---

## Claude's Discretion

- Apply-button rounding/precision and rate display formatting
- Historical-jobs "attempt" counting feasibility
- Store schema field details + Dexie version number (verify research's v12 assumption)
- Nozzle-type field shape on printer records
- Ledger entry edit/delete mechanics (stock-deduction reversal follows v1.8 self-correcting pattern)
- Hint placement/wording in CostParametersSection + NEW-badge treatment

## Deferred Ideas

- Seasonal / per-day-of-week tariff variants
- Photo attachments + wasted-cost override on failure entries
- Maintenance cost trend chart (Phase 40 Insights candidate)
- Read-only maintenance roll-up in Reports
- Weekday/weekend-aware TOU via full date-time input
