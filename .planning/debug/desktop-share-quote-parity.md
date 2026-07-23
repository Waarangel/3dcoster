# Debug Session: Desktop Share-Quote Parity (Phase 46 UAT gap G-46-6, test 6)

**Date:** 2026-07-23
**Type:** Scope gap (deliberate web-only gating), not a crash
**Truth:** ALL Pro features — including Share-quote publishing — must work on BOTH web and desktop for v2.0 launch. No web-only Pro features.
**Actual:** Share-quote button renders nothing on desktop; publishing is web-only by an explicit, documented Phase 46-02 scope decision.

---

## 1. Root cause — the gate (single, self-contained)

There is exactly ONE code gate that hides Share-quote on desktop:

| # | File:Line | Gate | Effect |
|---|-----------|------|--------|
| 1 | `src/components/pro/ShareQuoteButton.tsx:38` | `if (__IS_TAURI__) return null; // D-12: Pro is web-only` | Component self-gates. Both branches vanish on desktop: the signed-out "Share quote [Pro]" pitch chip AND the signed-in Share/Unpublish button. |

The gate is deliberately **self-contained** (comment at lines 15–17: "renders nothing under `__IS_TAURI__` regardless of caller — so every mount site stays correct even if a future caller forgets to gate it"). Consequence: **no mount site needs changes** — removing line 38 re-enables the button everywhere at once.

Mount sites (all unconditional, no extra gating):
- `src/components/JobsManager.tsx:345` (pending-quote row) and `:395` (declined-quote row)
- `src/components/PrintQuoteModal.tsx:620` (quote editing view)

Related but SEPARATE gate (not Share-quote; flag for planner):
- `src/components/pro/BillingPanel.tsx:50` — `if (__IS_TAURI__) return null; // D-12: Pro billing is web-only`. Billing/checkout management via Paddle MoR was kept web-only as its own decision (see `src/components/UserProfileModal.tsx:48` and `:69` comments). If the founder's "no web-only Pro features" truth extends to billing management, that is a second, independent gap — the Share-quote fix does not require touching it, but the gap-closure planner should get an explicit founder call on it.

Companion test that pins the current (wrong) behavior:
- `src/components/pro/ShareQuoteButton.test.tsx:100–105` — `it('renders nothing under __IS_TAURI__')` stubs `__IS_TAURI__ = true` and asserts empty render. Must be inverted to assert the button renders on desktop.

UAT doc that encodes the old scope:
- `.planning/phases/46-white-label-quotes/46-UAT.md:40` — test 6 "expected" text literally says "the Share-quote button stays ABSENT everywhere on desktop (publishing remains web-only)". The UAT expectation itself was written to the superseded scope; test 6's expected text needs rewriting along with the fix.

## 2. Historical rationale (what the fix supersedes)

Decision chain, in order:

1. **Phase 43 D-12** (`.planning/phases/43-pro-backend/43-CONTEXT.md:32`): "Web first; desktop parity by launch." Phase 43 shipped Pro fully web-only; Tauri auth was explicitly deferred to "a follow-up before the Phase 45 launch tag." At that time `supabaseClient.ts` returned `null` whenever `__IS_TAURI__` was true, so ALL Pro surfaces were dead on desktop.
2. **Phase 46 D-08** (`.planning/phases/46-white-label-quotes/46-CONTEXT.md:30` + line 11): scope expansion — desktop Pro **auth** ships in Phase 46 via email OTP code entry, "so white-label works on desktop too."
3. **46-RESEARCH flagged the ambiguity** (`46-RESEARCH.md:408` Assumption A5, and Open Question 1 at line 414): does D-08 include desktop *publishing* (`ShareQuoteButton`), or only sign-in + entitlement so the white-label PDF works? Research warned the planner not to assume.
4. **46-02-PLAN resolved it NARROWLY** (`.planning/phases/46-white-label-quotes/46-02-PLAN.md:49`): "Hosted-quote PUBLISHING (`ShareQuoteButton`) stays web-only — its `if (__IS_TAURI__) return null` gate is DELIBERATELY left in place this phase. The phase goal is PDF + hosted-page BRANDING, not desktop publishing; a desktop Pro user can still open 3dcoster.com in a browser to publish. Do not remove ShareQuoteButton's gate." Rationale was scope containment (the phase's "days" estimate) plus the web-workaround.
5. **46-02 execution honored it** (`46-02-SUMMARY.md:44, 150–151, 157–168`): stale `!__IS_TAURI__` gates were removed from `App.tsx` (SignInModal mount) and `UserProfileModal.tsx` (Account & Pro section) so desktop OTP auth became reachable; `ShareQuoteButton` and `BillingPanel` self-gates were deliberately preserved.
6. **G-46-6** (`46-UAT.md:74–77`): the founder's repeated product decision — "ALL Pro features need to work on web and desktop for v2.0 launch. No exceptions." — supersedes the 46-02 scope decision.

So the root cause is not an oversight: it is a **documented planner scope decision (46-02-PLAN.md line 49) that conflicts with a standing founder requirement**, and the fix must explicitly supersede that documented decision (plan text, code comments, summary claims, and the UAT test-6 expectation all encode the old scope).

## 3. What desktop enablement actually needs

### Already working on desktop (verified — no work needed)
- **Supabase client**: `src/lib/supabaseClient.ts` — Phase 46-02 removed the Tauri null-gate; the client is constructed on desktop under the same env-var-only gate as web (module doc explicitly says "D-08 reverses Phase 43's D-12"). Session persists in WebView localStorage (accepted threat model T-46-04).
- **Auth**: `useProAuth` + `SignInModal` OTP code entry work on desktop (46-02, human-verified checkpoint); no `__IS_TAURI__` branch anywhere in the auth path. `useProAuth.ts` / `useEntitlement.ts` contain zero Tauri references.
- **Entitlement check**: `usePublishedQuote.ts:84–96` `hasActiveEntitlement()` is a plain RLS-scoped Supabase read — platform-agnostic.
- **Network/CSP**: Tauri CSP `connect-src` already includes `https://*.supabase.co` (`src-tauri/tauri.conf.json`, added 46-02 per T-46-03); `release.yml` injects `VITE_SUPABASE_*` into desktop builds (46-02 Task 1).
- **The whole publish/unpublish/refreshStatuses data layer**: `src/hooks/usePublishedQuote.ts` has NO platform gate. In fact `refreshStatuses` is already CALLED unconditionally on desktop today (`JobsManager.tsx:1198`) and works — hosted approve/decline status pull-back is already desktop-functional. The "Live link" badge (`JobsManager.tsx:317–321`) is ungated too.
- **Pitch surfaces**: `ProPitchModal` / `SignInModal` already render on desktop (used by the Phase 46 `BrandingSection` Pro chip, D-13).

### Browser-API audit of the publish flow (blockers: NONE)
- `navigator.clipboard?.writeText(url)` — `ShareQuoteButton.tsx:76`. Optional-chained inside try/catch; on failure the toast still shows the full URL (`:79`). Tauri WebViews (WKWebView/WebView2) generally expose `navigator.clipboard` in their secure custom-protocol context, but reliability varies (notably WebKitGTK on Linux). **Not a blocker** (graceful fallback exists). For a first-class copy experience the planner may add `tauri-plugin-clipboard-manager` — currently NOT installed (`src-tauri/Cargo.toml` has only shell, window-state, dialog, fs, persisted-scope).
- `crypto.randomUUID()` — `usePublishedQuote.ts:72`, available in all Tauri WebViews and has an explicit fallback (`:76`). Non-issue.
- **No `window.open` / `navigator.share` anywhere in the publish flow.** The hosted URL (`https://3dcoster.com/q/<token>`, built at `usePublishedQuote.ts:160`) is only ever copied/toasted; `publishedUrl` on the Quote is not rendered as a link anywhere (`types.ts:428` is the only other reference). If the planner adds an "open hosted page" affordance on desktop, the established pattern is `UpdateBanner.tsx:70–83`: dynamic `import('@tauri-apps/plugin-shell')` → `open(url)` with `window.open` fallback; the `shell:default` capability is already granted (`src-tauri/capabilities/default.json:8`) and includes `allow-open`.

### Minimal change set for parity
1. Delete `ShareQuoteButton.tsx:38` (and rewrite the D-12 comment block at lines 11–23).
2. Invert `ShareQuoteButton.test.tsx:100–105` to assert the button RENDERS under `__IS_TAURI__`.
3. Rewrite `46-UAT.md` test-6 expected text (line 40) to match the new truth.
4. Decide + document: clipboard plugin (optional robustness) and whether an "open hosted page" desktop affordance is wanted (optional, pattern exists).
5. Founder decision needed on `BillingPanel.tsx:50` — is billing management inside "ALL Pro features," or does the Paddle-checkout-stays-in-browser rationale stand?
6. Supersede the 46-02-PLAN.md:49 scope decision in whatever decision log the gap-closure plan produces (the old text says "Do not remove ShareQuoteButton's gate" — a future reader must see it was overridden by G-46-6).

## 4. Evidence log

- `grep -rn "__IS_TAURI__" src/` → full gate inventory; only ShareQuoteButton:38 and BillingPanel:50 gate Pro surfaces (others are PDF-save/file-IO/update-banner/cookie-consent, unrelated).
- Read in full: `ShareQuoteButton.tsx`, `usePublishedQuote.ts`, `supabaseClient.ts`, `UpdateBanner.tsx`; mount-site context in `JobsManager.tsx` (306–399, 1184–1198) and `PrintQuoteModal.tsx` (79, 620).
- Planning docs: `43-CONTEXT.md` (D-12), `46-CONTEXT.md` (D-08, line 103 "audit existing web-only gates"), `46-RESEARCH.md` (A5, Open Question 1, line 61 infra gaps), `46-02-PLAN.md` (line 49 scope decision, line 180), `46-02-SUMMARY.md` (lines 44, 116, 135, 142–143, 150–151, 157–168, 208), `46-UAT.md` (lines 40, 74–77).
- Tauri infra: `src-tauri/tauri.conf.json` CSP includes `https://*.supabase.co`; `src-tauri/capabilities/default.json` grants `shell:default`; `Cargo.toml` plugin list confirms no clipboard plugin.

## 5. Conclusion

Root cause: a single deliberate `__IS_TAURI__` self-gate at `ShareQuoteButton.tsx:38`, kept by 46-02-PLAN's documented "publishing stays web-only" scope decision, which G-46-6 declares superseded by the founder's all-platforms requirement. Every dependency below the button (auth, entitlement, Supabase network path, CSP, status refresh) already works on desktop as of Phase 46-02. No technical blocker exists; the fix is UI-gate removal + test inversion + doc supersession, with optional clipboard/open-URL polish and a separate founder call on BillingPanel.
