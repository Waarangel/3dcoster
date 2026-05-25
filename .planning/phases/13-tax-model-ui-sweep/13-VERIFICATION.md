---
phase: 13-tax-model-ui-sweep
verified: 2026-05-21T13:35:00Z
status: passed
score: 6/6 must-haves verified
overrides_applied: 0
uat_closed: 2026-05-25
uat_closure_phase: 24-nyquist-contracts-phase-13-visual-uat-phase-18-review-carryover
uat_closure_req: NYQ-05
---

# Phase 13: Tax Model + UI Sweep Verification Report

**Phase Goal:** Users can set, override, and see a tax rate on every job with correct rounding and order-of-operations, backed by a region default — and all currency/numeric inputs across touched forms use the compact/InfoTooltip pattern in one pass

**Verified:** 2026-05-21T13:35:00Z
**Status:** passed (UAT closed 2026-05-25 per Phase 24 NYQ-05)
**Re-verification:** No — initial verification + UAT closure 2026-05-25

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can set a default tax rate in Settings (Pricing/Costs & Rates tab); new jobs seed the tax row from this rate; the rate persists across sessions | VERIFIED | `src/components/SettingsModal.tsx:264-301` renders a "Default Tax Rate" h3 with `Input value={userProfile.defaultTaxRate ?? ''}` and writes through `onUserProfileChange`. The Default Tax Rate sits inside `activeTab === 'costs'` (line 264) after Default Profit Margin. `userProfile` persists via existing IndexedDB-backed Dexie store — same shape as `defaultProfitMargin`. App.tsx passes `userProfile` to CostCalculator (line 274). `resolveTaxRate` reads `settingsDefault: userProfile.defaultTaxRate` (CostCalculator.tsx:460). |
| 2 | User can override the tax rate per job in the cost calculator; the per-job override is saved with the job and displayed when the job is reopened | VERIFIED | `src/components/CostCalculator.tsx:129` declares `taxRateOverride` state seeded from `editingJob?.taxRate`. The 4th column of the Set Financial Targets grid (line 1232-1256) renders the per-job Tax Rate Input with `value={taxRateOverride ?? ''}` and Math.min/Math.max clamping. `handleSaveJob` persists `taxRate: taxRateOverride` and `taxAmount: tax.taxAmount` in BOTH update branch (lines 549-550) and create branch (lines 578-579). `useState(() => editingJob?.taxRate)` ensures round-trip. |
| 3 | Region default lookup works: US shows 0% with marketplace-facilitator note; EU shows midpoint via eu-average branch; unknown region shows manual sentinel; `rateAsOf` date is surfaced | VERIFIED | `src/data/taxRates.ts` ships 31 rows (5 currency-keyed + 26 EU reference; Sweden serves dual duty); US row carries the locked D-11 marketplace-facilitator note. `src/utils/taxResolution.ts:41-66` implements the 5-step fallback chain with EUR branch BEFORE the .find() (Pitfall 4 prevention). `region` source carries `rateAsOf` (line 61) and the note is surfaced through `tooltipForSource`. The `manual` sentinel (line 65) returns `{ kind: 'manual', rate: 0 }` for unknown currencies — never silently 0% via fallthrough. Tests in `taxResolution.test.ts` verify US/EU/GBP/ZAR branches. |
| 4 | "Tax (X%)" line appears in cost breakdown after `sellingPrice`; total = `sellingPrice + taxAmount`; tax row hides when rate is 0% | VERIFIED | `src/components/CostCalculator.tsx:1373-1387` wraps the Tax row in `{tax.ratePercent > 0 && (...)}` and renders both `Tax (X.X%)` (line 1377, `.toFixed(1)`) and `Total (with Tax)` (line 1383) using `sellingPrice + tax.taxAmount` (line 1384). The block sits AFTER the Cost Per Unit display (line 1361) and BEFORE the Marketplace Fee Note (line 1390). Tooltip integration uses `tooltipForSource(taxSource, userCurrency)` (line 1378) for D-08/D-11/D-13. |
| 5 | calculateTax unit tests pass: rate=0, EU/UK/AU rates, centime rounding (23%/12.50→2.88), and order-of-operations guard; existing `it.todo` activated | VERIFIED | `src/utils/costCalc.ts:124-136` implements `calculateTax` with `Math.round(sellingPrice * ratePercent) / 100` rounding strategy. `src/utils/costCalc.test.ts:447-488` ships 7 tests in a new top-level `describe('calculateTax', ...)` block. All 6 VALIDATION-locked substrings are present: "rate is 0", "UK 20%", "AU 10%", "EU-average", "centime rounding", "order-of-operations". The order-of-operations guard at line 475-487 uses synthetic case (subtotal=10, sellingPrice=25, rate=20) asserting both branches individually AND inequality. `grep -n "it.todo" src/utils/costCalc.test.ts` returns 0 matches — the it.todo at the previous line 444 has been replaced. Full vitest run: 92/92 passing. (Note: the roadmap criterion mentions "when depreciation > 0", but the synthetic case captures the same math fact — see Notes below.) |
| 6 | All currency, percentage, and numeric inputs in CostCalculator, AssetLibrary, JobsManager, PrinterSettings, and import modals use the `compact` prop on `<Input>`; descriptive placeholder text is replaced with `<InfoTooltip>` next to the label, with placeholders showing example values only | VERIFIED | `compact` prop count by file: CostCalculator=11, AssetLibrary=8, JobsManager=3, PrinterSettings=6, SettingsModal=32. Total 60 compact inputs. InfoTooltip imported in CostCalculator (line ?), AssetLibrary (line 6), PrinterSettings, and SettingsModal (line 6). Locked tooltip strings verified: "For items that get reused (e.g., a brush)" (AssetLibrary:1042), "What you paid (may differ from MSRP)" (PrinterSettings:153), "Target months to recover your investment via printed-job sales" (PrinterSettings:166), "Expected hours/month — used to estimate cost recovery" (PrinterSettings:183), "Round-trip distance" (CostCalculator:999). Remaining `<p className="text-xs text-slate-500">` blocks (2 in PrinterSettings, 3 in CostCalculator, 4 in SettingsModal) are section-level descriptions under h3 headings or dynamic-content rendering — these are NOT field-level placeholders and were explicitly out of scope per the plan's RESEARCH UI Sweep Inventory. |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/data/taxRates.ts` | Static TAX_RATES table + EU_AVERAGE_RATE | VERIFIED | 70 lines, 31 rows total. `EU_AVERAGE_RATE = 21` (line 22). US note matches D-11 verbatim. CA note matches federal-GST string. |
| `src/utils/taxResolution.ts` | resolveTaxRate + isRateStale + tooltipForSource + TaxRateSource union | VERIFIED | 116 lines, 5-step fallback chain (lines 41-66) with EUR branch before .find() (line 48). USD-append + de-dup guard at lines 112-114. |
| `src/utils/taxResolution.test.ts` | Vitest suite covering chain + staleness + tooltip | VERIFIED | 158 lines, 18 tests across 3 describe blocks. All 5 VALIDATION-locked substrings present. |
| `src/utils/costCalc.ts` | calculateTax pure function | VERIFIED | calculateTax at lines 124-136 with locked rounding `Math.round(sellingPrice * ratePercent) / 100`. Defensive guards for non-finite rate and zero/negative sellingPrice. No throws. |
| `src/utils/costCalc.test.ts` | calculateTax describe block + it.todo removed | VERIFIED | New describe block at line 447-488 with 7 tests. `grep "it.todo"` returns 0 matches. All 6 VALIDATION substrings present. |
| `src/components/SettingsModal.tsx` | Default Tax Rate field + 3 InfoTooltip migrations + 3 compact additions | VERIFIED | Default Tax Rate at lines 264-301. InfoTooltip used 5x in JSX + 1 import = present at lines 208/225/246/272 (existing 3 migrations + new tax-rate tooltip). 32 `compact` props total. NewBadge for `default-tax-rate` at line 267 with anti-pattern-safe absolute positioning. |
| `src/components/CostCalculator.tsx` | Per-job Tax Rate Input + Tax row + persistence + sweep + NewBadge cleanup | VERIFIED | `userProfile: UserProfile` prop (line 23). Tax-rate state (line 129). taxSource + tax useMemos (lines 457-469). Per-job Tax Rate Input in 4th grid column (lines 1232-1256, `md:grid-cols-4` at line 1181). Tax row + Total (with Tax) at lines 1373-1387, hidden at 0%. Persistence in both handleSaveJob branches (lines 549-550, 578-579). 3 stale NewBadge sites removed (only `model-url` remains at line 741). 11 compact inputs. |
| `src/components/AssetLibrary.tsx` | 8 compact inputs + Lifespan Units InfoTooltip + zero NewBadge | VERIFIED | 8 `compact` props. InfoTooltip at line 1042 with locked text. `grep "NewBadge"` returns 0 matches in file (JSX + import both removed). |
| `src/components/JobsManager.tsx` | 3 compact inputs in Record Sale form | VERIFIED | 3 `compact` props at lines 544, 554, 594 (Sale Quantity, Price per Unit, Shipping Cost). |
| `src/components/PrinterSettings.tsx` | 6 compact inputs + 3 InfoTooltip migrations | VERIFIED | 6 `compact` props. 3 InfoTooltips at lines 153, 166, 183 with locked strings. |
| `src/components/UserProfileModal.tsx` | Zero NewBadge references | VERIFIED | `grep "NewBadge"` returns 0 matches in file. |
| `src/components/GcodeImport.tsx` | Zero NewBadge references | VERIFIED | `grep "NewBadge"` returns 0 matches in file. |
| `src/features.ts` | 4-entry registry: settings-reorg, default-profit-margin, model-url, default-tax-rate | VERIFIED | Filtered count of `new Date(` lines = 4. All 9 stale entries (per-unit-licensing, author-min-price, configurable-marketplace-fees, custom-carriers, multi-currency, packaging-materials, csv-import, gcode-import, 3mf-import) absent. `'default-tax-rate': new Date('2026-05-21')` present at line 9. |
| `src/App.tsx` | userProfile passed to CostCalculator | VERIFIED | Line 274: `userProfile={userProfile}` on `<CostCalculator />`. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| CostCalculator.tsx | taxResolution.ts | `import { resolveTaxRate, tooltipForSource }` | WIRED | Line 9: `import { resolveTaxRate, tooltipForSource } from '../utils/taxResolution';` — both used at lines 458, 1378. |
| CostCalculator.tsx | costCalc.ts (calculateTax) | `import { calculateTax }` | WIRED | Line 8: `import { calculateCost, calculateTax } from '../utils/costCalc';` — used at line 467. |
| taxResolution.ts | taxRates.ts | `import { TAX_RATES, EU_AVERAGE_RATE }` | WIRED | Line 6: `import { TAX_RATES, EU_AVERAGE_RATE } from '../data/taxRates';` — both used (line 51 EU_AVERAGE_RATE, line 55 TAX_RATES.find). |
| taxResolution.ts | types.ts (Currency) | `import type { Currency }` | WIRED | Line 5: `import type { Currency } from '../types';` — used in `ResolveTaxRateInput` (line 29) and `tooltipForSource` second arg (line 85). |
| SettingsModal Default Tax Rate Input | userProfile.defaultTaxRate | `onUserProfileChange` callback | WIRED | Line 295: `onUserProfileChange({ ...userProfile, defaultTaxRate: Math.min(Math.max(parsed, 0), 99.9) })` — Math.min/Math.max clamping. Empty string writes `defaultTaxRate: undefined` (line 291). |
| CostCalculator handleSaveJob | PrintJob.taxRate, PrintJob.taxAmount | object spread | WIRED | Lines 549-550 (update branch): `taxRate: taxRateOverride, taxAmount: tax.taxAmount`. Lines 578-579 (create branch): same. |
| CostCalculator taxSource useMemo | resolveTaxRate | call with full input shape | WIRED | Lines 457-464: `resolveTaxRate({ jobOverride: taxRateOverride, settingsDefault: userProfile.defaultTaxRate, currency: userCurrency })` with correct dependency array. |
| CostCalculator Tax row InfoTooltip | tooltipForSource(source, userCurrency) | JSX consumption | WIRED | Line 1378: `<InfoTooltip text={tooltipForSource(taxSource, userCurrency)} />` — userCurrency second arg for D-12/D-13 USD-append. |
| App.tsx CostCalculator | userProfile prop | JSX prop pass-through | WIRED | Line 274: `userProfile={userProfile}` passed alongside the other props. |
| SettingsModal NewBadge `default-tax-rate` | src/features.ts registry | feature key lookup | WIRED | Line 267 emits `<NewBadge feature="default-tax-rate" />`; src/features.ts line 9 registers `'default-tax-rate': new Date('2026-05-21')`. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| SettingsModal Default Tax Rate Input | `userProfile.defaultTaxRate` | userProfile from useUserProfile hook → Dexie store | Yes — persists across reloads | FLOWING |
| CostCalculator Per-Job Tax Rate Input | `taxRateOverride` | useState(() => editingJob?.taxRate), seeded from editingJob via useEffect | Yes — round-trips via handleSaveJob | FLOWING |
| CostCalculator Tax row label | `tax.ratePercent`, `tax.taxAmount` | useMemo of calculateTax(sellingPrice, taxSource.rate) | Yes — driven by live sellingPrice + resolved rate | FLOWING |
| CostCalculator Tax row tooltip | `tooltipForSource(taxSource, userCurrency)` | taxSource from resolveTaxRate (driven by override → settings → eu-average → region → manual chain) | Yes — provenance-aware tooltip with USD-append branch | FLOWING |
| Persisted PrintJob | `taxRate`, `taxAmount` | handleSaveJob spread in both create + update branches | Yes — written to IndexedDB | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All tests pass | `npm test` | 6 files, 92 tests passed | PASS |
| TypeScript build green | `npm run build` | exit 0, dist/ produced, main chunk 47.2 KB gzipped | PASS |
| Order-of-operations test green | `npx vitest run src/utils/costCalc.test.ts -t "order-of-operations"` | 1 passed, 45 skipped | PASS |
| Cross-repo stale NewBadge audit | `grep -rE 'NewBadge feature="(per-unit-licensing\|...)"' src/` | 0 matches | PASS |
| Stale keys absent from registry | `grep -v '^\s*//' src/features.ts \| grep -cE "new Date\("` | exactly 4 | PASS |
| `it.todo` removed | `grep -n "it.todo" src/utils/costCalc.test.ts` | 0 matches | PASS |
| calculateTax centime rounding | (covered by vitest "centime rounding" test) | calculateTax(12.5, 23).taxAmount === 2.88 | PASS |
| resolveTaxRate USD region returns marketplace note | (covered by vitest "US region default" test) | result.note contains "marketplaces" | PASS |
| EU branch precedes .find() (Pitfall 4) | code review of taxResolution.ts:48-55 | EUR branch at line 48 BEFORE TAX_RATES.find() at line 55 | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| TAX-01 | 13-03 | Default tax rate in Settings | SATISFIED | SettingsModal.tsx:264-301 — Default Tax Rate field with `?? ''` empty-when-unset semantics, undefined-on-empty onChange, US/non-USD InfoTooltip ternary, NewBadge with absolute positioning |
| TAX-02 | 13-05 | Per-job override + persistence | SATISFIED | CostCalculator.tsx:129 taxRateOverride state, lines 1232-1256 per-job Input, lines 549-550 + 578-579 handleSaveJob persistence in both branches |
| TAX-03 | 13-01 | Region default lookup with fallback chain | SATISFIED | taxResolution.ts:41-66 implements 5-step chain (override → settings → eu-average → region → manual); taxRates.ts has 31 rows with US/CA notes and rateAsOf dates |
| TAX-04 | 13-05 | Tax line in cost breakdown + total = sellingPrice + taxAmount + hide-at-0% | SATISFIED | CostCalculator.tsx:1373-1387 — `{tax.ratePercent > 0 && (...)}` gate, `Tax (X.X%)` label with `.toFixed(1)`, `Total (with Tax)` row using `sellingPrice + tax.taxAmount` |
| TAX-05 | 13-02 | calculateTax unit-tested + it.todo activated | SATISFIED | costCalc.ts:124-136 calculateTax with locked rounding; costCalc.test.ts:447-488 7-test describe block; `grep "it.todo"` returns 0; order-of-operations test passes |
| UI-08 | 13-03 / 13-04 / 13-05 | compact prop on numeric inputs across forms | SATISFIED | 60 compact inputs total across SettingsModal (32), CostCalculator (11), AssetLibrary (8), PrinterSettings (6), JobsManager (3) |
| UI-09 | 13-03 / 13-04 / 13-05 | Descriptive placeholders → InfoTooltip on label | SATISFIED | 4 InfoTooltip migrations: AssetLibrary Lifespan Units (line 1042), PrinterSettings Purchase Price (153) + Recovery Period (166) + Monthly Print Hours (183); plus SettingsModal's 3 from Plan 03 (electricity/hourly rate/profit margin) + new Default Tax Rate tooltip; plus CostCalculator Round-trip distance (line 999). Remaining `<p>` blocks are section-level or dynamic content, explicitly out of UI-09 scope per RESEARCH inventory |
| UI-10 | 13-04 / 13-05 / 13-06 | NewBadge audit — stale JSX removed + registry pruned | SATISFIED | 11 stale NewBadge JSX sites removed (2 AssetLibrary, 3 CostCalculator, 1 UserProfileModal, 2 GcodeImport, plus 3 already-orphaned registry entries pruned). NewBadge imports dropped from AssetLibrary, UserProfileModal, GcodeImport. Registry pruned to exactly 4 entries with new `default-tax-rate` added. Cross-repo grep gate returns 0 stale-key matches. |

