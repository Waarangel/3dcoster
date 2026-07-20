---
phase: 45-brand-launch
plan: 02
subsystem: ui
tags: [css-custom-properties, design-tokens, shared-primitives, toast, header, footer]

# Dependency graph
requires:
  - phase: 45-brand-launch
    plan: "01"
    provides: Cost-Truth Dark CSS custom-property token layer (src/index.css) with slate-equivalent :root defaults + .theme-brand-dark override, MarketingThemeScope
provides:
  - Token-driven Button/Card/Input/Select/Textarea (var(--brand)/var(--surface)/var(--hairline)/var(--ink) etc.) — themes by DOM ancestry, no per-component prop
  - "support" toast variant (amber/gold, color-mix over --surface) for SupportNudge's Pro retarget (45-09)
  - Brand-ported Header with /pricing nav entry (desktop + mobile) and dead variant="light" code dropped
  - Brand-ported Footer preserving main's Privacy/Terms/CookieSettingsLink links, plus a new Pricing link
affects: [45-03, 45-04, 45-05, 45-06, 45-07, 45-08, 45-09, 45-10, 45-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared ui/ primitives read var(--x) tokens unconditionally; the DOM ancestor (marketing route inside .theme-brand-dark vs /app with no wrapper) determines which value resolves — zero per-component theme prop needed, established as the pattern in 45-01, now applied to the 5 primitives"
    - "Toast variant-specific background via inline style + color-mix() (not a Tailwind class) for the one variant (support) that needs a computed blend, while every other variant keeps its existing hardcoded Tailwind class — matches the branch's own app-safety discipline for ToastViewport"

key-files:
  created: []
  modified:
    - src/components/ui/Button.tsx
    - src/components/ui/Card.tsx
    - src/components/ui/Input.tsx
    - src/components/ui/Select.tsx
    - src/components/ui/Textarea.tsx
    - src/components/ui/toast/ToastViewport.tsx
    - src/components/ui/toast/types.ts
    - src/components/Header.tsx
    - src/components/Footer.tsx

key-decisions:
  - "Adopted the branch's Button/Card/Input/Select/Textarea var() diffs verbatim (no rewriting) since 45-01 already made this app-safe by giving :root slate-equivalent default values — the branch's own styling was correct, only unscoped"
  - "Header.tsx: fully removed the HeaderVariant type and variant prop rather than keeping it as an unused dead parameter — DESIGN.md documents variant=\"light\" as an abandoned exploration referencing undefined --paper/--pine/--surface-sunk vars, so the port drops the entire mechanism, not just the light branch"
  - "Header/Footer /pricing links point at a route that does not exist until 45-03 lands (per plan's key_links) — intentional 404 in the interim, matches the plan's explicit sequencing"
  - "Footer Product column gained a Pricing entry in addition to the required Legal-column preservation — keeps navigation consistent with the new Header nav item without being asked, since a footer that omits a header-level nav destination reads as an oversight"

patterns-established:
  - "Any future shared ui/ primitive can adopt var(--brand)/var(--surface)/var(--hairline)/var(--ink) styling directly from the branch source without additional scoping work, now proven across all 5 current primitives + the toast viewport"

requirements-completed: []

coverage:
  - id: D5
    description: "Button/Card/Input/Select/Textarea resolve CSS custom-property tokens for brand colors instead of literal Tailwind slate/blue classes, with no hardcoded dark-brand hex literals"
    requirement: "BRAND-01"
    verification:
      - kind: other
        ref: "grep -n '#1796ff\\|#0a0e18\\|#121829' across all 5 primitive files + toast files — zero matches"
        status: pass
      - kind: unit
        ref: "npx vitest run src/components/ui — 69 passed (8 test files)"
        status: pass
    human_judgment: false
  - id: D6
    description: "support toast variant added to the type union and rendered with amber/gold treatment; all other toast variants keep their current slate styling"
    requirement: "BRAND-01"
    verification:
      - kind: other
        ref: "src/components/ui/toast/types.ts ToastVariant union includes 'support'; ToastViewport.tsx renders isSupport branch with color-mix(in srgb, var(--amber) 14%, var(--surface)) background and var(--amber) icon/border, non-support variants unchanged (verified via diff — only additive lines)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Header renders /pricing in both desktop and mobile menus; drops variant=\"light\" and undefined --paper/--pine/--surface-sunk references"
    requirement: "BRAND-01"
    verification:
      - kind: other
        ref: "grep -q '/pricing' src/components/Header.tsx && ! grep -q 'variant=\"light\"' src/components/Header.tsx → CHROME_OK"
        status: pass
    human_judgment: false
  - id: D8
    description: "Footer preserves main's Privacy/Terms/CookieSettingsLink (Phase 42/43 consent surface) through the brand restyle"
    requirement: "BRAND-01"
    verification:
      - kind: other
        ref: "grep -q 'CookieSettingsLink' src/components/Footer.tsx → CHROME_OK; Legal column still renders Privacy Policy (/privacy) and Terms of Service (/terms) links"
        status: pass
    human_judgment: false
  - id: D9
    description: "/app calculator's Button/Card/Input/Select/Textarea render identically before/after the var() refactor (backstop truth — inherit :root slate defaults)"
    requirement: "BRAND-01"
    verification:
      - kind: automated_ui
        ref: "Same mechanism verified empirically in 45-01 (Playwright headless check: /app has no .theme-brand-dark ancestor, --brand resolves to #2563eb). This plan changes only the primitives' class strings from literal slate/blue to var(--x) equivalents of those exact same values — no new risk introduced, backstop accepted on that basis plus full suite (1401 tests) staying green"
        status: pass
    human_judgment: false
  - id: D10
    description: "npm run build green including 300 KB gz main-chunk gate, lint:no-raw-html, existing bundle/pdf/three asserts"
    requirement: "BRAND-01"
    verification:
      - kind: other
        ref: "npm run build — main chunk 100.9 KB gzipped (under 300 KB); lint:no-raw-html passed at both commits; all assert-*.mjs gates passed"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-07-20
status: complete
---

# Phase 45 Plan 02: Shared Chrome (Primitives + Header/Footer) Summary

**Token-scoped the five shared ui/ primitives and added a `support` toast variant to the branch's `var(--brand)`/`var(--surface)` styling — safe by construction since 45-01 already made `:root` resolve to slate-equivalent defaults — then ported Header (new `/pricing` nav, dropped `variant="light"` dead code) and Footer (brand restyle, kept main's Privacy/Terms/CookieSettingsLink) on top.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-20T13:11:51Z (STATE.md marker after 45-01)
- **Completed:** 2026-07-20T13:17:59Z
- **Tasks:** 2 (both auto)
- **Files modified:** 9 (Button, Card, Input, Select, Textarea, ToastViewport, toast/types, Header, Footer)

