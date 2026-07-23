---
phase: 46-white-label-quotes
plan: 11
subsystem: ui
tags: [clipboard, toast, react, hosted-quotes, pro, gap-closure]

# Dependency graph
requires:
  - phase: 43-pro-backend
    provides: usePublishedQuote hook writing quote.publishedUrl/hostedToken (43-04)
provides:
  - "copyToClipboard() truthful clipboard write helper (never throws, honest boolean)"
  - "HostedLinkActions component — persistent Copy-link + Open-hosted-page affordance for a published quote"
  - "LinkIcon + ExternalLinkIcon UI icons"
  - "Honest publish toast in ShareQuoteButton (no more false 'copied' claim on desktop)"
affects: [white-label-quotes, pro-backend, uat]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Truthful async boundary wrapper: copyToClipboard() guards navigator/clipboard/writeText existence explicitly instead of optional-chaining through an absent API, so 'success' is only ever reported after the underlying call actually resolved"
    - "Read-site parity: a durably-persisted field (quote.publishedUrl) written by one hook now has TWO independent mounted read sites (JobsManager row + PrintQuoteModal footer) instead of a single ephemeral toast"

key-files:
  created:
    - src/utils/clipboard.ts
    - src/utils/clipboard.test.ts
    - src/components/ui/icons/LinkIcon.tsx
    - src/components/ui/icons/ExternalLinkIcon.tsx
    - src/components/pro/HostedLinkActions.tsx
    - src/components/pro/HostedLinkActions.test.tsx
  modified:
    - src/components/ui/icons/index.ts
    - src/components/pro/ShareQuoteButton.tsx
    - src/components/pro/ShareQuoteButton.test.tsx
    - src/components/JobsManager.tsx
    - src/components/JobsManager.test.tsx
    - src/components/PrintQuoteModal.tsx
    - src/components/PrintQuoteModal.test.tsx

key-decisions:
  - "HostedLinkActions is mounted at BOTH the JobsManager 'Live link' badge row AND the PrintQuoteModal edit footer, keyed off quote.publishStatus === 'published' directly (not nested inside ShareQuoteButton) — a declined+published quote has no ShareQuoteButton row but still needs its link retrievable"
  - "Failed clipboard copy shows toast.info(url, { duration: 0 }) — non-transient/dismissable — rather than a 5s auto-dismiss, so a copy failure never silently loses the link"
  - "ShareQuoteButton's publish-toast clipboard write now goes through the same copyToClipboard() util as HostedLinkActions, eliminating the navigator.clipboard?.writeText(url) optional-chain that resolved 'successfully' (no throw) when the WebView exposed no clipboard, producing a false 'copied' claim on desktop"

requirements-completed: [D-08, D-13]

coverage:
  - id: D1
    description: "copyToClipboard() returns a truthful boolean and never throws across all clipboard states (present+resolves, absent, present-but-not-callable, present-but-rejects)"
    requirement: "D-13"
    verification:
      - kind: unit
        ref: "src/utils/clipboard.test.ts#copyToClipboard"
        status: pass
    human_judgment: false
  - id: D2
    description: "HostedLinkActions renders labelled Copy-link + Open-hosted-page controls, shows an honest toast on copy (success vs persistent-failure), opens the url on web via window.open, and both handlers stopPropagation"
    requirement: "D-08"
    verification:
      - kind: unit
        ref: "src/components/pro/HostedLinkActions.test.tsx#HostedLinkActions"
        status: pass
    human_judgment: false
  - id: D3
    description: "ShareQuoteButton's publish toast only claims 'copied' when copyToClipboard actually returned true; a failed copy shows the url in a non-transient toast instead of the old false-positive"
    requirement: "D-08"
    verification:
      - kind: unit
        ref: "src/components/pro/ShareQuoteButton.test.tsx#ShareQuoteButton — honest publish-toast clipboard claim (G-46-6R)"
        status: pass
    human_judgment: false
  - id: D4
    description: "quote.publishedUrl is retrievable again later (no republish) from both the JobsManager quote row and the PrintQuoteModal edit footer for any published quote"
    requirement: "D-13"
    verification:
      - kind: unit
        ref: "src/components/JobsManager.test.tsx#OrdersQuoteRows — HostedLinkActions retrievability (G-46-6R)"
        status: pass
      - kind: unit
        ref: "src/components/PrintQuoteModal.test.tsx#PrintQuoteModal — edit mode (D-27) renders HostedLinkActions"
        status: pass
    human_judgment: false
  - id: D5
    description: "The desktop-specific false-copy-claim regression (the actual reported gap) is visually gone in a real WebView"
    verification: []
    human_judgment: true
    rationale: "Unit tests stub navigator.clipboard/writeText deterministically, which proves the logic branch, but the original gap was only observable in a real Tauri desktop WebView session — a human should confirm the fix visually on desktop during phase UAT."

