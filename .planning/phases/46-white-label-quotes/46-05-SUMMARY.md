---
phase: 46-white-label-quotes
plan: 05
subsystem: api
tags: [xss-allowlist, vercel-functions, supabase, white-label, hosted-quote, security]

# Dependency graph
requires:
  - phase: 46-white-label-quotes (plan 01)
    provides: src/utils/logoDataUrl.ts canonical isValidLogoDataUrl allowlist
  - phase: 46-white-label-quotes (plan 03)
    provides: UserProfile.logoDataUrl inventory/policy
  - phase: 46-white-label-quotes (plan 04)
    provides: shared PrintQuoteModal.tsx surface (PDF branding injection)
  - phase: 43-pro-backend
    provides: api/q/[token].ts hosted-quote renderer, api/lib/supabaseRest.ts RPC helper
provides:
  - usePublishedQuote accepts an injected logoDataUrl and bakes it into the frozen publish snapshot (D-11)
  - api/lib/logoDataUrl.ts — lockstep server-side copy of the canonical XSS allowlist
  - api/q/[token].ts renders the maker logo and suppresses "Powered by 3DCoster" only when a valid logo is present (D-09)
  - First logo-specific test coverage for the hosted-page renderer (api/q/[token].test.ts)
affects: [46-white-label-quotes remaining plans, any future hosted-quote-page changes]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Lockstep server-side validator copy (api/ cannot import from src/) — same convention as api/lib/supabaseRest.ts avoiding @supabase/supabase-js"
    - "Allowlist-as-escaping: a strictly anchored base64-alphabet regex is itself the XSS defense for an interpolated data: URL attribute, re-validated independently at write time (client) and render time (server)"

key-files:
  created:
    - api/lib/logoDataUrl.ts
    - api/q/[token].test.ts
  modified:
    - src/hooks/usePublishedQuote.ts
    - src/hooks/usePublishedQuote.test.ts
    - src/components/PrintQuoteModal.tsx
    - src/components/JobsManager.tsx
    - api/q/[token].ts

key-decisions:
  - "D-09 footer rule stays deliberately different from the PDF's D-05/D-10 rule: the hosted page keeps 'Powered by 3DCoster' until a logo is actually set, not for every Pro user"
  - "D-11 frozen-snapshot: the logo is captured at publish time from the injected current value; a later profile logo change never touches an already-published row"
  - "Server validator is a byte-identical lockstep copy of src/utils/logoDataUrl.ts (verified via diff), not an import, because api/ is a separate Vercel Function bundle"

requirements-completed: [D-05, D-09, D-10, D-11, D-12]

coverage:
  - id: D1
    description: "publish() bakes a validated logo into the hosted_quotes insert snapshot; an invalid/absent logo is omitted (D-11)"
    requirement: "D-11"
    verification:
      - kind: unit
        ref: "src/hooks/usePublishedQuote.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Hosted page renders the maker logo <img> and suppresses the Powered-by footer only when a valid logo is present (D-09)"
    requirement: "D-09"
    verification:
      - kind: unit
        ref: "api/q/[token].test.ts#D-09: valid logo suppresses the powered-by footer and renders the logo"
        status: pass
      - kind: unit
        ref: "api/q/[token].test.ts#D-09: no logo keeps the powered-by footer"
        status: pass
    human_judgment: false
  - id: D3
    description: "Server-side re-validation strips malformed/tampered logo values (javascript:, svg, attribute-breakout, oversized) before they ever reach the rendered HTML (Pitfall 4)"
    requirement: "D-12"
    verification:
      - kind: unit
        ref: "api/q/[token].test.ts#Pitfall 4: server-side re-validation strips malformed/tampered logo values"
        status: pass
    human_judgment: false
  - id: D4
    description: "The 404/unavailable page stays byte-identical; logo logic only touches the valid published-page branch (D-16 regression guard)"
    requirement: "D-10"
    verification:
      - kind: unit
        ref: "api/q/[token].test.ts#D-16: the unavailable page is unaffected by logo logic"
        status: pass
      - kind: unit
        ref: "tests/security/hosted-quote-404-indistinguishable.test.ts"
        status: pass
    human_judgment: false

# Metrics
duration: continuation (Task 1 committed in a prior interrupted session; Task 2 executed this session, ~15min)
completed: 2026-07-23
status: complete
---

# Phase 46 Plan 05: White-Label Hosted Quote Page Summary

**Maker logo now bakes into the frozen publish snapshot and renders on the hosted `/q/[token]` page behind a server-side re-validated XSS allowlist, with the "Powered by 3DCoster" footer suppressed only once a valid logo is actually present.**

## Performance

- **Duration:** Continuation of an interrupted execution. Task 1 was completed and committed in a prior session (`c260e4a`, 2026-07-23T08:47:29-04:00). This session picked up mid-Task-2 (the lockstep validator file already existed, untracked) and completed the remaining Task 2 work in ~15 minutes.
- **Completed:** 2026-07-23
- **Tasks:** 2/2 complete
- **Files modified:** 7 (2 created new in this session's commit: `api/lib/logoDataUrl.ts` review/keep + `api/q/[token].test.ts`; 1 modified: `api/q/[token].ts`; plus 4 files from the prior session's Task 1 commit)

## Accomplishments