All 8 declared requirement IDs verified. No orphaned requirements — REQUIREMENTS.md Traceability table maps TAX-01..05, UI-08, UI-09, UI-10 to Phase 13 and all are accounted for in plan frontmatter.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | — | — | — | No TBD/FIXME/XXX debt markers found in phase-modified files. No stub returns. No hardcoded empty data feeding UI. No empty handlers. |

A `grep -rE "TBD|FIXME|XXX|TODO" src/data/taxRates.ts src/utils/taxResolution.ts src/utils/costCalc.ts src/utils/costCalc.test.ts src/utils/taxResolution.test.ts src/components/SettingsModal.tsx src/components/CostCalculator.tsx src/components/AssetLibrary.tsx src/components/JobsManager.tsx src/components/PrinterSettings.tsx src/components/UserProfileModal.tsx src/components/GcodeImport.tsx src/features.ts src/App.tsx` returns zero unresolved debt markers across all phase-touched files.

### Human Verification Required

Phase 13 produces user-visible UI changes (Settings field, per-job Tax Rate input, Cost Breakdown Tax row, NewBadge rendering, layout of the new 4-column Set Financial Targets grid) and visual sweeping (compact inputs, InfoTooltip placement) that grep-based verification cannot validate. The plans themselves explicitly defer the following to phase wrap-up UAT per VALIDATION.md:

#### 1. Default Tax Rate field renders below Default Profit Margin

**Test:** Open Settings → Costs & Rates tab. Confirm a "Default Tax Rate" h3 with a `NEW` badge appears below "Default Profit Margin", and that the field starts empty (placeholder "e.g., 20") on a fresh profile. Type "20" and close/reopen Settings.
**Expected:** Value persists across modal close/reopen and across full app reload (IndexedDB-backed). Clearing the field writes `undefined`, not `0` (the next reopen shows empty, not "0").
**Why human:** Requires real DOM render + IndexedDB persistence verification across reloads + visual badge gating (`NEW` badge should appear for 36 hours after first seen, hidden after).

#### 2. Per-job Tax Rate Input round-trip

**Test:** In the calculator, set sellingPrice=10, per-job Tax Rate=20%, save the job. Reopen the saved job via JobsManager.
**Expected:** The per-job Tax Rate input shows "20" on reopen (the persisted override is rehydrated from `editingJob?.taxRate`). The Tax row shows "Tax (20.0%) $2.00" and Total (with Tax) = $12.00.
**Why human:** Requires real form-load-from-saved-job flow + visual Cost Breakdown rendering.

#### 3. Tax row hides at 0%

**Test:** Clear the per-job Tax Rate input. Confirm no Settings default is configured. Confirm currency is USD (region rate = 0%).
**Expected:** The Tax row + "Total (with Tax)" row are completely absent from the Cost Breakdown when `tax.ratePercent === 0`.
**Why human:** Visual confirmation of conditional rendering.

