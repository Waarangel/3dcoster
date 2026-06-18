# Calculator App Audit — Work Backlog

> **Source:** Read-only multi-dimension audit of the `/app` calculator UI (`App.tsx` +
> component tree), run 2026-06-18 across five lenses — design/brand consistency, UX/workflows,
> code quality/architecture, accessibility, performance.
> **Status:** Queued as the next set of work (after the staged web deploy / redesign branch lands).
> No code changes have been made; everything below is a recommendation with severity + effort.

## Headline

The app is **mature and well-engineered** — no critical bugs, no security issues, no data-loss
risk. Strong foundations: correct Dexie transactions on every multi-table write, validators at
every storage boundary, react-window virtualization, lazy-loaded PDF, excellent bundle chunking,
near-zero `any`/`console.log`, production-quality dialog a11y primitives (`dialogA11y.ts`).

The work is **(1) brand cohesion** (the calculator never got the redesign, so it reads as a
different app from the new marketing site), plus a **cluster of small, fixable
correctness / UX / a11y issues**. Nothing here is a rewrite.

## Branch note

- **Tier 2 (brand cohesion)** logically belongs **on the redesign branch
  `test/design-skills-experiment`** — it completes the Cost-Truth migration into `/app`. The
  shared `ui/` kit is already tokenized; this is the markup *around* those primitives.
- **Tiers 1, 3, 4, 5, 6** are independent of the redesign and can land on `main` (or wherever the
  next build is cut from).

---

## Tier 1 — Real correctness bugs (small fixes, do first)

| # | Finding | File | Sev | Effort |
|---|---------|------|-----|--------|
| 1.1 | **`key={index}` on mutable lists** (filament / post-processing / packaging rows). Deleting a middle row rebinds controlled-input state to the wrong row → stale-input bug. Derive a stable key (filamentId / an added `id`). | `CostCalculator.tsx:923,1062,1201` | High | S |
| 1.2 | **Calculator ignores the live marketplace-fee Settings.** Etsy/FB fees are hardcoded inline *and* duplicated in `defaultMarketplaceFees`; the user's customized fees in Settings never reach the calc. Wire the memo to the live `marketplaceFees` config. | `CostCalculator.tsx:410-428` | High | M |
| 1.3 | **Missing error handling** on `confirmDeleteJob` / `handleConfirmDecline` — a failed Dexie write closes the modal but leaves the data, silently desyncing the UI. Wrap in try/catch + toast. | `JobsManager.tsx:1242-1249,1147-1155` | High | S |
| 1.4 | **`setTimeout` without cleanup** in `handleSaveJob` (fires on unmounted component / stacks on rapid saves). Store id in a ref, clear on unmount/clearForm. | `CostCalculator.tsx:677,722` | High | S |

---

## Tier 2 — Brand cohesion (the design headline; kill the `/app` seam)

The calculator markup is still **raw `slate-*`/`blue-*`** — **429 slate + 52 blue literals, 0 token
references** across the audited files. Brand-blue ui-kit buttons sit on cooler `slate-800` panels
(`#1e293b` vs `--surface #121829`) with Tailwind `blue-500/400` accents (`#3b82f6/#60a5fa` vs
`--brand #1796ff`) — a perceptible "generic dark SaaS" mismatch crossing from `/` into `/app`.

| # | Finding | File | Sev | Effort |
|---|---------|------|-----|--------|
| 2.1 | **Two DESIGN.md violations on the hero cost-summary** — a **banned gradient** (`from-blue-600/20 to-purple-600/20`) and a **purple/orange/green rainbow stat row** (True Cost / Sell / Fee / Profit / Margin). This is the exact surface the marketing `CostReveal` animation promises. Collapse to `--ink` figures, `--brand-soft` for the one focal number, `--amber`/red only for real warnings. | `CostCalculator.tsx:~1399-1422,1580` | Critical (design) | M |
| 2.2 | **Shell sweep** — `App.tsx` `bg-slate-900→--bg`, header `slate-800→--surface`, active tab `text-blue-400`/underline `bg-blue-500→--brand`, borders→`--hairline`. Highest visibility-per-line; first thing a user sees. | `App.tsx:180,188,272,286,292` | High | S |
| 2.3 | **CostCalculator panels** — retokenize the five `bg-slate-800 … border-slate-700` panels to `--surface`/`--hairline`. | `CostCalculator.tsx:794,1043,1102,1308,1442` | High | M |
| 2.4 | **No display font in the app** — `font-display` (Bricolage) appears 0× in the calculator. Adopt on the total + section headings. Small change, large perceptual payoff. | calculator components | High | S |
| 2.5 | **Tokenize modal shells + combobox popovers** to `--surface`/`--surface-2`/`--brand` selection states. | `RecordSaleModal.tsx`, `PrintQuoteModal.tsx`, `SettingsModal.tsx` | Medium | M |
| 2.6 | **Define tokenized semantic colors** (success/warn/danger CSS vars) and route JobsManager break-even/status pills + AssetLibrary category colors through them. Keep AssetLibrary's category-color *idea* (it's the strongest hierarchy device) — just anchor it to tokens. | `JobsManager.tsx`, `AssetLibrary.tsx`, `index.css` | Medium | M |
| 2.7 | Brand-blue active state on AssetLibrary filter tabs; remove `text-blue-400` overrides on ui-kit Buttons; tokenize skeleton wrappers; replace ASCII sort arrows / hand SVG chevrons with the icon set. | `AssetLibrary.tsx`, `JobsManager.tsx` | Low | S |

