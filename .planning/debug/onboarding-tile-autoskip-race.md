---
status: diagnosed
created: 2026-07-11
phase: 42
severity: major
issue: onboarding-tile-autoskip-race
---

## Symptoms

**Expected:** Fresh profile (empty Dexie) → wizard shows step 1/3 (add printer) → clicking the
"Bambu Lab A1 mini" quick-add tile adds the printer AND advances the wizard to step 2/3 (add
filament) → step index is persisted to Dexie so a reload resumes at step 2.

**Actual:** Tile click writes the `printerInstance` row to Dexie (confirmed:
`3DCosterDB.printerInstances` has the `bambu-a1-mini` instance), but the wizard disappears
instead of advancing. No `onboardingStep`/`onboardingCompletedAt` value is ever persisted anywhere
(`settings` table has no `userProfile` row reflecting a step change — `settings` only contains
`fxRateTable` and `seedState` keys in the repro, meaning `userProfile` was never written at all in
this session). After reload the wizard never reappears — steps 2 and 3 are unreachable.

**Errors:** None in console — this is a silent logic race, not a thrown exception.

**Repro:** Live dev server on :4173, cleared IndexedDB + localStorage + cookies, navigate to
`/app`, click "Bambu Lab A1 mini" tile in the Guided setup dialog.

