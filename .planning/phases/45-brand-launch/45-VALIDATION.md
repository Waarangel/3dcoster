---
phase: 45
slug: brand-launch
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-20
---

# Phase 45 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (unit) + Playwright (e2e) |
| **Config file** | `vitest.config.ts` / `playwright.config.ts` |
| **Quick run command** | `npx vitest run --changed` |
| **Full suite command** | `npm run build && npx vitest run` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --changed`
- **After every plan wave:** Run `npm run build && npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 45-01-01 | 01 | 1 | BRAND-01 | T-45-SC | Package legitimacy gate (blocking human) | integration | `node -e "…motion + @fontsource present"` | ✅ | ⬜ pending |
| 45-01-02 | 01 | 1 | BRAND-01 | T-45-01, T-45-03 | Self-hosted font (no 3P request / no CSP widen); slate-safe :root; route-marketing marker | unit | `npx vitest run` + `grep theme-brand-dark/fonts.googleapis.com/route-marketing` | ✅ | ⬜ pending |
| 45-01-03 | 01 | 1 | BRAND-01 | T-45-03 | 300 KB gz bundle gate; motion-vendor isolation | build | `npm run build` | ✅ | ⬜ pending |
| 45-02-01 | 02 | 2 | BRAND-01 | — | D-02 token scoping (app stays slate) | unit | `npx vitest run src/components/ui` | ✅ | ⬜ pending |
| 45-02-02 | 02 | 2 | BRAND-01 | — | N/A | build | `npm run build` + `grep /pricing + CookieSettingsLink + !variant="light"` | ✅ | ⬜ pending |
| 45-03-01 | 03 | 3 | BRAND-01 | — | Price-consistency lock (byte-match guard) | unit | `npx vitest run src/pages/PricingPage.test.tsx` | 🆕 plan-created | ⬜ pending |
| 45-03-02 | 03 | 3 | BRAND-01 | — | N/A | build | `npm run build` + `grep /pricing route + price constant` | ✅ | ⬜ pending |
| 45-04-01 | 04 | 4 | BRAND-01 | — | a11y landmarks preserved | build | `npm run build` + `grep <main + aria-labelledby` | ✅ | ⬜ pending |
| 45-04-02 | 04 | 4 | BRAND-01 | — | Price-consistency lock (teaser) | unit | `npx vitest run` + `grep price constant + /pricing` | ✅ | ⬜ pending |
| 45-05-01 | 05 | 4 | BRAND-01 | — | a11y landmarks preserved | build | `npm run build` + `grep <main + aria-labelledby` | ✅ | ⬜ pending |
| 45-05-02 | 05 | 4 | BRAND-01 | — | Price-consistency lock; drop false "no Pro tier" copy | unit | `npx vitest run` + `grep Pro + !"no Pro tier" + price` | ✅ | ⬜ pending |
| 45-06-01 | 06 | 3 | BRAND-01 | — | isSafeHttpUrl + Linux logic preserved | build | `npm run build` + `grep isSafeHttpUrl + <main` | ✅ | ⬜ pending |
| 45-06-02 | 06 | 3 | BRAND-01 | — | Content correctness (Linux Qs / GDPR copy) | build | `npm run build` + `grep linux + !stale copy` | ✅ | ⬜ pending |
| 45-07-01 | 07 | 3 | BRAND-01 | — | isSafeHttpUrl markdown-link safety | build | `npm run build` + `grep isSafeHttpUrl + !url.startsWith('http` | ✅ | ⬜ pending |
| 45-07-02 | 07 | 3 | BRAND-01 | — | a11y landmark | build | `npm run build` + `grep <main` (RoadmapPage) | ✅ | ⬜ pending |
| 45-07-03 | 07 | 3 | BRAND-01 | — | a11y landmark | build | `npm run build` + `grep <main` (FeedbackPage) | ✅ | ⬜ pending |
| 45-08-01 | 08 | 3 | BRAND-01 | T-45-15 | Content-lock (processor list, EUR 6.90/EUR 69 Pro price) | unit | `npx vitest run src/pages/PrivacyPage.test.tsx src/pages/TermsPage.test.tsx` | ✅ | ⬜ pending |
| 45-08-02 | 08 | 3 | BRAND-01 | T-45-05 | Consent gating + equal-weight; D-02/D-12 route scope (brand on marketing, slate on /app) | e2e | `npx playwright test consent-gate + free-floor-no-network + consent-theme-scope` | 🆕 plan-created (consent-theme-scope) | ⬜ pending |
| 45-09-01 | 09 | 3 | BRAND-01 | — | No donation ask (D-03 single monetization voice) | unit | `npx vitest run` + `grep support + !donat/coffee/ko-fi` | ✅ | ⬜ pending |
| 45-09-02 | 09 | 3 | BRAND-01 | — | Single Pro-pitch voice (no stacked nag) | build | `npm run build` + `grep supportNudge wire + !dup pitch comment` | ✅ | ⬜ pending |
| 45-10-01 | 10 | 5 | BRAND-01 | — | N/A | integration | `test -f docs/PRODUCT.md docs/DESIGN.md` | ✅ | ⬜ pending |
| 45-10-02 | 10 | 5 | BRAND-01 | — | Release-notes pipeline (no fallback) + version bumps | integration | `node scripts/extract-changelog.cjs v2.0.0` + version greps | ✅ | ⬜ pending |
| 45-10-03 | 10 | 5 | BRAND-01 | — | Announcement inactive at rest (no auto-post) | integration | `test -f LAUNCH-COMMS.md` + `announcement.active===false` | 🆕 plan-created | ⬜ pending |
| 45-11-01 | 11 | 6 | BRAND-01 | T-45 (release review) | Pre-tag review gate (D-17), CRITICAL/HIGH cleared | build | `test -f docs/PHASE-45-REVIEW.md` + `npm run build` | 🆕 plan-created | ⬜ pending |
| 45-11-02 | 11 | 6 | BRAND-01 | — | Non-destructive archive before deletion (D-01) | integration | `git tag -l archive/design-skills-experiment` | ✅ | ⬜ pending |
| 45-11-03 | 11 | 6 | BRAND-01 | — | Founder-gated branch deletion (blocking human) | integration | archive tag present on origin check | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*File Exists: ✅ = runs on existing infra (vitest/Playwright/build) · 🆕 plan-created = the test/artifact file is authored by the plan itself.*

*(Refined by plan-phase to the final 11-plan / 26-task structure; validate-phase completes Status + Threat Ref columns and flips `nyquist_compliant`.)*

---

## Wave 0 Requirements

- [ ] Content-lock guard tests for the 3 new Pro-pricing marketing spots (mirror TermsPage regex-guard pattern) — stubs for BRAND-01

*Existing infrastructure (vitest + Playwright e2e consent specs + regex-guard tests) covers restyle regression detection.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual fidelity of Cost-Truth Dark port vs branch design reference | BRAND-01 | Visual design judgment cannot be asserted by unit tests | Compare ported pages at 4173 against branch screenshots / DESIGN.md token rules |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
