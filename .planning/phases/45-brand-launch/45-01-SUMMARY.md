---
phase: 45-brand-launch
plan: 01
subsystem: ui
tags: [css-custom-properties, design-tokens, react-router, motion, fontsource, vite-chunking]

# Dependency graph
requires:
  - phase: 43-pro-backend
    provides: Pro pricing constants (BillingPanel.tsx) this phase's later plans will surface on marketing pages
provides:
  - Cost-Truth Dark CSS custom-property token layer (src/index.css) with slate-equivalent :root defaults and a .theme-brand-dark override block
  - MarketingThemeScope component (theme wrapper + document.body route-marketing marker)
  - Self-hosted Bricolage Grotesque display font (no Google Fonts, no CSP change)
  - Reveal / CostReveal motion primitives ported from the design branch
  - motion-vendor Rollup chunk isolation
  - MarketingLayout route wiring in main.tsx (marketing routes only, /app and Tauri untouched)
affects: [45-02, 45-03, 45-04, 45-05, 45-06, 45-07, 45-08, 45-09, 45-10, 45-11]

# Tech tracking
tech-stack:
  added: ["motion@^12.42.2", "@fontsource/bricolage-grotesque@^5.3.0"]
  patterns:
    - "CSS custom-property cascade scoping: :root slate-equivalent defaults + .theme-brand-dark override class, applied only via a wrapper component around marketing routes (never around /app)"
    - "React Router layout route (<Route element={<MarketingLayout/>}>...</Route>) as the single mount point for MarketingThemeScope, keeping it stable across marketing→marketing navigation"
    - "document.body class marker (route-marketing) as the bridge signal for out-of-React-tree DOM (vanilla-cookieconsent's #cc-main), consumed by a later plan (45-08)"

key-files:
  created:
    - src/components/marketing/MarketingThemeScope.tsx
    - src/components/motion/Reveal.tsx
    - src/components/landing/CostReveal.tsx
  modified:
    - src/index.css
    - src/main.tsx
    - vite.config.ts
    - package.json
    - package-lock.json

key-decisions:
  - "Slate-equivalent :root defaults chosen to reproduce Button.tsx/Card.tsx/Input.tsx's exact current Tailwind literal values (bg-blue-600/700, slate-800/700/900) — verified empirically via a headless Playwright check, not just visual inspection"
  - "--font-display and its .font-display utility class are NOT duplicated inside .theme-brand-dark (not in the plan's per-scope token list) — defined once at :root since font family isn't a marketing/app distinction"
  - "Self-hosted only the latin subset (not latin-ext/vietnamese) of Bricolage Grotesque weights 600/700/800 — the exact weights docs/DESIGN.md specifies, smallest asset footprint"
  - "React Router layout route (not per-page wrapping) chosen for MarketingThemeScope mount point, per 45-RESEARCH Open Question 1 recommendation — keeps the route-marketing body marker stable across marketing nav"
  - "requirements-completed left empty this plan despite BRAND-01 appearing in this plan's frontmatter — BRAND-01 is a single phase-spanning requirement referenced identically by all 11 plans in this phase; marking it complete after plan 1/11 would misrepresent REQUIREMENTS.md state. Left for the phase's final plan/orchestrator step to mark complete once the full port lands."

patterns-established:
  - "Pattern: any future shared ui/ primitive (Button, Card, Input, Select, Textarea) that adopts var(--brand)/var(--surface) styling is automatically /app-safe as long as it is never rendered inside .theme-brand-dark — no per-component theme prop needed"

requirements-completed: []

coverage:
  - id: D1
    description: "Brand-dark CSS token layer with slate-equivalent :root defaults so /app is visually unaffected"
    requirement: "BRAND-01"
    verification:
      - kind: automated_ui
        ref: "Playwright headless check: /app route has no .theme-brand-dark element in DOM and --brand resolves to #2563eb; marketing route (/) has .theme-brand-dark present with --brand resolving to #1796ff"
        status: pass
      - kind: unit
        ref: "npx vitest run (1401 passed, 4 skipped, 1 todo) — full existing suite unaffected"
        status: pass
    human_judgment: false
  - id: D2
    description: "Self-hosted Bricolage Grotesque font, zero Google Fonts / CSP change"
    requirement: "BRAND-01"
    verification:
      - kind: other
        ref: "grep -c 'fonts.googleapis.com' index.html → 0 matches; git diff vercel.json → empty (unchanged)"
        status: pass
    human_judgment: false
  - id: D3
    description: "motion + @fontsource/bricolage-grotesque installed after founder package-legitimacy approval, no other dependency added"
    requirement: "BRAND-01"
    verification:
      - kind: other
        ref: "git diff package.json (Task 1 commit aa96eed) shows exactly 2 additions"
        status: pass
    human_judgment: false
  - id: D4
    description: "npm run build green including 300 KB gz main-chunk gate, tsc -b, lint:no-raw-html, existing bundle-size/pdf/three asserts"
    requirement: "BRAND-01"
    verification:
      - kind: other
        ref: "npm run build — main chunk 100.7 KB gzipped (under 300 KB); all assert-*.mjs gates passed"
        status: pass
    human_judgment: false

duration: 40min
completed: 2026-07-20
status: complete
---

# Phase 45 Plan 01: Cost-Truth Dark Foundation Summary

**CSS custom-property cascade-scoping layer (slate-equivalent :root defaults + .theme-brand-dark override), self-hosted Bricolage Grotesque font, motion primitives, and a React Router layout route that mounts MarketingThemeScope around marketing routes only — /app calculator confirmed byte-for-byte unchanged.**

## Performance

