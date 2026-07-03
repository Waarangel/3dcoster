# Phase 13: Tax Model + UI Sweep - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-21
**Phase:** 13-tax-model-ui-sweep
**Areas discussed:** Tax fallback table contents, Tax row display + label format, US marketplace-facilitator UX, UI sweep heuristic

---

## Tax fallback table contents

### Q1 — Regions shipped in `src/data/taxRates.ts`

| Option | Description | Selected |
|--------|-------------|----------|
| EU + UK + AU + CA + US | Covers the currencies the app supports today (USD, EUR, GBP, AUD, CAD) plus US-specific 0% logic. ~30 entries, minimal. | ✓ |
| EN-speaking + EU bloc | UK, AU, CA, US, NZ, IE + 27 EU member states with their own VAT rates. ~33 entries. | |
| Top 40 by hobbyist-seller volume | EU/UK/AU/CA/US plus India, Japan, Brazil, Mexico, Switzerland, Norway, etc. ~40 entries; some may go years without use. | |
| You decide | I pick a starter list and document it. Easy to PR more regions later as needed. | |

### Q2 — Region key

| Option | Description | Selected |
|--------|-------------|----------|
| By currency | userProfile.currency → region key (USD→US, GBP→UK, AUD→AU, CAD→CA, EUR→? — needs a sub-decision for EUR which spans 19 countries). | ✓ |
| By a new userProfile.country field | Explicit user setting in Settings. Needs schema change (one more optional field on UserProfile). Most accurate; small UI cost. | |
| Hybrid: currency → region, with EUR drop-down in Settings | USD/GBP/AUD/CAD auto-map (1:1). EUR users pick their country from a small dropdown the first time the tax row needs a rate. | |

### Q3 — Staleness threshold

| Option | Description | Selected |
|--------|-------------|----------|
| 18 months | Common annual-review cycle plus 6-month grace. Avoids nagging users immediately after a rate change. | ✓ |
| 12 months | Strict. Users see warnings yearly even when rates didn't change. | |
| 24 months | Generous. Some EU/UK rates haven't changed in years; warning would rarely fire. | |
| Never warn — just display the date | Minimal UI. User reads the date and decides for themselves. | |

### Q4 — Settings Default Tax Rate initial value

| Option | Description | Selected |
|--------|-------------|----------|
| Empty / unset | Field blank with placeholder like 'e.g. 13'. Per-job UI uses the fallback chain (Settings→region→manual). Most flexible. | ✓ |
| Auto-populated from region table | Pre-fills with the user's region rate (e.g. 20% if UK). User accepts or overrides. More opinionated. | |
| 0% | Explicit zero. User must opt in to tax. Worst UX for sellers in VAT/GST jurisdictions. | |

### Follow-up Q5 — EUR currency handling (gap surfaced by Q2)

| Option | Description | Selected |
|--------|-------------|----------|
| Use 21% EU average | Mean of 27 member states' standard VAT — close to actual for most users (DE/FR/IT/ES sit between 19-22%). Shown as 'EU average rate — verify for your country' tooltip. User overrides if needed. | ✓ |
| Show 'enter manually' — same as unknown region | Currency alone is insufficient information. User must set the Settings default or per-job override. Treats EUR like an undecoded region. | |
| Prompt user to pick EU country on first encounter | When the tax row first needs to render for an EUR user, show a tiny dropdown of EU countries (one-time pick, persisted to localStorage). Lighter than a full userProfile.country field but adds one extra UX moment. | |
| Add userProfile.country (reverses Q2) | I'd reverse the previous answer and ship country-keyed lookup instead. More accurate, requires one more optional schema field on UserProfile. | |

**Notes:** EU members each get their own row in `taxRates.ts` (per-country VAT), but the per-EUR-user lookup resolves to the 21% EU-average fallback because EUR-keyed lookup is ambiguous by design.

---

## Tax row display + label format

### Q1 — Label naming

| Option | Description | Selected |
|--------|-------------|----------|
| Always 'Tax' | Simple, no edge cases. 'Tax (20%)' regardless of region. Matches TAX-04 exact wording in ROADMAP. | ✓ |
| Region-aware (VAT / GST / Tax) | EU + UK → 'VAT (20%)', AU + CA → 'GST (10%)', US + unknown → 'Tax (X%)'. More polished for international users but adds string-mapping logic. | |
| Always 'Sales Tax' | US-style label everywhere. Loses local nomenclature for EU/UK/AU. | |

### Q2 — Decimal precision

| Option | Description | Selected |
|--------|-------------|----------|
| One decimal place | 'Tax (20.0%)' / 'Tax (8.5%)'. Handles HU 27%, IE 23%, fractional rates uniformly. Matches the Profit Margin field's existing step=0.1. | ✓ |
| Smart — drop trailing .0 | 'Tax (20%)' for whole rates, 'Tax (8.5%)' for fractional. Cleaner reading but extra format logic. | |
| No decimals — round to integer | 'Tax (8%)' even when user set 8.5%. Loses precision in display (math still uses the real value). | |

### Q3 — Rate-source surfacing

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, info icon next to label | Tooltip reads e.g. 'From Settings default — 20%' / 'Per-job override' / 'From your region (UK, rateAsOf 2024-04-01)' — helps users debug surprising numbers. | ✓ |
| Show source as italic suffix on the row | 'Tax (20%) — from Settings' inline. Always visible, no hover. More vertical/horizontal clutter on the breakdown. | |
| No source shown | Just the line. User looks in Settings / calculator to figure out what's active. | |

### Q4 — Override-equals-default UX

