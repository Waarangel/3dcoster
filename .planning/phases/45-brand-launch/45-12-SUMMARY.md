---
phase: 45-brand-launch
plan: 12
subsystem: ui
tags: [currency, fx, marketing, pricing, react-hooks]

# Dependency graph
requires:
  - phase: 45-brand-launch (plan 03/04/05)
    provides: src/pricing.ts label constants, PricingPage/LandingPage/FeaturesPage marketing surfaces
  - phase: earlier (fx system)
    provides: src/utils/fxConvert.ts convert()/canConvert(), src/hooks/useFxRates.ts cached USD table, src/utils/currency.ts formatCurrency/CURRENCY_CONFIG
provides:
  - src/utils/pricingDisplay.ts pure currency-resolution + approx-formatting module
  - src/hooks/useDisplayPrice.ts hook composing stored preference + locale + FX table into display strings
  - All 3 marketing Pro-price surfaces (/pricing, landing Pro teaser, /features) rendering home-currency approximations with EUR billing always disclosed
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Resolution ladder pattern: stored preference -> locale inference -> hard fallback, expressed as a pure function taking explicit inputs (resolveDisplayCurrency), never reading globals itself"
    - "Approx-lead + billing-disclosure UI pattern: primary figure is the best available number, a smaller disclosure line always names the fixed billing truth when the primary figure is an approximation"

key-files:
  created:
    - src/utils/pricingDisplay.ts
    - src/utils/pricingDisplay.test.ts
    - src/hooks/useDisplayPrice.ts
    - src/hooks/useDisplayPrice.test.tsx
  modified:
    - src/pricing.ts
    - src/pages/PricingPage.tsx
    - src/pages/LandingPage.tsx
    - src/pages/FeaturesPage.tsx
    - src/pages/PricingPage.test.tsx

key-decisions:
  - "REGION_TO_CURRENCY is a hand-maintained literal map (not derived from CURRENCY_CONFIG's country field), since only a subset of eurozone countries plus the 18 CURRENCY_CONFIG countries participate in the ladder and a derived map would need its own eurozone-membership list anyway"
  - "useDisplayPrice reads the stored userProfile via getSetting(settingsKeys.userProfile, null, isUserProfile) directly, NOT via getUserProfile(DEFAULT_PROFILE) — the existing DEFAULT_PROFILE default is CAD, which would have silently misrepresented every never-set visitor as a Canadian preference instead of falling through to locale inference"
  - "Hook and page tests use the existing raw createRoot+act harness convention already established by useFailureRate.test.tsx/useFailureEvents.test.tsx, not React Testing Library's renderHook — @testing-library/react is not installed in this codebase, and the plan's task text describing 'renderHook' was adapted to the actual established pattern"
  - "PricingPage's approx-lead disclosure line ('Billed as EUR 6.90/mo (times) EUR 69/yr') is rendered once per Pro column rather than duplicated per price line, since the plan's 'a billed as ... disclosure' language did not require per-line duplication and a single disclosure keeps the card legible"

requirements-completed: [BRAND-01]

coverage:
  - id: D1
    description: "resolveDisplayCurrency resolves stored preference -> navigator locale -> USD fallback ladder correctly"
    requirement: "BRAND-01"
    verification:
      - kind: unit
        ref: "src/utils/pricingDisplay.test.ts#resolveDisplayCurrency"
        status: pass
    human_judgment: false
  - id: D2
    description: "formatApproxPrice never returns a guessed number (null on same-currency or missing FX table)"
    requirement: "BRAND-01"
    verification:
      - kind: unit
        ref: "src/utils/pricingDisplay.test.ts#formatApproxPrice"
        status: pass
    human_judgment: false
  - id: D3
    description: "useDisplayPrice composes stored preference + FX table into displayCurrency/monthly/annual, never masking a never-set visitor as CAD"
    requirement: "BRAND-01"
    verification:
      - kind: unit
        ref: "src/hooks/useDisplayPrice.test.tsx#useDisplayPrice"
        status: pass
    human_judgment: false
  - id: D4
    description: "All 3 marketing Pro-price surfaces (/pricing, landing teaser, /features) render the approximation with the EUR billing amount always disclosed, and fall back to the exact EUR label with no guessed number when EUR-visitor or no-FX"
    requirement: "BRAND-01"
    verification:
      - kind: unit
        ref: "src/pages/PricingPage.test.tsx#pricing constants (src/pricing.ts)"
        status: pass
      - kind: automated_ui
        ref: "throwaway render test (removed after use): en-US+FX shows $-approx + 'Billed as EUR 6.90/mo · EUR 69/yr'; de-DE+FX and no-FX-cache both show 'EUR 6.90' alone with no 'Billed as' text"
        status: pass
    human_judgment: true
    rationale: "Visual/layout correctness across the 3 surfaces (table-cell compactness, teaser card spacing) and real browser locale behavior are best confirmed by a human looking at /pricing, /features, and / under different browser languages, per the plan's human-check verification step."

# Metrics
duration: 20min
completed: 2026-07-20
status: complete
---

# Phase 45 Plan 12: Marketing Pro-price home-currency approximation Summary

**Home-currency approximation of the Pro price (stored preference -> locale -> USD ladder, FX-converted via the existing display-time seam) shown alongside the always-disclosed fixed EUR billing amount on all 3 marketing Pro-price surfaces.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-20T18:59:00Z
- **Completed:** 2026-07-20T19:06:00Z
- **Tasks:** 3
- **Files modified:** 9 (4 created, 5 modified)

