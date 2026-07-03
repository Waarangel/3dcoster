---
phase: 13
slug: tax-model-ui-sweep
status: draft
shadcn_initialized: false
preset: none
created: 2026-05-21
---

# Phase 13 — UI Design Contract

> Visual and interaction contract for the Tax Model + UI Sweep phase. Existing design system; no new primitives. All visual decisions trace to upstream artifacts (`13-CONTEXT.md` D-01..D-17, `13-RESEARCH.md`) or to source-code patterns established in Phases 10–12 (`54b206e..ccbde28`).

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (no shadcn) |
| Preset | not applicable |
| Component library | first-party primitives in `src/components/ui/` |
| Icon library | inline SVG (Heroicons-style stroke paths) — already used by `InfoTooltip.tsx:33` and `AssetLibrary.tsx:849` |
| Font | system default (Tailwind `font-sans`); monospace `font-mono` reserved for numeric values in Cost Breakdown |

**Frozen primitives this phase composes:** `Input` (`src/components/ui/Input.tsx`), `InfoTooltip` (`src/components/ui/InfoTooltip.tsx`), `NewBadge` (`src/components/NewBadge.tsx`), `Button`, `Select`. Zero new primitives. Phase 13 is composition, not creation (per RESEARCH "Don't Hand-Roll" closer, line 356).

---

## Spacing Scale

The project uses Tailwind's default 4px-base scale. Phase 13 does **not** introduce new spacing; it consumes existing tokens. Confirmed against `tailwind.config.js` (no custom `spacing` overrides).

| Token | Tailwind | Pixels | Phase 13 Usage |
|-------|----------|--------|----------------|
| 1 | `gap-1` / `pt-1` | 4px | Tax label↔tooltip gap (matches Model URL label at `CostCalculator.tsx:710`) |
| 1.5 | `gap-1.5` | 6px | Label inner-gap when icon + text + badge (precedent: `CostCalculator.tsx:710`, `:861`) |
| 2 | `space-y-2` / `pt-2` / `mt-2` | 8px | Cost Breakdown row vertical rhythm (`CostCalculator.tsx:1252,1294`) |
| 3 | `space-y-3` / `pt-3` / `mt-3` | 12px | Cost Breakdown grand-total padding (`CostCalculator.tsx:1305`) |
| 4 | `gap-x-4 gap-y-3` / `pt-4 mt-4` | 16px | Form row wrap gap; Cost Breakdown card inner padding (`CostCalculator.tsx:1249` `p-6` exception) |
| 6 | `p-6` | 24px | Card inner padding (`CostCalculator.tsx:1249`); no change |

**Exceptions:**
- `max-w-28` (`Input.tsx:23`) is the only "size cap" on compact inputs. Equates to 7rem / 112px. No alternative widths.
- The `pl-8` on the Set Financial Targets primary inputs (`CostCalculator.tsx:1162`) stays untouched — those inputs are intentionally NOT compact (per RESEARCH UI sweep inventory, line 432).
- Default Profit Margin `NewBadge` uses `className="absolute top-0 left-full ml-2 pointer-events-none"` (`SettingsModal.tsx:240`). The Default Tax Rate field does NOT get a NewBadge in this phase — first-mention badge will arrive in a future phase. Reserve this pattern only.

---

## Typography

The project uses Tailwind's default `text-*` scale on system fonts. Phase 13 declares the four roles already in use across the touched surfaces. No new sizes.

| Role | Tailwind | Effective Size | Weight | Line Height | Phase 13 Usage |
|------|----------|----------------|--------|-------------|----------------|
| Label / micro-copy | `text-xs` | 12px | 400 (default) / 500 (`font-medium` on section headers) | 1.5 (Tailwind default for `text-xs`) | `<label className="text-xs text-slate-400">` everywhere (CostCalculator, SettingsModal); InfoTooltip body text |
| Body / row value | `text-sm` | 14px | 400 | 1.5 | Cost Breakdown rows (`CostCalculator.tsx:1252`); Settings descriptions |
| Section heading | `text-sm font-medium` | 14px | 500 | 1.5 | "Default Profit Margin" / "Default Tax Rate" h3 (`SettingsModal.tsx:238`) |
| Card heading | `text-lg font-semibold` | 18px | 600 | 1.25 | "Cost Breakdown" h2 (`CostCalculator.tsx:1250`) |