# Metrics
duration: 30min
completed: 2026-07-23
status: complete
---

# Phase 46 Plan 11: Hosted-Quote Link Retrievability (G-46-6R) Summary

**Truthful clipboard util + a persistent Copy-link/Open-hosted-page affordance mounted on both published-quote surfaces, closing the gap where a published quote's link only ever appeared in a 5s toast (and desktop falsely claimed "copied" via an optional-chained clipboard write).**

## Performance

- **Duration:** 30 min
- **Started:** 2026-07-23T18:34:00Z
- **Completed:** 2026-07-23T19:04:00Z
- **Tasks:** 3
- **Files modified:** 13 (7 created, 6 modified)

## Accomplishments

- `copyToClipboard(text): Promise<boolean>` (`src/utils/clipboard.ts`) guards `navigator`/`navigator.clipboard`/`writeText` existence explicitly and wraps the write in try/catch — returns `true` only after the write genuinely resolves, `false` in every other case, and never throws. This is the single fix underlying the whole gap: the old `navigator.clipboard?.writeText(url)` optional-chain resolved to `undefined` (not a rejected promise) when the WebView had no clipboard, so the surrounding try/catch never fired and the toast lied.
- `HostedLinkActions` (`src/components/pro/HostedLinkActions.tsx`) — a reusable Copy-link + Open-hosted-page control pair (two `IconButton`s wrapping the shared `Button` primitive, both `stopPropagation`). Copy uses `copyToClipboard`; success shows a normal toast, failure shows a `duration: 0` (dismissable, non-transient) toast still containing the url. Open reuses the exact `UpdateBanner.tsx` desktop-vs-web pattern (`@tauri-apps/plugin-shell` dynamic import with a `window.open` fallback).
- Two new icons — `LinkIcon`, `ExternalLinkIcon` — added to `src/components/ui/icons/` matching the existing `ClipboardListIcon` shape, exported from `icons/index.ts`.
- `ShareQuoteButton`'s publish-success toast now routes through `copyToClipboard()` instead of the optional-chained write, so the "link copied" claim is honest on both web and desktop; a failed copy leaves a persistent toast with the url rather than a 5s vanish.
- `HostedLinkActions` mounted in `JobsManager`'s `QuoteRow` (next to the "Live link" badge, keyed on `publishStatus === 'published' && publishedUrl` — independent of whether `ShareQuoteButton` is rendered on that row) and in `PrintQuoteModal`'s edit footer (next to `ShareQuoteButton`, same guard on `editingQuote`). Every published quote now has a durable, always-visible way to recover its exact link — no republish, no reliance on the vanished toast (D-13 preserved: the token is only ever read from `publishedUrl`, never re-minted).

## Task Commits

Each task was committed atomically:

1. **Task 1: Truthful clipboard util + HostedLinkActions (Copy + Open) affordance + icons** - `fe35a16` (feat) — TDD RED confirmed (import-resolution failure) before `clipboard.ts` existed; GREEN once implemented. 4/4 `clipboard.test.ts` cases + 5/5 `HostedLinkActions.test.tsx` cases pass.
2. **Task 2: Make ShareQuoteButton's publish toast honest via copyToClipboard** - `71c985a` (fix) — TDD RED confirmed (2 new assertions failed against the old optional-chain implementation, 7 pre-existing cases still passed) before the fix; GREEN after. 9/9 `ShareQuoteButton.test.tsx` cases pass.
3. **Task 3: Mount HostedLinkActions on both persistent published-quote surfaces** - `daf11ef` (feat) — `lint:no-raw-html` passes (both controls wrap `IconButton`); 92/92 combined `JobsManager.test.tsx` + `PrintQuoteModal.test.tsx` cases pass.

