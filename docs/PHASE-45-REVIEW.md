# Phase 45 (Brand & Launch) — Targeted Release Review

**Date:** 2026-07-20
**Reviewer:** Claude (executor agent, 45-11 Task 1)
**Scope (per D-17):**
1. FULL review of Phase 45's own diff — `44ea4cf..63aa440` (75 files changed, 7615 insertions / 1386 deletions) — the Cost-Truth Dark redesign port.
2. RISK-FOCUSED sweep of the cumulative `v1.9.0..HEAD` diff (339 commits, phases 38-45), limited to: pricing surfaces, security-sensitive paths (CSP, font loading, `isSafeHttpUrl`, consent), and launch-checklist-adjacent code.

This is **not** a re-review of phases 38-44 end to end — those were already reviewed at their own phase boundaries (see `docs/PRO-SECURITY-REVIEW.md` for the Phase 43 security gate). This document covers only the genuinely new Phase 45 code plus the specific risk surfaces D-17 calls out.

---

## Method

- `git diff 44ea4cf..HEAD --stat` to enumerate every file Phase 45 touched.
- Read-the-code review of every touched source file (not just the automated grep checks each plan already ran) — `src/index.css`, `src/main.tsx`, `MarketingThemeScope.tsx`, `Header.tsx`, `Footer.tsx`, the 5 shared `ui/` primitives, `ToastViewport.tsx`, all 10 marketing pages, `src/pricing.ts`, `src/utils/supportNudge.ts`, `src/components/SupportNudge.tsx`, `consent-theme.css`, `vite.config.ts`, `package.json`.
- Targeted `git diff v1.9.0..HEAD` on `vercel.json` (CSP), `isSafeHttpUrl` call sites, and `src/components/pro/BillingPanel.tsx` (pricing truth) to confirm Phase 45 did not touch what it shouldn't.
- Full verification run: `npx vitest run` (1412 passed / 4 skipped / 1 todo) and `npm run build` (lint:no-raw-html, jspdf/pdf/three static-import asserts, `tsc -b`, `vite build`, 300 KB gz bundle gate) — all green.
- `npm audit --omit=dev` — 0 vulnerabilities.

---

## Findings

### CRITICAL

None found.

### HIGH

**H-1. `src/components/Footer.tsx` rendered a live `buymeacoffee.com` donation link, contradicting the phase-wide "one monetization voice at launch" truth (D-03, CONTEXT.md `<specifics>`).**

- **Component:** `src/components/Footer.tsx` (Brand column, both `full`-variant paths).
- **Why HIGH:** CONTEXT.md's `<specifics>` states explicitly: "One monetization voice at launch: SupportNudge (Pro), ShareQuoteButton pitch (Pro) — no donation asks anywhere at launch." `deferred-items.md` tracked this across 45-09 (found, out of scope) and 45-04 (LandingPage's copy of the same link removed, Footer's left open) as a known gap that needed closing before the phase's final review pass.
- **Disposition: FIXED in this plan (Task 1).** Removed the `<a href="https://buymeacoffee.com/3dcoster">Support this project</a>` block (icon + copy) from `Footer.tsx`'s Brand column. Verified `grep -rn "buymeacoffee\|ko-fi" src` now returns zero hits repo-wide. Full suite re-run green (1412 passed) after the fix; `npm run build` green.
- **Commit:** see Task 1 commit in this plan's SUMMARY.

### MEDIUM

**M-1. `src/components/calculator/outputEquivalence.test.tsx` intermittently times out under the full coverage suite (pre-existing, unrelated to Phase 45).**

- Logged by 45-04 and 45-07 in `deferred-items.md`; reproduced identically on unmodified `main` via `git stash` (pre-existing, not a Phase 45 regression).
- Re-ran `npx vitest run` and `npm run build` twice during this review — both times all 1412 tests passed including this one, consistent with "flaky under resource contention," not a deterministic failure.
- **Disposition:** Not fixed (out of scope — file untouched by any Phase 45 plan; scope-boundary rule). Recommend raising the test's timeout in a future maintenance pass. Non-blocking for launch since it has not failed in review verification runs.

### LOW

**L-1. Bundle-size warning: several vendor chunks (`vendor`, `three`, `pdf`, `react-vendor`) exceed Rollup's 500 KB post-minification advisory threshold.**

- This is Vite's generic informational warning, not a failure — the project's actual enforced gate is the **300 KB gzipped main chunk** (`scripts/assert-bundle-size.mjs`), which passes at 100.2 KB gz. `three`/`pdf` are confirmed lazy-loaded (verified by `assert-no-pdf-preload.mjs`, `assert-no-static-pdf-import.mjs`, `assert-no-static-three-import.mjs`, all passing). No action needed.

---

## Risk-Focused Sweep Results (v1.9.0..HEAD)