#### 4. Fallback chain visual verification — tooltip provenance

**Test:** Hover the Tax row's info icon under the following four scenarios:
1. Per-job override set → tooltip says "Per-job override — X%"
2. Clear per-job override; Settings default set → tooltip says "From Settings default — X%"
3. Clear both; currency=EUR → tooltip says "EU midpoint rate — verify for your country (21%)"
4. Clear both; currency=USD → tooltip starts with "From your region (US..." AND contains "marketplaces (Etsy, eBay, Amazon)" (D-11)
**Expected:** Each tooltip matches the locked UI-SPEC string. The USD case appends the marketplace-facilitator note when source.kind != region (D-12/D-13).
**Why human:** Tooltip rendering is interaction-driven; the assertions verify the live D-08/D-11/D-12/D-13 provenance disclosure.

#### 5. Set Financial Targets grid layout (4 columns on md+)

**Test:** Resize browser to ≥768px width. Open the cost calculator.
**Expected:** The Set Financial Targets section shows 4 equal-width columns: Profit Margin, Target Profit, Selling Price, Tax Rate. Below 768px it should stack to 1 column.
**Why human:** Visual responsive-grid verification; `md:grid-cols-4` could land but visually overflow or wrap on narrow screens.

#### 6. NewBadge `default-tax-rate` renders + does NOT push siblings

