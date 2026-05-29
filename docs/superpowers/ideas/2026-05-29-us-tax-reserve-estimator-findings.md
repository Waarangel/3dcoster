# US Tax Reserve Estimator — Findings & Recommended Approach

**Date:** 2026-05-29
**Status:** Idea / findings — NOT a spec, no implementation committed. Needs its own
brainstorm → spec → plan cycle before building.
**Tier:** Free (cost/pricing aid — covered by the "every cost-model improvement stays free"
principle). Distinct from the paid white-label work.

## Origin

A user-supplied spec proposed a "US Business Tax Reserve Calculator" that computed:
`taxReserve = revenue × (0.153 SE + 0.12 federal + 0.03 state)`. Asked to verify
independently as senior dev, the component math was found to be **wrong in ways that would
give users materially incorrect numbers**. A tax tool that is wrong is worse than none.

## Verified facts (IRS / SSA / reputable sources, 2026)

| Topic | Verified | Source |
|---|---|---|
| SE tax rate | 15.3% (12.4% Social Security + 2.9% Medicare) | irs.gov self-employment-tax |
| SE tax basis | Applied to **92.35% of net earnings** (profit), **not gross revenue** | irs.gov self-employment-tax |
| SS wage cap | SS portion (12.4%) caps at the wage base: **$176,100 (2025)**, **$184,500 (2026)**; Medicare uncapped | irs.gov / ssa.gov COLA |
| Additional Medicare | +0.9% above $200k single / $250k MFJ | irs.gov Topic 560 |
| SE tax deduction | **Half of SE tax is income-deductible** (above-the-line) | irs.gov self-employment-tax |
| Federal income tax | **Progressive/marginal**, not flat: 10/12/22/24/32/35/37% | irs.gov brackets |
| Standard deduction | $15,750 single (2025) | irs.gov 2026 inflation adjustments |
| QBI / §199A | 20% pass-through deduction; **made permanent by OBBBA (2025)**, $400 min from 2026 | irs.gov QBI |
| "Set aside" rule of thumb | **25–30%** (some say 30–40% incl. state), applied to **net income/profit** not gross revenue | NerdWallet, Bench |

## Why the original formula is wrong

1. **Wrong basis.** It multiplies the reserve rate by `revenue`. Both SE tax and income
   tax are computed on **net profit**. Applying ~28% to gross revenue tells a thin-margin
   seller to reserve more than they actually *made*.
2. **SE tax is not flat 15.3% of anything simple.** It's 15.3% × 92.35% of net earnings,
   the SS half caps at the wage base, and half of it is income-deductible.
3. **Federal income tax is bracketed, not flat 12%.** Ignores the standard deduction and
   the 20% QBI deduction most of these businesses get.

## Recommended approach (the honest version)

Build a **reserve *estimator*, not a tax calculator**:

- **Key it off profit, which the app already computes** per job and per sale — not revenue.
- Apply a **configurable reserve band defaulting to ~25–30%**; show "set aside ~$X."
- **US-only**: gate on `UserProfile.address.country === 'US'`; hide/disable otherwise (the
  app supports 18 currencies internationally).
- **Hard disclaimer**: "Rough estimate based on the common 25–30% rule of thumb. Not tax
  advice — consult a tax professional."
- **Skip "advanced mode" with precise component rates** — that is where false-precision and
  liability live. The defensible product is the rule-of-thumb on profit.

### Possible surfaces (for the future brainstorm)
- Per-job: "set aside ~$X of this job's profit for taxes" (pricing aid).
- Aggregate: a reserve figure across recorded sales over a period (monthly/quarterly).

## Out of scope / explicitly rejected
- Computing precise tax liability or specific dollar tax owed.
- State-by-state income tax tables.
- Anything applied to gross revenue.
- Non-US tax regimes (for now).
