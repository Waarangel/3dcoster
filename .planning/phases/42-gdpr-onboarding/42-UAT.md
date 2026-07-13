---
status: partial
phase: 42-gdpr-onboarding
source: [42-VERIFICATION.md]
started: 2026-07-11T00:00:00Z
updated: 2026-07-13T19:30:00Z
---

## Current Test

[testing paused — 1 deploy-gated item outstanding (test 4: production DevTools network check)]

## Tests

### 1. Full-browser onboarding wizard walkthrough (re-test after 42-05 fix)
expected: Clear IndexedDB → reload → wizard at step 0 → printer tile advances to step 1 → filament advances to step 2 → saved job fires completion toast and unmounts overlay → reload does not re-show. Existing-printer profiles never see the wizard. Mid-wizard reload resumes at the same step (real Dexie persistence, not mocks).
result: pass
source: automated (preview-browser drive against live dev server, 2026-07-11, post-42-05)
retest_of: "issue found 2026-07-11 (tile-autoskip race), fixed in 42-05 (commits c4271d7 RED test, dd494b9 GREEN fix)"
evidence: "Fresh DB → wizard STEP 1 OF 3; 'Bambu Lab A1 mini' tile advanced to STEP 2 OF 3 (previously unmounted); mid-wizard reload resumed at STEP 2 (settings.userProfile record now persists — was never written pre-fix); 'Bambu PLA Basic' tile advanced to STEP 3; saving job 'UAT Test Benchy' fired completion toast ('You're ready — save this job or create a quote') and unmounted overlay; reload did not re-show; existing-user simulation (printerInstance present, userProfile deleted) never showed the wizard; zero console errors."

### 2. Tauri desktop build visual confirmation
expected: Run `npm run tauri dev` (or a compiled build) — no cookie banner and zero analytics anywhere in the desktop app (compile-time `!__IS_TAURI__` gate). Low-risk one-time check.
result: pass
source: user (manual desktop-app check, 2026-07-11)

### 3. privacy@3dcoster.com forwarding alias
expected: Email forwarding alias exists and receives mail BEFORE the production deploy that makes /privacy publicly reachable (the page's Contact section names this address). External DNS/email configuration.
result: pass
source: user + automated mailbox verification (2026-07-13)
evidence: "Google Workspace Default routing catch-all (`^.*@3dcoster\\.com$` → envelope-rewrite to support@3dcoster.com, which delivers to marcus@howtoproject.ca). External test mail from waarangel@gmail.com to privacy@3dcoster.com landed in INBOX at 2026-07-13T19:24:27Z (verified via Gmail search). Earlier self-sent tests were hidden by Gmail same-mailbox Message-ID dedupe — not a routing failure. Alias confirmed working BEFORE production deploy, satisfying the ordering requirement."

### 4. Manual production DevTools network check (D-13/D-14 hard gate)
expected: Per docs/GATE-VERIFICATION.md, after production deploy: fresh incognito on https://3dcoster.com, hard reload, DevTools Network shows zero /_vercel/insights/* requests before any consent click; beacon fires after Accept All; stays silent after Reject All including across a reload. The GDPR hard gate is not closed until this passes on live production.
result: blocked
blocked_by: release-build
reason: "Requires a production deploy. USER DECISION 2026-07-13: no deploy until v2.0 is ready — this test is deliberately deferred to the v2.0 launch deploy (post phases 43-45). It is the FIRST item on the launch-day checklist: run docs/GATE-VERIFICATION.md against live 3dcoster.com immediately after the deploy, then re-run /gsd-verify-work 42 to close the phase. Note 2026-07-13: production bundle (index-CCVB6jcp.js) confirmed to contain zero consent code — old build, analytics unconditional — so a pre-deploy 'pass' is impossible by construction."

## Summary

total: 4
passed: 3
issues: 0
pending: 0
skipped: 0
blocked: 1

## Gaps

- truth: "Onboarding wizard advances from the printer step to the filament step when the user adds a printer via a quick-add tile, and mid-wizard progress survives a page reload (real Dexie persistence)"
  status: closed (fixed in 42-05, re-verified pass 2026-07-11 via automated preview-browser drive)
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