**Test:** On a fresh installs/localStorage, open Settings → Costs & Rates. Confirm a "NEW" badge appears next to the "Default Tax Rate" h3 text and does NOT push the h3 text to wrap or shift the field below.
**Expected:** Badge positioned absolutely top-right of the h3 (`absolute top-0 left-full ml-2 pointer-events-none`); the h3 text and field below remain in their natural position.
**Why human:** The badge position contract is anti-pattern-safe by class string, but visual verification ensures it didn't regress on a specific browser/zoom level. CLAUDE.md memory specifically flags this as a critical UX gate ("a NEW badge that breaks the layout is worse than no badge at all").

#### 7. Stale NewBadge sites no longer render

**Test:** On a fresh install (or with clean localStorage), open these surfaces and confirm no "NEW" badges appear: Cost calculator licensing checkbox, Cost calculator author min price label, Packaging Materials section, AssetLibrary CSV import button, AssetLibrary packaging category dropdown, GcodeImport drop-zone, UserProfileModal Currency label.
**Expected:** Zero "NEW" badges on these surfaces (JSX removed; registry pruned; cross-repo grep gate satisfied).
**Why human:** Visual confirmation of UI cleanup; the grep-level evidence is strong (0 matches) but rendering verification confirms no spurious wrappers/fragments remain.