**Numeric formatting:**
- Currency values in Cost Breakdown use `font-mono` (`CostCalculator.tsx:1257`). Tax row inherits.
- Tax percentage display: **1 decimal place always** (`Tax (20.0%)`, `Tax (8.5%)`, `Tax (27.0%)`) per CONTEXT D-07. Formatter: `tax.ratePercent.toFixed(1)` inline in JSX. No helper module; the call is local to the Tax row JSX in CostCalculator (matches the rest of the breakdown which uses `.toFixed(2)` inline at `CostCalculator.tsx:1257`).
- Tax amount uses `.toFixed(2)` (RESEARCH Example 2, line 682). Math is `Math.round(sellingPrice * ratePercent) / 100` inside `calculateTax` — display is unrounded post-math (`toFixed(2)` is cosmetic only).

---

## Color

Phase 13 introduces **no new colors**. Slate-based dark theme established by `tailwind.config.js` + Phase 10–12 redesigns is the baseline.

| Role | Tailwind / Hex | Usage |
|------|----------------|-------|
| Dominant (60%) | `bg-slate-900` / `bg-slate-800` | Page background, card surface (`bg-slate-800` is the Cost Breakdown card per `CostCalculator.tsx:1249`) |
| Secondary (30%) | `bg-slate-700` / `bg-slate-700/50` | Input fill (`Input.tsx:22`), inset panels (`CostCalculator.tsx:1203,1333`) |
| Accent (10%) | `text-blue-400` / `focus:ring-blue-500` | Reserved for: input focus rings (`Input.tsx:22`), `text-blue-400` links/cta highlights (`CostCalculator.tsx:1226`), `accent-blue` checkbox (`CostCalculator.tsx:745`). **Tax row uses neutral slate, not accent.** |
| Destructive | `text-red-400` / `bg-red-500/20` | Author Min Price warning (`CostCalculator.tsx:1238`); not used in tax UI |
| Info (warn variant) | `text-yellow-400` / `text-orange-400` | Reserved for Failure Adjustment row (`CostCalculator.tsx:1299`), Marketplace Fee note (`CostCalculator.tsx:1320`). **Tax staleness hint does NOT add a new color** — staleness surfaces through the existing InfoTooltip body text per CONTEXT D-08 (the same tooltip already carries `rateAsOf`). Inline `<span className="text-yellow-400 text-xs">` (RESEARCH discretion option, line 53) is REJECTED — keep staleness inside the tooltip to avoid color sprawl. |
| Tax row text | `text-slate-300` | Same as Subtotal / Filament / Electricity rows (`CostCalculator.tsx:1255,1259`) — Tax is a neutral cost line, not a callout |
| Grand total text | `text-white font-semibold` | Same as "Cost Per Unit" total at `CostCalculator.tsx:1306`; "Total (with Tax)" row mirrors |

**Accent reserved for (explicit list — no expansion in Phase 13):**
1. Input focus ring (`focus:ring-blue-500` on `Input.tsx:22`)
2. `text-blue-400` on the "Reset to default" Button (`CostCalculator.tsx:1002`) and Net Margin KPI tile (`CostCalculator.tsx:1226`)
3. `accent-blue` per-unit-license checkbox (`CostCalculator.tsx:745`)
4. `bg-green-500` NewBadge chip (`NewBadge.tsx:69`)

**Color anti-patterns banned in this phase:**
- No region-keyed color differentiation on the Tax row (no UK-blue, EU-yellow, etc.). Label text color is `text-slate-300` always. Per CONTEXT D-06: label is `"Tax (X%)"`, region-agnostic.
- No flag emojis, region badges, or country glyphs on the Tax row label.
- No new yellow-staleness chip. Staleness narrative lives inside the existing InfoTooltip text (D-03 + D-08 share one tooltip).

---

## Copywriting Contract

All Phase 13 copy is locked. Planner may copy-edit lightly per CONTEXT D-11 caveat; the substance is fixed.

### Tax Row (CostCalculator Cost Breakdown)

| Element | Copy | Source |
|---------|------|--------|
| Tax row label | `Tax (X.X%)` — always one decimal, region-agnostic | CONTEXT D-06, D-07 |
| Grand total row label | `Total (with Tax)` | RESEARCH Example 2, line 685 |
| Tax row hidden state | (row not rendered when `tax.ratePercent === 0`) | TAX-04 success criterion 4; CONTEXT D-04 prohibits silent 0% but the **row** still hides at 0% — see Empty States below |

### InfoTooltip body text (locked strings — planner uses verbatim)

