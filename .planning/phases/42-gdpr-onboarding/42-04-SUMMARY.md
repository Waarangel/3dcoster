---
phase: 42-gdpr-onboarding
plan: 04
subsystem: testing
tags: [playwright, e2e, gdpr, consent, vanilla-cookieconsent, vercel-analytics]

# Dependency graph
requires:
  - phase: 42-01
    provides: CookieConsentManager banner (vanilla-cookieconsent v3, opt-in mode, Accept All/Reject All), AnalyticsGate consent-gated Analytics mount, src/utils/consent.ts pub/sub store
provides:
  - Project's first E2E test harness (Playwright, chromium-only, minimal scope)
  - Automated D-14 gate assertion (zero pre-consent analytics, one-click Reject All, structural equal-weight buttons)
  - docs/GATE-VERIFICATION.md — documented manual production DevTools network-check procedure (D-13/D-14)
affects: [42-gdpr-onboarding (hard gate closure), 43-pro-backend (gate must pass before this phase begins)]

# Tech tracking
tech-stack:
  added: ["@playwright/test@1.61.1 (devDependency, chromium browser only)"]
  patterns:
    - "E2E harness minimal-scope pattern: single spec file, single browser project, webServer targets vite preview on the app's pinned port"
    - "navigator.webdriver override via page.addInitScript when testing bot-detection-gated UI (vanilla-cookieconsent's hideFromBots)"

key-files:
  created:
    - playwright.config.ts
    - e2e/consent-gate.spec.ts
    - docs/GATE-VERIFICATION.md
  modified:
    - package.json (added @playwright/test devDependency, test:e2e script)
    - package-lock.json
    - .gitignore (Playwright artifact dirs)

key-decisions:
  - "vanilla-cookieconsent's default hideFromBots option checks navigator.webdriver and silently skips rendering the entire banner for any WebDriver-controlled browser (Playwright sets navigator.webdriver=true by default) — fixed test-side via page.addInitScript overriding the property to false, rather than changing production config, since real visitors never have navigator.webdriver===true"
  - "Equal-weight button assertion compares computed padding/font-weight/font-size/border (structural equality) plus exact height match, with a 12px width tolerance — width alone is not asserted tightly because 'Accept All' and 'Reject All' render at slightly different natural glyph widths even with byte-identical CSS"

patterns-established:
  - "Pattern: Bot-detection test override — page.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => false })) before goto() when the app under test has bot-detection logic that would otherwise hide the UI from Playwright"

requirements-completed: [GDPR-01]

coverage:
  - id: D1
    description: "Automated Playwright spec asserts zero analytics network requests fire before consent is given"
    requirement: "GDPR-01"
    verification:
      - kind: e2e
        ref: "e2e/consent-gate.spec.ts#no analytics before consent, one-click Reject All, equal-weight buttons"
        status: pass
    human_judgment: false
  - id: D2
    description: "Spec asserts Reject All is exactly one click with no intermediate preferences screen"
    requirement: "GDPR-01"
    verification:
      - kind: e2e
        ref: "e2e/consent-gate.spec.ts#no analytics before consent, one-click Reject All, equal-weight buttons"
        status: pass
    human_judgment: false
  - id: D3
    description: "Spec asserts Accept All and Reject All carry structurally equal visual weight (font-weight, font-size, padding, border, height)"
    requirement: "GDPR-01"
    verification:
      - kind: e2e
        ref: "e2e/consent-gate.spec.ts#no analytics before consent, one-click Reject All, equal-weight buttons"
        status: pass
    human_judgment: false
  - id: D4
    description: "Manual production DevTools network-check procedure documented for the operator to run after the D-13 deploy against live 3dcoster.com"
    requirement: "GDPR-01"
    verification: []
    human_judgment: true
    rationale: "This is an operator runbook for a manual post-deploy check against live production — it cannot be automated (no production deploy exists yet at plan-execution time) and its correctness is a documentation-quality judgment, not a testable assertion."

duration: ~25min (across two sessions, split by the package-legitimacy checkpoint)
completed: 2026-07-11
status: complete
---

# Phase 42 Plan 04: Playwright E2E Consent-Gate Test Summary

**Playwright's first E2E spec in the project asserts zero pre-consent analytics, one-click Reject All, and structurally equal-weight Accept/Reject buttons against the real CookieConsentManager banner on the built preview server; docs/GATE-VERIFICATION.md documents the manual production incognito network-check the operator runs post-deploy.**

## Performance

- **Duration:** ~25 min of active execution (session split by a blocking-human package-legitimacy checkpoint, approved by the user before resuming)
- **Completed:** 2026-07-11
- **Tasks:** 2 (plus the checkpoint task, resolved by the orchestrator/user before this continuation began)
- **Files modified:** 6 (package.json, package-lock.json, .gitignore, playwright.config.ts, e2e/consent-gate.spec.ts, docs/GATE-VERIFICATION.md)

