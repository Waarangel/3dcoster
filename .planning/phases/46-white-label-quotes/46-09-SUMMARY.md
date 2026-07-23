---
phase: 46-white-label-quotes
plan: 09
subsystem: auth
tags: [react, hooks, supabase, otp, magic-link, testing]

requires:
  - phase: 43-pro-backend
    provides: useProAuth magic-link + OTP-code auth hook, SignInModal contextual UI
provides:
  - resetSignIn() user-driven exit from the trapped 'link-sent' status
  - Unified SignInModal close path (X/backdrop/Escape/both Cancel buttons all reset identically)
  - "Use a different email" in-session recovery affordance on the code step
  - Accurate first-time sign-in copy (one-time code + new-account confirm messaging)
  - shouldCreateUser: true passed explicitly to signInWithOtp
affects: [46-white-label-quotes, pro-auth, sign-in-modal]

tech-stack:
  added: []
  patterns:
    - "Hook reset actions gate on the underlying source-of-truth state (session), not on the derived status enum, to avoid stale-closure risk and guarantee a signed-in user can never be reset"
    - "Transitionable module-level mock (getter + spy-driven mutation) replaces a frozen-status mock so component lifecycle tests can express real state transitions"

key-files:
  created: []
  modified:
    - src/hooks/useProAuth.ts
    - src/hooks/useProAuth.test.tsx
    - src/components/pro/SignInModal.tsx
    - src/components/pro/SignInModal.test.tsx

key-decisions:
  - "resetSignIn() gates on `session !== null` (the same source isSignedIn derives from) rather than reading `status` inside the callback — avoids stale-closure risk and structurally guarantees a signed-in user can never be knocked back to signed-out (T-46-4-01)."
  - "'Use a different email' clears only the local code field, not the email field — the user is fixing/reusing their email, not necessarily retyping it from scratch; resetSignIn() flips status back to 'signed-out' which is what actually re-enables the (previously disabled) email input."
  - "Test mock rewritten from a frozen status: 'link-sent' object to a transitionable one (module-level mockStatus var + a status getter + signInWithEmail/resetSignIn spies that mutate it) — since the mocked hook has no React state, mutating mockStatus alone doesn't schedule a re-render (unlike the real hook), so lifecycle tests explicitly re-render (root.render again) after each transition to reflect it, mirroring the real hook's own state-driven re-render."

requirements-completed: [D-08, D-09]

coverage:
  - id: D1
    description: "resetSignIn() returns useProAuth.status from 'link-sent' to 'signed-out' (or 'unavailable' with a null client), and is a guaranteed no-op while signed in"
    requirement: D-09
    verification:
      - kind: unit
        ref: "src/hooks/useProAuth.test.tsx#useProAuth — resetSignIn (G-46-4 user-driven exit from link-sent)"
        status: pass
    human_judgment: false
  - id: D2
    description: "signInWithEmail passes shouldCreateUser: true explicitly to signInWithOtp"
    requirement: D-08
    verification:
      - kind: unit
        ref: "src/hooks/useProAuth.test.tsx#signInWithEmail sends a magic link redirecting to /app and reports link-sent"
        status: pass
    human_judgment: false
  - id: D3
    description: "All SignInModal close gestures (X/backdrop/Escape/email-step Cancel/code-step Cancel) route through the same resetAndClose, leaving an editable, empty email step on reopen"
    requirement: D-09
    verification:
      - kind: unit
        ref: "src/components/pro/SignInModal.test.tsx#send -> link-sent -> close via resetAndClose (Modal onClose) -> reopen shows editable, empty email step"
        status: pass
      - kind: unit
        ref: "src/components/pro/SignInModal.test.tsx#code-step Cancel routes through the same reset (status returns to signed-out)"
        status: pass
    human_judgment: false
  - id: D4
    description: "'Use a different email' on the code step returns to the editable email step without closing the modal"
    requirement: D-09
    verification:
      - kind: unit
        ref: "src/components/pro/SignInModal.test.tsx#\"Use a different email\" on the code step returns to the email step without firing onClose"
        status: pass
    human_judgment: false
  - id: D5
    description: "First-time sign-in copy accurately states a one-time code is emailed and a brand-new account may need to confirm before the code works"
    requirement: D-08
    verification: []
    human_judgment: true
    rationale: "Copy accuracy/tone is a readability judgment, not something a unit test can assert meaningfully beyond substring matching; visual/human read is the appropriate check."

duration: 7min
completed: 2026-07-23
status: complete
---

# Phase 46 Plan 09: SignInModal reset + copy fix Summary

**Added a user-driven `resetSignIn()` exit from the trapped `link-sent` auth status and unified every SignInModal close gesture through it, closing the stuck-disabled-email-field bug (G-46-4) and fixing over-promising first-time sign-in copy (G-46-2 client half).**

## Performance