The Tax row label carries one `<InfoTooltip text={...}>` whose body text branches on `taxSource.kind` from `resolveTaxRate()`. Helper `tooltipForSource(source)` lives in `src/utils/taxResolution.ts` (RESEARCH Example 3, line 695).

| `taxSource.kind` | Tooltip Body |
|------------------|--------------|
| `override` (non-USD currency) | `Per-job override — {rate}%` |
| `override` (USD currency) | `Per-job override — {rate}%\nMost US states require marketplaces (Etsy, eBay, Amazon) to collect sales tax for you. Override only if you sell direct or in a non-facilitator state.` |
| `settings` (non-USD currency) | `From Settings default — {rate}%` |
| `settings` (USD currency) | `From Settings default — {rate}%\nMost US states require marketplaces (Etsy, eBay, Amazon) to collect sales tax for you. Override only if you sell direct or in a non-facilitator state.` |
| `region` (non-stale, no note) | `From your region ({regionCode}, as of {rateAsOf}).` |
| `region` (stale per `isRateStale`) | `From your region ({regionCode}, as of {rateAsOf} — rate may be stale, verify locally).` |
| `region` (US, marketplace facilitator) | `From your region (US, as of 2025-01-01).\nMost US states require marketplaces (Etsy, eBay, Amazon) to collect sales tax for you. Override only if you sell direct or in a non-facilitator state.` |
| `region` (CA, federal-GST note) | `From your region (CA, as of 2008-01-01).\nFederal GST only. Provincial sales tax (PST/HST) varies — override for your province.` |
| `eu-average` | `EU midpoint rate — verify for your country (21%)` |
| `manual` | `Unknown region — enter manually. We don't have a default rate for your currency yet.` |

> **Wording note on `eu-average`:** CONTEXT D-05 calls 21% the "average" / "mean"; the actual unweighted mean is 21.9% and 21% is the median (RESEARCH Discrepancy 2, line 880). The tooltip uses **"midpoint"** instead of "mean" to be accurate without re-opening the locked value. Planner may revert to "average" if the user prefers; substance is unchanged.

> **D-12 + D-13 implementation note:** When `userCurrency === 'USD'`, the US marketplace-facilitator string is **appended** to the tooltip body for ALL `taxSource.kind` values, not just `kind: 'region'`. This preserves the note when a US user manually enters a non-zero rate via per-job override (D-12) and when the rate comes from the Settings default (D-13). Implementation: `tooltipForSource(source, userCurrency)` in `src/utils/taxResolution.ts` takes the user's currency as a second argument and appends the locked D-11 string to the returned tooltip whenever `userCurrency === 'USD'`. The `region` (US) row above already includes the note inline because the US region row in `src/data/taxRates.ts` carries the note string — the override/settings/eu-average/manual branches append it explicitly via the currency argument.

### SettingsModal — Default Tax Rate field

Slotted into the existing **"Costs & Rates" tab** (`activeTab === 'costs'`, `SettingsModal.tsx:200`), positioned **BELOW Default Profit Margin** (currently at `SettingsModal.tsx:237-262`). Rationale: Default Profit Margin is the more frequently edited setting (per RESEARCH Example 4 line 723); Tax slots in after it as a less-frequent but related pricing setting. Single new `<div className="pt-4 border-t border-slate-700">` block, mirroring `SettingsModal.tsx:237`.

> **Tab terminology resolution:** CONTEXT, ROADMAP, and REQUIREMENTS all say "Pricing tab" but the actual code has `'costs' | 'delivery' | 'marketplaces'` with label "Costs & Rates" (`SettingsModal.tsx:149`). This UI-SPEC formalizes the resolution from RESEARCH Discrepancy 1 (line 872): **slot Default Tax Rate into the existing "Costs & Rates" tab**. Do NOT add a new "Pricing" tab.

| Element | Copy | Source |
|---------|------|--------|
| Section heading (h3) | `Default Tax Rate` | RESEARCH Example 4, line 731 |
| Field label | `Tax Rate (%)` | Mirrors `Profit Margin (%)` at `SettingsModal.tsx:243` |
| Placeholder | `e.g., 20` | RESEARCH Example 4, line 759 (D-15: placeholder is an example value, not a description) |
| InfoTooltip (USD currency) | `Most US states require marketplaces (Etsy, eBay, Amazon) to collect sales tax for you. Override only if you sell direct or in a non-facilitator state.` | CONTEXT D-11 (substance locked), D-13 (appears in both Settings + per-job) |
| InfoTooltip (non-USD currency) | `Default tax rate applied to new jobs. Override per-job in the calculator.` | RESEARCH Example 4, line 738 |
| Below-input descriptive `<p>` | (none — D-15/D-16: description lives in InfoTooltip, NOT in a `<p>` below) | CONTEXT D-15 |

