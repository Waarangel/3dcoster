---
status: testing
phase: 42-gdpr-onboarding
source: [42-VERIFICATION.md]
started: 2026-07-11T00:00:00Z
updated: 2026-07-11T00:00:00Z
---

## Current Test

number: 1
name: Full-browser onboarding wizard walkthrough
expected: |
  In a browser with cleared IndexedDB (or fresh incognito profile) on http://localhost:4173:
  wizard appears at step 0 → add a printer via quick-add tile → advances to step 1 →
  add a filament → advances to step 2 → save a first job → completion toast fires and
  overlay unmounts → reload → wizard does NOT reappear. Separately: a profile that
  already owns a printer never sees the wizard at all. Mid-wizard reload resumes at the
  same step.
awaiting: user response

## Tests

### 1. Full-browser onboarding wizard walkthrough
expected: Clear IndexedDB → reload → wizard at step 0 → printer tile advances to step 1 → filament advances to step 2 → saved job fires completion toast and unmounts overlay → reload does not re-show. Existing-printer profiles never see the wizard. Mid-wizard reload resumes at the same step (real Dexie persistence, not mocks).
result: [pending]

### 2. Tauri desktop build visual confirmation
expected: Run `npm run tauri dev` (or a compiled build) — no cookie banner and zero analytics anywhere in the desktop app (compile-time `!__IS_TAURI__` gate). Low-risk one-time check.
result: [pending]

### 3. privacy@3dcoster.com forwarding alias
expected: Email forwarding alias exists and receives mail BEFORE the production deploy that makes /privacy publicly reachable (the page's Contact section names this address). External DNS/email configuration.
result: [pending]

### 4. Manual production DevTools network check (D-13/D-14 hard gate)
expected: Per docs/GATE-VERIFICATION.md, after production deploy: fresh incognito on https://3dcoster.com, hard reload, DevTools Network shows zero /_vercel/insights/* requests before any consent click; beacon fires after Accept All; stays silent after Reject All including across a reload. The GDPR hard gate is not closed until this passes on live production.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
