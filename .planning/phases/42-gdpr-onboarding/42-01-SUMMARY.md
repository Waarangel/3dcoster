---
phase: 42-gdpr-onboarding
plan: 01
subsystem: consent
tags: [vanilla-cookieconsent, gdpr, vercel-analytics, useSyncExternalStore, react]

# Dependency graph
requires: []
provides:
  - "Analytics-consent pub/sub store (src/utils/consent.ts) + useAnalyticsConsent hook"
  - "Themed vanilla-cookieconsent banner (CookieConsentManager) with equal-weight Accept All / Reject All"
  - "Consent-gated Analytics mount with explicit revoke cleanup (AnalyticsGate)"
  - "Cookie settings entry points in marketing Footer and in-app SettingsModal"
  - "Web-only mount pattern for consent banner + analytics (desktop ships zero analytics)"
affects: [42-02-legal-pages, 42-04-playwright-gate]

# Tech tracking
tech-stack:
  added: [vanilla-cookieconsent@3.1.0]
  patterns:
    - "useSyncExternalStore-driven consent store fed by vanilla-cookieconsent's onFirstConsent/onConsent/onChange callbacks (not a storage-event listener — library persists to a first-party cookie)"
    - "Explicit teardown of a one-way inject() side effect (script tag + window globals) on revoke, not just conditional unmount"
    - "vi.stubGlobal('__IS_TAURI__', false) test-file stub for any test that renders a component reading the Vite define global (vitest.config.ts has no `define` block)"

key-files:
  created:
    - src/utils/consent.ts
    - src/utils/consent.test.ts
    - src/hooks/useConsent.ts
    - src/components/consent/CookieConsentManager.tsx
    - src/components/consent/consent-theme.css
    - src/components/consent/AnalyticsGate.tsx
    - src/components/consent/AnalyticsGate.test.tsx
    - src/components/consent/CookieSettingsLink.tsx
  modified:
    - src/main.tsx
    - src/components/Footer.tsx
    - src/components/SettingsModal.tsx
    - src/components/SettingsModal.test.tsx
    - package.json
    - package-lock.json

key-decisions:
  - "Cookie settings entry lands in the gear-icon SettingsModal Data tab (not the ?tab=settings PrinterSettings route) per Pitfall 3 disambiguation — it groups with other cross-cutting UserProfile-level preferences"
  - "CookieSettingsLink renders a raw <button> with allow-raw-html justification (footer/settings link-list context) rather than wrapping the padded Button primitive, matching the existing JobsManager.tsx precedent for controls that would be visually dwarfed by the shared primitive"

patterns-established:
  - "Consent-gated third-party script mount: conditional render (not CSS hide) + explicit script/global cleanup on revoke, for any future third-party script with a one-way inject side effect"

requirements-completed: [GDPR-01]

coverage:
  - id: D1
    description: "Consent pub/sub store defaults to false and notifies subscribers on change (subscribeConsent/getAnalyticsConsentSnapshot/setAnalyticsConsent)"
    requirement: "GDPR-01"
    verification:
      - kind: unit
        ref: "src/utils/consent.test.ts#consent store"
        status: pass
    human_judgment: false
  - id: D2
    description: "AnalyticsGate renders no analytics script pre-consent, mounts <Analytics /> on consent, and strips the script + window.va/vaq/vam on revoke"
    requirement: "GDPR-01"
    verification:
      - kind: unit
        ref: "src/components/consent/AnalyticsGate.test.tsx#AnalyticsGate"
        status: pass
    human_judgment: false
  - id: D3
    description: "Themed opt-in banner with equal-weight Accept All / Reject All renders on every web route; skipped entirely on desktop (Tauri)"
    requirement: "GDPR-01"
    verification: []
    human_judgment: true
    rationale: "Visual equal-weight verification and live network-request assertion (zero analytics pre-consent) require a running browser session — deferred to 42-04's Playwright gate spec and the D-13/D-14 manual production DevTools check. This plan's automated coverage (D1/D2) proves the underlying mechanics; the visual/network claim itself needs human or E2E verification."
  - id: D4
    description: "Cookie settings reachable from marketing Footer (Legal column) and in-app SettingsModal (Data tab, web-only)"
    requirement: "GDPR-01"
    verification:
      - kind: unit
        ref: "src/components/SettingsModal.test.tsx (existing A11Y-10 suite, now covering the __IS_TAURI__-gated Data tab render)"
        status: pass
    human_judgment: true
    rationale: "Existing tests confirm the entries render without throwing and the correct components are referenced, but clicking through to the actual preferences modal and confirming no-reload behavior is a visual/interactive check better suited to the D-14 Playwright spec or manual UAT."

