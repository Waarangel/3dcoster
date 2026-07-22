---
phase: 45-brand-launch
plan: 14
subsystem: ui
tags: [pricing, currency, i18n, react, paddle]

# Dependency graph
requires:
  - phase: 45-brand-launch (plan 12)
    provides: useDisplayPrice/pricingDisplay currency-approximation layer (G-45-CURRENCY)
  - phase: 45-brand-launch (plan 03)
    provides: src/pricing.ts single-source-of-truth Pro price constants + PricingPage
provides:
  - USD 7.99/mo, USD 79/yr as the single guarded Pro price truth everywhere (pricing.ts, BillingPanel, Terms, marketing surfaces via the hook)
  - Dollar-collision currency disambiguation (CA$/A$/NZ$/MX$) in formatApproxPrice
  - formatZeroPrice() + useDisplayPrice().freePrice — Free-card zero always matches the Pro card's shown currency
  - /pricing Free-card zero wired to freePrice; both card CTAs bottom-aligned at md+
affects: [45-brand-launch (any future pricing/billing plan), Pro backend/Paddle checkout config]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Currency disambiguation table (DOLLAR_DISAMBIGUATION) for '$'-colliding ISO currencies, applied post-format by prefix-swap (never String.replace, to dodge '$'-pattern interpretation)"
    - "Free-card zero derives its currency from whichever branch the paired Pro figure actually renders (approx vs billing fallback), not from displayCurrency alone"

key-files:
  created: []
  modified:
    - src/pricing.ts
    - src/components/pro/BillingPanel.tsx
    - src/components/pro/BillingPanel.test.tsx
    - src/pages/PricingPage.test.tsx
    - src/pages/TermsPage.tsx
    - src/pages/TermsPage.test.tsx
    - src/lib/paddle.ts
    - src/hooks/useDisplayPrice.ts
    - src/hooks/useDisplayPrice.test.tsx
    - src/utils/pricingDisplay.ts
    - src/utils/pricingDisplay.test.ts
    - src/pages/PricingPage.tsx
    - src/pages/LandingPage.tsx

key-decisions:
  - "Pro price re-based EUR 6.90/EUR 69 -> USD 7.99/USD 79 (founder decision, UAT chat 2026-07-20: company is Canadian, bill in USD; Paddle as Merchant of Record will localize checkout later, nothing Paddle-side to code now)"
  - "USD deliberately omitted from DOLLAR_DISAMBIGUATION — it is the billing base and is shown only via the ISO-code label, never as an approx symbol, so it stays a bare '$'"
  - "TermsPage EFFECTIVE_DATE bumped to July 21, 2026 for the material Pro-price change, per the Phase-43 carry-forward rule"
  - "Historical code comments referencing the OLD price avoid the literal substrings 'EUR 6.90'/'EUR 69' (reworded to 'the prior Euro-billed price') so the plan's own stale-price grep guard stays clean of true stale figures AND commentary about them"

patterns-established:
  - "Dollar-collision disambiguation: any future dollar-symbol currency (e.g. SGD, HKD) added to Currency should get a DOLLAR_DISAMBIGUATION entry alongside REGION_TO_CURRENCY, otherwise it will silently render as a bare '$' next to the USD billing label"

requirements-completed: []  # BRAND-01 already marked complete in plan 45-11; this is gap-closure work, not new requirement completion

coverage:
  - id: D1
    description: "Pro price is USD 7.99/mo, USD 79/yr on pricing.ts, BillingPanel, Terms (new effective date), guarded by byte-match tests"
    requirement: "BRAND-01"
    verification:
      - kind: unit
        ref: "src/pages/PricingPage.test.tsx#pricing constants (src/pricing.ts)"
        status: pass
      - kind: unit
        ref: "src/components/pro/BillingPanel.test.tsx#shows both plans with the exact ToS prices and no trial copy"
        status: pass
      - kind: unit
        ref: "src/pages/TermsPage.test.tsx#contains the concrete Pro-tier price figures and names Paddle as Merchant of Record"
        status: pass
    human_judgment: false
  - id: D2
    description: "CAD/AUD/NZD visitors see a disambiguated dollar symbol (CA$/A$/NZ$), never a bare $ that could read as USD"
    requirement: "BRAND-01"
    verification:
      - kind: unit
        ref: "src/utils/pricingDisplay.test.ts#formatApproxPrice > disambiguates dollar-collision currencies with a prefixed symbol"
        status: pass
      - kind: automated_ui
        ref: "playwright: /pricing rendered with locale en-CA/en-AU/en-NZ at 1440px — CA$11.25/mo, A$11.40/mo, NZ$13.63/mo confirmed in page text"
        status: pass
    human_judgment: false
  - id: D3
    description: "/pricing Free card renders its zero in the SAME display currency the Pro card shows, never a mismatched currency"
    requirement: "BRAND-01"
    verification:
      - kind: unit
        ref: "src/hooks/useDisplayPrice.test.tsx#freePrice assertions (GBP/USD-same-currency/no-FX-table cases)"
        status: pass
      - kind: automated_ui
        ref: "playwright: /pricing en-US shows $0 next to USD 7.99; en-CA shows CA$0 next to CA$11.25"
        status: pass
    human_judgment: false
  - id: D4
    description: "Both /pricing card CTA buttons sit on the same baseline at md+ widths"
    requirement: "BRAND-01"
    verification:
      - kind: automated_ui
        ref: "playwright: bounding-box Y-coordinate check at 768/1024/1440px, en-US and en-CA — CTA bottoms match exactly (e.g. 947px == 947px at 1440, 1013px == 1013px at 768)"
        status: pass
    human_judgment: false

