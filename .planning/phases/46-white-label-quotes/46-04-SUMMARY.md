---
phase: 46-white-label-quotes
plan: 04
subsystem: pdf
tags: [jspdf, white-label, entitlement, localStorage, pdf, react-hooks]

requires:
  - phase: 46-01
    provides: "UserProfile.logoDataUrl, isValidLogoDataUrl (canonical XSS-allowlist validator)"
  - phase: 46-02
    provides: "Desktop Supabase client un-gated (D-08), so useEntitlement resolves on Tauri too"
provides:
  - "QuoteBranding interface + branding-aware generateQuotePdf/generateQuotePdfBytes"
  - "Last-known-good entitlement cache in useEntitlement (D-07 offline Pro)"
  - "Live-entitlement branding injection wired into PrintQuoteModal's download call"
affects: [46-05, 46-06, 46-07]

tech-stack:
  added: []
  patterns:
    - "Dependency-injection seam for a pure module: branding is a caller-supplied argument, never an internal Dexie/hook read (mirrors usePublishedQuote(userProfile.name, ...))"
    - "Last-known-good cache: write on every successful read (any status), read only as a fallback on a FAILED read while a userId is present — never read when signed out"

key-files:
  created: []
  modified:
    - src/pdf/generateQuotePdf.ts
    - src/pdf/generateQuotePdf.test.ts
    - src/hooks/useEntitlement.ts
    - src/hooks/useEntitlement.test.ts
    - src/components/PrintQuoteModal.tsx
    - src/components/PrintQuoteModal.test.tsx

key-decisions:
  - "QuoteBranding is a plain optional second argument (default { isWhiteLabel: false }) — fully backward compatible with the single pre-existing caller before this plan touched it"
  - "Logo header layout: logo bounding box 90x36pt at (MARGIN_LEFT, 15), business name rendered to the right of the logo (or alone at the wordmark's old baseline y=30 when no valid logo) — stays above the y=65 rule line"
  - "Logo addImage always uses the explicit format extracted from the data-URL prefix (never jsPDF's auto-detect), and is wrapped in try/catch so corrupt bytes that pass isValidLogoDataUrl's regex still degrade to business-name-only instead of crashing PDF generation"
  - "Entitlement cache key is `entitlement-cache:<userId>` in localStorage; written on every successful read (Pro or not) so a successful non-Pro read overwrites a stale Pro cache (D-06); read only as a fallback on a FAILED read when a userId is present — signed-out never touches the cache (T-46-10)"
  - "Branding built in PrintQuoteModal from live useEntitlement().isPro + userProfile.logoDataUrl/name at the exact download call site, so the PDF reflects entitlement AT DOWNLOAD TIME (D-10 asymmetry vs. the frozen hosted-page snapshot)"

patterns-established:
  - "generateQuotePdf(quote, branding?) is the second precedent (after usePublishedQuote) for injecting caller-owned state into an otherwise pure/by-value module rather than letting the module read Dexie/hooks itself"

requirements-completed: [D-04, D-05, D-06, D-07, D-10]

coverage:
  - id: D1
    description: "Pro user's PDF renders maker logo + business name in the header and has no 'Made with 3DCoster' footer"
    requirement: "D-04"
    verification:
      - kind: unit
        ref: "src/pdf/generateQuotePdf.test.ts#white-label branding > isWhiteLabel:true with a valid logo + businessName renders the logo image + business name, and drops the 3DCoster footer"
        status: pass
    human_judgment: false
  - id: D2
    description: "Free/lapsed user's PDF keeps the unchanged 3DCoster wordmark header and footer"
    requirement: "D-06"
    verification:
      - kind: unit
        ref: "src/pdf/generateQuotePdf.test.ts#white-label branding > isWhiteLabel:false renders the unchanged 3DCoster wordmark header and keeps the footer"
        status: pass
      - kind: unit
        ref: "src/pdf/generateQuotePdf.test.ts#white-label branding > no branding argument defaults to isWhiteLabel:false (backward-compatible)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Invalid or absent logo degrades gracefully — footer still drops, business name still renders, logo simply omitted"
    requirement: "D-04"
    verification:
      - kind: unit
        ref: "src/pdf/generateQuotePdf.test.ts#white-label branding > isWhiteLabel:true with an INVALID logoDataUrl still drops the footer and renders businessName, but omits the logo image"
        status: pass
      - kind: unit
        ref: "src/pdf/generateQuotePdf.test.ts#white-label branding > isWhiteLabel:true with an ABSENT logoDataUrl still drops the footer and renders businessName"
        status: pass
    human_judgment: false
  - id: D4
    description: "Offline paying user still resolves as Pro via a cached last-known-good entitlement status; signed-out user never reads the cache; a confirmed cancel reverts the cache"
    requirement: "D-07"
    verification:
      - kind: unit
        ref: "src/hooks/useEntitlement.test.ts#useEntitlement — offline cache (D-07) > falls back to the cached last-known-good status when a later read fails and a userId is present"
        status: pass
      - kind: unit
        ref: "src/hooks/useEntitlement.test.ts#useEntitlement — offline cache (D-07) > does NOT read the cache when there is no userId (signed-out never resolves Pro)"
        status: pass
      - kind: unit
        ref: "src/hooks/useEntitlement.test.ts#useEntitlement — offline cache (D-07) > a successful canceled read overwrites/clears the cache (D-06 lapse reverts)"
        status: pass
    human_judgment: false
  - id: D5
    description: "PrintQuoteModal injects live entitlement + profile into the PDF download as a QuoteBranding object (D-10 live-at-download-time asymmetry)"
    requirement: "D-10"
    verification:
      - kind: unit
        ref: "src/components/PrintQuoteModal.test.tsx#PrintQuoteModal — Phase 46-04 white-label PDF branding injection > passes isWhiteLabel:true + logoDataUrl + businessName from userProfile when isPro is true"
        status: pass
      - kind: unit
        ref: "src/components/PrintQuoteModal.test.tsx#PrintQuoteModal — Phase 46-04 white-label PDF branding injection > passes isWhiteLabel:false when isPro is false, regardless of a stored logo/name"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-07-23