## Accomplishments

- Installed `@playwright/test@1.61.1` (dev-only dependency, approved via the mandatory package-legitimacy checkpoint) and the Chromium browser binary; added `playwright.config.ts` (chromium-only project, baseURL/webServer targeting the pinned `:4173` preview server) and the `test:e2e` npm script, without touching the existing `npm run build` gate chain
- Wrote `e2e/consent-gate.spec.ts`, the project's first E2E test, which drives the real `CookieConsentManager` banner and asserts: (1) zero analytics network requests (`/_vercel/insights/*`) fire before any consent decision (T-42-03), (2) "Reject All" dismisses the banner in exactly one click with no intermediate preferences screen, and (3) "Accept All"/"Reject All" carry structurally identical visual weight (computed font-weight, font-size, padding, border, height) — the automated half of the D-14 hard-gate requirement
- Discovered and fixed a real blocker: `vanilla-cookieconsent`'s `hideFromBots` default option checks `navigator.webdriver` and silently skips rendering the banner for any automated browser — Playwright's Chromium sets this `true` by default. Fixed test-side (`page.addInitScript` overriding the property before navigation), not by weakening the app's bot-detection for everyone
- Wrote `docs/GATE-VERIFICATION.md` documenting both the automated check (`npm run build && npm run test:e2e`) and the manual incognito DevTools production network-check procedure the operator must run after the D-13 deploy, before Phase 43 begins

## Task Commits

Each task was committed atomically:

1. **Task 1: Install @playwright/test + chromium, add playwright.config.ts + test:e2e script + gitignore** - `e70bca5` (feat)
2. **Task 2: e2e/consent-gate.spec.ts + docs/GATE-VERIFICATION.md** - `4b5065c` (feat)

**Plan metadata:** commit pending (this SUMMARY + STATE.md + ROADMAP.md commit, created after this document)

## Files Created/Modified

- `playwright.config.ts` - Minimal Playwright config: chromium-only project, `testDir: 'e2e'`, `use.baseURL: 'http://localhost:4173'`, `webServer` runs `npm run preview` with `reuseExistingServer: !process.env.CI`
- `e2e/consent-gate.spec.ts` - The D-14 automated consent-gate spec: pre-consent analytics-request assertion, one-click Reject All, structural equal-weight button assertion
- `docs/GATE-VERIFICATION.md` - Automated-check instructions + the manual incognito DevTools production network-check runbook (D-13/D-14)
- `package.json` - Added `@playwright/test` devDependency and `"test:e2e": "playwright test"` script (kept separate from the vitest-based `build` gate chain)
- `package-lock.json` - Lockfile update for the new devDependency
- `.gitignore` - Added `/test-results/`, `/playwright-report/`, `/playwright/.cache/`

## Decisions Made