#### 8. UI-08 compact width visual consistency

**Test:** Visually compare numeric inputs across the swept forms (AssetLibrary, JobsManager Record Sale, PrinterSettings Add/Edit, SettingsModal, CostCalculator Materials/Shipping/Carrier).
**Expected:** Numeric inputs are visibly narrower than text inputs (capped at max-w-28 = 112px). Customer Name / Asset Name / other text inputs remain wide per D-14. The new per-job Tax Rate Input is wide (UI-SPEC line 188 lock — primary financial inputs stay wide).
**Why human:** Width verification is a visual cue; grep evidence confirms `compact` prop is present but rendering width is browser-dependent.

### Gaps Summary

No blocking gaps found. All 6 success criteria from ROADMAP.md are satisfied by codebase evidence. All 8 declared requirement IDs (TAX-01..05, UI-08, UI-09, UI-10) are SATISFIED with concrete file/line evidence.

**Notes on roadmap criterion 5 (order-of-operations guard):**
The roadmap criterion explicitly says "the order-of-operations guard that asserts `taxAmount !== subtotal × rate` when depreciation > 0". The shipped test in `costCalc.test.ts:475-487` uses a synthetic numeric case (subtotal=10, sellingPrice=25, rate=20) rather than a depreciation-driven case. Plan 13-02 elected this approach explicitly (documented in 13-02-SUMMARY decisions section) because it asserts the same math fact in a more isolated and resilient way — depreciation is just one input that makes sellingPrice > subtotal; the synthetic case makes the order-of-operations guarantee explicit at the unit level. The same fact ALSO transitively guards the integration path via `calculateTax(sellingPrice, taxSource.rate)` at CostCalculator.tsx:467. The criterion's intent (guard the math fact) is satisfied; the form differs from the literal wording. This is intentional and is documented in the plan summary.

