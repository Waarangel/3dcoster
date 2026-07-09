---
phase: 33-insight-pricing-coach
plan: 03
status: complete
requirements: [SC3, SC5, SC6]
date: 2026-06-25
---

# 33-03 — Dynamic "Why this price?" coach — SUMMARY

## What shipped
A contextual pricing coach whose verdict line **changes with the user's margin** — the moat vs SlicePrice3D's static guide.

- **`src/utils/pricingCoach.ts`** (+ `.test.ts`) — pure `selectMarginBand(marginPercent)` → `{key, tone, text}` over a **non-overlapping health ladder** (thresholds as named constants `MARGIN_BAND_MIN`, **user-confirmed 2026-06-25**): `<0 loss` / `0–30 thin` / `30–50 wholesale` / `50–70 healthy` / `≥70 strong`; non-finite → neutral. Margin interpolated into the message (rounded 1 dp for display, band on raw value). 6 unit tests incl. the SC3 distinct-message proof + boundaries.
- **`src/components/CostCalculator.tsx`** — a shared `netMargin` memo now feeds BOTH the Net Margin stat and the coach (single source of truth — can't disagree). A coach card between the Pricing summary and Cost Breakdown: an always-visible verdict line (colored by tone, ⚠ for bad/warn) + a collapsed `<CollapsibleSection title="Why this price?">` holding the retained margin-vs-markup + per-channel reference explainer.
- **`src/features.ts`** — `'pricing-coach'` registered (2026-06-25); NEW badge on the collapsible title.

## Verification
- `vitest`: pricingCoach (6) + profitPerHour + costAllocation — 22 targeted tests pass.
- `tsc -b` clean; `lint:no-raw-html` pass; **full `npm run build` green**.
- **Live smoke** (insight worktree :4173) — varied the selling price; the verdict line changed across every band, tones correct:
  - $0.50 (below cost) → red **"You're selling below cost…"**
  - $1.30 (25.5%) → amber **"thin…"**
  - $1.60 (39.5%) → slate **"keystone / wholesale range…"**
  - $2.00 (51.6%) → green **"healthy…"**
  - $5.00 (80.6%) → green **"strong…"**
  Expanding "Why this price?" showed the margin-vs-markup + channel-range explainer; NEW badge present; no console errors.

## SC mapping
- **SC3** ✅ guidance changes as margin changes (unit distinct-message test + live across 5 bands).
- **SC5** ✅ free/local/offline.
- **SC6** ✅ gates green; NEW badge + features.ts entry.

## UAT revision (2026-06-25)
Per user UAT: the big always-visible "Why this price?" card was **too heavy**. Replaced with a compact treatment (like the Tax info icon): the **Net Margin stat is now color-coded by band** (red/amber/slate/green) and an **info icon beside it** carries the dynamic verdict + margin-vs-markup + channel-ranges explainer. The standalone collapsible card and the `pricing-coach` NEW-badge entry were removed; the `selectMarginBand` util is unchanged. Verified live: Net Margin recolors as the price changes (green→amber confirmed), tooltip carries the dynamic verdict.

## Decisions / notes
- **Net margin** drives the coach (same value as the Net Margin stat) — resolves the plan-checker's net-vs-gross flag.
- Ladder cutoffs/copy are the **user-confirmed** 0/30/50/70 set (not the plan's draft 0/25/50/65).
- Channel-awareness stays out of scope; when the later Channel Presets phase lands, this ladder becomes the per-channel band source.