status: complete
---

# Phase 46 Plan 04: White-Label PDF Quotes Summary

**Branding-aware `generateQuotePdf`/`generateQuotePdfBytes` (logo+name header, conditional footer), a last-known-good offline entitlement cache in `useEntitlement`, and PrintQuoteModal's live-entitlement branding injection at download time**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-23T07:53:00Z (approx)
- **Completed:** 2026-07-23T07:57:00Z (approx)
- **Tasks:** 3 completed
- **Files modified:** 6

## Accomplishments
- `generateQuotePdf(quote, branding?)` / `generateQuotePdfBytes(quote, branding?)` now accept an optional `QuoteBranding` argument (`{ isWhiteLabel, logoDataUrl?, businessName? }`), defaulting to `{ isWhiteLabel: false }` — byte-identical to the pre-existing behavior when omitted
- White-label header renders the maker's logo (gated through `isValidLogoDataUrl` + an explicit jsPDF image format, never auto-detect) alongside the business name, and completely omits the '3DCoster' wordmark; free/lapsed PDFs are unchanged
- White-label footer omits 'Made with 3DCoster — 3dcoster.com' entirely; free/lapsed footer is unchanged
- `useEntitlement` persists every successful read's status/plan/current_period_end to `localStorage` under a per-user key, and falls back to that cache on a FAILED read (network/Supabase unreachable) when a `userId` is present — an offline Pro user still gets white-label PDFs (D-07). Signed-out never reads the cache; a successful non-Pro read overwrites/clears a stale Pro cache (D-06)
- `PrintQuoteModal` calls `useEntitlement()` and builds the `QuoteBranding` object from live `isPro` + `userProfile.logoDataUrl`/`name` at the exact download call site — the PDF reflects entitlement status AT DOWNLOAD TIME, not whatever was true when the Quote was originally created (D-10's deliberate asymmetry vs. the frozen hosted-page snapshot)
- The generator module stays pure — no Dexie/React/UserProfile import added; branding arrives purely as an injected argument

## Task Commits

Each task was committed atomically:

1. **Task 1: Branding-aware PDF generator (logo header + conditional footer)** - `d33fde9` (test, RED) → `e59fe4e` (feat, GREEN) → `af50e7c` (fix, test-hygiene deviation — see below)
2. **Task 2: Cache last-known-good entitlement for offline white-label (D-07)** - `e26142f` (test, RED) → `ae78a65` (feat, GREEN)
3. **Task 3: Inject branding into the PDF download from PrintQuoteModal** - `d534606` (feat, includes test additions — task was `type="auto"` without `tdd="true"`)

_TDD tasks (1 and 2) each have a test commit followed by an implementation commit._

## Files Created/Modified
- `src/pdf/generateQuotePdf.ts` - Added exported `QuoteBranding` interface, `renderWhiteLabelHeader` helper, `extractLogoFormat`, branding-gated `renderHeader`/`renderFooter`, and threaded the optional `branding` arg through `_buildDoc`/`generateQuotePdfBytes`/`generateQuotePdf`
- `src/pdf/generateQuotePdf.test.ts` - New `white-label branding` describe block: valid-logo render, footer-drop, backward-compatible default, invalid-logo degrade, absent-logo degrade, and a `generateQuotePdf` (not just Bytes) signature sanity check
- `src/hooks/useEntitlement.ts` - Added `cacheKey`/`readCache`/`writeCache` helpers and wired them into `refresh()`: write on every successful read, read as a fallback on error/exception when `userId` is present
- `src/hooks/useEntitlement.test.ts` - New `useEntitlement — offline cache (D-07)` describe block: persist-on-success, fallback-on-failed-read, signed-out-never-reads-cache, and successful-canceled-read-overwrites-cache
- `src/components/PrintQuoteModal.tsx` - Imported `useEntitlement` + `QuoteBranding` type, called `useEntitlement()` unconditionally, built the `branding` object at the download call site and passed it as `generateQuotePdf`'s 2nd argument
- `src/components/PrintQuoteModal.test.tsx` - Added a controllable `mockEntitlement`/`vi.mock('../hooks/useEntitlement', ...)`, extended the happy-path test to assert the branding argument, and added a new `Phase 46-04 white-label PDF branding injection` describe block covering both `isPro: true` and `isPro: false`

## Decisions Made
- Logo bounding box capped at 90×36pt positioned at `(MARGIN_LEFT, 15)`, business name rendered to the right of the logo (or alone at the old wordmark baseline y=30 when no valid logo renders) — keeps the whole block above the existing y=65 horizontal rule
- `addImage` is wrapped in try/catch: a data URL that passes `isValidLogoDataUrl`'s regex but somehow fails to decode (corrupt bytes) still degrades to business-name-only instead of throwing and breaking PDF generation entirely
- Entitlement cache key format `entitlement-cache:<userId>` chosen for readability/debuggability in localStorage inspector; cache write happens unconditionally after ANY successful read (not just Pro ones) so D-06 lapse-revert is enforced by the write path itself, not a separate clear step
- `QuoteBranding` type imported into `PrintQuoteModal.tsx` as a type-only import (`import type { QuoteBranding }`) so it is erased at compile time and does not create a static runtime import of the jsPDF-dependent module — the existing dynamic-import-only-for-jspdf convention is preserved

## Deviations from Plan

All three tasks matched their `<action>`/`<behavior>`/`<acceptance_criteria>` blocks with no scope changes. The worktree coordination note (RESEARCH Pitfall 5) was checked first: `.claude/worktrees/cool-kowalevski-9831d4` was confirmed clean and at the same commit as `main` (no live edits to `generateQuotePdf.ts`), so no coordination was needed.

### Auto-fixed Issues

**1. [Rule 1 - Bug] Self-authored test wrote a real PDF to the repo root**
- **Found during:** Task 1 (self-review after the first full test-suite run)
- **Issue:** An extra sanity-check test I added (`generateQuotePdf accepts the branding argument`) called the real web `.save()` branch (`__IS_TAURI__` false). jsPDF's Node build performs `fs.writeFileSync` when no browser download API is present, leaving a stray `Quote-Q-0042.pdf` at the repo root on every test run — a real bug in test hygiene that would have polluted every future CI run.
- **Fix:** Rewrote the test to exercise the already-mocked Tauri branch (same `@tauri-apps/plugin-dialog`/`plugin-fs` mock pattern as the pre-existing "writeFile error mapping" describe block), asserting the same `generateQuotePdf(quote, branding)` call signature without ever touching disk.
- **Files modified:** src/pdf/generateQuotePdf.test.ts
- **Verification:** `npm run test -- src/pdf/generateQuotePdf.test.ts` (37/37 pass) followed by a full suite run (1469 passed) with `git status --short` confirming no stray file was created.
- **Committed in:** af50e7c

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Self-contained test-hygiene fix; no production code or behavior changed.

## Issues Encountered

None. Verified early via a scratch Node check that jsPDF's `getImageProperties`/`addImage` parse PNG data URLs using jsPDF's own internal format parsers (not a DOM `Image` element), so they work correctly under Vitest's jsdom environment with a tiny 1×1 PNG fixture — no test-environment workaround was needed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `QuoteBranding`, the branding-aware PDF generator, and the cached `useEntitlement` are all available for any later Phase 46 plan needing white-label state (e.g. the hosted-page branding path in 46-05, which already renders its own server-side logo path and does not consume this client module).
- Full test suite verified green after this plan: 1469 passed, 4 skipped, 1 todo (129 test files) — no regressions in any consumer of `generateQuotePdf`, `useEntitlement`, or `PrintQuoteModal`.
- No blockers.

---
*Phase: 46-white-label-quotes*
*Completed: 2026-07-23*

## Self-Check: PASSED

All 6 created/modified source files verified present on disk; all 6 commits (d33fde9, e59fe4e, e26142f, ae78a65, d534606, af50e7c) verified present in git log. Full suite re-verified green after the af50e7c fix: 1469 passed, 4 skipped, 1 todo (129 test files), with `git status --short` confirming no stray artifacts.
