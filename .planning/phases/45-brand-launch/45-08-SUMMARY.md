---
phase: 45-brand-launch
plan: 08
subsystem: ui
tags: [css-custom-properties, design-tokens, consent-banner, legal-pages, gdpr]

# Dependency graph
requires:
  - phase: 45-brand-launch
    plan: "01"
    provides: Cost-Truth Dark CSS custom-property token layer (src/index.css), MarketingThemeScope's route-marketing body marker
  - phase: 45-brand-launch
    plan: "02"
    provides: Token-scoped Header/Footer pattern (var(--x) restyle convention) this plan mirrors on PrivacyPage/TermsPage
provides:
  - PrivacyPage and TermsPage restyled to Cost-Truth Dark tokens, content byte-identical
  - "body.route-marketing #cc-main CSS override in consent-theme.css — the consent banner renders brand-dark on marketing routes, slate on /app"
  - e2e/consent-theme-scope.spec.ts — permanent D-12-vs-D-02 regression guard for the consent-banner route scoping
affects: [45-09, 45-10, 45-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "body-anchored CSS override (body.route-marketing #cc-main) to theme DOM appended outside the React tree by a third-party library (vanilla-cookieconsent), keyed off a document.body marker class rather than the .theme-brand-dark div cascade"
    - "Colors-only CSS custom-property override block (no border-radius/padding re-declaration) to preserve an equal-weight UI contract across two visually distinct themes of the same component"

key-files:
  created:
    - e2e/consent-theme-scope.spec.ts
  modified:
    - src/pages/PrivacyPage.tsx
    - src/pages/TermsPage.tsx
    - src/components/consent/consent-theme.css

key-decisions:
  - "Consent-banner brand override implemented as a second CSS rule block (body.route-marketing #cc-main) appended after the base #cc-main block, not a rewrite of the base block — base block stays byte-identical so /app and desktop are provably unaffected by diff inspection alone"
  - "Every --cc-* color variable overridden (not just the plan's 'at minimum' list) so no half-themed banner state exists (e.g. a secondary button border staying slate while its background went brand-dark) — border-radius/padding/font-weight left undeclared per the plan's colors-only constraint"
  - "Secondary-button and toggle hover/readonly hex values computed to mirror the base block's own internal reuse pattern (base's --cc-toggle-off-bg literally equals its --cc-btn-secondary-hover-bg, --cc-toggle-readonly-bg equals --cc-btn-secondary-bg) — the brand override reproduces that structural relationship via var() references instead of duplicating hex, for maintainability"
  - "PrivacyPage/TermsPage h1 gained font-display + an id, and <main> gained aria-labelledby, matching the landmark pattern already established on DownloadPage/FAQPage/FeedbackPage/RoadmapPage — not explicitly required by the plan's acceptance criteria beyond 'a <main> landmark', but keeps the two legal pages consistent with every other ported marketing page's a11y structure"

patterns-established:
  - "Any future third-party-appended DOM node outside the React tree (a library that mounts to document.body directly) can be theme-scoped the same way: key a body-anchored CSS selector off MarketingThemeScope's route-marketing marker, override colors only, never touch layout-affecting properties needed for an existing equal-weight/shape contract"

requirements-completed: []

coverage:
  - id: D19
    description: "PrivacyPage and TermsPage render in the Cost-Truth Dark token system while their guarded content (processor list, Pro-tier price text) stays byte-identical"
    requirement: "BRAND-01"
    verification:
      - kind: unit
        ref: "npx vitest run src/pages/PrivacyPage.test.tsx src/pages/TermsPage.test.tsx — 7 passed (both regex-guard specs green, content assertions unchanged)"
        status: pass
      - kind: other
        ref: "grep -n 'slate-\\|text-white\\|blue-4\\|blue-3\\|bg-blue\\|text-blue' src/pages/PrivacyPage.tsx src/pages/TermsPage.tsx — zero matches, confirming every literal Tailwind color class was replaced with a var(--x) token"
        status: pass
    human_judgment: false
  - id: D20
    description: "Consent banner renders brand-dark on marketing routes and stays slate on /app; base #cc-main block untouched"
    requirement: "BRAND-01"
    verification:
      - kind: automated_ui
        ref: "e2e/consent-theme-scope.spec.ts (new) — on / asserts document.body has class route-marketing AND #cc-main's computed --cc-bg equals #0a0e18; on /app asserts body lacks route-marketing AND --cc-bg equals #0f172a. Both pass against the built preview server."
        status: pass
    human_judgment: false
  - id: D21
    description: "GDPR behavior invariants (equal-weight buttons, one-click reject, zero pre-consent analytics) stay intact through the restyle; CookieConsentManager.tsx untouched"
    requirement: "BRAND-01"
    verification:
      - kind: automated_ui
        ref: "npx playwright test e2e/consent-gate.spec.ts e2e/free-floor-no-network.spec.ts e2e/consent-theme-scope.spec.ts — 4 passed. consent-gate.spec.ts's equal-weight structural assertion (identical font-weight/font-size/padding/border, matching height, width within 12px tolerance) passed unchanged, proving the colors-only override preserved the shape contract."
        status: pass
      - kind: other
        ref: "git diff src/components/consent/CookieConsentManager.tsx — empty (file not touched)"
        status: pass
    human_judgment: false
  - id: D22
    description: "npm run build green including 300 KB gz main-chunk gate, tsc -b, lint:no-raw-html"
    requirement: "BRAND-01"
    verification:
      - kind: other
        ref: "npm run build — main chunk 101.0 KB gzipped (under 300 KB); tsc -b clean; lint:no-raw-html passed at both commits"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-07-20
status: complete
---

# Phase 45 Plan 08: Legal Surfaces + Consent Banner Brand Port Summary

**Restyled PrivacyPage/TermsPage to the Cost-Truth Dark token system with content byte-identical (both regex-guard tests green), and resolved the D-12-vs-D-02 tension on the globally-mounted, out-of-React-tree cookie-consent banner via a route-scoped `body.route-marketing #cc-main` CSS override — brand-dark on marketing routes, slate on /app — verified by a new permanent e2e regression guard.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-20T14:29:52Z (approx, following STATE.md's `last_updated` marker before this plan)
- **Completed:** 2026-07-20T14:41:00Z (approx)
- **Tasks:** 2 (both auto)
- **Files modified:** 3 (PrivacyPage.tsx, TermsPage.tsx, consent-theme.css) + 1 created (e2e/consent-theme-scope.spec.ts)

## Accomplishments
- Restyled `PrivacyPage.tsx` and `TermsPage.tsx`: every literal Tailwind slate/blue/white color class (`text-white`, `text-slate-400`, `text-slate-300`, `text-blue-400 hover:text-blue-300`, the slate gradient background) replaced with the `var(--bg)`/`var(--surface)`/`var(--ink)`/`var(--ink-soft)`/`var(--ink-faint)`/`var(--brand)`/`var(--brand-soft)` tokens 45-01/45-02 established — while every text node (the full data-processor list, the EUR 6.90/mo · EUR 69/yr Pro-price paragraph, "Merchant of Record", "no free trial", "stay live") stayed byte-for-byte unchanged. Both pages gained `font-display` on their hero `<h1>` and an `aria-labelledby`-wired `<main>` landmark, matching the pattern already established on DownloadPage/FAQPage/FeedbackPage/RoadmapPage.
- Resolved the plan's central tension: `CookieConsentManager` mounts once globally at the `main.tsx` root (siblings of both `/app` and the marketing route tree) and `vanilla-cookieconsent` appends `#cc-main` directly to `document.body`, outside both the React tree and the `.theme-brand-dark` wrapper div — so no CSS cascade from `MarketingThemeScope` reaches it. Added a second, additive `body.route-marketing #cc-main { … }` block in `consent-theme.css`, keyed off the `route-marketing` marker 45-01's `MarketingThemeScope` already toggles on `document.body`. The base `#cc-main { … }` slate block was left completely untouched.
- The override re-points every `--cc-*` color custom property to the Cost-Truth Dark palette (`--cc-bg: #0a0e18`, primary button `#1796ff` → `#5bb3ff` hover, surfaces `#121829`/`#18203a`, hairline-toned separator, ink `#f2f5fb`/`#a8b3c7`) while deliberately never re-declaring `--cc-btn-border-radius`, `--cc-modal-border-radius`, or any padding/font-weight — both Accept All and Reject All inherit the base block's identical shape, so the Pitfall 5 / T-42-01 equal-weight contract holds under the new colors exactly as it did under the old ones.
- Added `e2e/consent-theme-scope.spec.ts`: in two fresh (no-consent) browser contexts, asserts `/` has `document.body.classList` containing `route-marketing` and `#cc-main`'s computed `--cc-bg` equals the brand-dark hex, then asserts `/app` has neither the marker nor the brand color (computed `--cc-bg` equals the original slate hex). Neither sub-test clicks Accept/Reject, keeping the free-floor-no-network invariant untouched.
- Ran the full GDPR e2e trio together (`consent-gate.spec.ts`, `free-floor-no-network.spec.ts`, the new `consent-theme-scope.spec.ts`) against the built preview server — all 4 tests (one file has two sub-tests) passed, including `consent-gate.spec.ts`'s structural equal-weight assertion (identical computed font-weight/font-size/padding/border, matching bounding-box height, width within 12px tolerance), proving the colors-only override did not disturb the shape contract it depends on.

## Task Commits

Each task was committed atomically:

1. **Task 1: Restyle PrivacyPage and TermsPage to the brand (content byte-identical, guards green)** - `0cedfa5` (feat)
2. **Task 2: Brand-theme the consent banner on marketing routes only (slate on /app, behavior unchanged, GDPR e2e green)** - `ff32bd4` (feat)

**Plan metadata:** committed after this SUMMARY (see final_commit step)

## Files Created/Modified
- `src/pages/PrivacyPage.tsx` - All literal slate/blue/white Tailwind classes swapped for `var(--x)` tokens; `font-display` + `id`/`aria-labelledby` landmark wiring added; every text node untouched
- `src/pages/TermsPage.tsx` - Same restyle treatment; the EUR 6.90/mo, EUR 69/yr, "Merchant of Record", "no free trial", "stay live" text nodes untouched
- `src/components/consent/consent-theme.css` - Added a `body.route-marketing #cc-main { … }` override block (colors only) after the untouched base `#cc-main` block
- `e2e/consent-theme-scope.spec.ts` - New. Two-test spec proving the D-12 (brand on marketing) vs D-02 (slate on /app) boundary, without ever accepting/rejecting consent

## Decisions Made
See `key-decisions` in frontmatter. Most notable: rather than overriding only the plan's "at minimum" list of `--cc-*` variables, every color-affecting custom property in the base block got a brand-dark counterpart, avoiding a half-themed banner (e.g. a slate-bordered secondary button sitting on a brand-dark background). Hover/readonly/toggle-off values were derived by mirroring the base block's own internal value-reuse pattern (its `--cc-toggle-off-bg` literally equals its `--cc-btn-secondary-hover-bg`; its `--cc-toggle-readonly-bg` equals its `--cc-btn-secondary-bg`) via `var()` references in the new block, rather than picking arbitrary hex values.

## Deviations from Plan

None — plan executed exactly as written. The additional `font-display`/landmark-id wiring on the two legal pages is an in-scope completion of the plan's own "Re-apply the a11y landmark/aria pattern" read_first instruction and the "renders in the brand theme with a `<main>` landmark" acceptance criterion — not a new surface, matching the a11y convention every other ported marketing page in this phase already carries.

## Issues Encountered
None.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- Both legal surfaces and the consent banner now wear the full Cost-Truth Dark brand while every content/behavior guard from Phase 42/43 (regex-guard tests, GDPR e2e trio) stays green.
- `e2e/consent-theme-scope.spec.ts` is now a permanent regression guard alongside `consent-gate.spec.ts`/`free-floor-no-network.spec.ts` — any future change that accidentally removes the `route-marketing` marker or edits the base `#cc-main` slate block will be caught automatically.
- REQUIREMENTS.md BRAND-01 checkbox intentionally left unmarked — this is plan 8 of 11 in the phase; the final plan/orchestrator step marks it complete once the whole redesign + pricing-spot port lands (per 45-01's established precedent).
- Remaining phase work (45-09 SupportNudge Pro-retarget, 45-10 docs, 45-11 release prep/launch-comms) is unaffected by and does not depend on this plan's file set.

---
*Phase: 45-brand-launch*
*Completed: 2026-07-20*

## Self-Check: PASSED

All 4 files (PrivacyPage.tsx, TermsPage.tsx, consent-theme.css, e2e/consent-theme-scope.spec.ts) confirmed present on disk. Both commits (0cedfa5, ff32bd4) confirmed present in `git log --oneline -5`.
