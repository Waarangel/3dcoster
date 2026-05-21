# Phase 13: Tax Model + UI Sweep - Context

**Gathered:** 2026-05-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can set a default tax rate in Settings (Pricing tab), override it per job in the cost calculator, and see a "Tax (X%)" line appended to the cost breakdown after `sellingPrice` — backed by a static `src/data/taxRates.ts` lookup keyed by `userProfile.currency` (US defaults to 0% with a marketplace-facilitator note; EUR uses an EU-average rate). The phase also performs a one-pass UI sweep so every currency / percentage / numeric input across CostCalculator, AssetLibrary, JobsManager, PrinterSettings, and import modals (GcodeImport, CsvImportModal) uses the `compact` prop on `<Input>` (max-w-28) and the `<InfoTooltip>` pattern on the label (descriptive placeholders move into the tooltip; placeholders show example values only). Stale `<NewBadge>` JSX past `NEW_FEATURE_MAX_AGE_DAYS` (14 days) is removed and `src/features.ts` is pruned in the same pass (UI-10 folded into scope).

**In scope:** tax engine (`calculateTax`), tax fallback table, tax row UI in Settings + CostCalculator + cost breakdown, the 5-surface UI sweep, the `src/features.ts` audit, activating the `it.todo` at [src/utils/costCalc.test.ts:444](src/utils/costCalc.test.ts:444).

**Out of scope:** geo-based live tax APIs (TAX-F1 deferred), US per-state tax tables (TAX-F2 deferred), per-customer tax exemptions, currency conversion, anything in Phase 14+ (CUST, QUOTE, TAGS).

</domain>

<decisions>
## Implementation Decisions

### Tax Fallback Table (TAX-03)
- **D-01:** `src/data/taxRates.ts` ships with: each EU member state (27 entries, per-country VAT), UK, Australia, Canada, US. ~30 entries total. PRable to extend later — keep schema permissive so adding a row stays mechanical.
- **D-02:** Region key is `userProfile.currency`. Single-currency-per-country mappings are 1:1 (USD→US, GBP→UK, AUD→AU, CAD→CA). EUR is the multi-country exception — see D-05.
- **D-03:** Each row in `taxRates.ts` carries `rateAsOf: string` (ISO date). When the current date is more than **18 months** past `rateAsOf`, the UI surfaces a "rate may be stale — verify locally" hint near the tax row (planner picks exact placement — inline text or InfoTooltip extension).
- **D-04:** Default Tax Rate in Settings (Pricing tab) **starts empty / unset** on first view. The per-job tax UI falls through the chain: per-job override → Settings default → region table → "enter manually" for unknown region. The user is never silently defaulted to 0% (per TAX-03 success criterion).
- **D-05:** When `userProfile.currency === 'EUR'`, use a **21% EU-average** rate with a tooltip reading "EU average rate — verify for your country." This is a deliberate compromise: country-keyed lookup was rejected (we picked currency-keyed in D-02), and forcing every EUR user through "enter manually" would be punitive when 19/27 EU member states sit between 19–22%.

### Tax Row Display (TAX-04)
- **D-06:** Label is always literally **"Tax"** — not region-aware. `Tax (X%)` everywhere. Matches TAX-04 wording exactly; avoids a regional-string-map matrix.
- **D-07:** Percentage display uses **one decimal place** always: `Tax (20.0%)`, `Tax (8.5%)`, `Tax (27.0%)`. Matches the existing `step=0.1` on the Profit Margin input. Math uses the actual float; only display is rounded.
- **D-08:** Tax row label gets an InfoTooltip showing the **rate source**: "From Settings default — 20%" / "Per-job override" / "From your region (UK, rateAsOf 2024-04-01)". Helps users debug surprising numbers and reinforces the fallback chain.
- **D-09:** When a per-job override **equals** the Settings default value, no badge or marker is shown. Behaviorally identical to no override; surfacing "(overridden)" would be noise.