| Option | Description | Selected |
|--------|-------------|----------|
| Treat same as default — no badge | If the user explicitly sets per-job rate equal to Settings default, it's behaviorally identical. Showing 'overridden' is noise. | ✓ |
| Show '(overridden)' badge | Sticks faithfully to TAX-02 'override persists with the saved job' — makes the override explicit regardless of value. | |
| Only badge when override differs from default | Compromise — badge only when actually different. Hides redundant signal but adds compare logic. | |

---

## US marketplace-facilitator UX

### Q1 — Note placement

| Option | Description | Selected |
|--------|-------------|----------|
| InfoTooltip next to the tax label | Same pattern as everywhere else in the form. 'i' icon next to 'Tax' — hover/tap reveals the note. Consistent with UI-09. | ✓ |
| Inline help text below the input | Always visible. Adds vertical space to every US user's calculator and Settings. Hard to miss but noisy. | |
| Dismissable banner on first US calc | Shows once, user dismisses. Educational but doesn't surface on return visits when they might forget. | |

### Q2 — Wording

| Option | Description | Selected |
|--------|-------------|----------|
| Short and factual | 'Most US states require marketplaces (Etsy, eBay, Amazon) to collect sales tax for you. Override only if you sell direct or in a non-facilitator state.' | ✓ |
| Very short | 'Etsy/eBay handles US sales tax for you in most states.' Minimal, less actionable. | |
| Longer / more cautious | Multi-sentence explanation with link to Etsy's policy. More accurate but overweight for a tooltip. | |
| You decide | I'll draft something concise; you adjust during code review. | |

### Q3 — On override

| Option | Description | Selected |
|--------|-------------|----------|
| Note persists | The marketplace-facilitator situation hasn't changed just because the user typed a number. Tooltip still explains why the default was 0; user already accepted the override. Safe and educational. | ✓ |
| Note hides at non-zero | Less clutter when user has made their choice. But user might forget the context if they revisit later. | |
| Note swaps to 'You've overridden the marketplace default' | Confirms the override deliberately. Slight string-management cost. | |

### Q4 — Where shown

| Option | Description | Selected |
|--------|-------------|----------|
| Both (Settings field + per-job tax row) | Settings default field gets the note (user sees it when they first set up); per-job tax row gets the note (in case they're editing a saved job and didn't touch Settings). Consistent. | ✓ |
| Settings only | Per-job tax row stays clean. User who skips Settings entirely never sees the note. | |
| Per-job tax row only | Note appears where the tax actually applies. Settings field is just a number entry. | |

---

## UI sweep heuristic

### Q1 — Compact rule

| Option | Description | Selected |
|--------|-------------|----------|
| Numeric only — currency, %, count, time | Any input where the value is a small number (g, h, $, %, count). Text inputs (names, URLs, addresses) stay full-width. Matches the v1.2 spec intent. | ✓ |
| Numeric + short-suffix text | Adds short-text inputs like SKU codes, single-character codes. Slightly broader but harder to define. | |
| Numeric + text fields under N characters | Length-based heuristic. Hard to enforce consistently. | |

### Q2 — Placeholder migration

| Option | Description | Selected |
|--------|-------------|----------|
| Replace with example value or empty | '0', '0.00', 'e.g. 13', or empty. Pure example, no instructions. The 'why this field exists' lives in the InfoTooltip. Most consistent. | ✓ |
| Always empty placeholder | Cleanest visual but loses 'what does this expect?' affordance for first-time users. | |
| Keep descriptive when no good example exists | Some fields don't have an obvious example value. Allow descriptive fallback case-by-case. | |

### Q3 — Wide text inputs

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, same pattern | Every field with a description gets InfoTooltip on the label, regardless of `compact`. Consistent. Existing CostCalculator already does this for Model URL. | ✓ |
| Only when the placeholder is descriptive today | Surgical — only migrate inputs that currently have a 'Enter...' / descriptive placeholder. | |
| Skip wide text inputs | Leave Print Name / Model URL placeholders alone. UI-08/09 only target the numeric set. | |

### Q4 — UI-10 scope

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, audit src/features.ts in the same phase | Natural pairing with the UI sweep — same files get touched. Removes badges past NEW_FEATURE_MAX_AGE_DAYS (14 days) and prunes entries with zero JSX consumers. | ✓ |
| Defer to its own micro-phase | Keep Phase 13 strictly tax + sweep. Schedule UI-10 separately. | |
| Yes, but only the obvious stale badges — skip registry pruning | Quick win: remove badges past 14 days. Leave src/features.ts cleanup for later. | |

---

## Claude's Discretion

- Exact placement of Default Tax Rate field within the Pricing tab vertical order.
- Exact placement of the per-job tax row within CostCalculator's pricing block.
- Internal data shape of `taxRates.ts` (Map vs record vs typed array).
- Test grouping inside `costCalc.test.ts`.
- JSX/Tailwind classes for the tax-row visual.
- Whether the sweep lands in one PR or split per file.
- Whether the staleness hint reuses InfoTooltip or adds an inline indicator.

## Deferred Ideas

- Region-aware tax labels (VAT / GST / Sales Tax) — rejected in this discussion; revisit if localization becomes a goal.
- `userProfile.country` field — rejected in favor of the 21% EU-average compromise.
- Geo-based live tax API (TAX-F1).
- US per-state sales tax tables (TAX-F2).
- Tax-inclusive pricing toggle.
- Per-customer tax exemptions (Phase 14+ territory).
- Per-job "(overridden)" badge — rejected in D-09; revisit if user feedback surfaces confusion.