- **Package-legitimacy checkpoint resolution:** `@playwright/test@1.61.1` was flagged SUS by the automated legitimacy checker (a "too-new patch release" heuristic), which 42-RESEARCH.md assessed as a high-confidence false positive (43.8M weekly downloads, official `microsoft/playwright` repo, no postinstall script). The orchestrator independently re-verified this (`npm view` repository/scripts checks) and the user explicitly approved the install before this continuation began.
- **navigator.webdriver test override, not an app-code change:** `vanilla-cookieconsent`'s `hideFromBots: true` default silently hides the banner from any browser reporting `navigator.webdriver === true`. Rather than disabling `hideFromBots` in `CookieConsentManager.tsx` (which would also stop hiding the banner from real search-engine bots — an actual product behavior change with SEO/crawl implications outside this plan's scope), the fix lives entirely in the test: `page.addInitScript` overrides the property to `false` before navigation. Real visitors never set `navigator.webdriver`, so this makes the automated browser behave observably like a real visitor without touching production code.
- **Equal-weight assertion uses structural style equality, not raw bounding-box width:** initial implementation asserted bounding-box width within a 2px tolerance and failed — "Accept All" and "Reject All" are both 10-character labels but render 6px apart in width purely from natural glyph-width differences, even with byte-identical CSS (padding, font-weight, font-size, and border were all confirmed identical via computed-style inspection). Rewrote the assertion to compare computed `padding`/`font-weight`/`font-size`/`border` for exact equality (the properties a themer could actually break, per Pitfall 5's own framing: "same padding, same font-weight, same border-radius, only a permissible hue/contrast difference"), assert exact height equality (height is unaffected by text content), and use a 12px width tolerance that still catches gross equal-weight violations while tolerating natural text-rendering variance.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] navigator.webdriver bot-detection hid the consent banner from Playwright**
- **Found during:** Task 2 (writing and first-running `e2e/consent-gate.spec.ts`)
- **Issue:** The spec's first run timed out waiting for the "Accept All" button — the banner never rendered at all. Root-caused by reading `vanilla-cookieconsent`'s minified source: `hideFromBots: true` (library default) checks `navigator.webdriver || navigator.userAgent` bot patterns and returns early before any modal setup, and Playwright's Chromium reports `navigator.webdriver === true` by default.
- **Fix:** Added `await page.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => false }); })` before `page.goto('/')` in the spec. This is test-environment-only; production `CookieConsentManager.tsx` config is unchanged.
- **Files modified:** `e2e/consent-gate.spec.ts`
- **Verification:** Re-ran the spec; banner rendered and all three assertions (zero pre-consent analytics, one-click reject, equal-weight buttons) passed.
- **Committed in:** `4b5065c` (Task 2 commit)

**2. [Rule 1 - Bug] Equal-weight assertion used the wrong signal (raw width) and produced a false failure**
- **Found during:** Task 2 (first passing run of the banner-visibility fix above)
- **Issue:** After fixing the `navigator.webdriver` issue, the spec still failed — `Math.abs(acceptBox.width - rejectBox.width)` was 6px against a 2px tolerance, even though the buttons are genuinely equal-weight by design (confirmed via computed-style inspection: identical padding `6.56px 26.24px`, font-weight `600`, font-size `13.12px`, border `1px solid rgb(37, 99, 235)`). The width delta is natural glyph-rendering variance between "Accept All" and "Reject All", not a design regression.
- **Fix:** Rewrote the assertion to compare computed `padding`/`font-weight`/`font-size`/`border` for byte-identical equality (the actual "equal weight" signal), assert exact bounding-box height equality, and widen the width tolerance to 12px (still tight enough to catch a real violation, e.g. one button losing its border/padding).
- **Files modified:** `e2e/consent-gate.spec.ts`
- **Verification:** Re-ran the spec; all assertions passed. Re-ran the full plan verification command (`npm run build && npx playwright test e2e/consent-gate.spec.ts`) — exit 0.
- **Committed in:** `4b5065c` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3/Rule 1 — blocking test-environment issue and a test-assertion bug found while writing the spec, not application-code changes)
**Impact on plan:** Both fixes were necessary to make the D-14 spec actually exercise and correctly assert the real behavior. No production code (CookieConsentManager, AnalyticsGate, consent.ts) was touched. No scope creep — the fixes stayed within `e2e/consent-gate.spec.ts`.

## Issues Encountered

- `npm run build` runs the full gate chain (lint:no-raw-html, jspdf-static-import assert, `vitest run --coverage` across 98 test files / 1165 tests, `tsc -b`, `vite build`, bundle-size/pdf-preload/pdf-import asserts) — took ~15s locally. Ran successfully with no failures; confirms this plan's changes did not regress the existing build gate.
- Local `test-results/` and `playwright-report/` directories generated by running the spec were deleted after verification (both are gitignored per this plan's `.gitignore` addition) — not committed, per the plan's artifact scope.

## User Setup Required

None - no external service configuration required. Note: the manual production DevTools network-check documented in `docs/GATE-VERIFICATION.md` is an **operator action required after deploy** (per D-13), not a setup step — it is the final piece of the Phase 42 hard gate and must be run and confirmed passing on live `3dcoster.com` before Phase 43 (Pro Backend) begins.

## Next Phase Readiness

- Phase 42 (GDPR & Onboarding) code is now complete across all four plans (42-01 consent banner, 42-02 onboarding wizard, 42-03 legal pages, 42-04 this E2E gate test). The hard gate itself is **not yet closed** — per D-13, closure requires: UAT (`/gsd-verify-work`) → release-diff code review across staged Phases 38–42 → user's explicit `DEPLOY_OK=1` → single production deploy → the manual incognito DevTools check in `docs/GATE-VERIFICATION.md` passing on live `3dcoster.com`.
- Phase 43 (Pro Backend) must not begin planning or execution until that production verification passes.
- The `e2e/` directory and `test:e2e` npm script are now available for any future minimal E2E needs, but per D-14/42-CONTEXT.md "Deferred Ideas", a broader E2E test milestone remains explicitly out of scope — do not expand `e2e/` beyond the consent gate without a dedicated decision.

## Self-Check: PASSED

- FOUND: playwright.config.ts
- FOUND: e2e/consent-gate.spec.ts
- FOUND: docs/GATE-VERIFICATION.md
- FOUND: e70bca5 (git log --oneline --all)
- FOUND: 4b5065c (git log --oneline --all)

---
*Phase: 42-gdpr-onboarding*
*Completed: 2026-07-11*