### US Marketplace-Facilitator UX (TAX-03)
- **D-10:** The marketplace-facilitator note lives in an **InfoTooltip next to the tax label** — same pattern as UI-09. Consistent with the rest of the form, no banners or inline help text.
- **D-11:** Wording (short, factual): _"Most US states require marketplaces (Etsy, eBay, Amazon) to collect sales tax for you. Override only if you sell direct or in a non-facilitator state."_ Planner may copy-edit lightly but the substance is locked.
- **D-12:** The note **persists** when a US user manually enters a non-zero rate. The marketplace-facilitator situation hasn't changed because the user typed a number; the tooltip still explains why the default was 0.
- **D-13:** The US note appears in **both** the Settings Pricing-tab Default Tax Rate field **and** the per-job tax row in CostCalculator. A user who skips Settings entirely still sees the note where they actually edit tax.

### UI Sweep (UI-08, UI-09, UI-10)
- **D-14:** `compact` (max-w-28) applies to **numeric inputs only** — currency ($), percentage (%), count (sold copies, copies remaining), time (g, h, min). Text inputs (Print Name, Model URL, filament selector free-text, etc.) stay full-width.
- **D-15:** Descriptive placeholders are migrated to `<InfoTooltip>` on the label. The placeholder becomes an **example value** (e.g. `0`, `0.00`, `e.g. 13`) or empty when no useful example exists. The placeholder no longer carries "what this field is for" — that's the tooltip's job.
- **D-16:** Non-compact (wide) text inputs **also** get the InfoTooltip-on-label treatment when they have a description today. Consistency across the form trumps surgical scope. The existing Model URL field in CostCalculator is the reference pattern.
- **D-17:** UI-10 is **folded into Phase 13 scope** (originally listed but unmapped). Same files get touched, same review window. Action: audit `src/features.ts`; remove `<NewBadge>` JSX where the feature's release date is past `NEW_FEATURE_MAX_AGE_DAYS` (14 days from today); prune registry entries that have zero remaining JSX consumers.

### Claude's Discretion
- Exact placement of Default Tax Rate field within the Pricing tab vertical order (above or below Default Profit Margin — both are reasonable).
- Exact placement of the per-job tax row within CostCalculator's pricing block (TAX-04 says "after `sellingPrice`" — multiple acceptable concrete positions).
- Whether `taxRates.ts` exports a `Map`, a record, or a typed array of `{currency, region, label, rate, rateAsOf, note?}` objects — planner picks based on lookup ergonomics.
- Test grouping inside `costCalc.test.ts` (`describe('calculateTax', ...)` block or inline alongside `calculateCost` tests).
- Exact JSX/Tailwind classes for the tax row visual (planner follows existing breakdown-row patterns).
- Whether `compact` swap and `<InfoTooltip>` swap land in one PR or split per file — planner picks based on diff size; both are acceptable.
- Whether the staleness hint for D-03 reuses InfoTooltip or adds a small inline `<span className="text-yellow-400 text-xs">` indicator.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 13 source-of-truth
- `.planning/REQUIREMENTS.md` § TAX-01..05, UI-08, UI-09, UI-10 — requirement contracts.
- `.planning/ROADMAP.md` § Phase 13 — success criteria, especially the no-silent-0% / unknown-region requirement and `it.todo` activation.

### Phase 12 carry-forward (schema already shipped)
- `.planning/phases/12-schema-foundation/12-CONTEXT.md` — D-02 (only `tags = []` backfilled; other new fields stay undefined on existing records) and D-09 (optional fields, no runtime validation in the type system).
- `.planning/phases/12-schema-foundation/12-VERIFICATION.md` — confirms `taxRate?: number`, `taxAmount?: number` on `PrintJob` and `defaultTaxRate?: number` on `UserProfile` are landed.

### Existing code touchpoints
- `src/utils/costCalc.test.ts:444` — the `it.todo` to activate (`'tax/VAT applies after subtotal — activates in v1.2'`).
- `src/utils/costCalc.ts` — host for `calculateTax(sellingPrice, ratePercent)` per TAX-05.
- `src/components/SettingsModal.tsx` — `activeTab === 'pricing'` block (currently houses Default Profit Margin) is the home for Default Tax Rate.
- `src/components/CostCalculator.tsx` — Set Financial Targets block; tax row attaches after `sellingPrice`.
- `src/components/ui/Input.tsx` — already supports `compact` (max-w-28); no primitive changes needed.
- `src/components/ui/InfoTooltip.tsx` — already exists; the sweep just adopts it more broadly.
- `src/components/NewBadge.tsx` and `src/features.ts` — for UI-10 audit.