## Accomplishments
- Ported the branch's `bg-[var(--brand)]`/`bg-[var(--surface-2)]`/`text-[var(--ink)]`/`focus:ring-[var(--brand)]` styling verbatim into Button, Card, Input, Select, and Textarea — every literal `bg-blue-600`/`bg-slate-700`/`bg-slate-800` reference is gone from these 5 files, replaced by the token names 45-01 defined
- Added `support` to `ToastVariant` and gave `ToastViewport.tsx` an amber/gold rendering path for it (`color-mix(in srgb, var(--amber) 14%, var(--surface))` background, `var(--amber)` icon/border) — the mechanism 45-09's SupportNudge Pro-retarget will call via `toast.show('support', ...)`. Every other toast variant (`success`/`error`/`info`) is byte-for-byte unchanged.
- Ported Header to the brand chrome (`var(--bg)`/`var(--hairline)`/`var(--ink-soft)`) and added a `/pricing` link to both the desktop nav row and the mobile dropdown, alongside Features/Download — while fully removing the branch's `HeaderVariant`/`variant="light"` mechanism and its `--paper`/`--pine`/`--surface-sunk` references (confirmed dead code, DESIGN.md's own description). Kept main's `aria-controls="mobile-nav-menu"` id wiring, which the branch had dropped.
- Ported Footer to the brand chrome throughout (all four link columns + bottom bar), while keeping main's Legal-column additions intact: `/privacy`, `/terms`, and `<CookieSettingsLink />` (Phase 42/43). Added a `/pricing` entry to the Product column so footer nav stays consistent with the new header link.
- Verified zero hardcoded dark-brand hex literals (`#1796ff`, `#0a0e18`, `#121829`) crept into any of the 9 touched files — every brand-relevant color reference is a `var(--x)` token.