> **Pattern divergence from Default Profit Margin:** The existing Default Profit Margin field has a descriptive `<p className="text-xs text-slate-500 mt-2">` below the Input at `SettingsModal.tsx:257-259`. Per CONTEXT D-15/D-16 + RESEARCH "SettingsModal sweep" line 442, that `<p>` migrates into an InfoTooltip on the label as part of this phase's sweep. So the new Default Tax Rate field starts in the **final visual state** (InfoTooltip on label, no `<p>` below) — and the same wave rewrites Default Profit Margin to match.

### NewBadge presence on Default Tax Rate field

**NO NewBadge on the Default Tax Rate field in this phase.** Default Profit Margin currently shows a NewBadge (released 2026-05-18, 3 days old, fresh per RESEARCH NEW Badge Audit line 548). Default Tax Rate is a new feature in this phase but the planner registers it in `src/features.ts` only at JSX-write time. Decision: register `'default-tax-rate': new Date('2026-05-21')` (today) and emit `<NewBadge feature="default-tax-rate" className="absolute top-0 left-full ml-2 pointer-events-none" />` next to the `<h3>Default Tax Rate</h3>` — same pattern as `SettingsModal.tsx:238-241`. The badge is required per project memory rule "Every new USER-FACING feature must get a NEW badge" (CLAUDE.md auto-memory).

**Anti-pattern check** (CLAUDE.md memory): the badge MUST be `absolute`, never inline in flex-wrap or grid containers that consume layout width. The mirrored pattern at `SettingsModal.tsx:240` is correct. Verify the new badge does not push the h3 width.

### Cost Breakdown — Tax row anatomy (JSX-level spec)

Drop-in after the "Cost Per Unit" total at `CostCalculator.tsx:1305-1313` and before the Marketplace Fee Note at `:1316`. The row is wrapped in `{tax.ratePercent > 0 && (...)}` so it disappears entirely at 0% (TAX-04).

```tsx
{tax.ratePercent > 0 && (
  <div className="border-t border-slate-700 pt-2 mt-2">
    <div className="flex justify-between text-slate-300">
      <span className="flex items-center gap-1.5">
        <span>Tax ({tax.ratePercent.toFixed(1)}%)</span>
        <InfoTooltip text={tooltipForSource(taxSource)} />
      </span>
      <span className="font-mono">{currencySymbol}{tax.taxAmount.toFixed(2)}</span>
    </div>
    <div className="flex justify-between text-white font-semibold mt-1">
      <span>Total (with Tax)</span>
      <span className="font-mono">{currencySymbol}{(sellingPrice + tax.taxAmount).toFixed(2)}</span>
    </div>
  </div>
)}
```

**Class-string contract** (all classes already exist in the codebase — no new utilities):
- Outer wrapper: `border-t border-slate-700 pt-2 mt-2` (mirrors the Subtotal/Failure block at `CostCalculator.tsx:1294`).
- Row container: `flex justify-between text-slate-300` (mirrors Filament row at `:1255`).
- Label span: `flex items-center gap-1.5` (matches Model URL label at `:710`, Prep Time label at `:861`).
- Value span: `font-mono` (mirrors every Cost Breakdown value).
- Total row: `flex justify-between text-white font-semibold mt-1` (mirrors "Cost Per Unit" at `:1306` but slightly smaller — no `text-lg`, since this is the post-Subtotal grand total in a more compact form).

### Per-job Tax Rate override input (CostCalculator)

The per-job override Input belongs in the same Pricing section as Profit Margin / Target Profit / Selling Price (`CostCalculator.tsx:1150-1200`). Decision: **add as a 4th input to the grid**, changing `md:grid-cols-3` → `md:grid-cols-4` for the financial-targets row at `CostCalculator.tsx:1150`. Wide style (not compact) — these are primary financial inputs styled identically.

| Element | Copy / Class |
|---------|--------------|
| Label | `Tax Rate` (h-medium, white) — mirrors `Profit Margin` at `:1152` |
| Prefix overlay | `%` — `absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10` — mirrors `:1154` |
| Input class | `pl-8` (no `compact`) — mirrors `:1162` |
| Placeholder | empty (the resolved rate from `resolveTaxRate` displays via `value` when no override is set; the Input shows the override-typed value once typed) |
| Empty-state behavior | When the user clears the field (`value === ''`), `editingJob.taxRate` becomes `undefined` and the chain falls back to Settings default → region → manual |