| Risk surface | Result |
|---|---|
| **D-02 token leak into `/app`** | Confirmed via source inspection of `src/main.tsx`: `/app` (`<Route path="/app" element={<App />} />`) and the desktop Tauri branch are siblings **outside** `<MarketingLayout>`/`MarketingThemeScope`. `:root` in `src/index.css` carries slate-equivalent defaults (`--brand: #2563eb` etc.); `.theme-brand-dark` (marketing-only override) is never applied to `/app`. Matches 45-01/45-02's own empirical Playwright verification (re-verified by code inspection, not re-run, since no code changed since). **Pass.** |
| **Self-hosted font / CSP** | `src/index.css` imports `@fontsource/bricolage-grotesque` (bundled local asset), zero runtime request to `fonts.googleapis.com`/`fonts.gstatic.com`. `git diff 44ea4cf..HEAD -- vercel.json` is **empty** — Phase 45 did not touch the CSP at all. (The CSP's Paddle/Supabase additions visible in `v1.9.0..HEAD` predate Phase 45, from Phase 43's Pro backend — already covered by the Phase 43-07 security review.) **Pass.** |
| **`isSafeHttpUrl` on ChangelogPage** | `src/pages/ChangelogPage.tsx` line 145 calls `isSafeHttpUrl(url)` in the markdown-link renderer; confirmed the branch's weaker `url.startsWith('http')` check was NOT ported (grep returns no match). **Pass.** |
| **DownloadPage Linux URL safety** | `src/pages/DownloadPage.tsx` wraps every constructed release-asset URL (`windowsUrl`/`macSiliconUrl`/`macIntelUrl`/`linuxAppImageUrl`/`linuxDebUrl`/`linuxRpmUrl`) in `isSafeHttpUrl(...)` before use, with `null` fallback. `detectPlatform()` retains the ChromeOS (`cros`) exclusion and the Android-vs-Linux disambiguation. Fallback version is `1.9.0` (not a stale `1.0.0`). **Pass.** |
| **Consent behavior** | `git diff ff32bd4..HEAD -- src/components/consent/` is **empty** — no consent-surface file has changed since 45-08's own verification (which ran the full GDPR e2e trio — `consent-gate.spec.ts`, `free-floor-no-network.spec.ts`, `consent-theme-scope.spec.ts` — all green, including the equal-weight structural assertion). The brand override (`body.route-marketing #cc-main`) is additive-only; the base `#cc-main` slate block is untouched. **Pass** (verification carried forward from 45-08, no regression since). |
| **Pricing byte-match** | `src/pricing.ts`'s `MONTHLY_PRICE_LABEL`/`ANNUAL_PRICE_LABEL` (`EUR 6.90` / `EUR 69`) match `src/components/pro/BillingPanel.tsx`'s locked literals verbatim. `PricingPage.test.tsx`'s regex-guard (3 tests) and the full suite both pass. All three marketing pricing spots (`/pricing`, landing teaser, features-table Pro column) import from `src/pricing.ts` — no re-typed literals found via grep. **Pass.** |
| **a11y regressions** | Every ported marketing page (`LandingPage`, `FeaturesPage`, `DownloadPage`, `FAQPage`, `ChangelogPage`, `RoadmapPage`, `FeedbackPage`, `PricingPage`, `PrivacyPage`, `TermsPage`) carries a `<main>` landmark, `aria-labelledby` on sections, and `aria-hidden="true"` on decorative icons — re-applying/exceeding main's pre-existing Phase 37 a11y pattern in every case (confirmed via grep + source read across all 10 files). **Pass.** |
| **Amber quarantine (DESIGN.md rule)** | `grep -n amber` across `FeaturesPage.tsx`, `PricingPage.tsx`, `LandingPage.tsx` returns zero matches — amber stays confined to the `support` toast variant and genuine warning contexts, not spread into pricing/marketing chrome. **Pass.** |
| **New dependency legitimacy** | Phase 45 added exactly 2 runtime dependencies (`motion@^12.42.2`, `@fontsource/bricolage-grotesque@^5.3.0`) — both cleared the blocking package-legitimacy checkpoint in 45-01 (founder-approved after live registry verification: 16M/wk and 41K/wk downloads, official GitHub orgs). `npm audit --omit=dev` reports 0 vulnerabilities across the full dependency tree (including Phase 43/44's `@supabase/supabase-js`, `@paddle/paddle-js`, `three`, `vanilla-cookieconsent`, none of which Phase 45 touched). **Pass.** |
| **No premature v2.0.0 tag / no production push** | `git tag -l v2.0.0` → empty. `git log` shows all Phase 45 commits are local (no `git push` executed this phase). Matches D-15/D-16. **Pass.** |

---

## Verification Evidence

- `npx vitest run` → **1412 passed, 4 skipped, 1 todo** (124/125 test files) — full suite green after the Footer.tsx fix.
- `npm run build` → **green end-to-end**: `lint:no-raw-html`, `assert-no-static-jspdf`, `vitest run --coverage` (1412 passed), `tsc -b`, `vite build`, `assert-bundle-size` (main chunk **100.2 KB gzipped**, under the 300 KB gate), `assert-no-pdf-preload`, `assert-no-static-pdf-import`, `assert-no-static-three-import` — all passed.
- `npm audit --omit=dev` → **0 vulnerabilities**.
- `grep -rn "buymeacoffee\|ko-fi" src` → **0 matches** (post-fix; was 1 match in `Footer.tsx` pre-fix).
- `git diff 44ea4cf..HEAD -- vercel.json` → empty (Phase 45 did not touch CSP).
- `git diff ff32bd4..HEAD -- src/components/consent/` → empty (no consent-surface drift since 45-08's own green GDPR e2e run).

---

## Disposition Summary

| Severity | Count | Status |
|---|---|---|
| CRITICAL | 0 | — |
| HIGH | 1 | **Fixed** (H-1, Footer.tsx donation link removed) |
| MEDIUM | 1 | Dispositioned — pre-existing, out of scope, non-blocking (M-1) |
| LOW | 1 | Informational only, no action needed (L-1) |

**Gate status: SATISFIED.** No open CRITICAL or HIGH finding remains. The mandatory pre-tag review gate (`.claude/CLAUDE.md` §Desktop App Release Process) is cleared for the Phase 45 diff and the v1.9.0..HEAD risk-focused surfaces. `npm run build` and the full test suite are green.

This review does not authorize a `v2.0.0` tag or a production push — that remains a founder-driven event per D-15/D-16, gated behind the Launch-Day Checklist in `docs/PRO-SECURITY-REVIEW.md` Part 5.