# Metrics
duration: ~20min
completed: 2026-07-10
status: complete
---

# Phase 42 Plan 01: GDPR Consent Banner Summary

**Themed opt-in vanilla-cookieconsent v3 banner with a useSyncExternalStore-driven consent bridge gating Vercel Analytics, plus revocation entry points in the marketing Footer and in-app SettingsModal — desktop ships zero analytics.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-10T10:40:00Z (approx, from session start)
- **Completed:** 2026-07-10T10:52:46Z
- **Tasks:** 3
- **Files modified:** 13 (8 created, 5 modified, plus package.json/package-lock.json)

## Accomplishments
- Installed `vanilla-cookieconsent@3.1.0` and built a pure module-level pub/sub consent store (`src/utils/consent.ts`) consumed via `useSyncExternalStore` (`src/hooks/useConsent.ts`) — safe default `false`, no React imports in the store itself
- `CookieConsentManager` mounts the library in opt-in mode with `necessary`/`analytics` categories, `equalWeightButtons` left at the library's compliant default, and a slate-900/blue-600 themed banner (`consent-theme.css`) that keeps Accept/Reject buttons visually matched (Pitfall 5)
- `AnalyticsGate` conditionally renders `<Analytics />` and, critically, strips the injected `insights/script.js` `<script>` tag and `window.va`/`vaq`/`vam` globals on revoke — a naive unmount alone would leave analytics wired up (Pitfall 1)
- `main.tsx` rewired: bare unconditional `<Analytics />` removed; `CookieConsentManager` + `AnalyticsGate` both gated on `!__IS_TAURI__` so the desktop build mounts neither (D-03)
- `CookieSettingsLink` + entries in the marketing `Footer` (Legal column) and the gear-icon `SettingsModal` (Data tab, web-only) so consent is revocable from both required surfaces (D-02) without a page reload
- Full build gate green: 1140 tests, `tsc -b` clean, `lint:no-raw-html` clean, main chunk 93.3 KB gzipped (well under the 300 KB gate — the ~20 KB increase from `vanilla-cookieconsent` + `@vercel/analytics`'s wrapper stays far inside budget, contrary to the ~7 KB A1 assumption in research, but the gate is still comfortably green)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install vanilla-cookieconsent, create consent pub/sub store + useConsent hook** - `663650c` (feat)
2. **Task 2: CookieConsentManager + themed banner + AnalyticsGate with revoke cleanup + main.tsx rewire** - `4fcf375` (feat)
3. **Task 3: CookieSettingsLink + marketing Footer entry + in-app SettingsModal entry** - `1eb2498` (feat)

_No TDD refactor commits were needed — RED tests were written alongside GREEN implementation and both passed on first run for each task._

## Files Created/Modified
- `src/utils/consent.ts` - module-level pub/sub consent store (subscribeConsent, getAnalyticsConsentSnapshot, setAnalyticsConsent), no React imports
- `src/utils/consent.test.ts` - 4 Vitest cases: default false, update, subscribe notification, unsubscribe
- `src/hooks/useConsent.ts` - `useAnalyticsConsent()` via `useSyncExternalStore`
- `src/components/consent/CookieConsentManager.tsx` - mounts `CookieConsent.run()` in opt-in mode, web-only
- `src/components/consent/consent-theme.css` - slate-900/blue-600 CSS-variable theme scoped to `#cc-main`
- `src/components/consent/AnalyticsGate.tsx` - consent-gated `<Analytics />` with revoke cleanup
- `src/components/consent/AnalyticsGate.test.tsx` - 3 Vitest cases: no-injection, injection, revoke-cleanup (NODE_ENV stubbed to production so the test exercises the same script-src path as the deployed app)
- `src/components/consent/CookieSettingsLink.tsx` - thin control wrapping `CookieConsent.showPreferences()`
- `src/main.tsx` - removed bare `<Analytics />`; added web-only `CookieConsentManager` + `AnalyticsGate`
- `src/components/Footer.tsx` - "Cookie settings" entry in the full-variant Legal column
- `src/components/SettingsModal.tsx` - web-only "Privacy & cookies" control in the Data tab
- `src/components/SettingsModal.test.tsx` - added `vi.stubGlobal('__IS_TAURI__', false)` (see Deviations)
- `package.json` / `package-lock.json` - added `vanilla-cookieconsent@3.1.0` dependency

## Decisions Made
- Cookie settings entry placed in the gear-icon `SettingsModal`'s Data tab, not the `?tab=settings` `PrinterSettings` route — resolves the CONTEXT.md/research Pitfall 3 ambiguity by grouping it with other cross-cutting `UserProfile`-level preferences (currency, tax rate, etc.)
- `CookieSettingsLink` renders a raw `<button>` with an `allow-raw-html` justification rather than wrapping the shared `Button` primitive — the padded/min-height `Button` would visually dwarf a footer link-list row and the Settings modal's other inline controls, matching the existing `JobsManager.tsx` overflow-toggle precedent for this exact class of exception

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Stubbed `__IS_TAURI__` global in SettingsModal.test.tsx**
- **Found during:** Task 3 (SettingsModal Data-tab entry)
- **Issue:** The plan's new `!__IS_TAURI__`-gated JSX block in `SettingsModal.tsx`'s Data tab is reached by the *existing* A11Y-10 arrow-key-navigation test suite (Home/End/wrap tests visit every tab, including Data). `vitest.config.ts` has no Vite `define` for `__IS_TAURI__` (only `vite.config.ts`'s build-time define provides it), so referencing the identifier at runtime under Vitest threw `ReferenceError: __IS_TAURI__ is not defined`, failing 4 previously-green tests.
- **Fix:** Added the same `vi.stubGlobal('__IS_TAURI__', false)` stub already used in `App.test.tsx` for this exact, documented gap.
- **Files modified:** `src/components/SettingsModal.test.tsx`
- **Verification:** All 23 SettingsModal tests pass; full suite (1140 tests) green.
- **Committed in:** `1eb2498` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to keep the pre-existing test suite green after adding the `!__IS_TAURI__` gate the plan specified. No scope creep — the stub only restores test-environment parity with the Vite build-time define that already exists for production/desktop builds.

## Issues Encountered
- `@vercel/analytics` resolves its script src differently in "development" mode (Vitest's `NODE_ENV=test` is treated as development, using a debug script URL that doesn't contain "insights/script.js"). `AnalyticsGate.test.tsx` stubs `NODE_ENV` to `'production'` via `vi.stubEnv` so the test exercises the same script-src / cleanup-selector path that runs in the real deployed app — this is a test-environment quirk, not a product bug (verified by reading `node_modules/@vercel/analytics/dist/react/index.mjs`).

## User Setup Required
None - no external service configuration required for this plan. (Note: `privacy@3dcoster.com` inbox setup remains a prerequisite for 42-02's Privacy Policy page, not this plan.)

## Next Phase Readiness
- The consent store, banner, and gate are fully wired and web-only; desktop mounts neither (D-03 verified via `!__IS_TAURI__` gates in `main.tsx`).
- 42-02 (legal pages) can proceed independently — no code dependency on this plan beyond routing conventions already in `main.tsx`.
- 42-04 (Playwright gate) will need this plan's `AnalyticsGate`/`CookieConsentManager` in place to write its "zero analytics pre-consent" + "Reject All is one click" assertions — both are now available.
- Visual/network verification of the live banner (equal-weight buttons, zero pre-consent requests) is intentionally deferred to 42-04 and the D-13 UAT + production DevTools check, per the plan's own verification section.

## Self-Check: PASSED

All 8 created files verified present on disk. All 3 task commit hashes (663650c, 4fcf375, 1eb2498) verified present in git log.

---
*Phase: 42-gdpr-onboarding*
*Completed: 2026-07-10*
