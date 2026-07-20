---
phase: 45-brand-launch
plan: 06
subsystem: ui
tags: [react, tailwind, css-custom-properties, marketing-pages, accessibility, url-security]

# Dependency graph
requires:
  - phase: 45-brand-launch
    plan: "01"
    provides: Cost-Truth Dark CSS custom-property token layer (src/index.css), MarketingThemeScope, Reveal motion primitive
  - phase: 45-brand-launch
    plan: "02"
    provides: Token-driven Header/Footer and shared ui/ primitives (var(--brand)/var(--surface)/var(--ink) etc.)
provides:
  - Restyled DownloadPage (Cost-Truth Dark visual treatment) with main's exact Linux download logic preserved verbatim (asset-detection regex, isSafeHttpUrl gating, ChromeOS/Android detectPlatform exclusions, v1.9.0 fallback version)
  - Restyled FAQPage (search + scroll-spy browse mode from the branch) carrying main's full 21-entry current Q&A content, including the 3 Linux troubleshooting entries and the GDPR-aware/14-day-badge copy
affects: [45-07, 45-08, 45-09, 45-10, 45-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Content-merge port pattern for pages that diverged on both branches after a shared merge-base: adopt the branch's JSX/visual structure wholesale, but re-derive any logic-bearing or content-bearing block (URL construction, Q&A arrays) from main's current file line-by-line rather than trusting the branch's independently-evolved version of the same concern"
    - "Drop any branch-only CSS class dependency (e.g. .hero-aura) that a prior foundation plan didn't port into src/index.css, rather than reintroducing an undefined class reference — kept both pages' hero sections working with zero CSS additions, which stayed out of this plan's files_modified scope"

key-files:
  created: []
  modified:
    - src/pages/DownloadPage.tsx
    - src/pages/FAQPage.tsx

key-decisions:
  - "DownloadPage: used main's exact detectPlatform/fetchLatestRelease/fallbackUrls logic verbatim (including the ChromeOS 'cros' exclusion the branch's independent Linux implementation never added, and main's v1.9.0 fallback version instead of the branch's stale v1.0.0) — the branch's unified `platforms`-array visual layout was kept as the container, but every value it renders is main's, not the branch's own independently-computed Linux fields"
  - "DownloadPage: used main's actual Tux SVG icon (the detailed brand-recognizable path) instead of the branch's simplified placeholder Linux icon path — a like-for-like icon swap, not a logic change, done to preserve visual quality already shipped in production"
  - "DownloadPage: re-added the Linux 'make the AppImage executable before running' troubleshooting note that the branch's rewrite had dropped, alongside the macOS Gatekeeper note both versions already carried — this note is referenced by FAQPage's Linux AppImage Q&A, so dropping it would have orphaned that cross-reference"
  - "FAQPage: treated as a pure content merge — main's current 21-entry Q&A array (including the 3 Linux troubleshooting entries, the GDPR-aware 'is it free/is my data collected' wording, and the 14-day/36-hour NEW-badge copy) was substituted wholesale for the branch's stale 18-entry array ('no data collection', '3-day' badge, zero Linux entries); every other part of the branch's FAQPage component (search box, scroll-spy category rail, FaqRow accordion) was ported unchanged"
  - "Both pages: dropped the branch's `.hero-aura` decorative background div rather than referencing an undefined CSS class — 45-01's SUMMARY explicitly lists what it ported into src/index.css and .hero-aura isn't in that list; adding it would have been an index.css edit outside this plan's files_modified scope (src/pages/DownloadPage.tsx, src/pages/FAQPage.tsx only)"
  - "Both pages: added aria-labelledby to each <section> and aria-hidden=\"true\" to every decorative SVG (beyond the plan's literal must_haves grep bar of just `<main`), matching main's Phase 37 a11y hardening pattern used on LandingPage/FeaturesPage even though DownloadPage's specific Phase 37 diff (commit 499155f) only added a bare <main> wrapper with no aria-labelledby sections — a stronger, not weaker, a11y bar than what the plan's automated verify checks for"

patterns-established: []

requirements-completed: []

coverage:
  - id: D11
    description: "DownloadPage uses main's isSafeHttpUrl-gated URL construction and main's detectPlatform (with ChromeOS 'cros' exclusion), not the branch's independently-written Linux implementation, inside the branch's restyled three-platform card layout"
    requirement: "BRAND-01"
    verification:
      - kind: other
        ref: "grep -q isSafeHttpUrl src/pages/DownloadPage.tsx && grep -q '<main' src/pages/DownloadPage.tsx → DOWNLOAD_OK; manual diff against src/pages/DownloadPage.tsx@main confirmed fallbackVersion=1.9.0 and the cros exclusion are both present verbatim"
        status: pass
      - kind: unit
        ref: "npx vitest run — 1404 passed, 4 skipped, 1 todo (full existing suite unaffected)"
        status: pass
    human_judgment: false
  - id: D12
    description: "DownloadPage retains a <main> landmark and gained aria-labelledby/aria-hidden hardening consistent with main's Phase 37 pattern; all 6 download targets (Windows, macOS Silicon/Intel, Linux AppImage/deb/rpm) still offered with the Gatekeeper note and the re-added Linux executable-bit note"
    requirement: "BRAND-01"
    verification:
      - kind: other
        ref: "npm run build (green, main chunk 101.0 KB gz); npx tsc -b (clean); npm run lint:no-raw-html (passed)"
        status: pass
    human_judgment: false
  - id: D13
    description: "FAQPage carries main's current 21-entry Q&A array (3 Linux troubleshooting entries, GDPR-aware wording, 14-day/36-hour badge copy) inside the branch's search + scroll-spy browse-mode UI; stale branch copy ('no data collection', '3-day') is fully purged"
    requirement: "BRAND-01"
    verification:
      - kind: other
        ref: "grep -qi linux src/pages/FAQPage.tsx && ! grep -qi 'no data collection' src/pages/FAQPage.tsx && ! grep -q '3-day' src/pages/FAQPage.tsx → FAQ_OK; grep -q '<main' src/pages/FAQPage.tsx → MAIN_OK"
        status: pass
      - kind: unit
        ref: "npx vitest run — same full-suite pass as D11 (single test run covers both files)"
        status: pass
    human_judgment: false
  - id: D14
    description: "npm run build green including 300 KB gz main-chunk gate, tsc -b, lint:no-raw-html"
    requirement: "BRAND-01"
    verification:
      - kind: other
        ref: "npm run build — main chunk 101.0 KB gzipped (under 300 KB); npx tsc -b clean; lint:no-raw-html passed at both commits"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-07-20
status: complete
---

# Phase 45 Plan 06: DownloadPage + FAQPage Content Reconciliation Summary

**Restyled DownloadPage (branch's three-platform card layout + main's exact isSafeHttpUrl-gated Linux download logic, v1.9.0 fallback, ChromeOS exclusion) and FAQPage (branch's search/scroll-spy UI + main's full current 21-entry Q&A content including 3 Linux troubleshooting entries and GDPR-aware/14-day-badge copy) — the phase's highest content-reconciliation-risk plan, resolving two independently-diverged Linux implementations without regressing either page.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-20T13:55:00Z
- **Completed:** 2026-07-20T14:17:36Z
- **Tasks:** 2 (both auto)
- **Files modified:** 2 (src/pages/DownloadPage.tsx, src/pages/FAQPage.tsx)

## Accomplishments
- Ported DownloadPage to the branch's Cost-Truth Dark visual treatment (Reveal-driven hero, unified three-platform card grid with a "Recommended for you" badge, editorial "Why use the desktop app?" ruled list) while re-deriving all download logic from main's current file line-by-line: `detectPlatform`'s ChromeOS/Android exclusions, the GitHub-release asset-detection regex, `isSafeHttpUrl` wrapping every constructed URL, and the `v1.9.0` fallback version (not the branch's stale `v1.0.0`)
- Re-added the Linux "make the AppImage executable before running" troubleshooting note the branch's rewrite had silently dropped, alongside the macOS Gatekeeper note both versions carried — both link to `/faq`, which now has the matching Linux Q&As
- Ported FAQPage as a content merge: kept main's complete current 21-entry Q&A array (3 Linux troubleshooting entries, GDPR-aware "is it free/is my data collected" wording referencing the Privacy Policy, and 14-day/36-hour NEW-badge copy) inside the branch's search-with-live-filtering + sticky scroll-spy category rail UI, purging the branch's stale array entirely ("no data collection", "3-day" badge, zero Linux entries)
- Hardened both pages' accessibility beyond the plan's literal automated-verify bar: added `aria-labelledby` on every `<section>` and `aria-hidden="true"` on every decorative SVG, matching the spirit of main's Phase 37 a11y pass even where that specific commit's DownloadPage diff only added a bare `<main>` wrapper
- Verified zero regressions: full `npx vitest run` (1404 passed / 4 skipped / 1 todo), clean `npx tsc -b`, passing `lint:no-raw-html`, and `npm run build` green with the main chunk still 101.0 KB gzipped (under the 300 KB gate)