- `usePublishedQuote` accepts an injected `logoDataUrl` (dependency-injection pattern, mirrors the existing `businessName` param) and bakes a validated logo into the `hosted_quotes` insert snapshot at publish time; an invalid/absent logo is silently omitted (D-11, Task 1 — prior session).
- `PrintQuoteModal.tsx` and `JobsManager.tsx` thread `userProfile.logoDataUrl` through their existing `usePublishedQuote` call sites (Task 1 — prior session).
- `api/lib/logoDataUrl.ts` created as a byte-identical lockstep copy of the canonical `src/utils/logoDataUrl.ts` allowlist regex + length cap, with a header comment pointing back to the source of truth (Task 2 — this session verified the pre-existing untracked file against the canonical copy via `diff` and kept it as-is; it matched exactly).
- `api/q/[token].ts` now re-validates `snapshot.logoDataUrl` at render time via the lockstep copy: a valid logo renders an `<img>` and suppresses "Powered by 3DCoster"; anything invalid (missing, `javascript:`, svg, attribute-breakout, oversized) is treated identically to "no logo" (D-09, Pitfall 4 defense-in-depth).
- `pageShell()` gained an optional `showFooter` parameter (default `true`), keeping the D-16 unavailable-page output byte-identical while letting only the valid published-page branch suppress the footer.
- `api/q/[token].test.ts` created — the first logo-specific test coverage for this handler, covering the valid-logo render, no-logo fallback, three distinct XSS-payload-omission cases (javascript:, svg, attribute-breakout), an oversized-payload rejection, and a 404-unaffected regression check.

## Task Commits

Each task was committed atomically:

1. **Task 1: Bake the validated logo into the publish snapshot (D-11)** - `c260e4a` (feat) — completed and committed in a **prior interrupted session**, verified present via `git log` before this continuation began. Not redone.
2. **Task 2: Server-side hosted-page logo render + D-09 footer rule + XSS allowlist** - `4ac2dce` (feat) — completed this session (TDD: RED test file written and confirmed failing on the valid-logo assertion, then implementation added, then GREEN confirmed across all 26 tests in the three related suites).

**Plan metadata:** (this commit) - docs: complete plan

## Files Created/Modified

- `src/hooks/usePublishedQuote.ts` - Injected `logoDataUrl` param; validates via `isValidLogoDataUrl` before adding to the insert snapshot (Task 1, prior session)
- `src/hooks/usePublishedQuote.test.ts` - Logo-included / invalid-logo-omitted snapshot test cases (Task 1, prior session)
- `src/components/PrintQuoteModal.tsx` - Threads `userProfile.logoDataUrl` through the `usePublishedQuote` call site (Task 1, prior session)
- `src/components/JobsManager.tsx` - Threads `userProfile.logoDataUrl` through the `usePublishedQuote` call site (Task 1, prior session)
- `api/lib/logoDataUrl.ts` - Lockstep server-side copy of the canonical `isValidLogoDataUrl` allowlist (Task 2, this session — verified byte-identical to `src/utils/logoDataUrl.ts` via diff)
- `api/q/[token].ts` - `HostedSnapshot.logoDataUrl?: string`, `hasLogo` gate driving both the `<img>` render and `pageShell`'s new `showFooter` parameter (Task 2, this session)
- `api/q/[token].test.ts` - New test file: valid-logo render, no-logo fallback, three XSS-omission cases, oversized-payload rejection, 404-unaffected check (Task 2, this session)

## Decisions Made

- Kept the pre-existing untracked `api/lib/logoDataUrl.ts` as-is after verifying it matches the canonical `src/utils/logoDataUrl.ts` regex and length cap byte-for-byte via `diff` — no changes needed.
- `pageShell()` was extended with a trailing optional `showFooter = true` parameter rather than restructuring the function's signature, so every existing caller (including `renderUnavailablePage`) is unaffected by default and the D-16 byte-identical 404 guarantee holds.
- The logo `<img>` interpolates `snapshot.logoDataUrl` directly (no `escapeHtml` on the value itself) because the anchored base64-alphabet-only regex already forecloses any character that could break out of the `src="..."` attribute — the allowlist IS the escaping for this specific attribute+scheme case, matching the plan's explicit guidance. The `alt` text (derived from `businessName`) IS escaped, since that field carries arbitrary maker-entered text.

## Deviations from Plan

None - plan executed exactly as written. Task 1 was already complete from a prior interrupted session; this continuation verified it via `git log` and left it untouched, then completed Task 2's TDD cycle (RED confirmed failing on the valid-logo assertion → implementation → GREEN across all related suites).

## Issues Encountered

- **Continuation context:** the prior session left `api/lib/logoDataUrl.ts` created but untracked (uncommitted) mid-Task-2. This session reviewed it against the canonical validator (verbatim regex + length cap, confirmed via `diff`), found it correct, and included it in Task 2's commit.
- **Unrelated flaky test:** `src/components/calculator/outputEquivalence.test.tsx` timed out (5000ms) during a full-suite `npm run test` run, but passes in ~2s when run in isolation both before and after this plan's changes (confirmed via `git stash`). This is a pre-existing resource-contention flake under full parallel test load, unrelated to this plan's files (CostCalculator scenario oracle, nothing to do with hosted-quote rendering or logo validation). Logged here per the deviation-rules scope boundary — not fixed, as it is out of scope for this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The hosted quote page (`api/q/[token].ts`) now fully supports white-label branding: maker logo + business name display, with the correct D-09 footer semantics (distinct from the PDF's D-05/D-10 rule).
- Already-published links are unaffected by this change (D-11 frozen snapshot) — only quotes published AFTER this change can carry a logo; existing published rows simply have no `logoDataUrl` key and keep the powered-by footer, which is the expected/correct D-09 fallback behavior.
- Recommend flagging the logo-in-HTML allowlist for this project's D-17-style pre-release security review (per the plan's `<verification>` section) before the phase's final gate.

---
*Phase: 46-white-label-quotes*
*Completed: 2026-07-23*

## Self-Check: PASSED

All created/modified files verified present on disk; both task commits (`c260e4a`, `4ac2dce`) verified present in `git log --oneline --all`.