- **Duration:** 40 min
- **Started:** 2026-07-20T12:29:52Z
- **Completed:** 2026-07-20T13:10:07Z
- **Tasks:** 3 (1 checkpoint:human-verify + 2 auto)
- **Files modified:** 6 (package.json, package-lock.json, src/index.css, vite.config.ts, src/main.tsx) + 3 created (MarketingThemeScope.tsx, Reveal.tsx, CostReveal.tsx)

## Accomplishments
- Installed `motion@^12.42.2` and `@fontsource/bricolage-grotesque@^5.3.0` after the founder approved the blocking package-legitimacy checkpoint (both flagged `SUS`/`too-new` by the automated seam, both confirmed legitimate via research: 16M/wk and 41K/wk downloads, official GitHub orgs)
- Built the Cost-Truth Dark token layer in `src/index.css`: a `:root` block with slate-equivalent defaults that reproduce the current `/app` palette exactly, and a `.theme-brand-dark` override block with the design branch's actual dark-brand values — the single cascade-scoping mechanism every later marketing page port depends on
- Self-hosted Bricolage Grotesque (latin subset, weights 600/700/800 only) via `@fontsource` — zero runtime request to Google Fonts, `vercel.json` CSP untouched
- Created `MarketingThemeScope`, which renders the `.theme-brand-dark` wrapper and toggles a `route-marketing` marker on `document.body` (mount/cleanup effect) — the signal a later plan (45-08) needs to brand-theme the out-of-React-tree cookie-consent banner
- Ported `Reveal.tsx` and `CostReveal.tsx` motion primitives unchanged from `test/design-skills-experiment`
- Wired a `motion-vendor` Rollup chunk in `vite.config.ts`, mirroring the existing jsPDF/three chunk-isolation discipline
- Mounted `MarketingThemeScope` via a React Router layout route wrapping all 9 marketing routes; `/app` and the desktop `__IS_TAURI__` branch remain siblings outside it
- **Verified empirically** (not just by code inspection) via a headless Playwright script: on `/`, `.theme-brand-dark` is present and `--brand` computes to `#1796ff`; on `/app`, no `.theme-brand-dark` element exists anywhere in the DOM and `--brand` computes to `#2563eb` (the slate-equivalent default) — confirming the D-02 boundary holds

## Task Commits

Each task was committed atomically:

1. **Task 1: Package legitimacy checkpoint + install motion + @fontsource/bricolage-grotesque** - `aa96eed` (chore) — paused at the blocking-human checkpoint, resumed after founder typed "approved"
2. **Task 2: Brand token layer + self-hosted font + MarketingThemeScope** - `4c73c25` (feat)
3. **Task 3: Port motion primitives + motion-vendor chunk + mount MarketingThemeScope** - `fe9d514` (feat)

**Plan metadata:** committed after this SUMMARY (see final_commit step)

## Files Created/Modified
- `src/index.css` - Cost-Truth Dark token set (14 custom properties) defined twice: slate-equivalent `:root` defaults + `.theme-brand-dark` override; self-hosted font `@import`s; `.font-display` utility class
- `src/components/marketing/MarketingThemeScope.tsx` - New. Renders `.theme-brand-dark` wrapper + toggles `document.body.classList` `route-marketing` marker on mount/unmount
- `src/components/motion/Reveal.tsx` - New. Scroll/mount reveal animation primitive (ported unchanged from branch)
- `src/components/landing/CostReveal.tsx` - New. Animated hero cost-breakdown card (ported unchanged from branch)
- `vite.config.ts` - Added `motion-vendor` manualChunks routing (mirrors existing pdf/three chunk isolation)
- `src/main.tsx` - New `MarketingLayout` layout-route component; `/app` route moved to be a sibling of the marketing route group instead of interleaved with it; all 9 marketing routes now nest under `<Route element={<MarketingLayout />}>`
- `package.json` / `package-lock.json` - Added `motion` and `@fontsource/bricolage-grotesque` runtime dependencies (no other dependency touched)

## Decisions Made
- See `key-decisions` in frontmatter. Most notable: slate-equivalent token values were verified against a live render (Playwright computed-style check), not just derived from reading Button/Card/Input source — this catches any drift the research's manual value mapping might have missed. None was found.
- `requirements-completed` deliberately left empty and `requirements mark-complete BRAND-01` was NOT called this plan — see key-decisions rationale. This is a foundation plan; BRAND-01 (the full redesign port + pricing spots) isn't satisfied until later plans in this 11-plan phase land.

## Deviations from Plan

None - plan executed exactly as written. The plan's `must_haves.truths` D-02 backstop truth (marked `verification: backstop` since no automated visual-regression harness exists in this repo) was upgraded from "manual/accept as unverified" to an actual automated headless-browser check during this plan's execution — a strictly stronger verification than the plan required, not a deviation from it.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The token-scoping foundation, self-hosted font, motion primitives, and route-scoped theme mount are all live on `main` and verified not to affect `/app`.
- 45-02 through 45-11 (page ports, `/pricing` page, legal-surface restyle, SupportNudge retarget, docs, release prep, launch-comms) can now safely apply `.theme-brand-dark`-scoped styling and reference `Reveal`/`CostReveal`/`MarketingThemeScope` without re-solving D-02.
- REQUIREMENTS.md BRAND-01 checkbox intentionally left unchecked — the final plan to land in this phase (or a phase-completion step) should call `requirements mark-complete BRAND-01` once the whole redesign + pricing-spot port is done.

---
*Phase: 45-brand-launch*
*Completed: 2026-07-20*

## Self-Check: PASSED

All created/modified files present on disk (src/index.css, src/components/marketing/MarketingThemeScope.tsx, src/components/motion/Reveal.tsx, src/components/landing/CostReveal.tsx, vite.config.ts, src/main.tsx). All 4 commits (aa96eed, 4c73c25, fe9d514, 50e65a1) confirmed present in `git log --oneline --all`.