## Task Commits

Each task was committed atomically:

1. **Task 1: Port DownloadPage — branch layout, main's exact Linux logic + isSafeHttpUrl + a11y** - `7c399cb` (feat)
2. **Task 2: Port FAQPage — branch visual treatment over main's current content** - `07c0701` (feat)

**Plan metadata:** committed after this SUMMARY (see final_commit step)

## Files Created/Modified
- `src/pages/DownloadPage.tsx` - Full rewrite: branch's three-platform card layout (Reveal motion, unified `CARDS` array, editorial "Why desktop" section) over main's exact Linux/URL-security/version logic; `<main>` landmark + `aria-labelledby`/`aria-hidden` hardening added
- `src/pages/FAQPage.tsx` - Full rewrite: branch's search + scroll-spy browse-mode component (`FaqRow`, `SECTIONS`, `IntersectionObserver` scroll-spy) with main's current 21-entry `faqs` array substituted in place of the branch's stale array; `<main>` landmark retained, `aria-labelledby` added per section

## Decisions Made
See `key-decisions` in frontmatter. Most notable: the DownloadPage a11y hardening (aria-labelledby/aria-hidden) goes beyond what main's actual Phase 37 diff added to this specific file (a bare `<main>` wrapper only) — a deliberate strengthening in the direction the plan's `must_haves.truths` D-02 backstop asked for, not a deviation that removes anything.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Dropped the branch's undefined `.hero-aura` CSS class reference on both pages**
- **Found during:** Task 1 (DownloadPage hero section) and Task 2 (FAQPage hero section)
- **Issue:** Both the branch's DownloadPage and FAQPage hero sections render a decorative `<div className="hero-aura" ...>`. Grepping the current `src/index.css` (as landed by 45-01) confirmed `.hero-aura` was never ported — 45-01's SUMMARY explicitly lists the CSS it added (14 custom properties, `.font-display` utility, self-hosted font imports) and `.hero-aura` isn't among them. Porting the branch's JSX as-is would ship a dead class reference (silently no-op, but dead code) on two pages.
- **Fix:** Omitted the `.hero-aura` div from both pages' hero sections rather than adding the missing CSS rule, since `src/index.css` is outside this plan's `files_modified` scope (`src/pages/DownloadPage.tsx`, `src/pages/FAQPage.tsx` only) and a cross-file CSS addition belongs to whichever later plan actually needs the effect.
- **Files modified:** src/pages/DownloadPage.tsx, src/pages/FAQPage.tsx (both already in scope)
- **Verification:** `npm run build` green on both commits; no `hero-aura` string remains in either file
- **Committed in:** 7c399cb (Task 1), 07c0701 (Task 2)

---

**Total deviations:** 1 auto-fixed (1 blocking — undefined CSS class reference)
**Impact on plan:** Purely a dead-code omission scoped to files already in-plan; no visual regression (the branch's own hero-aura effect was already a subtle radial gradient behind the heading, not a load-bearing layout element). No scope creep — did not touch `src/index.css`.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Both `/download` and `/faq` are live on `main` in the Cost-Truth Dark brand skin with zero content or logic regression versus the pre-port `main` versions.
- The reconciliation pattern used here (branch's JSX structure + main's logic/content re-derived line-by-line) is now a proven precedent for any remaining page in this phase that has a similar independent-divergence risk.
- REQUIREMENTS.md `BRAND-01` checkbox intentionally left unmarked — spans all 11 plans in this phase, per 45-01's established precedent; the phase's final plan (or orchestrator step) should call `requirements mark-complete BRAND-01` once the whole port lands.

---
*Phase: 45-brand-launch*
*Completed: 2026-07-20*

## Self-Check: PASSED

Both modified files present on disk (src/pages/DownloadPage.tsx, src/pages/FAQPage.tsx). Both commits (7c399cb, 07c0701) confirmed present in `git log --oneline --all`.