**Why wide and not compact:** the 3 existing inputs in this block (Profit Margin, Target Profit, Selling Price) are intentionally wide (RESEARCH inventory line 431-433, "primary inputs, leave wide"). Tax Rate joins them as a peer.

### Removed copy (UI-10 cleanup)

11 `<NewBadge>` JSX sites are deleted per RESEARCH "Remove-list (JSX sites)" line 554. For each removal:

| File:line | Removed JSX | Cleanup check |
|-----------|-------------|---------------|
| `CostCalculator.tsx:748` | `<NewBadge feature="per-unit-licensing" />` | Inside a `<label className="flex items-center gap-2 mt-2 cursor-pointer ...">`. Badge sits between `<span>Per-unit license</span>` and label close. Removal leaves a clean flex row with the checkbox + label only. **No stray `relative` to remove** (the label has no `relative` class). |
| `CostCalculator.tsx:756` | `<NewBadge feature="author-min-price" />` | Inside `<label className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">` with `<span>` + `<InfoTooltip>`. Removal leaves label + tooltip. **No `relative` cleanup needed** (label is not absolute-positioned). |
| `CostCalculator.tsx:1016` | `<NewBadge feature="packaging-materials" />` | Inside `<h3 className="flex items-center gap-2 text-sm font-medium text-white">` at `:1014`. Removal leaves the heading text alone. **No `relative` cleanup needed.** |
| `UserProfileModal.tsx:79` | `<NewBadge feature="multi-currency" />` | Planner must verify placement — RESEARCH line 561 lists this site; check parent for `relative` class and remove if it was solely for the badge. |
| `AssetLibrary.tsx:763` | `<NewBadge feature="csv-import" ... />` | Planner must verify placement. |
| `AssetLibrary.tsx:845` | `{cat === 'packaging' && <NewBadge feature="packaging-materials" />}` | **Remove the entire `{cat === 'packaging' && ...}` conditional** — the `{`...`}` expression itself, not just the inner JSX, leaves a dangling expression-evaluating-to-false otherwise. |
| `GcodeImport.tsx:282` | `<NewBadge feature="gcode-import" />` | Verify parent. |
| `GcodeImport.tsx:283` | `<NewBadge feature="3mf-import" />` | Verify parent. |

For all 8 verified sites: after removing the JSX, run `grep -n "import.*NewBadge" <file>` — if the file no longer uses `<NewBadge>` anywhere, remove the import line too (Pitfall 6 in RESEARCH line 390). Specifically: `GcodeImport.tsx` after removing both lines has zero `<NewBadge>` usages → remove the import. `AssetLibrary.tsx` after removing both has zero → remove the import. `UserProfileModal.tsx` likely has zero → remove the import. `CostCalculator.tsx` keeps the import (still uses `model-url` and `default-profit-margin` — wait, those are in SettingsModal; CostCalculator only keeps `<NewBadge feature="model-url" />` at `:713`).

**Registry cleanup** (`src/features.ts`): 9 stale keys removed (RESEARCH line 571-581); 3 fresh keys kept (`settings-reorg`, `default-profit-margin`, `model-url`); 1 new key added (`default-tax-rate`) — net file has **4 entries** after this phase.

---

## Interaction Contract

### Cost Breakdown Tax row — show/hide rules

| Condition | Tax row rendering | Grand total label |
|-----------|-------------------|-------------------|
| `tax.ratePercent === 0` | **Hidden entirely** — no row, no total override. The existing "Cost Per Unit" total at `:1306` is the last total shown. | n/a |
| `tax.ratePercent > 0` AND `sellingPrice > 0` | Visible: `Tax (X.X%)` label + amount; below it, `Total (with Tax)` row | `Total (with Tax)` |
| `tax.ratePercent > 0` AND `sellingPrice === 0` | Tax row visible with `Tax (X.X%)` label and `{currencySymbol}0.00` amount (since `calculateTax(0, rate) = {taxAmount: 0}`). **Total row hidden** — both the existing "Cost Per Unit" total and the new "Total (with Tax)" row would be `0.00`, redundant. | n/a |

> **Coupling note:** the `tax.ratePercent` value comes from `resolveTaxRate(...).rate`, which can be `0` for the `kind: 'region'` US case AND for the `kind: 'manual'` unknown-region case. Both correctly hide the row. The marketplace-facilitator note (D-12, D-13) for US users surfaces in **the Settings field's InfoTooltip** even when the Cost Breakdown row is hidden. This is the per-job tax UI's intended fallback — user sees the tooltip in Settings, knows why the calculator's tax row is empty.