**Notes on row count (taxRates.ts):**
Plan 13-01 must_haves D-01 stated "32 rows" but the file ships 31 rows. Plan 13-01 SUMMARY documents this as an auto-fixed plan-criteria bug — Sweden (SEK/SE) serves dual duty as both the SEK currency-keyed lookup row AND one of the 27 EU member states; listing it twice would be dead code (the second .find() match would never fire). All behavioral tests (US/GBP/AU/CA/EUR/ZAR/SE branches) pass and TAX-03 success criteria are satisfied behaviorally.

**Status reasoning:**
Despite 6/6 truths verified and all requirements satisfied programmatically, the phase produces visible UI surfaces (Settings field, per-job input, Cost Breakdown row, badges, grid layout) where the visual contract is critical — particularly the NewBadge layout (CLAUDE.md memory flags this as a strict UX gate) and the new 4-column Set Financial Targets grid. Status was initially `human_needed` to formally request human UAT confirmation per the 8 items above. The plan-level summaries and 13-VALIDATION.md explicitly deferred these to "phase wrap-up UAT" and they were harvested into the verification surface. Status flipped to `passed` on 2026-05-25 per Phase 24 NYQ-05 (see UAT Closure section below).

## UAT Closure (Phase 24 NYQ-05) — 2026-05-25

The 8 deferred visual UAT items above are formally closed per Phase 24 NYQ-05 with the following disposition:

### Smoke-Tested (2 items)

| # | Item | Result | Evidence |
|---|------|--------|----------|
| 1 | Default Tax Rate field in Settings — render + IndexedDB persistence across modal close/reopen + full app reload | PASS | Verified manually in `npm run dev` on 2026-05-25: value `20` typed into Settings → Costs & Rates → Default Tax Rate; persisted across modal close/reopen; persisted across hard-reload (Cmd-Shift-R); cleared correctly to empty (NOT `0`) — `undefined`-on-empty semantics confirmed at SettingsModal.tsx:291. All 9 sub-checks PASS, attested by signal `pass-1`. |
| 2 | Per-job Tax Rate input round-trip — set on save, reads back on reopen from `editingJob?.taxRate` | PASS | Verified manually in `npm run dev` on 2026-05-25: rate=`20` entered on a test job with sellingPrice=`10`; Cost Breakdown immediately showed `Tax (20.0%) $2.00` + `Total (with Tax) $12.00`; job saved; reopened via JobsManager showed per-job Tax Rate `20` rehydrated from IndexedDB (CostCalculator.tsx:129 `useState(() => editingJob?.taxRate)`); Cost Breakdown still showed `Tax (20.0%) $2.00` + `Total (with Tax) $12.00` post-reopen. All 8 sub-checks PASS, attested by signal `pass-2`. |

### Rubber-Stamped — In-Prod Evidence (6 items)

The remaining 6 items — **#3 Tax row hides at 0%**, **#4 Fallback chain visual verification — tooltip provenance (4 scenarios)**, **#5 Set Financial Targets grid layout (4 columns on md+)**, **#6 NewBadge `default-tax-rate` renders without pushing siblings**, **#7 Stale NewBadge sites no longer render (7 surfaces)**, and **#8 UI-08 compact width visual consistency (5 components / 60 compact inputs)** — are rubber-stamped against in-prod evidence rather than re-smoke-tested.

In-prod validated since 2026-05-21 across phases 14, 15, 15.1, 16, and 17 with zero bug reports — formally accepted as passed per Phase 24 NYQ-05.

The phases stacked on top of Phase 13 (Phase 14: Customer block on Sale + Etsy helper; Phase 15: Tags + search + duplicate; Phase 15.1: Customer Library; Phase 16: PDF generation; Phase 17: PDF-04 / Rollup circular chunk + tax rounding parity) all exercised these visual surfaces during their own UAT cycles, and no regressions were reported by the user across the 2026-05-21 → 2026-05-25 in-prod window.

Phase 13 visual contract is now formally closed.

---

_Verified: 2026-05-21T13:35:00Z_
_Verifier: Claude (gsd-verifier)_
_UAT closed: 2026-05-25 (Phase 24 NYQ-05)_
