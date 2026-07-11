---
status: testing
phase: 42-gdpr-onboarding
source: [42-VERIFICATION.md]
started: 2026-07-11T00:00:00Z
updated: 2026-07-11T00:00:00Z
---

## Current Test

number: 2
name: Tauri desktop build visual confirmation
expected: |
  Run `npm run tauri dev` (or a compiled build) — no cookie banner and zero analytics
  anywhere in the desktop app (compile-time `!__IS_TAURI__` gate).
awaiting: user response

## Tests

### 1. Full-browser onboarding wizard walkthrough
expected: Clear IndexedDB → reload → wizard at step 0 → printer tile advances to step 1 → filament advances to step 2 → saved job fires completion toast and unmounts overlay → reload does not re-show. Existing-printer profiles never see the wizard. Mid-wizard reload resumes at the same step (real Dexie persistence, not mocks).
result: issue
source: automated (preview-browser drive against live dev server, 2026-07-11)
reported: "Clicking the 'Bambu Lab A1 mini' quick-add tile writes the printerInstance to Dexie but the wizard unmounts immediately instead of advancing to step 2. No onboarding step/userProfile record is ever persisted (3DCosterDB has no profile store entry; settings store has only fxRateTable + seedState). After reload the wizard never reappears — steps 2 and 3 are unreachable. Auto-skip race re-fires on the wizard's own printer write before the step-advance write lands; the unit-test mocks hid this because only real Dexie liveQuery exhibits the race."
severity: major

### 2. Tauri desktop build visual confirmation
expected: Run `npm run tauri dev` (or a compiled build) — no cookie banner and zero analytics anywhere in the desktop app (compile-time `!__IS_TAURI__` gate). Low-risk one-time check.
result: [pending]

### 3. privacy@3dcoster.com forwarding alias
expected: Email forwarding alias exists and receives mail BEFORE the production deploy that makes /privacy publicly reachable (the page's Contact section names this address). External DNS/email configuration.
result: blocked
blocked_by: third-party
reason: "External email/DNS configuration — must be done by the operator before the production deploy; no deploy has happened yet."

### 4. Manual production DevTools network check (D-13/D-14 hard gate)
expected: Per docs/GATE-VERIFICATION.md, after production deploy: fresh incognito on https://3dcoster.com, hard reload, DevTools Network shows zero /_vercel/insights/* requests before any consent click; beacon fires after Accept All; stays silent after Reject All including across a reload. The GDPR hard gate is not closed until this passes on live production.
result: blocked
blocked_by: release-build
reason: "Requires a production deploy, which is gated behind UAT completion, release review, and the user's DEPLOY_OK=1 — cannot run yet."

## Summary

total: 4
passed: 0
issues: 1
pending: 1
skipped: 0
blocked: 2

## Gaps

- truth: "Onboarding wizard advances from the printer step to the filament step when the user adds a printer via a quick-add tile, and mid-wizard progress survives a page reload (real Dexie persistence)"
  status: failed
  reason: "User reported (automated preview-browser drive): tile click writes printerInstance to Dexie, wizard unmounts instead of advancing; no onboarding step is ever persisted; reload never re-shows the wizard, making steps 2-3 unreachable for new users. Auto-skip re-fires on the wizard's own printer write before the step-advance persists."
  severity: major
  test: 1
  root_cause: "shouldShow (useOnboarding.ts:44) and the auto-advance effect (OnboardingOverlay.tsx:59-64) both key off the same instances.length 0→1 transition in the same render; the effect's `if (!shouldShow || step !== 0) return` guard short-circuits before advanceStep(1) runs, so onboardingStep is never persisted and the overlay renders null forever. The step-0 printer tile onClick only fire-and-forgets addInstance (OnboardingOverlay.tsx:99-107), unlike the step-1 filament tile which calls advanceStep(2) synchronously (OnboardingOverlay.tsx:124-128). Unit tests mock both hooks so the same-render race is invisible (OnboardingOverlay.test.tsx:23-31)."
  debug_session: .planning/debug/onboarding-tile-autoskip-race.md
  artifacts:
    - src/hooks/onboarding/useOnboarding.ts:44
    - src/components/onboarding/OnboardingOverlay.tsx:59-64
    - src/components/onboarding/OnboardingOverlay.tsx:99-107
    - src/hooks/useDatabase.ts:416-469
    - src/components/onboarding/OnboardingOverlay.test.tsx:23-31
  missing:
    - "Direct advanceStep(1) call from the step-0 tile onClick (await addInstance first), mirroring the step-1 tile pattern — or a shouldShow gate decoupled from the instances.length value the advance effect watches"
    - "Real-Dexie (fake-indexeddb, non-mocked) integration test covering the tile-click → advance → reload-resume path"