### Empty-state matrix (Tax row vs. Settings field)

| User currency | Settings `defaultTaxRate` | Per-job `taxRate` | resolveTaxRate result | Cost Breakdown Tax row | Settings tooltip |
|---------------|----------------------------|---------------------|------------------------|------------------------|-------------------|
| USD | undefined | undefined | `region` rate=0 | **HIDDEN** (rate=0) | Marketplace-facilitator note |
| USD | 5.5 (user typed) | undefined | `settings` rate=5.5 | `Tax (5.5%)` visible | Marketplace-facilitator note (D-12: note persists) |
| USD | undefined | 8 (per-job typed) | `override` rate=8 | `Tax (8.0%)` visible | Marketplace-facilitator note |
| EUR | undefined | undefined | `eu-average` rate=21 | `Tax (21.0%)` visible | `Default tax rate applied to new jobs. Override per-job in the calculator.` (non-USD branch) |
| GBP | undefined | undefined | `region` rate=20 | `Tax (20.0%)` visible | non-USD branch |
| AUD | undefined | undefined | `region` rate=10 | `Tax (10.0%)` visible | non-USD branch |
| CAD | undefined | undefined | `region` rate=5 | `Tax (5.0%)` visible (federal GST note in tooltip) | non-USD branch |
| ZAR (unknown) | undefined | undefined | `manual` rate=0 | **HIDDEN** (rate=0). Tooltip on the resolved Settings tooltip is not surfaced in Cost Breakdown because no row renders. | non-USD branch + the user discovers the manual-entry need by visiting Settings. |
| ZAR | 15 (user typed) | undefined | `settings` rate=15 | `Tax (15.0%)` visible | non-USD branch |

> **Why ZAR (unknown region) doesn't break the "never silently 0%" rule:** CONTEXT D-04 / TAX-03 say the system never silently defaults to 0%. In the ZAR-empty case the Cost Breakdown row hides (correct — there's no rate to show), but the user-facing surface that tells them to enter a rate is the **Settings field tooltip** plus the implicit empty state of their own Settings field. The `kind: 'manual'` branch in `resolveTaxRate` exists specifically to power the Settings field's "enter manually" call-to-action — which planner wires up by showing the placeholder `e.g., 20` and the tooltip "Default tax rate applied to new jobs..." (which prompts manual entry). If the planner wants to make this more explicit, a follow-on can add a `kind: 'manual'`-specific tooltip variant. Not required for this phase.

### InfoTooltip — placement and ordering rules

When a label has both `<InfoTooltip>` and `<NewBadge>` (e.g., Default Profit Margin h3 currently, Default Tax Rate h3 after this phase):

| Container | Order (left → right) | Pattern source |
|-----------|---------------------|----------------|
| h3 section heading | h3 text, then `<NewBadge>` absolutely-positioned at `top-0 left-full ml-2` | `SettingsModal.tsx:238-241` (Default Profit Margin) |
| Inline `<label>` for an Input | `<span>text</span>`, `<InfoTooltip>`, `<NewBadge>` (badge is inline at end of label flex chain) | `CostCalculator.tsx:710-713` (Model URL: span → InfoTooltip → NewBadge) |

**Order is locked**: text → tooltip → badge. Reading order top-to-bottom: "What field is this?" → "What does it mean?" → "Is it new?"

Both badge variants are anti-pattern-safe per CLAUDE.md auto-memory:
- h3 absolute-positioned variant cannot push siblings because it's absolute.
- Inline-at-end-of-label variant lives in a `flex items-center gap-1.5` label that is NOT a `flex-1` peer — the label is just a label, not a flex column competing for width. The badge appearing/disappearing doesn't reflow neighbors.

### Numeric input — keyboard contract

Mirror the existing Default Profit Margin contract (`SettingsModal.tsx:244-256`) for Default Tax Rate **and** the per-job Tax Rate override:

