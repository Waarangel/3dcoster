---
phase: 34-live-papercut-fixes
plan: 01
subsystem: web-shell
tags: [pwa, service-worker, scroll, routing, regression-lock]
dependency_graph:
  requires: []
  provides: [FIX-01-pwa-reload, FIX-02-scroll-to-top]
  affects: [src/components/PwaUpdatePrompt.tsx, src/components/ScrollToTop.tsx, src/main.tsx]
tech_stack:
  added: []
  patterns: [service-worker-controllerchange-reload, useLocation-pathname-effect]
key_files:
  created:
    - src/components/ScrollToTop.tsx
    - src/components/ScrollToTop.test.tsx
    - src/test/stubs/pwaRegister.ts
    - src/components/PwaUpdatePrompt.test.tsx
  modified:
    - src/components/PwaUpdatePrompt.tsx
    - src/main.tsx
    - vitest.config.ts
decisions:
  - "FIX-01 verified via cherry-pick of 496d829 — not rebuilt; implementation confirmed correct with both code paths present"
  - "FIX-02 cherry-picked cleanly from 4da205f (test/design-skills-experiment) with no conflicts on main.tsx"
  - "ScrollToTop test uses a single MemoryRouter render with a NavHook that captures the navigate() function, enabling real in-process route changes without re-mounting"
  - "behavior: 'auto' (instant) chosen over 'smooth' — smooth fights per-page reveal animations per React Router best practice"
metrics:
  duration: "~10 minutes"
  completed: "2026-06-25"
  tasks_completed: 2
  files_changed: 7
---

# Phase 34 Plan 01: FIX-01 + FIX-02 PWA Reload & ScrollToTop Summary

Two web-shell papercut fixes verified, test-locked, and committed: the PWA "Reload" button reliably reloads onto a new version even on uncontrolled pages, and SPA route navigation now lands at the top of the destination page with #hash anchors left untouched.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Verify FIX-01 PWA Reload regression | c95d8b3 | PwaUpdatePrompt.tsx, PwaUpdatePrompt.test.tsx, stubs/pwaRegister.ts, vitest.config.ts |
| 2 | Add ScrollToTop and mount in router (FIX-02) | 74dcc00 + a012043 | ScrollToTop.tsx, main.tsx, ScrollToTop.test.tsx |

## What Was Built

### FIX-01: PWA "Reload" button — both paths regression-locked

`PwaUpdatePrompt.tsx` already had the two-path `handleReload` from commit `496d829` (cherry-picked from the `v1.9-hardening` branch which held the pre-built fix). The implementation was verified:

- **Controlled-page path** (worker waiting): registers a one-time `controllerchange` listener → calls `updateServiceWorker(true)` → reloads on `controllerchange` → 2s `setTimeout` safety net.
- **Uncontrolled-page path** (fresh load / hard refresh, nothing waiting): calls `window.location.reload()` immediately.

`PwaUpdatePrompt.test.tsx` (2 tests) locks both paths:
1. "reloads immediately when no worker is waiting (uncontrolled page — the bug)" — asserts `window.location.reload()` called once.
2. "asks the waiting worker to take over, then reloads on controllerchange" — asserts `updateServiceWorker(true)` called, reload deferred until `controllerchange` fires.

`vitest.config.ts` aliases `virtual:pwa-register/react` to `src/test/stubs/pwaRegister.ts`.

### FIX-02: ScrollToTop — route navigation lands at top of page

`ScrollToTop.tsx` cherry-picked cleanly from commit `4da205f` (test/design-skills-experiment branch):

```tsx
export function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) return;                                           // #hash anchors: browser handles
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });   // instant, not smooth
  }, [pathname, hash]);
  return null;
}
```

Mounted inside `<BrowserRouter>` in `src/main.tsx` (sibling of `<Suspense>`, before the routes).

`ScrollToTop.test.tsx` (3 tests) locks all specified behaviors:
1. Pathname change scrolls to top (calls `window.scrollTo({ top:0, left:0, behavior:'auto' })`).
2. Hash-only change does NOT trigger scroll-to-top — `#hash` anchors left for the browser.
3. Renders `null` — no DOM output.

## Test Results

```
PwaUpdatePrompt: 2/2 passed
ScrollToTop:     3/3 passed
Full suite:    670/670 passed (1 pre-existing todo)
tsc -b: clean
```

## Deviations from Plan

### Worktree bootstrap — cherry-picked 5 commits from v1.9-hardening

**Found during:** Execution start.

**Issue:** The worktree branch (`worktree-agent-ab74a18ad2eafa258`) was based off `main` at `42d9401` — it was missing 5 commits that existed on `v1.9-hardening`: the PWA fix (`496d829`), 3 planning docs commits, and the phase plan commit. Without these, FIX-01 would have appeared not-yet-built.

**Fix:** Cherry-picked all 5 commits (`496d829 6fdc134 8463f44 f0e3000 feb40c2`) onto the worktree branch. All applied cleanly.

**Impact:** No functional change — this was bootstrapping the worktree to include already-completed work.

### ScrollToTop cherry-pick applied cleanly (no manual port needed)

The plan anticipated a possible conflict on `src/main.tsx`. Commit `4da205f` cherry-picked with no conflicts — `main.tsx` on this branch already matched the expected base.

## Known Stubs

None. No stub patterns found in files created or modified by this plan.

## Threat Flags

No new security-relevant surface was introduced. Both changes are browser-API-only (`window.location.reload()`, `window.scrollTo`) with no user input crossing the trust boundary, consistent with the plan's threat model.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| src/components/PwaUpdatePrompt.tsx | FOUND |
| src/components/PwaUpdatePrompt.test.tsx | FOUND |
| src/test/stubs/pwaRegister.ts | FOUND |
| src/components/ScrollToTop.tsx | FOUND |
| src/components/ScrollToTop.test.tsx | FOUND |
| .planning/phases/34-live-papercut-fixes/34-01-SUMMARY.md | FOUND |
| Commit c95d8b3 (PWA fix) | FOUND |
| Commit 74dcc00 (ScrollToTop) | FOUND |
| Commit a012043 (ScrollToTop test) | FOUND |