### Codebase maps (background)
- `.planning/codebase/STRUCTURE.md`, `.planning/codebase/CONVENTIONS.md` — pattern references.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `<Input compact />` — already exists, max-w-28 cap; no primitive change needed for UI-08.
- `<InfoTooltip text="..." />` — already exists; the sweep extends its usage to ~all forms.
- `<NewBadge feature="..." />` — already exists with two-gate logic (release age + per-user seen); UI-10 audits the registry but doesn't change the component.
- `getSetting<T>(key, defaultValue) / setSetting<T>(key, value)` in `src/db/database.ts` — already drives `userProfile` storage; `defaultTaxRate` reads via existing pattern.
- The Pricing-tab structure in SettingsModal already groups financial settings; Default Tax Rate slots in next to Default Profit Margin.

### Established Patterns
- All form fields use a `<label className="block text-xs text-slate-400 mb-1">…</label>` header followed by an Input. The phase 12 follow-up redesign (CostCalculator's "Model URL + Model Cost + Author Min Price" row, `54b206e..ccbde28`) sets the flex-wrap precedent for compact-numeric rows.
- Cost breakdown rows are flex-row label/value pairs; the Tax row drops into that block after `sellingPrice` per TAX-04.
- Test pattern: `describe('calculateCost', ...)` in `costCalc.test.ts` with one `it.todo` reserved for tax — activation goes there.

### Integration Points
- `calculateTax` returns `{taxAmount, ratePercent}` (or similar) consumed by both the cost breakdown row and the saved-job persistence (`taxAmount` field on `PrintJob`).
- `userProfile.defaultTaxRate` reads/writes through `getUserProfile` / `setUserProfile`.
- The fallback chain (override → Settings → region table → manual) is centralized in a single helper so UI consumers don't re-implement it.

</code_context>

<specifics>
## Specific Ideas

- D-05 EU-average value of **21%** is a starter — close to the unweighted mean of 27 member states' standard VAT (median is 21%, range 17% in Luxembourg → 27% in Hungary). The tooltip explicitly tells the user to verify for their country.
- D-11 marketplace-facilitator note quotes Etsy, eBay, Amazon by name as the major marketplaces 3DCoster users sell on. If a planner wants to drop platform names to avoid implying endorsement, the substance ("most US states require marketplaces to collect for you") still holds.
- D-08 tooltip surfaces `rateAsOf` from the region table when the source is region fallback. This is the natural place to expose the staleness hint from D-03 — they're the same tooltip.
- Phase 12's UI redesign (`54b206e`, `b7d5408`, `ccbde28`) updated Print Job Details to the flex-wrap pattern. Phase 13's sweep follows the same precedent across other surfaces.

</specifics>

<deferred>
## Deferred Ideas

- **Region-aware tax labels (VAT / GST / Sales Tax)** — explicitly rejected in D-06. If a future phase wants to localize, the label map lives next to the region table.
- **`userProfile.country` field for precise EU country mapping** — explicitly rejected in D-02 / D-05. If reopened, would replace the EU-average compromise with country-keyed lookup.
- **Geo-based live tax API** — TAX-F1 in REQUIREMENTS.md, deferred indefinitely (breaks offline-first).
- **US per-state sales tax tables** — TAX-F2 in REQUIREMENTS.md, deferred unless seller-collected jurisdictions become common.
- **Tax-inclusive vs tax-exclusive pricing toggle** — every decision here assumes tax-exclusive (sellingPrice + taxAmount = total). Reopens if user demand surfaces.
- **Per-customer tax exemptions** — Phase 14+ (customer model) territory.
- **Per-job override badge when override differs from default** — explicitly rejected in D-09. If user feedback shows confusion, revisit.

</deferred>

---

*Phase: 13-tax-model-ui-sweep*
*Context gathered: 2026-05-21*
