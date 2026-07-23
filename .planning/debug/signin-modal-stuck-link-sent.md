# Debug Session: SignInModal stuck on code step after abandoned sign-in (G-46-4, UAT test 4)

- **Date:** 2026-07-23
- **Phase/Gap:** 46 UAT, gap G-46-4
- **Mode:** find_root_cause_only (no source edits)
- **Status:** ROOT CAUSE FOUND

## Symptom

- **Expected:** Reopening "Sign in for Pro" after abandoning a sign-in attempt lets the user start over (type an email, request a new code).
- **Actual (user, verbatim):** "The email field is restricted. I cannot type in it. I think it's stuck on waiting for the verification code from last test" — screenshot: modal open, EMPTY but disabled email field, one-time-code step visible, Verify code disabled.
- **Workaround that worked:** full quit + relaunch of the desktop app.

## Root Cause

`useProAuth`'s `status` state is trapped at `'link-sent'` for the lifetime of the app session, and the SignInModal (with its `useProAuth` instance) is **never unmounted**, so closing and reopening the modal cannot reset it. There is **no code path in the entire app** that returns `status` from `'link-sent'` to `'signed-out'` short of an actual Supabase auth event or a full app restart.

### Causal chain (with exact references)

1. **SignInModal is permanently mounted.**
   `src/App.tsx:363-366` renders `<SignInModal isOpen={showSignInModal} onClose={() => setShowSignInModal(false)} />` unconditionally. `src/components/ui/Modal.tsx:67` (`if (!isOpen) return null;`) hides only the Modal's *children* — the "HYG-09 absorption" comment at Modal.tsx:65-66 promises "consumers no longer need close-reset useEffects" because children unmount, **but SignInModal itself is the Modal's *parent*, not its child**. SignInModal's own hooks (`useState` email/code at SignInModal.tsx:47-48 and the `useProAuth()` call at SignInModal.tsx:45) live above the `isOpen` cut and survive every close/reopen cycle.

2. **`status` is per-instance state with no reset path.**
   `src/hooks/useProAuth.ts:54-56` — `status` is plain `useState`. `signInWithEmail` sets `'sending-link'` (line 93) then `'link-sent'` (line 107). The ONLY things that ever leave `'link-sent'`:
   - `onAuthStateChange` firing SIGNED_IN/SIGNED_OUT (lines 77-83) — requires the user to actually complete or already have auth;
   - a signInWithEmail *error* (lines 104, 111);
   - `signOut()` (line 141) — but SignInModal doesn't destructure `signOut`, and calling it while signed out is semantically wrong anyway.
   The hook exposes **no `reset`/`cancel` action** in its `ProAuth` interface (lines 25-50).

3. **`'link-sent'` disables the email input and shows the code step.**
   `src/components/pro/SignInModal.tsx:58` — `codeStepVisible = status === 'link-sent'`; line 115 — `disabled={codeStepVisible}` on the email `Input`; lines 134-167 — the code form renders whenever `codeStepVisible`. Verify is disabled (line 160) because `code` is empty after reset.

4. **`resetAndClose` clears the wrong state.**
   `SignInModal.tsx:61-65` — `resetAndClose` clears the *local* `email`/`code` state and calls `onClose`. It **cannot** touch `status` (owned by useProAuth). So the code-step Cancel button (line 154) empties the email field, closes the modal… and leaves `status === 'link-sent'`. Reopen ⇒ **empty + disabled email field + code step visible + Verify disabled** — this is pixel-for-pixel the user's screenshot. (The empty field tells us the user abandoned via the code-step Cancel button, which routes through `resetAndClose`.)

5. **Why relaunch fixed it:** app restart remounts App ⇒ fresh `useProAuth` instance ⇒ `getSession()` finds no session ⇒ `status` initializes to `'signed-out'` (useProAuth.ts:54-56).

### Inconsistent close paths (secondary defect, same flow)

- Code-step **Cancel** button → `resetAndClose` (clears email/code, status still stuck).
- Modal **X button** (Modal.tsx:90), **backdrop click** (Modal.tsx:61-63), and **Escape** (via `useDialogA11y`, Modal.tsx:59) → call the raw `onClose` prop that SignInModal passes straight through at line 93. These close **without clearing email/code at all** — so an X-close reopens with the *stale email still populated* AND the stuck code step. Two different abandonment gestures produce two different broken states.
- Email-step Cancel (line 120) also uses raw `onClose` (not `resetAndClose`) — stale email survives, though at that stage status is still `'signed-out'` so it's merely cosmetic.