---

## Tier 3 — UX / onboarding (highest UX leverage)

| # | Finding | File | Sev | Effort |
|---|---------|------|-----|--------|
| 3.1 | **★ Guided first-run setup.** Cold start is a dead end: a new user has no printers/filaments → scattered warnings + an empty FilamentSelector that *looks broken*. Build a 2-step "add a printer → add a filament → price" funnel (or seed sensible starter data + a dismissible note). The single biggest UX win. | `CostCalculator.tsx:835`, `FilamentSelector.tsx`, `PrinterSettings.tsx:372` | High | M |
| 3.2 | **`window.confirm()` for the destructive Asset "Reset all".** The app's most dangerous action has the *least* protection. Use the styled modal pattern (with counts) Jobs already uses. *(Also an a11y win — see 4.x.)* | `AssetLibrary.tsx:807-812` | High | S |
| 3.3 | Empty FilamentSelector → real empty state; Printers empty state → explain the calculator dependency. | `FilamentSelector.tsx`, `PrinterSettings.tsx` | Medium | S |
| 3.4 | Per-asset **source currency** missing from asset forms (multi-currency makers lose native purchase price); inline filament **price override** missing from the calc path; CSV import gives no post-import summary; customer picker labeling ambiguous + silent duplicate creation in RecordSale. | `AssetLibrary.tsx`, `FilamentSelector.tsx`, `RecordSaleModal.tsx:280-301,445-455` | Medium | M |
| 3.5 | Calculator is a long single-column scroll; the payoff (True Cost / Profit / Break-even) is near the bottom. Collapse optional sections (shipping/packaging/marketplace/post-processing) by default or mark the minimum path. | `CostCalculator.tsx` | Medium | M |
| 3.6 | Confirm edit-job jump scrolls to the "Editing…" banner (long form, banner at top). | `App.tsx:155-158`, `CostCalculator.tsx:772` | Low | S |

---

## Tier 4 — Accessibility (real gaps; fundamentals otherwise good)

| # | Finding | File | WCAG | Sev | Effort |
|---|---------|------|------|-----|--------|
| 4.1 | **Settings inner tabs**: no Left/Right arrow-key nav + focus never moves to the panel on switch. | `SettingsModal.tsx:175-198` | 2.4.3 | Critical | M |
| 4.2 | **Form errors not programmatically associated** — `formError` has no `role="alert"`; failing inputs lack `aria-invalid` / `aria-describedby`. | `AssetLibrary.tsx:1027-1031`, `CostCalculator.tsx` | 3.3.1, 1.3.1 | Critical | S |
| 4.3 | **Unlabelled icon-only edit/delete buttons** across Settings carriers/marketplaces + Asset rows. Add `aria-label`. | `SettingsModal.tsx:488-521`, `AssetLibrary.tsx:310-396` | 4.1.2 | High | S |
| 4.4 | **FilamentSelector menu has no accessible name**; submenu announces poorly (no `aria-activedescendant`/live region). | `FilamentSelector.tsx:301,299-379` | 4.1.2 | High | S |
| 4.5 | **Tag-remove chip buttons** are 14px, opacity-0 at rest — below target-size minimum, hard to discover on touch. | `JobsManager.tsx:539-547` | 2.5.5/2.5.8 | High | M |
| 4.6 | Main `<main role="tabpanel">` needs `tabIndex={-1}` for post-switch focus. Break-even bar needs `role="progressbar"` + values. SortIndicator `▲/▼` and per-unit `invisible`+`aria-hidden` label patterns need cleanup. `InfoTooltip` aria-label is the full sentence (verbose) + no Escape dismiss. "Back to site" icon-only link on mobile needs a label. Category filter group needs `role="group"` label. | `App.tsx:282,199-208`, `JobsManager.tsx:707-714`, `AssetLibrary.tsx:483-485,972-997`, `CostCalculator.tsx:885-898`, `InfoTooltip.tsx` | various AA | Medium | S each |