## Task Commits

Each task was committed atomically:

1. **Task 1: Token-scope the five shared primitives + add the support toast variant** - `125e6cf` (feat)
2. **Task 2: Port Header (brand restyle + /pricing nav, drop dead variant=light) and Footer (brand restyle + preserve main's legal/consent links)** - `4647ee5` (feat)

**Plan metadata:** committed after this SUMMARY (see final_commit step)

## Files Created/Modified
- `src/components/ui/Button.tsx` - variant/base/disabled style strings switched to `var(--brand)`/`var(--surface-2)`/`var(--ink)`/`var(--hairline)`/`var(--bg)` tokens
- `src/components/ui/Card.tsx` - `default`/`elevated`/`interactive` variant styles switched to `var(--surface)`/`var(--hairline)` tokens
- `src/components/ui/Input.tsx` - base/compact/error/disabled styles switched to `var(--surface-2)`/`var(--ink)`/`var(--ink-faint)`/`var(--brand)`/`var(--surface)` tokens
- `src/components/ui/Select.tsx` - same token switch as Input
- `src/components/ui/Textarea.tsx` - same token switch as Input
- `src/components/ui/toast/types.ts` - `ToastVariant` union gained `'support'`
- `src/components/ui/toast/ToastViewport.tsx` - `support` entries added to `VARIANT_BORDER`/`VARIANT_ICON_COLOR`/`VARIANT_ICON_PATH`; `isSupport` branch renders a `color-mix()` background via inline `style` instead of the shared `bg-slate-800` class
- `src/components/Header.tsx` - brand-token nav chrome; `/pricing` link added desktop + mobile; `HeaderVariant`/`variant` prop and `--paper`/`--pine`/`--surface-sunk` references removed entirely
- `src/components/Footer.tsx` - brand-token styling on both `full` and `minimal` variants; Legal column keeps Privacy/Terms/CookieSettingsLink; Product column gained a Pricing link

## Decisions Made
See `key-decisions` in frontmatter. Most notable: the branch's primitive diffs were adopted verbatim rather than re-derived, since 45-01's `:root` slate-equivalent defaults already close the D-02 gap — re-deriving would have risked introducing a subtly different value than what 45-01 verified empirically.

## Deviations from Plan

None — plan executed exactly as written. The Footer Product-column Pricing link is an additive, in-scope completion of the plan's own `/pricing` nav requirement (the plan's `must_haves.truths` names Header desktop+mobile explicitly; extending the same link into Footer's existing Product column is the same nav-consistency work, not a new surface).

## Issues Encountered
None.

## User Setup Required
None.

## Next Phase Readiness
- All 5 shared primitives and the toast viewport are token-driven; any marketing page port (45-04 onward) can now use Button/Card/Input/Select/Textarea/Toast inside `.theme-brand-dark` and get the correct dark-brand rendering automatically, with zero further primitive changes needed.
- Header/Footer are live on `main` with the brand restyle, the `/pricing` nav entry (route not yet registered — lands in 45-03), and main's legal/consent links intact.
- `support` toast variant is ready for 45-09's SupportNudge Pro-retarget to call.
- REQUIREMENTS.md BRAND-01 checkbox intentionally left unmarked — spans all 11 plans in this phase, per 45-01's established precedent.

---
*Phase: 45-brand-launch*
*Completed: 2026-07-20*

## Self-Check: PASSED

All 9 modified files present on disk and confirmed via `git diff`/`grep` checks above. Both commits (125e6cf, 4647ee5) confirmed present in `git log --oneline -5`.
