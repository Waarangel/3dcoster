---
phase: 46-white-label-quotes
plan: 12
subsystem: routing
tags: [vercel, react-router, vitest, hosted-quotes, gap-closure]

# Dependency graph
requires:
  - phase: 43-pro-backend
    provides: api/q/[token].ts serverless hosted-quote function + its D-16 indistinguishable-404 contract
provides:
  - "/q/:token -> /api/q/:token Vercel rewrite so a published hosted-quote link reaches the serverless function instead of a platform 404"
  - "Regression test (tests/routing/vercel-rewrites.test.ts) guarding the rewrite AND the SPA catch-all's q/+api/ exclusion"
  - "src/pages/NotFoundPage.tsx: themed catch-all for any unmatched web location, wired into main.tsx"
  - "Launch-day checklist item 12 recording the deferred /q rewrite preview-deploy verification"
affects: [51-launch-prep-redux]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "vercel.json rewrites are order-sensitive but non-conflicting here: the /q/:token mapping sits before the SPA catch-all, whose negative-lookahead already excludes q/ and api/"
    - "NotFound-style pages inject/remove their own meta element instance per effect run (create-and-remove pairing) rather than querySelector-based dedup, which is StrictMode-safe by construction"

key-files:
  created:
    - tests/routing/vercel-rewrites.test.ts
    - src/pages/NotFoundPage.tsx
    - src/pages/NotFoundPage.test.tsx
  modified:
    - vercel.json
    - src/main.tsx
    - docs/PRO-SECURITY-REVIEW.md

key-decisions:
  - "vercel.json: added the /q/:token rewrite as the FIRST entry (before the SPA catch-all) per the plan's key_links — non-conflicting since the SPA source's negative-lookahead already excludes q/ and api/"
  - "NotFoundPage's noindex meta effect creates and removes its own element instance per run instead of querySelector-based existence checking, which trivially satisfies the StrictMode double-invoke no-duplicates requirement without extra bookkeeping"
  - "NotFoundPage.test.tsx follows the project's existing createRoot+act harness (no @testing-library/react in this repo, matching TermsPage.test.tsx/ScrollToTop.test.tsx precedent) rather than introducing RTL for one file"

patterns-established: []

requirements-completed: [D-12, D-13]

coverage:
  - id: D1
    description: "vercel.json routes /q/:token to /api/q/:token (the LATENT PRODUCTION BUG from the debug session) with a regression test proving the rewrite exists and the SPA catch-all still excludes q/ and api/"
    requirement: D-12
    verification:
      - kind: unit
        ref: "tests/routing/vercel-rewrites.test.ts#vercel.json rewrites"
        status: pass
    human_judgment: false
  - id: D2
    description: "Any unmatched web (non-Tauri) location renders a friendly, themed NotFound page (Header/Footer, home link, noindex meta) instead of a blank page; Tauri catch-all untouched"
    requirement: D-13
    verification:
      - kind: unit
        ref: "src/pages/NotFoundPage.test.tsx#NotFoundPage"
        status: pass
      - kind: other
        ref: "node scripts/lint-no-raw-html.mjs"
        status: pass
    human_judgment: false
  - id: D3
    description: "The deferred /q rewrite preview-deploy verification is recorded as launch-day checklist item 12 in docs/PRO-SECURITY-REVIEW.md Part 5, cross-referencing 43-VALIDATION.md:87 and item 7; no deploy performed"
    verification:
      - kind: other
        ref: "grep -q '12. /q rewrite preview-deploy verification' docs/PRO-SECURITY-REVIEW.md"
        status: pass
    human_judgment: false

# Metrics
duration: 12min
completed: 2026-07-23
status: complete
---

# Phase 46 Plan 12: /q Rewrite + Web NotFound Catch-All Summary