| Attribute | Value | Source |
|-----------|-------|--------|
| `type` | `"number"` | `SettingsModal.tsx:245` |
| `step` | `"0.1"` | `SettingsModal.tsx:246` (matches D-07's 1-decimal display) |
| `min` | `"0"` | `SettingsModal.tsx:247` |
| `max` | `"99.9"` | `SettingsModal.tsx:248` |
| `inputMode` | `"decimal"` | (TO ADD — Default Profit Margin doesn't currently set this; planner may add to both for mobile decimal keypad — discretion) |
| `value` clamp | `Math.min(Math.max(parsed, 0), 99.9)` | `SettingsModal.tsx:253` |
| `value` for unset state | `''` (empty string) — **NOT `?? 0`** | RESEARCH Pitfall 3 line 372 (critical: differentiates "user hasn't touched" from "user typed 0") |

> **Default Profit Margin pattern deviation:** `SettingsModal.tsx:250` uses `value={userProfile.defaultProfitMargin ?? 30}` — this is OK because Profit Margin has a sensible default (30%) and Default Profit Margin is allowed to be `0` (the chain treats `0` as a valid setting). Default Tax Rate is **different**: D-04 says it starts empty/unset, so `?? ''` is required, and the `onChange` handler must set `defaultTaxRate: undefined` when the input is cleared (RESEARCH Example 4, line 750-757).

### Cost Breakdown row — responsive behavior

Cost Breakdown rows use simple `flex justify-between` (not `flex-wrap`) — see `CostCalculator.tsx:1255-1313`. They are **always horizontal** at every breakpoint (label left, value right). This is INTENTIONAL: rows must not wrap because the value's right-alignment is the visual scaffolding of the breakdown.

The Tax row inherits this. On mobile narrow viewports it stays one row. Label text can shrink via natural text-rendering (label is short — `Tax (20.0%)` is ~12 chars).

> The flex-wrap pattern from Phase 12's redesign (`54b206e..ccbde28`) applies to **form input rows** like Print Job Details, NOT to Cost Breakdown rows. The two layouts have different responsibilities. The Tax row is a Cost Breakdown row — `flex justify-between`, no wrap.

### Accessibility

- `InfoTooltip` already supports keyboard focus (`InfoTooltip.tsx:25-26` — `onFocus`/`onBlur` mirror hover) and click-to-pin on mobile (`:27-30` — `onClick` toggles `open`). `aria-describedby` wires up when open (`:24`). No changes needed.
- Inputs already inherit `min-h-[44px]` from `Input.tsx:15-17` (md size), meeting touch-target spec. No changes needed.
- The new Tax row is text-only — no interaction surface, no keyboard handling required.
- The Tax row label `<InfoTooltip>` is keyboard-reachable via Tab order from the InfoTooltip rendered inline. The order of focus inside the Cost Breakdown card is: (page tab order leads in) → label tooltips encountered as user tabs through. This is consistent with the existing Marketplace Fee section.
- All InfoTooltip body text strings are ≤ 200 chars (longest is the US marketplace-facilitator wording at ~180 chars). InfoTooltip CSS already caps with `max-w-xs` (`InfoTooltip.tsx:41` = 20rem) and wraps. No truncation risk.

---

## Component Inventory

Files touched in Phase 13. All components already exist — no new components are created.

| Component | File | Phase 13 Action |
|-----------|------|-----------------|
| `Input` | `src/components/ui/Input.tsx` | UNCHANGED — primitive. Consumed with `compact` prop on 22 numeric inputs. |
| `InfoTooltip` | `src/components/ui/InfoTooltip.tsx` | UNCHANGED — primitive. Consumed on Tax row label + 7 migrated descriptive `<p>` sites + 1 placeholder migration. |
| `NewBadge` | `src/components/NewBadge.tsx` | UNCHANGED — primitive. Removed from 11 JSX sites; added to 1 new site (Default Tax Rate). |
| `CostCalculator` | `src/components/CostCalculator.tsx` | MODIFIED — adds per-job Tax Rate input + Tax row + Total-with-Tax row; sweeps 3-6 numeric inputs to `compact`; removes 3 stale NewBadge sites |
| `SettingsModal` | `src/components/SettingsModal.tsx` | MODIFIED — adds Default Tax Rate field in "Costs & Rates" tab; migrates 3 descriptive `<p>` blocks to `<InfoTooltip>`; sweeps 3 numeric inputs to `compact` |
| `AssetLibrary` | `src/components/AssetLibrary.tsx` | MODIFIED — sweeps 7 numeric inputs to `compact`; migrates 1 descriptive placeholder ("For reusable items") to `<InfoTooltip>`; removes 2 stale NewBadge sites |
| `JobsManager` | `src/components/JobsManager.tsx` | MODIFIED — sweeps 3 numeric inputs to `compact` |
| `PrinterSettings` | `src/components/PrinterSettings.tsx` | MODIFIED — sweeps 6 numeric inputs to `compact`; migrates 3 descriptive `<p>` blocks to `<InfoTooltip>` |
| `UserProfileModal` | `src/components/UserProfileModal.tsx` | MODIFIED — removes 1 stale NewBadge site |
| `GcodeImport` | `src/components/GcodeImport.tsx` | MODIFIED (UI-10 only) — removes 2 stale NewBadge sites; **no numeric input sweep** (zero numeric inputs, verified) |
| `CsvImportModal` | `src/components/CsvImportModal.tsx` | UNCHANGED — zero numeric inputs, zero NewBadge sites; documented as no-op for sweep |
| `features.ts` | `src/features.ts` | MODIFIED — registry prunes 9 stale keys, adds 1 new key (`default-tax-rate`) |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none | not applicable (no shadcn in project) |
| Third-party | none | not applicable |

This phase composes only first-party primitives that have lived in the codebase since Phase 7 (Styling Primitives Pass, v1.1). No external block consumption. No npm install. No security gate required.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: all locked strings sourced from CONTEXT D-08/D-10/D-11/D-15; ZAR/unknown-region edge case explicitly handled; no NewBadge added to fields that don't qualify
- [ ] Dimension 2 Visuals: Tax row anatomy mirrors existing Cost Breakdown row pattern verbatim; no new primitives; CLAUDE.md NewBadge anti-pattern verified (absolute on h3, end-of-label inline on labels)
- [ ] Dimension 3 Color: zero new colors; staleness hint lives inside existing InfoTooltip (no yellow chip); Tax row neutral `text-slate-300`
- [ ] Dimension 4 Typography: 4 roles (label, body, section heading, card heading); 2 weights (400, 500/600); `font-mono` on numeric values; `.toFixed(1)` on percentage display
- [ ] Dimension 5 Spacing: Tailwind defaults only; `max-w-28` cap on compact inputs; no new tokens
- [ ] Dimension 6 Registry Safety: N/A (no shadcn, no third-party)

**Approval:** pending — awaiting `gsd-ui-checker` review.

---

## Notes for Planner

1. **Tab terminology**: docs say "Pricing tab" but code has "Costs & Rates". Slot Default Tax Rate into the existing `'costs'` tab. Do NOT create a new tab. (RESEARCH Discrepancy 1, line 872.)
2. **EU-average wording**: tooltip says "midpoint", not "mean". 21% is the median across 27 EU member states; the unweighted mean is 21.9%. (RESEARCH Discrepancy 2, line 880.)
3. **Default Tax Rate field is empty/unset, never `?? 0`**. The `onChange` writes `undefined` when the input clears. (RESEARCH Pitfall 3, line 372.)
4. **NewBadge for `default-tax-rate`**: register in `src/features.ts` with today's date as the release; emit absolute-positioned on the h3 (matching `SettingsModal.tsx:240`). Required by project memory rule on user-facing features.
5. **Per-job Tax Rate input**: lives in the Set Financial Targets block at `CostCalculator.tsx:1150`. Change `md:grid-cols-3` → `md:grid-cols-4`. Wide style with `pl-8` + `%` prefix overlay (matches Profit Margin). NOT compact.
6. **Cost Breakdown Tax row**: drop in after `:1313` (Cost Per Unit total), before `:1316` (Marketplace Fee Note). Wrap in `{tax.ratePercent > 0 && (...)}`. NO new colors. Use `text-slate-300` + `font-mono`.
7. **NewBadge import cleanup**: after removing the 11 JSX sites, `grep -n "import.*NewBadge"` each affected file. If a file no longer uses `<NewBadge>` anywhere, delete the import too. (RESEARCH Pitfall 6, line 390.) Specifically: GcodeImport.tsx, AssetLibrary.tsx, UserProfileModal.tsx will all have zero usages after the cleanup; CostCalculator.tsx retains the import for `model-url`.
8. **`features.ts` final state**: 4 entries — `settings-reorg`, `default-profit-margin`, `model-url`, `default-tax-rate`. All released within 14 days of today (2026-05-21).

*Generated by gsd-ui-researcher. Source-of-truth references: `13-CONTEXT.md` (decisions D-01..D-17), `13-RESEARCH.md` (UI Sweep Inventory line 410, NEW Badge Audit line 532), `src/components/CostCalculator.tsx`, `src/components/SettingsModal.tsx`, `src/components/ui/Input.tsx`, `src/components/ui/InfoTooltip.tsx`, `src/components/NewBadge.tsx`, `src/features.ts`.*