## Accomplishments
- `src/pricing.ts` gained `MONTHLY_PRICE_AMOUNT`/`ANNUAL_PRICE_AMOUNT`/`BILLING_CURRENCY` numeric constants alongside the byte-guarded label constants, giving the display layer numbers to convert without ever re-typing the billing truth
- New pure module `src/utils/pricingDisplay.ts`: `REGION_TO_CURRENCY` map (17 direct-country + 19 eurozone entries), `regionFromLanguageTag`, `resolveDisplayCurrency` (stored -> locale -> USD), `formatApproxPrice` (null on same-currency or no-table, formatted string otherwise) — 8 unit tests
- New hook `src/hooks/useDisplayPrice.ts` composing the stored `userProfile` currency preference (read once on mount, never defaulted to CAD), `useFxRates()`, and `pricingDisplay` into `{ displayCurrency, monthly: { approx, billingLabel }, annual: { approx, billingLabel } }` — 4 unit tests
- All 3 marketing Pro-price surfaces (`PricingPage.tsx`, `LandingPage.tsx`, `FeaturesPage.tsx`) wired to the hook: home-currency approximation leads, fixed EUR billing amount always disclosed via the verbatim guarded label; EUR visitors and no-FX states fall back to the exact EUR label alone (unchanged prior behavior)
- `PricingPage.test.tsx` byte-match guard extended (not deleted): new assertions that `MONTHLY_PRICE_AMOUNT`/`ANNUAL_PRICE_AMOUNT` stay aligned with the guarded labels and `BILLING_CURRENCY === 'EUR'`

## Task Commits

Each task was committed atomically (TDD RED/GREEN for tasks 1-2):

1. **Task 1: pricingDisplay pure module — resolution ladder + locale map + approx formatter** - `8cb00b3` (feat)
2. **Task 2: useDisplayPrice hook — stored-preference + locale + FX → display strings** - `944e6a8` (feat)
3. **Task 3: Wire the three marketing Pro-price surfaces + extend the pricing guard test** - `761ad44` (feat)

**Plan metadata:** (this commit) `docs(45-12): complete marketing Pro-price home-currency approximation plan`

## Files Created/Modified
- `src/pricing.ts` - Added MONTHLY_PRICE_AMOUNT/ANNUAL_PRICE_AMOUNT/BILLING_CURRENCY numeric constants alongside the unchanged label constants
- `src/utils/pricingDisplay.ts` - Pure resolution-ladder + approx-price formatter (no React, no IO)
- `src/utils/pricingDisplay.test.ts` - 8 unit tests for regionFromLanguageTag/resolveDisplayCurrency/formatApproxPrice
- `src/hooks/useDisplayPrice.ts` - React hook composing stored preference + useFxRates + pricingDisplay
- `src/hooks/useDisplayPrice.test.tsx` - 4 unit tests using the codebase's raw createRoot+act hook-test harness
- `src/pages/PricingPage.tsx` - Pro column monthly/annual/launch-price lines now approx-lead with a billing disclosure
- `src/pages/LandingPage.tsx` - Pro teaser card leads "Pro from {approx}" with a "billed as {billingLabel}" line
- `src/pages/FeaturesPage.tsx` - Breakdown-intro prose, Pro column header, and compact Price-row cell all approx-lead
- `src/pages/PricingPage.test.tsx` - Extended (not deleted) with amount/label alignment and BILLING_CURRENCY assertions

## Decisions Made
- `useDisplayPrice` reads the stored currency preference via `getSetting(settingsKeys.userProfile, null, isUserProfile)` directly rather than `getUserProfile(DEFAULT_PROFILE)`, since `DEFAULT_PROFILE`'s CAD default would have silently misrepresented every visitor who has never set a preference — a null read correctly falls through to locale inference (per the plan's explicit warning)
- Hook and page-render tests follow this codebase's established raw `createRoot`+`act` harness pattern (see `useFailureRate.test.tsx`) rather than React Testing Library's `renderHook`, since `@testing-library/react` is not installed here — the plan's task text mentioned "renderHook" generically, adapted to the actual codebase convention
- `REGION_TO_CURRENCY` is a hand-written literal map rather than derived from `CURRENCY_CONFIG`, since eurozone membership (19 countries mapping to EUR) has no representation in `CURRENCY_CONFIG` (which only lists one row per currency, not per country) — deriving it would still need its own eurozone list
- PricingPage's "Billed as EUR 6.90/mo · EUR 69/yr" disclosure renders once per Pro column (not duplicated after every approx-led line) — keeps the card legible while still satisfying the plan's requirement that the billing currency stay visible whenever an approximation is shown

## Deviations from Plan

None — plan executed exactly as written. The "renderHook" test-tooling reference in the plan's task text was interpreted as generic guidance and implemented using the codebase's actual established hook-test convention (raw `createRoot`+`act`), which is a test-infrastructure fit decision, not a scope or behavior deviation.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

BRAND-01 was already marked complete in REQUIREMENTS.md prior to this gap-closure plan (Phase 45 shipped 2026-07-20); this plan closes the G-45-CURRENCY gap identified during UAT without reopening the requirement. Full test suite (1426 tests, up from the pre-plan 1412+) and `npm run build` both pass. No new dependencies added. Nothing pushed to remote — release timing remains the user's call per project convention.

---
*Phase: 45-brand-launch*
*Completed: 2026-07-20*

## Self-Check: PASSED

All 9 created/modified files confirmed present on disk; all 3 task commit hashes (8cb00b3, 944e6a8, 761ad44) confirmed in git log.