**Closed the two real defects behind UAT gap G-46-18 (hosted-quote link opens blank): a missing `/q/:token → /api/q/:token` Vercel rewrite (would have 404'd after the v2.0 deploy) and no web-side `path="*"` catch-all in React Router (rendered `null` on any unmatched location).**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-23T19:04:00Z
- **Completed:** 2026-07-23T19:16:00Z
- **Tasks:** 3
- **Files modified:** 6 (3 created, 3 modified)

## Accomplishments
- `vercel.json` now maps `/q/:token` to `/api/q/:token`, closing the latent production bug the debug session found: `api/q/[token].ts` previously answered only at `/api/q/{token}`, so `GET /q/{token}` would have hit a Vercel platform 404 (neither the SPA shell nor the D-16 branded 404) after the v2.0 deploy.
- `tests/routing/vercel-rewrites.test.ts` is a permanent regression guard on this config: it proves the rewrite exists AND that the SPA catch-all's negative-lookahead still excludes both `q/` and `api/` — the exact failure mode this gap-closure exists to prevent from recurring.
- `src/pages/NotFoundPage.tsx` gives the web router a friendly, themed catch-all (Header/Footer, brand tokens, a home `Link`, a mount-scoped `noindex` robots meta) — wired as the final route inside `MarketingLayout` in `src/main.tsx`. Any unmatched web location now renders this page instead of `null`. The Tauri branch's existing `Navigate('/')` catch-all was left byte-for-byte unchanged.
- `docs/PRO-SECURITY-REVIEW.md` Part 5 gained item 12, recording the deferred real-HTTP preview-deploy verification of the new rewrite (200 for a published token; byte-identical D-16 branded 404s for unpublished/expired/random-UUID tokens) as a launch-day-only check — cross-referenced to the original deferred item at `.planning/phases/43-pro-backend/43-VALIDATION.md:87` and to Part 5's existing item 7.

## Task Commits

Each task was committed atomically:

1. **Task 1: Map /q/:token to the hosted-quote function + routing test** - `5c16f7e` (feat)
2. **Task 2a: Failing test for NotFoundPage catch-all (RED)** - `3e8a0b7` (test)
2. **Task 2b: NotFoundPage + main.tsx wiring (GREEN)** - `5740aca` (feat)
3. **Task 3: Launch-day checklist item 12** - `245db01` (docs)

**Plan metadata:** (this commit, appended after SUMMARY)

_Task 2 used TDD (tdd="true" in the plan): RED confirmed (import failure) before NotFoundPage.tsx existed, then GREEN. No REFACTOR commit needed — the GREEN implementation was already clean._

## Files Created/Modified
- `vercel.json` - added `{ "source": "/q/:token", "destination": "/api/q/:token" }` as the first rewrite entry, ahead of the existing SPA catch-all
- `tests/routing/vercel-rewrites.test.ts` - node-environment vitest test asserting the new rewrite and the SPA exclusion of `q/`/`api/`
- `src/pages/NotFoundPage.tsx` - themed catch-all page (Header/Footer, home link, noindex meta)
- `src/pages/NotFoundPage.test.tsx` - 5 tests: heading/copy, home link, noindex meta add/remove, StrictMode double-invoke idempotency, catch-all resolution inside a MarketingLayout-equivalent route tree
- `src/main.tsx` - lazy-imports `NotFoundPage` via the existing `lazyWithRetry` pattern; adds `<Route path="*" element={<NotFoundPage />} />` as the last child inside the web `MarketingLayout` route block
- `docs/PRO-SECURITY-REVIEW.md` - Part 5 launch-day checklist gains item 12

## Decisions Made
- vercel.json rewrite ordering: `/q/:token` placed FIRST, ahead of the SPA catch-all, per the plan's `key_links` guidance — confirmed non-conflicting since the SPA source's negative-lookahead already excludes `q/` (and `api/`).
- NotFoundPage's noindex-meta effect uses a create-your-own/remove-your-own element pattern per effect run rather than a querySelector existence check — this is simpler and inherently StrictMode-safe (each run's cleanup removes exactly the element that run added, before the next run adds its own), verified directly by a dedicated double-invoke test.
- NotFoundPage.test.tsx follows this repo's established `createRoot`+`act` component-mount test harness (no `@testing-library/react` dependency exists in this project — see `TermsPage.test.tsx`/`ScrollToTop.test.tsx`) rather than introducing a new test library for one file.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. Launch-day item 12 is a documentation-only checklist entry; the actual preview-deploy `curl` verification happens at launch time, not in this session.

## Next Phase Readiness

- G-46-18 is closed: `vercel.json` correctly routes published hosted-quote links to the serverless function once deployed, and any unmatched web location renders a friendly page instead of a blank one — both provable now via automated tests, not just code inspection.
- Full test suite (1514 passed / 4 skipped / 1 todo across 135 files) is green after the `main.tsx` routing change; `tsc -b` and `lint:no-raw-html` are clean.
- Launch-day checklist (`docs/PRO-SECURITY-REVIEW.md` Part 5) now has 13 items (0-12); item 12 must be executed on the first real Vercel preview deploy, before item 7's broader `/q/*` curl matrix is considered complete.
- No blockers for Phase 51 (Launch-prep redux), which will execute the full Part 5 checklist including this new item.

---
*Phase: 46-white-label-quotes*
*Completed: 2026-07-23*

## Self-Check: PASSED

All 7 files and 4 task commit hashes verified present on disk / in git log.