**Plan metadata:** (this commit) `docs(46-11): complete Hosted-Quote Link Retrievability plan`

_Note: Tasks 1 and 2 followed the TDD RED→GREEN cycle (test-first commits verified failing before the corresponding implementation commit); each task's test+implementation landed together in a single commit per the plan's per-task commit protocol._

## Files Created/Modified
- `src/utils/clipboard.ts` — `copyToClipboard()`, the truthful clipboard-write helper
- `src/utils/clipboard.test.ts` — 4 cases covering resolve/absent/not-callable/reject
- `src/components/ui/icons/LinkIcon.tsx` — chain-link glyph (Copy link)
- `src/components/ui/icons/ExternalLinkIcon.tsx` — box-with-outbound-arrow glyph (Open hosted page)
- `src/components/ui/icons/index.ts` — exports the two new icons
- `src/components/pro/HostedLinkActions.tsx` — the Copy/Open affordance component
- `src/components/pro/HostedLinkActions.test.tsx` — 5 cases (render, copy success, copy failure persistence, open-web, stopPropagation)
- `src/components/pro/ShareQuoteButton.tsx` — publish handler now uses `copyToClipboard()`; toast honesty fix
- `src/components/pro/ShareQuoteButton.test.tsx` — 2 new cases (honest copied-claim true/false) + module-level `copyToClipboard` mock
- `src/components/JobsManager.tsx` — mounts `HostedLinkActions` next to the "Live link" badge
- `src/components/JobsManager.test.tsx` — 2 new cases (published quote shows controls; unpublished quote omits them)
- `src/components/PrintQuoteModal.tsx` — mounts `HostedLinkActions` in the edit footer
- `src/components/PrintQuoteModal.test.tsx` — 1 new case (published editingQuote shows controls)

## Decisions Made
- HostedLinkActions is keyed directly off `quote.publishStatus === 'published' && quote.publishedUrl` at each mount site rather than being nested inside `ShareQuoteButton` — a declined+published quote renders the "Live link" badge but no `ShareQuoteButton` row, so nesting would have silently missed that case.
- Copy-failure toast uses `{ duration: 0 }` (dismissable, non-auto-expiring) so a failed copy never loses the link the way the old 5s toast did.
- `ShareQuoteButton`'s existing clipboard write was routed through the new `copyToClipboard()` util rather than patched in place, so both the publish-toast path and the persistent `HostedLinkActions` path share one single source of truth for "did the copy actually happen."

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- G-46-6R closed: the hosted-quote link is now retrievable from both persistent surfaces (JobsManager row, PrintQuoteModal edit footer) on both web and desktop, without republishing.
- Full test suite (1507 passed, 4 skipped, 1 todo) and `npm run build` (vitest + tsc + vite build) both pass clean.
- Recommend a human-verify pass during phase 46 UAT specifically on a real Tauri desktop session to visually confirm the previously-reported false "copied" toast no longer appears (D5 in coverage above — logic is unit-proven, the original symptom was WebView-specific).

---
*Phase: 46-white-label-quotes*
*Completed: 2026-07-23*

## Self-Check: PASSED

- FOUND: src/utils/clipboard.ts
- FOUND: src/components/pro/HostedLinkActions.tsx
- FOUND: src/components/ui/icons/LinkIcon.tsx
- FOUND: src/components/ui/icons/ExternalLinkIcon.tsx
- FOUND commit: fe35a16 (Task 1)
- FOUND commit: 71c985a (Task 2)
- FOUND commit: daf11ef (Task 3)
- Full suite: 1507 passed, 4 skipped, 1 todo (`npm test -- --run`)
- `npm run build` passed (vitest coverage + tsc + vite build)