- **Duration:** 7 min
- **Started:** 2026-07-23T15:31:57Z
- **Completed:** 2026-07-23T15:38:44Z
- **Tasks:** 2 completed
- **Files modified:** 4

## Accomplishments

- `useProAuth` now exposes `resetSignIn()` — the only user-driven way to return `status` from the dead-end `'link-sent'` state to `'signed-out'` (or `'unavailable'` when the client is null), gated on `session` so a signed-in user can never be reset.
- `signInWithEmail` passes `shouldCreateUser: true` explicitly, making the new-user branch a documented decision rather than an implicit supabase-js default.
- `SignInModal`'s Modal `onClose`, both Cancel buttons, and a new "Use a different email" link on the code step all route through one unified `resetAndClose` (or `resetSignIn` for the in-session recovery path) — every close gesture leaves the identical clean state on reopen, and reopening after any abandonment now shows an editable, empty email field instead of the user's reported stuck/disabled one.
- First-time sign-in copy now says a one-time code is emailed and that a brand-new account may need to confirm before the code works, instead of unconditionally promising "a magic link and a one-time code."
- Test suites for both files replaced their frozen/incomplete mocks with real lifecycle coverage: `useProAuth.test.tsx` gained 3 `resetSignIn` cases; `SignInModal.test.tsx`'s useProAuth mock became transitionable so send → link-sent → close (each gesture) → reopen and the new "Use a different email" path are now genuinely exercised, while the existing OTP code-length regression cases still pass unmodified.

## Task Commits

1. **Task 1: Add resetSignIn() to useProAuth and decide shouldCreateUser explicitly** - `8b50740` (feat)
2. **Task 2: Route all SignInModal close paths through reset, add 'Use a different email', fix first-time copy** - `2cce58b` (fix)

**Plan metadata:** (this commit)

## Files Created/Modified

- `src/hooks/useProAuth.ts` - Added `resetSignIn()` action (session-gated, no-op while signed in) and `shouldCreateUser: true` on `signInWithOtp`
- `src/hooks/useProAuth.test.tsx` - Added a `resetSignIn` describe block (3 cases: reset-from-link-sent, no-op-while-signed-in, unavailable-client) and updated the `signInWithOtp` call assertion to include `shouldCreateUser: true`
- `src/components/pro/SignInModal.tsx` - Unified all close paths through `resetAndClose` (now calling `resetSignIn()` too), added `useDifferentEmail` handler + button on the code step, rewrote the intro copy for first-time-user accuracy
- `src/components/pro/SignInModal.test.tsx` - Replaced the frozen `status: 'link-sent'` mock with a transitionable module-level mock; added 4 lifecycle tests (signed-out render, close/reopen via Modal's X, code-step Cancel reset, "Use a different email"); kept all 6 pre-existing OTP code-length regression cases passing

## Decisions Made

- `resetSignIn()` guards on `session !== null` rather than reading `status`, closing threat T-46-4-01 structurally (no code path can knock a signed-in user to signed-out) and sidestepping stale-closure concerns entirely.
- "Use a different email" clears only the code field (not email) — resetSignIn's status flip is what re-enables the email input; the existing text is preserved so the user isn't forced to retype an email that may have been correct.
- Test harness for SignInModal.test.tsx switched to a transitionable mock (status getter over a module-level variable, mutated by spies) since the mocked hook has no real React state — component re-renders were forced explicitly after each status-mutating action in the test to reflect the transition, mirroring what the real hook's `useState` would trigger automatically.

## Deviations from Plan

None — plan executed as written. One test-authoring subtlety surfaced during Task 2's TDD RED/GREEN pass: mutating the mocked hook's external `mockStatus` variable does not itself schedule a React re-render (the mock has no `useState`), so tests needed an explicit re-render step after each status transition to observe it in the DOM. This is a test-scaffold detail, not a source-code deviation, and is documented above under Decisions Made / patterns-established.

## Issues Encountered

None beyond the test-scaffold discovery above, resolved during the TDD RED/GREEN pass before the Task 2 commit.

## User Setup Required

None — no external service configuration required. (The Supabase 'Confirm signup' template fix that this plan's copy references is plan 46-08, already shipped separately.)

## Next Phase Readiness

- G-46-4 (stuck link-sent / disabled email field on reopen) is closed: every close gesture now resets cleanly, and "Use a different email" gives an in-session recovery path.
- G-46-2's CLIENT half (over-promising copy) is closed; the PRIMARY fix (Supabase email template) was already shipped in plan 46-08.
- No blockers for remaining phase 46 gap-closure plans (G-46-6) or subsequent phases.

---
*Phase: 46-white-label-quotes*
*Completed: 2026-07-23*

## Self-Check: PASSED

- FOUND: src/hooks/useProAuth.ts
- FOUND: src/hooks/useProAuth.test.tsx
- FOUND: src/components/pro/SignInModal.tsx
- FOUND: src/components/pro/SignInModal.test.tsx
- FOUND commit: 8b50740
- FOUND commit: 2cce58b