**Already good (keep):** `dialogA11y.ts` (focus trap/restore/scroll-lock, StrictMode-safe), Modal/SidePanel
`role="dialog"`+`aria-modal`+labelled, main tablist roles, CollapsibleSection ARIA, FilamentSelector
keyboard nav, global `prefers-reduced-motion`, `useId` label association, virtualized grid ARIA.

---

## Tier 5 — Performance (only bites at scale; typical data is fine)

| # | Finding | File | Sev | Effort |
|---|---------|------|-----|--------|
| 5.1 | **`useQuotes()` called once per visible job row** (in `OrdersSection` *and* `OrdersQuoteRows`) → 80+ jobs = 160+ live Dexie subscriptions, all re-evaluating on every quote write. Lift to the `JobsManager` parent, pass `quotesForJob` prop. | `JobsManager.tsx:329-414` | High (at scale) | M |
| 5.2 | **`getFilamentName` does O(N×M) `Array.find` per render** (per filament per job). Build a `materialsById` Map once. | `JobsManager.tsx:1251-1254` | Medium | S |
| 5.3 | **Pricing `useEffect` double-renders per keystroke** — its dep array includes the three values it sets (`profitMarginPercent`/`targetProfit`/`sellingPrice`). Move to event-handler pattern or trim deps to `[trueCost, lastEdited]`. | `CostCalculator.tsx:730-751` | Medium | S |
| 5.4 | (Low) `sessionStorage.setItem` fires on every form change; AssetLibrary virtualization guard keys off page-size setting, not item count. Both fine at current scale — note only. | — | Low | S |

**Already good (keep):** `manualChunks` (pdf + motion-vendor isolation, CI gates), gcode header-only
slicing, 24h FX cache, react-window with memoized `rowProps` + `React.memo(JobCard)`,
pre-computed `breakEvenMap` / `salesByJob` maps, scoped `useSales(jobId)`, lazy PDF + `modulePreload: false`.

---

## Tier 6 — Code health / maintainability (not urgent)

Four God-components past the 800-line rule: `CostCalculator.tsx` (1690), `JobsManager.tsx` (1630),
`AssetLibrary.tsx` (1516), `useDatabase.ts` (1236). `SettingsModal.tsx` (836) borderline.

| # | Action | File | Effort |
|---|--------|------|--------|
| 6.1 | Extract `useCalculatorForm` hook (all state + sessionStorage + editingJob repopulation + clearForm); split `<ShippingSection>` / `<PricingSection>` / `<CostBreakdownSection>`. | `CostCalculator.tsx` | L |
| 6.2 | Split `useDatabase.ts` by entity (`useAssets`/`useJobs`/`useSales`/`useCustomers`/`useQuotes`/`useSettings`); move the 7 module-scope reconcile flags into their owning hooks. Do gradually with re-exports (BackupRestore tests import it). | `useDatabase.ts` | L |
| 6.3 | Move direct `db.jobs.put` calls out of `JobsManager` title/tag handlers and `RecordSaleModal`'s convert-to-sale transaction into the hook layer (`renameJob`/`patchJobTags`/`convertQuoteToSale`). | `JobsManager.tsx:1192-1239`, `RecordSaleModal.tsx:369-374` | M |
| 6.4 | Extract each `SettingsModal` tab into its own component; extract `useJobsManagerHandlers`. | `SettingsModal.tsx`, `JobsManager.tsx` | M |
| 6.5 | Minor: `updatePackagingMaterial` helper via `map` (consistency); batch `useAssets` init reads with `Promise.all`; tighten `as UserProfile`/`as Currency` casts to validated narrowing (match v9 migration pattern). | various | S |

**Already solid (keep):** transaction safety, structural validators at every settings boundary,
`src/utils/` pure-module extraction (cost math, currency, CSV, backup, gcode), immutability
(3 index-mutation lines are the only violations), zero debug `console.log`, near-zero `any`,
`isSafeHttpUrl` XSS guard, memo discipline in JobsManager.

---

## Suggested first pass

**Tier 1 + Tier 2 together** — the correctness bugs are tiny, and the brand sweep is the most
visible win (and completes the redesign into `/app`). That's roughly one focused session.
Then Tier 3.1 (guided first-run) as the headline UX follow-up.