**Prior attempted fix:** Commit `3dbe7b9` ("fix(42-02): resume mid-wizard despite auto-skip once a
printer exists") added a `step > 0` disjunct to `shouldShow` in `useOnboarding.ts`, intending to
keep the overlay visible once real progress had been made. It does not fix this bug — see Root
Cause.

## Investigation Log

### Hypothesis 1 — `advanceStep` write throws / rejects silently
Checked `useOnboarding.ts:46-48` (`advanceStep`) and `useDatabase.ts:587-590` (`updateProfile` →
`setUserProfile`) → `database.ts:480-481` (`setUserProfile` → `setSetting`) →
`database.ts:320-322` (`setSetting` → `db.settings.put({ key, value: JSON.stringify(value) })`).
No try/catch swallowing errors; `db.settings.put` is a standard Dexie call. **Rejected** — if
`advanceStep` were called and threw, it would surface in the console (per symptoms: none). The
real issue, confirmed below, is that `advanceStep` is never *called* for this transition at all.

### Hypothesis 2 — no persistence table exists for the profile/onboarding step
Checked `database.ts` schema across all 12 `.version(N).stores({...})` blocks (v1 line 28 through
v12 line 267) — every version defines only `settings: 'key'` as a generic key/value store; there
is no dedicated `userProfile` table. This is **by design**, not a bug: `UserProfile` (including
`onboardingStep`/`onboardingCompletedAt`, `types.ts:611-617`) is JSON-serialized into a single
`settings` row keyed `'userProfile'` (`database.ts:325-333` `settingsKeys.userProfile`), exactly
like `taxJurisdiction` and other profile-shaped settings. `UserProfileModal.tsx` reads/writes
through the exact same `useUserProfile()`/`updateProfile` path (wired via `App.tsx:163-164`), so
there is only one profile persistence path in the app and it is not missing. **Rejected as
primary cause**, but relevant context: because there's no dedicated table, `useUserProfile` is
NOT `useLiveQuery`-reactive (see Hypothesis 3) — it's a one-shot load + optimistic local state,
unlike `usePrinterInstances`.

### Hypothesis 3 (confirmed) — `shouldShow` and the auto-advance effect race on the same
`instances.length` transition, so `advanceStep(1)` is never invoked

Traced the exact reactive wiring:

- `usePrinterInstances` (`useDatabase.ts:416-469`) uses real Dexie reactivity:
  `useLiveQuery(() => db.printerInstances.toArray(), [])` (line 418). `addInstance` calls
  `db.printerInstances.add(instance)` (line 433) — a real async Dexie write.
- `useUserProfile` (`useDatabase.ts:572-593`) is **not** liveQuery-reactive: it's `useState` +
  a mount-only `useEffect` (`[]` deps, line 585) that loads once via `getUserProfile`.
  `updateProfile` (lines 587-590) does an optimistic `setProfileState(value)` (synchronous) and
  then `await setUserProfile(value)` (the Dexie write).
- `useOnboarding.ts:44`:
  ```
  const shouldShow = !profileLoading && !instancesLoading && !isDone && (instances.length === 0 || step > 0);
  ```
  This formula reads `instances.length` **directly** from the live `usePrinterInstances` value —
  the same value the auto-advance effect watches.
- `OnboardingOverlay.tsx:59-64`:
  ```tsx
  useEffect(() => {
    if (!shouldShow || step !== 0) return;
    if (instances.length > 0) {
      advanceStep(1);
    }
  }, [shouldShow, step, instances.length, advanceStep]);
  ```
  This is the ONLY place `advanceStep(1)` is ever called for the printer step. The tile's own
  `onClick` (`OnboardingOverlay.tsx:99-107`) calls only `addInstance(instance)` — fire-and-forget,
  not awaited, and never calls `advanceStep` directly.

**The race, step by step:**

1. Initial state: `step === 0`, `instances === []` → `shouldShow = true` (via `instances.length
   === 0`). Overlay renders the printer step.
2. User clicks the tile → `addInstance(instance)` fires `db.printerInstances.add(...)`
   (fire-and-forget promise, `OnboardingOverlay.tsx:106`).
3. The Dexie write commits; `usePrinterInstances`'s `useLiveQuery` re-emits with
   `instances = [oneItem]`, triggering a re-render of every component subscribed to it —
   including both the direct `usePrinterInstances()` call in `OnboardingOverlay.tsx:33` and the
   one inside `useOnboarding()` (`useOnboarding.ts:31`).
4. **On this exact re-render**, `useOnboarding()` recomputes `shouldShow`. At this instant
   `profile.onboardingStep` is STILL `0` — nothing has written a new value yet, since the only
   writer (`advanceStep(1)`) hasn't run. So `shouldShow = (instances.length === 0 || step > 0)` →
   `(false || false)` → **`false`**.
5. Because React calls all hooks (including `useEffect` registrations) unconditionally before any
   conditional `return null`, the effect at `OnboardingOverlay.tsx:59-64` is still registered with
   its dependency array `[shouldShow, step, instances.length, advanceStep]` reflecting THIS
   render's values: `shouldShow=false, step=0, instances.length=1`. When React runs the effect
   after commit, its guard `if (!shouldShow || step !== 0) return;` sees `shouldShow === false`
   and **returns immediately — `advanceStep(1)` is never called.**
6. Simultaneously, the component's own render (same pass) hits `if (!shouldShow) return null;`
   (`OnboardingOverlay.tsx:94`) and renders nothing — the wizard visually disappears.
7. Because `advanceStep(1)` was never invoked, `onboardingStep` is never written to
   `settings['userProfile']` — nothing persists, so a reload has no `step` to resume from and
   `shouldShow` permanently evaluates to `instances.length === 0` → `false` (a printer now
   exists) `|| step > 0` → `false` (step was never persisted past `0`) = **permanently false**.
   The wizard is gone for good, matching the reported symptom exactly.

The comment block at `useOnboarding.ts:35-44` explains the INTENT of the `step > 0` guard (added
in `3dbe7b9`) — to keep the overlay visible "once real progress has been made" — but the fix
implicitly assumes `step` becomes `>0` *before or simultaneously with* the render where
`instances.length` flips non-zero. In reality the step write is causally *downstream* of that
same render (it's supposed to happen inside an effect gated on `shouldShow`, which has already
gone false by the time that effect runs). The guard added in `3dbe7b9` protects steps 1 and 2
correctly (their `shouldShow` checks don't depend on a "did I just cross zero" edge tied to the
same value that flips visibility), but for the printer step specifically, `shouldShow`'s own
formula and the effect that's supposed to keep it alive both key off the identical
`instances.length` signal, on the identical render, with `shouldShow` evaluated (and consumed at
line 94 and inside the effect's own guard at line 60) before `step` can catch up.

### Why unit tests never caught this
`OnboardingOverlay.test.tsx` mocks BOTH `useOnboarding` (line 23-25, `mockUseOnboarding`, fully
stubbed return value including a static `shouldShow` boolean the test sets directly) AND
`usePrinterInstances` (line 27-31, always returns `{ instances: [], addInstance: mockAddInstance
}` — `instances` never changes length within a test). Neither mock can ever produce the
same-render interaction between a live-updating `instances.length` and a not-yet-updated `step`
that real Dexie `liveQuery` timing produces. `useOnboarding.test.ts` (not fully quoted here, but
per file header/UAT context) similarly tests the hook's pure derivation in isolation, not wired
through `OnboardingOverlay`'s effect against a real, asynchronously-updating `usePrinterInstances`.
This is a genuine integration-timing bug invisible to both test suites' mocking strategy —
confirmed as the first real-browser exercise of the wizard per the UAT note.

## Root Cause

`useOnboarding.ts:44`'s `shouldShow` formula reads `instances.length` directly
(`instances.length === 0 || step > 0`), and `OnboardingOverlay.tsx:59-64`'s auto-advance effect —
the ONLY code path that ever calls `advanceStep(1)` for the printer step — guards its body on
`!shouldShow`. Both react to the identical `instances.length` transition (0 → 1) on the identical
render. Because `shouldShow` recomputes to `false` in that same render (since `step` is still `0`
and `instances.length` is no longer `0`), the effect's own `!shouldShow` guard short-circuits
before `advanceStep(1)` can run. The write that was supposed to make `step > 0` (and thus keep
`shouldShow` true) never happens, so nothing is ever persisted to `settings['userProfile']`, and
the overlay renders `null` permanently — matching the confirmed UAT reproduction exactly.

## Affected Artifacts

- `src/hooks/onboarding/useOnboarding.ts:44` — `shouldShow` formula couples visibility directly to
  the same `instances.length` signal the advance-effect depends on.
- `src/components/onboarding/OnboardingOverlay.tsx:59-64` — auto-advance `useEffect` guards on
  `!shouldShow`, which has already flipped false by the time this effect evaluates on the
  instances-length-transition render.
- `src/components/onboarding/OnboardingOverlay.tsx:99-107` — tile `onClick` calls only
  `addInstance(instance)` (fire-and-forget, unawaited); it never calls `advanceStep` directly,
  making the effect the sole (and racy) trigger for the step-0→1 transition.
- `src/hooks/useDatabase.ts:416-469` (`usePrinterInstances`, real `useLiveQuery`) vs.
  `src/hooks/useDatabase.ts:572-593` (`useUserProfile`, one-shot `useState`, NOT liveQuery-backed)
  — the asymmetric reactivity between the two hooks is what makes the race observable: printer
  instances update reactively and immediately; the profile/step does not, and is never given the
  chance to update first.
- `src/db/database.ts:267-279` (v12 schema) / `database.ts:320-333` / `database.ts:480-482` —
  confirms `onboardingStep` has exactly one persistence path (`settings['userProfile']`, via
  `setUserProfile`/`setSetting`/`db.settings.put`) and that path is simply never reached for this
  transition — not a missing-table or wrong-table issue.
- Commit `3dbe7b9` — the previous fix attempt; its `step > 0` disjunct in `shouldShow` cannot help
  the very first 0→1 transition because at that instant `step` is by definition still `0`.
- Test gaps (not root cause, but explains why this shipped): `src/components/onboarding/OnboardingOverlay.test.tsx:23-31`
  mocks both `useOnboarding` and `usePrinterInstances` as static values, so the real-timing
  interaction between a live-updating `instances.length` and a not-yet-updated `step` is never
  exercised.

## Missing

- A persisted step-advance write that happens independently of (or prior to) the
  `instances.length`-driven `shouldShow` recomputation — currently there is no ordering guarantee
  between "printer write commits and instances.length updates" and "step advances," even though
  the wizard's visibility is gated on both.
- Any direct call to `advanceStep(1)` from the tile's own `onClick` handler (unlike the step-1
  filament tile, which calls `advanceStep(2)` synchronously and does NOT depend on any Dexie
  round-trip — see `OnboardingOverlay.tsx:124-128` for the working pattern).
- A real-Dexie (non-mocked, e.g. `fake-indexeddb`) integration test exercising `OnboardingOverlay`
  + `useOnboarding` + `usePrinterInstances` together, which would have caught this timing gap
  before UAT.

## Suggested Fix Direction

The step-0 tile should not rely on an effect reacting to a side-channel signal (`instances.length`)
that also feeds the visibility gate it needs to survive. Two viable directions, not implemented
here per the diagnosis-only scope: (1) make the tile's `onClick` itself await `addInstance(...)`
and then explicitly call `advanceStep(1)` afterward — mirroring the step-1 filament tile's direct,
non-racy `onClick: () => advanceStep(2)` pattern — removing the effect-based auto-advance for step
0 entirely (the effect would still be needed to catch a manual add via the "Mine isn't listed" →
real Printers tab flow, so it likely needs to stay for that path but should no longer be the sole
path for the tile itself); or (2) decouple `shouldShow`'s visibility gate from `instances.length`
once the wizard has genuinely started (e.g. track "wizard has been shown at least once" in a way
that isn't computed from the exact same value the advance-effect is watching), so the effect's
`!shouldShow` guard can't go false before it has a chance to run its body on the same render the
`instances.length` transition occurs.