## Why tests didn't catch it

`src/components/pro/SignInModal.test.tsx` **mocks `useProAuth` entirely** with a frozen `status: 'link-sent'` (lines 24-34) — the mock's status can never transition, so no test can even express "close, reopen, expect email step." The whole suite (6 tests, lines 88-164) covers only OTP code-length/input-sanitization regression from 46-02. There is:
- no test rendering the email step (`status: 'signed-out'`);
- no test of the `signed-out → link-sent` transition in the component;
- no close-and-reopen test;
- no test that Cancel/X restores a usable email field.

`src/hooks/useProAuth.test.tsx` tests the hook in isolation (14 cases) and correctly documents the trap without recognizing it: it verifies `link-sent` is reached (line 178) and that only auth events or errors leave it — there is no test asserting any user-driven way back from `'link-sent'`, because none exists.

The integration seam — modal-open lifecycle × hook status persistence — is exactly what the unit-level mocking erased.

## Hypotheses considered and eliminated

- **Multiple useProAuth instances fighting each other:** 6 call sites exist (UserProfileModal, ShareQuoteButton, BillingPanel, useEntitlement, usePublishedQuote, SignInModal), each with independent `status`. Irrelevant here: only SignInModal's own instance drives `codeStepVisible`, and only that instance's `signInWithEmail` runs. Not the cause, but note each instance has divergent `status` by design (session/isSignedIn stay consistent via onAuthStateChange).
- **Supabase client caching/session persistence:** `getSession()` seeding (useProAuth.ts:65-73) only ever *upgrades* to `'signed-in'`; it cannot produce `'link-sent'`. Ruled out.
- **Desktop (Tauri) specificity:** nothing in the trap branches on `__IS_TAURI__`; the same bug reproduces on web. Desktop was just where UAT ran.

## Secondary UX gaps in the same flow (for the gap-closure planner)

1. **No recovery even while the modal stays open:** once `'link-sent'`, there is no "Use a different email", "Resend code", or "Back" affordance. A user who typo'd their email is hard-stuck in-session too — the reopen bug is just the most visible symptom of "no way back from link-sent."
2. **Email state survives X/backdrop/Escape close** (raw `onClose` at SignInModal.tsx:93/120 vs `resetAndClose` at line 154) — the two close paths should behave identically.
3. **No resend cooldown messaging:** Supabase built-in email service is rate-limited to a few emails/hour (module comment, SignInModal.tsx:24-26); any "start over / resend" fix should surface send failures clearly since retries may hit that limit.

## Suggested fix direction (not implemented — find_root_cause_only)

Give the flow an explicit user-driven exit from `'link-sent'`. Options, roughly in order of preference:

- **A (hook-level, minimal):** add a `resetSignIn()` (or `cancelSignIn()`) action to `useProAuth` that does `setStatus(supabase ? 'signed-out' : 'unavailable')` when not signed in; have SignInModal call it from a single unified close handler AND from a new "Use a different email" link on the code step. Route ALL close paths (X/backdrop/Escape/Cancel) through `resetAndClose` by passing `resetAndClose` as the Modal's `onClose` (SignInModal.tsx:93).
- **B (component-level):** stop deriving `codeStepVisible` directly from hook status; keep a local step state that resets when `isOpen` transitions false→true (or key the modal contents on open). Weaker — leaves the hook's dead-end state machine in place.
- Whatever is chosen, add the missing tests: unmocked-status component test covering send → close (each path) → reopen ⇒ email step editable; and a hook test for the new reset action.

## Files Involved

- `src/hooks/useProAuth.ts` — `status` state machine has no user-driven exit from `'link-sent'` (lines 54-56, 91-114; no reset action in interface lines 25-50).
- `src/components/pro/SignInModal.tsx` — derives UI lock from the trapped status (lines 58, 115); `resetAndClose` can't reset status (61-65); inconsistent close paths (93 vs 120 vs 154).
- `src/App.tsx` — permanent mount of SignInModal (363-366); correct per current Modal conventions, but it's why nothing self-heals on close.
- `src/components/ui/Modal.tsx` — HYG-09 children-unmount guarantee (65-67) does not cover the Modal's *parent* component's state; X/backdrop/Escape call `onClose` directly (59-63, 90).
- `src/components/pro/SignInModal.test.tsx` — mocks useProAuth with frozen `'link-sent'`; no lifecycle coverage.