duration: 31min
completed: 2026-07-21
status: complete
---

# Phase 45 Plan 14: Pro Price Re-base to USD + Pricing-Page Currency Consistency Summary

**Pro price re-based from EUR 6.90/EUR 69 to USD 7.99/USD 79 across every guarded surface, plus dollar-symbol disambiguation (CA$/A$/NZ$/MX$) and a currency-matched Free-card zero that closes the two UAT gaps G-45-BILLING-CURRENCY and G-45-PRICING-CONSISTENCY.**

## Performance

- **Duration:** ~31 min
- **Started:** 2026-07-21T21:00:00-04:00 (approx.)
- **Completed:** 2026-07-21T21:31:17-04:00
- **Tasks:** 3
- **Files modified:** 13

## Accomplishments
- `src/pricing.ts` is now the single USD 7.99/USD 79 source of truth; `BillingPanel.tsx`'s byte-match anchor moved in lockstep; the pricing byte-match guard, Terms guard, and BillingPanel guard tests were all re-targeted (RED confirmed against the old EUR literals, then GREEN against the new USD source) rather than deleted
- `TermsPage.tsx` Pro-price bullet updated to USD 7.99/USD 79, effective date bumped to July 21, 2026 for the material price change
- `formatApproxPrice` disambiguates CAD/AUD/NZD/MXN with CA$/A$/NZ$/MX$ prefixes (USD deliberately excluded — it's the billing base, stays a bare `$`); new `formatZeroPrice(currency)` gives a decimal-free zero in any currency
- `useDisplayPrice()` gained `freePrice`, computed from whichever currency the Pro card is actually showing (display currency when an approximation exists, USD billing fallback otherwise) — the Free and Pro figures can never disagree on currency
- `/pricing` Free card now renders `freePrice` instead of a hardcoded `€0`; the Pro card's Paddle-disclosure paragraph moved above its CTA so both cards' CTAs are their final flex child, with `mt-auto` added to both — verified bottom-aligned via Playwright bounding-box checks at 768/1024/1440px

## Task Commits

Each task was committed atomically:

1. **Task 1: Re-base the guarded price truth EUR -> USD** - `a97e1a4` (feat)
2. **Task 2: Currency-display layer — disambiguation + display-currency zero** - `730143c` (feat)
3. **Task 3: /pricing page — Free-card zero + bottom-aligned CTAs** - `5f0df57` (fix)

_TDD followed literally for Tasks 1 and 2: test files edited first, RED confirmed against the unmodified EUR source / missing `formatZeroPrice`/`freePrice`, then source updated to GREEN — verified via two separate `npx vitest run` invocations per task before committing._

## Files Created/Modified
- `src/pricing.ts` - USD 7.99/USD 79 constants (labels + numeric amounts + BILLING_CURRENCY)
- `src/components/pro/BillingPanel.tsx` - byte-match anchor, local price labels updated
- `src/components/pro/BillingPanel.test.tsx` - price assertions re-targeted to USD
- `src/pages/PricingPage.test.tsx` - pricing.ts byte-match guard re-targeted to USD
- `src/pages/TermsPage.tsx` - Pro price bullet + effective date
- `src/pages/TermsPage.test.tsx` - price-figure assertions re-targeted to USD
- `src/lib/paddle.ts` - doc-comment price references only (no code path change)
- `src/hooks/useDisplayPrice.ts` - new `freePrice` field
- `src/hooks/useDisplayPrice.test.tsx` - freePrice assertions; same-currency case rewritten as a USD (en-US) visitor
- `src/utils/pricingDisplay.ts` - `DOLLAR_DISAMBIGUATION` map, disambiguation in `formatApproxPrice`, new `formatZeroPrice`
- `src/utils/pricingDisplay.test.ts` - disambiguation + formatZeroPrice test coverage, extended FX fixture (CAD/AUD/NZD)
- `src/pages/PricingPage.tsx` - Free-card price wired to `freePrice`; CTA reorder + `mt-auto`
- `src/pages/LandingPage.tsx` - stale price literal in a comment generalized to avoid future drift

## Decisions Made
- Re-based to USD per founder decision (UAT chat 2026-07-20, company is Canadian) — Paddle remains Merchant of Record and will handle checkout localization later; this plan only changes the displayed/guarded price truth, no Paddle SKU/env changes
- USD excluded from the dollar-disambiguation table by design (it's the billing base; shown only via its ISO-code label)
- Comments referencing the old price were reworded to avoid the literal "EUR 6.90"/"EUR 69" substrings so the plan's own stale-price grep guard (`grep -rn "EUR 6.90\|EUR 69" src/`) stays genuinely clean, not just clean of code paths

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Stale EUR price literal in an unlisted file (LandingPage.tsx)**
- **Found during:** Task 1, verifying the plan's stale-EUR grep guard
- **Issue:** `src/pages/LandingPage.tsx` (not in the plan's `files_modified` list) had a code comment example reading `"Pro from EUR 6.90/mo"`, which would have tripped the plan's own `grep -rn "EUR 6.90\|EUR 69" src/` verification and left an inaccurate example after the re-base
- **Fix:** Generalized the comment to reference `[MONTHLY_PRICE_LABEL]` symbolically instead of a hardcoded price, so it can never drift again
- **Files modified:** src/pages/LandingPage.tsx
- **Verification:** `grep -rn "EUR 6.90\|EUR 69" src/` returns nothing; full suite green
- **Committed in:** a97e1a4 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix, comment-only, no runtime behavior change)
**Impact on plan:** No scope creep — the fix was required to satisfy the plan's own verification step.

## Issues Encountered

**Pre-existing environmental test flake in `npm run build`'s bundled `vitest run --coverage` step (out of scope, not a regression):** `src/components/calculator/outputEquivalence.test.tsx`'s single heavy test (mounts every curated + random calculator scenario) intermittently exceeds vitest's default 5000ms timeout when run as part of the full 127-file suite under this machine's current background CPU load (load average ~10-14 on a 10-core machine, driven by numerous unrelated MCP server processes). Investigated per the mandatory-testing-first instinct:
- The test passes reliably in isolation (multiple runs, with and without `--coverage`)
- The full suite passes cleanly (1429 tests, all coverage thresholds met) when run with `--testTimeout=30000`
- Reproduced the identical timeout on the **pre-plan baseline commit** `ef3a231` via a throwaway `git worktree` (removed after diagnosis) — proving this is not caused by any file this plan touches
- All individual `npm run build` gates were verified to pass on their own: `node scripts/lint-no-raw-html.mjs`, `node scripts/assert-no-static-jspdf.mjs`, `npx tsc -b`, `npx vite build` (main chunk 100.2 KB gz, well under the 300 KB gate), `node scripts/assert-bundle-size.mjs`, `node scripts/assert-no-pdf-preload.mjs`, `node scripts/assert-no-static-pdf-import.mjs`, `node scripts/assert-no-static-three-import.mjs` — all passed
- Not auto-fixed: raising the test's timeout or reconfiguring the test runner is outside this plan's file scope (`vitest.config.ts` / `outputEquivalence.test.tsx` are unrelated to G-45-BILLING-CURRENCY / G-45-PRICING-CONSISTENCY) and would be an infrastructure change, not a currency fix — flagging for a future hardening pass instead

## User Setup Required

None - no external service configuration required. (Paddle price IDs/SKUs are unaffected — those are Paddle-dashboard config for a later operator step, not touched by this plan.)

## Next Phase Readiness
- G-45-BILLING-CURRENCY and G-45-PRICING-CONSISTENCY both closed; USD 7.99/USD 79 is now the single guarded price truth across pricing.ts, BillingPanel, Terms, and every marketing surface fed by `useDisplayPrice()`
- Before any real Paddle checkout goes live, the operator must create USD-denominated Paddle price SKUs (VITE_PADDLE_PRICE_ID_MONTHLY/ANNUAL) matching USD 7.99/USD 79 — out of scope for this plan (no Paddle SKUs exist yet per plan context)
- Flag for a future hardening pass: `outputEquivalence.test.tsx`'s default 5000ms timeout is too tight for this machine's typical background load during full-suite coverage runs (pre-existing, reproduced on baseline)

---
*Phase: 45-brand-launch*
*Completed: 2026-07-21*
