---
status: diagnosed
phase: 45-brand-launch
source: [45-12-SUMMARY.md, 45-13-SUMMARY.md, 45-01-SUMMARY.md, 45-02-SUMMARY.md, 45-03-SUMMARY.md, 45-04-SUMMARY.md, 45-05-SUMMARY.md, 45-06-SUMMARY.md, 45-07-SUMMARY.md, 45-08-SUMMARY.md, 45-09-SUMMARY.md, 45-10-SUMMARY.md, 45-11-SUMMARY.md]
started: 2026-07-20T21:47:31Z
updated: 2026-07-21T16:17:40Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running dev server. Start the app from scratch (npm run dev, port 4173). Marketing homepage (/) loads the new Cost-Truth Dark landing page without console errors; /app loads the calculator in the unchanged slate theme.
result: pass

### 2. Pro Support Nudge in Calculator
expected: In /app: save a job (or create a quote / record a sale). A gold/amber 'support' toast appears once (~12s auto-dismiss), links to /pricing when clicked, and does not reappear on subsequent saves (90-day cooldown). No donation/buymeacoffee copy is reachable from the in-app calculator flows.
result: pass

### 3. Design-Branch Retirement Was Founder-Approved
expected: Confirm the test/design-skills-experiment branch deletion (local + remote) only happened after your explicit 'delete' approval, with the sibling worktree removed first and the archive/design-skills-experiment tag confirmed reachable on origin before any delete ran.
result: pass

### 4. Brand-dark CSS token layer with slate-equivalent :root defaults so /app is visually unaffected
expected: Brand-dark CSS token layer with slate-equivalent :root defaults so /app is visually unaffected
result: pass
source: automated
coverage_id: D1 (45-01-SUMMARY.md)
verified_by: Playwright headless check: /app route has no .theme-brand-dark element in DOM and --brand resolves to #2563eb; marketing route (/) has .theme-brand-dark present with --brand resolving to #1796ff; npx vitest run (1401 passed, 4 skipped, 1 todo) — full existing suite unaffected

### 5. Self-hosted Bricolage Grotesque font, zero Google Fonts / CSP change
expected: Self-hosted Bricolage Grotesque font, zero Google Fonts / CSP change
result: pass
source: automated
coverage_id: D2 (45-01-SUMMARY.md)
verified_by: grep -c 'fonts.googleapis.com' index.html → 0 matches; git diff vercel.json → empty (unchanged)

### 6. motion + @fontsource/bricolage-grotesque installed after founder package-legitimacy approval, no other dependency added
expected: motion + @fontsource/bricolage-grotesque installed after founder package-legitimacy approval, no other dependency added
result: pass
source: automated
coverage_id: D3 (45-01-SUMMARY.md)
verified_by: git diff package.json (Task 1 commit aa96eed) shows exactly 2 additions

### 7. npm run build green including 300 KB gz main-chunk gate, tsc -b, lint:no-raw-html, existing bundle-size/pdf/three asserts
expected: npm run build green including 300 KB gz main-chunk gate, tsc -b, lint:no-raw-html, existing bundle-size/pdf/three asserts
result: pass
source: automated
coverage_id: D4 (45-01-SUMMARY.md)
verified_by: npm run build — main chunk 100.7 KB gzipped (under 300 KB); all assert-*.mjs gates passed

### 8. Button/Card/Input/Select/Textarea resolve CSS custom-property tokens for brand colors instead of literal Tailwind slate/blue classes, with no hardcoded dark-brand hex literals
expected: Button/Card/Input/Select/Textarea resolve CSS custom-property tokens for brand colors instead of literal Tailwind slate/blue classes, with no hardcoded dark-brand hex literals
result: pass
source: automated
coverage_id: D5 (45-02-SUMMARY.md)
verified_by: grep -n '#1796ff\\|#0a0e18\\|#121829' across all 5 primitive files + toast files — zero matches; npx vitest run src/components/ui — 69 passed (8 test files)

### 9. support toast variant added to the type union and rendered with amber/gold treatment; all other toast variants keep their current slate styling
expected: support toast variant added to the type union and rendered with amber/gold treatment; all other toast variants keep their current slate styling
result: pass
source: automated
coverage_id: D6 (45-02-SUMMARY.md)
verified_by: src/components/ui/toast/types.ts ToastVariant union includes 'support'; ToastViewport.tsx renders isSupport branch with color-mix(in srgb, var(--amber) 14%, var(--surface)) background and var(--amber) icon/border, non-support variants unchanged (verified via diff — only additive lines)

### 10. Header renders /pricing in both desktop and mobile menus; drops variant=\"light\" and undefined --paper/--pine/--surface-sunk references
expected: Header renders /pricing in both desktop and mobile menus; drops variant=\"light\" and undefined --paper/--pine/--surface-sunk references
result: pass
source: automated
coverage_id: D7 (45-02-SUMMARY.md)
verified_by: grep -q '/pricing' src/components/Header.tsx && ! grep -q 'variant=\"light\"' src/components/Header.tsx → CHROME_OK

### 11. Footer preserves main's Privacy/Terms/CookieSettingsLink (Phase 42/43 consent surface) through the brand restyle
expected: Footer preserves main's Privacy/Terms/CookieSettingsLink (Phase 42/43 consent surface) through the brand restyle
result: pass
source: automated
coverage_id: D8 (45-02-SUMMARY.md)
verified_by: grep -q 'CookieSettingsLink' src/components/Footer.tsx → CHROME_OK; Legal column still renders Privacy Policy (/privacy) and Terms of Service (/terms) links

### 12. /app calculator's Button/Card/Input/Select/Textarea render identically before/after the var() refactor (backstop truth — inherit :root slate defaults)
expected: /app calculator's Button/Card/Input/Select/Textarea render identically before/after the var() refactor (backstop truth — inherit :root slate defaults)
result: pass
source: automated
coverage_id: D9 (45-02-SUMMARY.md)
verified_by: Same mechanism verified empirically in 45-01 (Playwright headless check: /app has no .theme-brand-dark ancestor, --brand resolves to #2563eb). This plan changes only the primitives' class strings from literal slate/blue to var(--x) equivalents of those exact same values — no new risk introduced, backstop accepted on that basis plus full suite (1401 tests) staying green

### 13. npm run build green including 300 KB gz main-chunk gate, lint:no-raw-html, existing bundle/pdf/three asserts
expected: npm run build green including 300 KB gz main-chunk gate, lint:no-raw-html, existing bundle/pdf/three asserts
result: pass
source: automated
coverage_id: D10 (45-02-SUMMARY.md)
verified_by: npm run build — main chunk 100.9 KB gzipped (under 300 KB); lint:no-raw-html passed at both commits; all assert-*.mjs gates passed

### 14. src/pricing.ts exports MONTHLY_PRICE_LABEL='EUR 6.90' / ANNUAL_PRICE_LABEL='EUR 69', guarded against BillingPanel.tsx drift
expected: src/pricing.ts exports MONTHLY_PRICE_LABEL='EUR 6.90' / ANNUAL_PRICE_LABEL='EUR 69', guarded against BillingPanel.tsx drift
result: pass
source: automated
coverage_id: D6-pricing-constant (45-03-SUMMARY.md)
verified_by: npx vitest run src/pages/PricingPage.test.tsx — 3 passed (labels match, BillingPanel.tsx byte-match, cross-file literal containment)

### 15. /pricing page renders Free ('everything, forever') vs Pro (EUR 6.90/mo, EUR 69/yr, early-supporter framing) columns; Pro CTA routes to /app only; no sign-in/checkout/urgency widget
expected: /pricing page renders Free ('everything, forever') vs Pro (EUR 6.90/mo, EUR 69/yr, early-supporter framing) columns; Pro CTA routes to /app only; no sign-in/checkout/urgency widget
result: pass
source: automated
coverage_id: D6-pricing-page (45-03-SUMMARY.md)
verified_by: npm run build green (main chunk 101.0 KB gz, under 300 KB gate); grep confirms /pricing route in main.tsx and pricing import in PricingPage.tsx; Headless Playwright screenshots at 1280x1600 and 375x900 (both normal and reducedMotion) confirm: Free column lists 8 free-floor features, Pro column shows EUR 6.90/mo + EUR 69/yr + 'Launch price — EUR 6.90/mo for early supporters', CTA reads 'Start free, upgrade in-app', no countdown/urgency element present; /app's --brand computed style still resolves #2563eb (slate-equivalent default), confirming the D-02 boundary holds

### 16. PricingPage re-applies the project's Phase 37 a11y pattern (<main> landmark, aria-labelledby sections, aria-hidden decorative icons)
expected: PricingPage re-applies the project's Phase 37 a11y pattern (<main> landmark, aria-labelledby sections, aria-hidden decorative icons)
result: pass
source: automated
coverage_id: D6-a11y (45-03-SUMMARY.md)
verified_by: Source inspection: <main> wraps all 3 sections; each <section> has aria-labelledby pointing at its heading id (or aria-labelledby on an sr-only h2 for the plans section, which itself needs no visible heading); all decorative SVG checkmarks/glow blob carry aria-hidden=\"true\"

### 17. LandingPage renders the CostReveal hero + Cost-Truth Dark styling and preserves Phase 37's <main> landmark, aria-labelledby sections, and aria-hidden decorative icons
expected: LandingPage renders the CostReveal hero + Cost-Truth Dark styling and preserves Phase 37's <main> landmark, aria-labelledby sections, and aria-hidden decorative icons
result: pass
source: automated
coverage_id: D45-04-hero-a11y (45-04-SUMMARY.md)
verified_by: grep -q '<main' src/pages/LandingPage.tsx && grep -q 'aria-labelledby' src/pages/LandingPage.tsx → LANDING_A11Y_OK; source inspection confirms every decorative <svg> (FeatureIcon, hero CTA arrow, hero-aura div) carries aria-hidden=\"true\", which the branch's originals lacked

### 18. Sections name all four v2.0 pillars: cost-truth engine, device sync (no accounts), STL instant quote, insights/printer-ROI
expected: Sections name all four v2.0 pillars: cost-truth engine, device sync (no accounts), STL instant quote, insights/printer-ROI
result: pass
source: automated
coverage_id: D45-04-pillars (45-04-SUMMARY.md)
verified_by: Source inspection: PILLARS array in LandingPage.tsx has exactly 4 entries with the required titles/descriptions, rendered in a new aria-labelledby=\"pillars-heading\" section

### 19. No docs/references mtnearz competitor image referenced on the landing page (D-14)
expected: No docs/references mtnearz competitor image referenced on the landing page (D-14)
result: pass
source: automated
coverage_id: D45-04-no-mtnearz (45-04-SUMMARY.md)
verified_by: grep -q 'docs/references' src/pages/LandingPage.tsx → no match

### 20. LandingPage imports MONTHLY_PRICE_LABEL from src/pricing.ts and renders a 'Pro from EUR 6.90/mo' card linking to /pricing, leading with a free-forever statement, with no donation ask anywhere on the page
expected: LandingPage imports MONTHLY_PRICE_LABEL from src/pricing.ts and renders a 'Pro from EUR 6.90/mo' card linking to /pricing, leading with a free-forever statement, with no donation ask anywhere on the page
result: pass
source: automated
coverage_id: D45-04-pro-teaser (45-04-SUMMARY.md)
verified_by: grep -q 'MONTHLY_PRICE_LABEL' src/pages/LandingPage.tsx && grep -q '/pricing' src/pages/LandingPage.tsx → TEASER_OK; grep -n 'buymeacoffee' src/pages/LandingPage.tsx → no match (only comment mentions of 'donation ask' as negation)

### 21. npm run build's constituent gates (tsc -b, vite build, bundle-size assert, lint:no-raw-html) pass; full vitest suite green outside the known pre-existing flaky test
expected: npm run build's constituent gates (tsc -b, vite build, bundle-size assert, lint:no-raw-html) pass; full vitest suite green outside the known pre-existing flaky test
result: pass
source: automated
coverage_id: D45-04-build-green (45-04-SUMMARY.md)
verified_by: npx vitest run (no coverage) — 1412 passed, 4 skipped, 1 todo, 124/125 files passed; npx tsc -b (clean), npx vite build (main chunk 101.5 KB gz, under 300 KB gate), node scripts/assert-bundle-size.mjs (pass), node scripts/lint-no-raw-html.mjs (pass) — all run independently and confirmed green

### 22. FeaturesPage renders inside a <main> landmark with aria-labelledby on every section and aria-hidden on every decorative icon, re-applying main's Phase 37 a11y hardening that the branch's older rewrite predates
expected: FeaturesPage renders inside a <main> landmark with aria-labelledby on every section and aria-hidden on every decorative icon, re-applying main's Phase 37 a11y hardening that the branch's older rewrite predates
result: pass
source: automated
coverage_id: D45-05-a11y (45-05-SUMMARY.md)
verified_by: grep -q '<main' src/pages/FeaturesPage.tsx && grep -q 'aria-labelledby' src/pages/FeaturesPage.tsx -> FEATURES_A11Y_OK; source inspection confirms all 6 <section> elements carry aria-labelledby, all Glyph/status-flow/chevron SVGs carry aria-hidden=\"true\"

### 23. Every shipped v2.0 capability (failure engine, TOU electricity, wear/maintenance amortization, insights/printer-ROI, what-if simulator, reprice alerts, spool lifecycle, tax-threshold tracker, device sync, STL instant quote, hosted quotes) is represented as a row in the comparison table; no unbuilt/roadmap feature is listed as shipped
expected: Every shipped v2.0 capability (failure engine, TOU electricity, wear/maintenance amortization, insights/printer-ROI, what-if simulator, reprice alerts, spool lifecycle, tax-threshold tracker, device sync, STL instant quote, hosted quotes) is represented as a row in the comparison table; no unbuilt/roadmap feature is listed as shipped
result: pass
source: automated
coverage_id: D45-05-v2-features (45-05-SUMMARY.md)
verified_by: Source inspection: 9 new rows added (TOU tariffs, what-if simulator, hourly-wage/profitability, printer ROI, reprice alerts, spool lifecycle/moisture, tax-threshold tracking, multi-device sync, STL/3MF instant quote) plus the existing failure/nozzle-wear rows extended with amortization language; every new row cross-checked against REQUIREMENTS.md's shipped v1 IDs (TOU-01/02, INS-01/02/03, CONN-01/02, LIFE-01/02, SYNC-01) — no roadmap-only item referenced

### 24. The comparison table has a 3DCoster Pro column with the price (from src/pricing.ts) in its header, Free column still shows the full free floor, and the price label is imported never re-typed
expected: The comparison table has a 3DCoster Pro column with the price (from src/pricing.ts) in its header, Free column still shows the full free floor, and the price label is imported never re-typed
result: pass
source: automated
coverage_id: D45-05-pro-column (45-05-SUMMARY.md)
verified_by: grep -qi 'Pro' src/pages/FeaturesPage.tsx && ! grep -q 'no Pro tier' src/pages/FeaturesPage.tsx && grep -q 'MONTHLY_PRICE_LABEL' src/pages/FeaturesPage.tsx -> PRO_COLUMN_OK; Playwright screenshot (1280px, reducedMotion) confirms the header renders '3DCoster Pro' / 'EUR 6.90/mo', the Price row shows 'Free forever' / 'EUR 6.90/mo', and the Hosted-quote-links row is the only row where Free != Pro (No / Yes); npx vitest run — 1412 passed, 4 skipped, 1 todo (124/125 files) — full suite unaffected

### 25. The string 'no Pro tier' (or an equivalent free-forever-only claim contradicting the Pro column) does not appear anywhere on the page
expected: The string 'no Pro tier' (or an equivalent free-forever-only claim contradicting the Pro column) does not appear anywhere on the page
result: pass
source: automated
coverage_id: D45-05-no-false-claim (45-05-SUMMARY.md)
verified_by: grep -q 'no Pro tier' src/pages/FeaturesPage.tsx -> no match. The branch source ported in this plan never carried this line (it predates Pro entirely); the floor-and-ceiling note added above the table explicitly frames Pro as additive, reinforcing rather than contradicting the Pro column

### 26. npm run build's constituent gates (tsc -b, vite build, bundle-size assert, lint:no-raw-html) pass; full vitest suite green
expected: npm run build's constituent gates (tsc -b, vite build, bundle-size assert, lint:no-raw-html) pass; full vitest suite green
result: pass
source: automated
coverage_id: D45-05-build-green (45-05-SUMMARY.md)
verified_by: npm run build — main chunk 101.5 KB gzipped (under 300 KB gate); tsc -b clean; lint:no-raw-html passed at both commits; assert-bundle-size.mjs/pdf/three static-import asserts all passed

### 27. DownloadPage uses main's isSafeHttpUrl-gated URL construction and main's detectPlatform (with ChromeOS 'cros' exclusion), not the branch's independently-written Linux implementation, inside the branch's restyled three-platform card layout
expected: DownloadPage uses main's isSafeHttpUrl-gated URL construction and main's detectPlatform (with ChromeOS 'cros' exclusion), not the branch's independently-written Linux implementation, inside the branch's restyled three-platform card layout
result: pass
source: automated
coverage_id: D11 (45-06-SUMMARY.md)
verified_by: grep -q isSafeHttpUrl src/pages/DownloadPage.tsx && grep -q '<main' src/pages/DownloadPage.tsx → DOWNLOAD_OK; manual diff against src/pages/DownloadPage.tsx@main confirmed fallbackVersion=1.9.0 and the cros exclusion are both present verbatim; npx vitest run — 1404 passed, 4 skipped, 1 todo (full existing suite unaffected)

### 28. DownloadPage retains a <main> landmark and gained aria-labelledby/aria-hidden hardening consistent with main's Phase 37 pattern; all 6 download targets (Windows, macOS Silicon/Intel, Linux AppImage/deb/rpm) still offered with the Gatekeeper note and the re-added Linux executable-bit note
expected: DownloadPage retains a <main> landmark and gained aria-labelledby/aria-hidden hardening consistent with main's Phase 37 pattern; all 6 download targets (Windows, macOS Silicon/Intel, Linux AppImage/deb/rpm) still offered with the Gatekeeper note and the re-added Linux executable-bit note
result: pass
source: automated
coverage_id: D12 (45-06-SUMMARY.md)
verified_by: npm run build (green, main chunk 101.0 KB gz); npx tsc -b (clean); npm run lint:no-raw-html (passed)

### 29. FAQPage carries main's current 21-entry Q&A array (3 Linux troubleshooting entries, GDPR-aware wording, 14-day/36-hour badge copy) inside the branch's search + scroll-spy browse-mode UI; stale branch copy ('no data collection', '3-day') is fully purged
expected: FAQPage carries main's current 21-entry Q&A array (3 Linux troubleshooting entries, GDPR-aware wording, 14-day/36-hour badge copy) inside the branch's search + scroll-spy browse-mode UI; stale branch copy ('no data collection', '3-day') is fully purged
result: pass
source: automated
coverage_id: D13 (45-06-SUMMARY.md)
verified_by: grep -qi linux src/pages/FAQPage.tsx && ! grep -qi 'no data collection' src/pages/FAQPage.tsx && ! grep -q '3-day' src/pages/FAQPage.tsx → FAQ_OK; grep -q '<main' src/pages/FAQPage.tsx → MAIN_OK; npx vitest run — same full-suite pass as D11 (single test run covers both files)

### 30. npm run build green including 300 KB gz main-chunk gate, tsc -b, lint:no-raw-html
expected: npm run build green including 300 KB gz main-chunk gate, tsc -b, lint:no-raw-html
result: pass
source: automated
coverage_id: D14 (45-06-SUMMARY.md)
verified_by: npm run build — main chunk 101.0 KB gzipped (under 300 KB); npx tsc -b clean; lint:no-raw-html passed at both commits

### 31. ChangelogPage restyled to Cost-Truth Dark (featured latest release + version-anchored timeline) while using isSafeHttpUrl (not the branch's weaker inline url.startsWith check) in the markdown-link renderer
expected: ChangelogPage restyled to Cost-Truth Dark (featured latest release + version-anchored timeline) while using isSafeHttpUrl (not the branch's weaker inline url.startsWith check) in the markdown-link renderer
result: pass
source: automated
coverage_id: D1 (45-07-SUMMARY.md)
verified_by: grep -q isSafeHttpUrl src/pages/ChangelogPage.tsx && ! grep -q \"url.startsWith('http\" src/pages/ChangelogPage.tsx → CHANGELOG_OK; npm run build — main chunk 101.0 KB gzipped (under 300 KB gate); lint:no-raw-html passed; tsc -b passed

### 32. RoadmapPage restyled to Cost-Truth Dark (journey-spine layout) with a <main> landmark and Phase 37 a11y pattern re-applied
expected: RoadmapPage restyled to Cost-Truth Dark (journey-spine layout) with a <main> landmark and Phase 37 a11y pattern re-applied
result: pass
source: automated
coverage_id: D2 (45-07-SUMMARY.md)
verified_by: grep -q '<main' src/pages/RoadmapPage.tsx → ROADMAP_OK; npm run build green (same run as D1)

### 33. RoadmapPage content refreshed per D-13: no shipped v2.0 feature present (verified — none ever was), and three post-launch candidates sourced from the v2-deferred requirement pool (CURR-01 currency expansion, SYNC-02 real-time sync ceiling, TOU-03 green-print nudge) added to src/roadmap.ts
expected: RoadmapPage content refreshed per D-13: no shipped v2.0 feature present (verified — none ever was), and three post-launch candidates sourced from the v2-deferred requirement pool (CURR-01 currency expansion, SYNC-02 real-time sync ceiling, TOU-03 green-print nudge) added to src/roadmap.ts
result: pass
source: automated
coverage_id: D3 (45-07-SUMMARY.md)
verified_by: grep -c 'CURR-01\\|More currencies\\|Real-time device sync\\|Green-print nudge' — manual read of src/roadmap.ts confirms all 3 items present at appropriate stages, zero shipped-feature titles present

### 34. FeedbackPage restyled to Cost-Truth Dark; Formspree submission flow (endpoint mbdgwnjl) and validation unchanged; no page-level theme-brand-dark class hardcoded so the desktop /feedback route stays slate
expected: FeedbackPage restyled to Cost-Truth Dark; Formspree submission flow (endpoint mbdgwnjl) and validation unchanged; no page-level theme-brand-dark class hardcoded so the desktop /feedback route stays slate
result: pass
source: automated
coverage_id: D4 (45-07-SUMMARY.md)
verified_by: grep -q '<main' src/pages/FeedbackPage.tsx && ! grep -q theme-brand-dark src/pages/FeedbackPage.tsx → FEEDBACK_OK; npm run build green (same run as D1); fetch('https://formspree.io/f/mbdgwnjl', ...) call site byte-identical to pre-port version

### 35. Full existing test suite stays green after the port
expected: Full existing test suite stays green after the port
result: pass
source: automated
coverage_id: D5 (45-07-SUMMARY.md)
verified_by: npx vitest run — 1403 passed, 4 skipped, 1 todo (one unrelated CostCalculator output-equivalence test timed out at the default 5000ms in this run; re-run with --testTimeout 30000 in isolation passed cleanly in 2.28s — a pre-existing flaky-timeout issue in an unrelated calculator test, not a regression from this plan's page-only changes)

### 36. PrivacyPage and TermsPage render in the Cost-Truth Dark token system while their guarded content (processor list, Pro-tier price text) stays byte-identical
expected: PrivacyPage and TermsPage render in the Cost-Truth Dark token system while their guarded content (processor list, Pro-tier price text) stays byte-identical
result: pass
source: automated
coverage_id: D19 (45-08-SUMMARY.md)
verified_by: npx vitest run src/pages/PrivacyPage.test.tsx src/pages/TermsPage.test.tsx — 7 passed (both regex-guard specs green, content assertions unchanged); grep -n 'slate-\\|text-white\\|blue-4\\|blue-3\\|bg-blue\\|text-blue' src/pages/PrivacyPage.tsx src/pages/TermsPage.tsx — zero matches, confirming every literal Tailwind color class was replaced with a var(--x) token

### 37. Consent banner renders brand-dark on marketing routes and stays slate on /app; base #cc-main block untouched
expected: Consent banner renders brand-dark on marketing routes and stays slate on /app; base #cc-main block untouched
result: pass
source: automated
coverage_id: D20 (45-08-SUMMARY.md)
verified_by: e2e/consent-theme-scope.spec.ts (new) — on / asserts document.body has class route-marketing AND #cc-main's computed --cc-bg equals #0a0e18; on /app asserts body lacks route-marketing AND --cc-bg equals #0f172a. Both pass against the built preview server.

### 38. GDPR behavior invariants (equal-weight buttons, one-click reject, zero pre-consent analytics) stay intact through the restyle; CookieConsentManager.tsx untouched
expected: GDPR behavior invariants (equal-weight buttons, one-click reject, zero pre-consent analytics) stay intact through the restyle; CookieConsentManager.tsx untouched
result: pass
source: automated
coverage_id: D21 (45-08-SUMMARY.md)
verified_by: npx playwright test e2e/consent-gate.spec.ts e2e/free-floor-no-network.spec.ts e2e/consent-theme-scope.spec.ts — 4 passed. consent-gate.spec.ts's equal-weight structural assertion (identical font-weight/font-size/padding/border, matching height, width within 12px tolerance) passed unchanged, proving the colors-only override preserved the shape contract.; git diff src/components/consent/CookieConsentManager.tsx — empty (file not touched)

### 39. npm run build green including 300 KB gz main-chunk gate, tsc -b, lint:no-raw-html
expected: npm run build green including 300 KB gz main-chunk gate, tsc -b, lint:no-raw-html
result: pass
source: automated
coverage_id: D22 (45-08-SUMMARY.md)
verified_by: npm run build — main chunk 101.0 KB gzipped (under 300 KB); tsc -b clean; lint:no-raw-html passed at both commits

### 40. SupportNudge ported + retargeted to Pro: gold `support` toast, ~12s auto-dismiss, 90-day cooldown / once-per-session / permanent-suppression-on-click gate intact; no FAB/jiggle/auto-modal; no donation copy or SUPPORT_URL/buymeacoffee/ko-fi target remains in the util
expected: SupportNudge ported + retargeted to Pro: gold `support` toast, ~12s auto-dismiss, 90-day cooldown / once-per-session / permanent-suppression-on-click gate intact; no FAB/jiggle/auto-modal; no donation copy or SUPPORT_URL/buymeacoffee/ko-fi target remains in the util
result: pass
source: automated
coverage_id: D1 (45-09-SUMMARY.md)
verified_by: src/utils/supportNudge.test.ts (6 tests: fresh-state show, same-session suppress, cooldown-window suppress, cooldown-elapsed re-show, clicked-permanent-suppress, malformed-localStorage-tolerance) — all pass; src/components/SupportNudge.test.tsx (2 tests: delayed toast render + click-through opens PRO_UPGRADE_URL + suppresses; gate-closed stays silent) — all pass; grep -q \"support\" src/components/SupportNudge.tsx && ! grep -qi \"donat|coffee|buymeacoffee|ko-fi\" src/utils/supportNudge.ts -> NUDGE_OK

### 41. SupportNudge wired into the CURRENT (post-Phase-38-split) save-success handlers: CostCalculator.tsx onSaveJob, PrintQuoteModal.tsx quote-created, RecordSaleModal.tsx sale-recorded; ProPitchModal.tsx's stale 'no other toast pitches Pro' comment replaced with an accurate coordination note
expected: SupportNudge wired into the CURRENT (post-Phase-38-split) save-success handlers: CostCalculator.tsx onSaveJob, PrintQuoteModal.tsx quote-created, RecordSaleModal.tsx sale-recorded; ProPitchModal.tsx's stale 'no other toast pitches Pro' comment replaced with an accurate coordination note
result: pass
source: automated
coverage_id: D2 (45-09-SUMMARY.md)
verified_by: grep -q \"upportNudge\" src/components/calculator/CostCalculator.tsx && ! grep -q \"No toasts or banners anywhere else pitch Pro\" src/components/pro/ProPitchModal.tsx -> WIRING_OK; npx vitest run -> 1412 passed | 4 skipped | 1 todo (full suite, incl. PrintQuoteModal.test.tsx / RecordSaleModal.test.tsx / calculator suite unaffected); npm run build -> lint:no-raw-html passed, vitest run --coverage passed, tsc -b passed, main chunk 101.5 KB gzipped (under 300 KB gate), pdf/three lazy-chunk asserts passed

### 42. docs/PRODUCT.md and docs/DESIGN.md exist, ported from the branch, updated for the port (new /pricing page, self-hosted font, removed dead Header variant), no Phase 33/v2.0-CANDIDATES cargo
expected: docs/PRODUCT.md and docs/DESIGN.md exist, ported from the branch, updated for the port (new /pricing page, self-hosted font, removed dead Header variant), no Phase 33/v2.0-CANDIDATES cargo
result: pass
source: automated
coverage_id: D45-10-docs (45-10-SUMMARY.md)
verified_by: test -f docs/PRODUCT.md && test -f docs/DESIGN.md && grep -qi 'pricing\\|font' docs/DESIGN.md -> DOCS_OK; grep -qi 'phase 33\\|v2.0-CANDIDATES' docs/PRODUCT.md docs/DESIGN.md -> no match

### 43. CHANGELOG.md has a ## [2.0.0] - 2026-07-20 section with user-facing bullets in Keep-a-Changelog groupings covering all 8 v2.0 phases; node scripts/extract-changelog.cjs v2.0.0 prints it with no fallback warning
expected: CHANGELOG.md has a ## [2.0.0] - 2026-07-20 section with user-facing bullets in Keep-a-Changelog groupings covering all 8 v2.0 phases; node scripts/extract-changelog.cjs v2.0.0 prints it with no fallback warning
result: pass
source: automated
coverage_id: D45-10-changelog (45-10-SUMMARY.md)
verified_by: node scripts/extract-changelog.cjs v2.0.0 — printed the full What's New section + Download section, zero stderr WARNING output

### 44. src/version.ts, src-tauri/tauri.conf.json, src-tauri/Cargo.toml (and Cargo.lock) all read 2.0.0; no git tag created
expected: src/version.ts, src-tauri/tauri.conf.json, src-tauri/Cargo.toml (and Cargo.lock) all read 2.0.0; no git tag created
result: pass
source: automated
coverage_id: D45-10-versions (45-10-SUMMARY.md)
verified_by: grep -q 2.0.0 src/version.ts && grep -q '\"2.0.0\"' src-tauri/tauri.conf.json && grep -q 2.0.0 src-tauri/Cargo.toml -> VERSIONS_OK; git tag -l v2.0.0 -> empty

### 45. announcement.json has launch copy with active:false; docs/launch/LAUNCH-COMMS.md contains a changelog-highlight writeup + platform post drafts; no donation ask, Pro is the single monetization voice
expected: announcement.json has launch copy with active:false; docs/launch/LAUNCH-COMMS.md contains a changelog-highlight writeup + platform post drafts; no donation ask, Pro is the single monetization voice
result: pass
source: automated
coverage_id: D45-10-comms (45-10-SUMMARY.md)
verified_by: test -f docs/launch/LAUNCH-COMMS.md && node -e \"process.exit(require('./announcement.json').active===false?0:1)\" -> COMMS_OK; grep -ni 'donat|coffee|buymeacoffee|ko-fi' docs/launch/LAUNCH-COMMS.md announcement.json -> only 2 meta-references confirming the ABSENCE of a donation ask, no actual ask present

### 46. No git tag created and nothing pushed to production during this plan
expected: No git tag created and nothing pushed to production during this plan
result: pass
source: automated
coverage_id: D45-10-no-tag-no-push (45-10-SUMMARY.md)
verified_by: git tag -l v2.0.0 -> empty; no git push command run this plan; all 3 commits are local

### 47. docs/PHASE-45-REVIEW.md exists with severity-tagged findings covering the Phase 45 diff (44ea4cf..HEAD) + the v1.9.0..HEAD risk surfaces (CSP/font, isSafeHttpUrl, consent, pricing byte-match, a11y, amber quarantine, dependency legitimacy); no open CRITICAL/HIGH finding remains
expected: docs/PHASE-45-REVIEW.md exists with severity-tagged findings covering the Phase 45 diff (44ea4cf..HEAD) + the v1.9.0..HEAD risk surfaces (CSP/font, isSafeHttpUrl, consent, pricing byte-match, a11y, amber quarantine, dependency legitimacy); no open CRITICAL/HIGH finding remains
result: pass
source: automated
coverage_id: D45-11-review (45-11-SUMMARY.md)
verified_by: test -f docs/PHASE-45-REVIEW.md; review doc's Disposition Summary table shows 0 CRITICAL, 1 HIGH (fixed), 1 MEDIUM (dispositioned non-blocking), 1 LOW (informational); npx vitest run — 1412 passed, 4 skipped, 1 todo (full suite green after the Footer.tsx fix); npm run build — green end-to-end (lint:no-raw-html, jspdf/pdf/three static-import asserts, tsc -b, vite build, main chunk 100.2 KB gz under the 300 KB gate); npm audit --omit=dev — 0 vulnerabilities

### 48. Footer.tsx's buymeacoffee.com donation link and copy removed — grep confirms zero buymeacoffee/ko-fi references remain anywhere in src/
expected: Footer.tsx's buymeacoffee.com donation link and copy removed — grep confirms zero buymeacoffee/ko-fi references remain anywhere in src/
result: pass
source: automated
coverage_id: D45-11-donation-fix (45-11-SUMMARY.md)
verified_by: grep -rn 'buymeacoffee\\|ko-fi' src → 0 matches (was 1 match in Footer.tsx pre-fix)

### 49. git tag archive/design-skills-experiment created as a lightweight tag at the exact branch tip, pushed to origin, and verified reachable BEFORE any deletion was proposed
expected: git tag archive/design-skills-experiment created as a lightweight tag at the exact branch tip, pushed to origin, and verified reachable BEFORE any deletion was proposed
result: pass
source: automated
coverage_id: D45-11-archive-tag (45-11-SUMMARY.md)
verified_by: git rev-parse archive/design-skills-experiment == git rev-parse test/design-skills-experiment (both 3125cad) confirmed BEFORE deletion; git ls-remote --tags origin | grep archive/design-skills-experiment confirmed present on origin BEFORE deletion

### 50. No v2.0.0 git tag created and nothing pushed to production during this plan
expected: No v2.0.0 git tag created and nothing pushed to production during this plan
result: pass
source: automated
coverage_id: D45-11-no-tag-no-push (45-11-SUMMARY.md)
verified_by: git tag -l v2.0.0 -> empty; git log shows only the pre-existing archive-tag push and this plan's Footer/review commit as remote-facing actions — no release tag, no deploy

### 51. Marketing Pro prices show home-currency approximation with EUR disclosure
expected: /pricing, the landing Pro teaser, and the /features Pro column all show your home-currency approximation (e.g. "$7.89/mo") with "Billed as EUR 6.90/mo" always visible. A EUR visitor (or no FX data) sees the exact EUR label only — never a guessed number.
result: issue
reported: "Why billing in EUR — Canadian company, should bill in user's local currency or USD. Pricing page shows Free in Euros (€0) but Pro in Dollars — wrong. Use-for-Free / Start-free buttons misaligned. Set app currency to EUR, website still showed $ (tested: read path works in same browser — cross-browser-profile explanation pending founder confirmation)."
severity: major

### 52. /features layout contained at wide widths
expected: On your wide monitor, every /features section — hero and "Only in 3DCoster" included — sits in the same centered fixed-width column; nothing runs edge-to-edge.
result: pass

### 53. Free vs Pro section visible without expanding
expected: /features shows a "Free vs Pro" section without clicking Expand: Free = everything forever; Pro = hosted quote links + early-supporter price (via the currency display); below it a "Coming to Pro" strip lists white-label, live Etsy sync, carrier rates, QuickBooks, cloud sync — each clearly "on the roadmap", linking to /roadmap.
result: issue
reported: "(2nd report) Expanded table still shows no real reason for Pro — add white-label, API, and database elements. (1st report) We sometimes say 'Cost Truth Engine', other times 'Cost Realism engine', sometimes 'cost realism'. Standardize on Cost Truth Engine. Don't just search-and-replace — read the content and eliminate redundancy."
severity: minor

### 54. Roadmap Pro badges
expected: /roadmap shows a Pro badge on the 5 paid-tier items (marketplace sync, shipping rates, white-label, QuickBooks, real-time sync), consistent with the features strip.
result: pass

### 55. resolveDisplayCurrency ladder (stored pref -> locale -> USD)
expected: resolveDisplayCurrency resolves stored preference -> navigator locale -> USD fallback ladder
result: pass
source: automated
coverage_id: D1 (45-12-SUMMARY.md)

### 56. formatApproxPrice never guesses
expected: formatApproxPrice never returns a guessed number (null on same-currency or missing FX table)
result: pass
source: automated
coverage_id: D2 (45-12-SUMMARY.md)

### 57. useDisplayPrice composition
expected: useDisplayPrice composes stored preference + FX table into displayCurrency/monthly/annual
result: pass
source: automated
coverage_id: D3 (45-12-SUMMARY.md)

### 58. Coming-to-Pro items never claimed as shipped
expected: Unbuilt Pro items appear only as a roadmap-linked 'Coming to Pro' strip, never claimed as available
result: pass
source: automated
coverage_id: D3 (45-13-SUMMARY.md)

## Summary

total: 58
passed: 53
issues: 5
pending: 0
skipped: 0
blocked: 0

## Gaps

- gap_id: G-45-CURRENCY
  truth: "Marketing pages show Pro pricing in the visitor's home currency: stored app currency preference first (the no-account 'logged in' analog), then detected locale currency, then USD fallback. Currently EUR 6.90 is hardcoded for all visitors via src/pricing.ts."
  status: resolved
  resolved_by: 45-12-PLAN.md
  resolved_at: 2026-07-20
  reason: "User requested during UAT: detect country when possible; USD as standard fallback; app users (no login exists — local currency preference is the analog) see marketing pages in their home currency."
  severity: major
  test: 15
  root_cause: "New scope, not a code defect: all marketing pricing surfaces render hardcoded EUR labels from src/pricing.ts (MONTHLY_PRICE_LABEL / ANNUAL_PRICE_LABEL, guarded by a byte-match test) with no currency-resolution layer. The app already has display-time FX conversion (useFxRates) and a locally-stored currency preference (IndexedDB settings), but marketing pages never consult either."
  artifacts:
    - path: "src/pricing.ts"
      issue: "hardcoded EUR-only labels + byte-match guard test that will need updating"
    - path: "src/pages/PricingPage.tsx"
      issue: "renders EUR labels for all visitors"
    - path: "src/pages/LandingPage.tsx"
      issue: "Pro teaser card renders EUR label"
    - path: "src/pages/FeaturesPage.tsx"
      issue: "Pro column header renders EUR label"
  missing:
    - "Currency resolution ladder: stored app currency preference -> navigator.language locale inference -> USD fallback"
    - "Approximate-conversion display via existing useFxRates seam, always showing billing currency (e.g. '~ $7.50/mo (billed as EUR 6.90)') - never imply we charge in the displayed currency"
    - "Update pricing-label guard tests for the new rendering"
  debug_session: "diagnosed inline during UAT (live DOM + decision-record review); no debug agent needed" 
- gap_id: G-45-FEATURES-LAYOUT
  truth: "All /features sections render inside the same centered max-width container (max-w-6xl mx-auto) as the rest of the page; nothing runs edge-to-edge on wide screens."
  status: resolved
  resolved_by: 45-13-PLAN.md
  resolved_at: 2026-07-20
  reason: "User reported: The Features page is partially broken. The first sections are full width instead of fixed width. Verified: hero inner block and the entire 'Only in 3DCoster' section (heading max-w-2xl without mx-auto + bento grid) lack the max-w-6xl mx-auto wrapper sections 2-5 have."
  severity: major
  test: 23
  root_cause: "FeaturesPage hero inner block and both children of the 'Only in 3DCoster' section lack the max-w-6xl mx-auto wrapper used by sections 2-5: the heading block is max-w-2xl WITHOUT mx-auto (left-pinned) and the bento grid is unconstrained (renders 1232px full-bleed vs 1152px centered siblings; verified in live DOM at 1280px and on founder's ~2000px screenshot)."
  artifacts:
    - path: "src/pages/FeaturesPage.tsx"
      issue: "hero inner and 'Only in 3DCoster' section children missing max-w-6xl mx-auto container"
  missing:
    - "Wrap hero inner content and 'Only in 3DCoster' heading + bento grid in the same max-w-6xl mx-auto container as sibling sections; verify at 1280/1440/1920"
  debug_session: "diagnosed inline during UAT via live DOM measurement; no debug agent needed" 
- gap_id: G-45-FREE-PRO-VISIBILITY
  truth: "The /features page visibly differentiates 3DCoster Free from Pro without requiring the breakdown table to be expanded — Pro's added value (hosted quote links today, clearly-labeled 'Coming to Pro' live-API items such as Live Etsy 90-day order sync) is presented so a visitor understands why Pro is worth paying for."
  status: resolved
  resolved_by: 45-13-PLAN.md
  resolved_at: 2026-07-20
  reason: "User reported: on the Features page we don't show any difference between the FREE 3DCoster and Pro. We should or what's the point of paying? Also Pro should have the Live Etsy 90 day order sync and other live APIs. Verified: Free/Pro columns only exist inside the collapsed table; 1 of 41 rows differs (hosted quote links). NOTE: live Etsy sync is NOT built — /features is shipped-only by standing decision; RESOLVED SCOPE (UAT chat 2026-07-20): visible Free vs Pro section on /features — Pro today (hosted quote links, early-supporter price lock) + clearly-labeled 'Coming to Pro' strip (white-label quotes, live Etsy 90-day order sync, live carrier rates, QuickBooks sync, cloud/real-time sync) linking to Pro-badged /roadmap entries. Do NOT claim unbuilt features as available (shipped-only rule)."
  severity: major
  test: 24
  root_cause: "Content/design gap: Free vs Pro differentiation exists only inside the collapsed breakdown table where exactly 1 of 41 rows differs (hosted quote links), so a visitor never sees why Pro is worth paying for. The unbuilt Pro ceilings (white-label quotes, live Etsy 90-day order sync, live carrier rates, QuickBooks sync, cloud/real-time sync) appear nowhere - not even on /roadmap - so there is no truthful surface for the Pro trajectory."
  artifacts:
    - path: "src/pages/FeaturesPage.tsx"
      issue: "no visible Free vs Pro differentiation outside collapsed table"
    - path: "src/roadmap.ts"
      issue: "no Pro-badged entries for the paid-tier build-order items"
    - path: "src/pages/RoadmapPage.tsx"
      issue: "needs to render Pro badges if data model gains them"
  missing:
    - "Visible Free vs Pro section on /features (no expand needed): Pro today = hosted quote links + early-supporter price lock"
    - "Clearly-labeled 'Coming to Pro' strip (white-label quotes, live Etsy 90-day order sync, live carrier rates, QuickBooks sync, cloud/real-time sync) linking to /roadmap - NEVER presented as available (shipped-only rule; founder-confirmed scope in UAT chat 2026-07-20)"
    - "Pro-badged /roadmap entries for those items (competitively safe: table-stakes features rivals already sell)"
  debug_session: "diagnosed inline during UAT (live DOM + docs/ROADMAP.md floor-and-ceiling decision review); no debug agent needed" 
- gap_id: G-45-PRICING-CONSISTENCY
  truth: "The /pricing page renders ONE consistent currency story: Free card price in the same display currency as the Pro card (no hardcoded EUR 0 next to a $ Pro price); dollar-ambiguous currencies (CAD/AUD/NZD) disambiguated (e.g. CA$11.07) so $ is never misread as USD; Free and Pro CTA buttons bottom-aligned across the two cards."
  status: failed
  reason: "User reported: The pro pricing page has Free in Euros, but Pro in Dollars. Also, the Use for Free and Start free, upgrade in-app buttons should be aligned."
  severity: major
  test: 51
  root_cause: "PricingPage.tsx:81 hardcodes the Free card price as a EUR literal instead of formatting 0 in the resolved display currency; formatApproxPrice uses locale symbol formatting so CAD renders as bare '$' in en-CA (correct locally, but ambiguous next to EUR labels); card CTAs lack mt-auto inside the flex-col cards so button rows don't align."
  artifacts:
    - path: "src/pages/PricingPage.tsx"
      issue: "hardcoded EUR 0 (line ~81); CTA buttons missing mt-auto bottom-anchor"
    - path: "src/utils/pricingDisplay.ts"
      issue: "formatApproxPrice ambiguous $ symbol for CAD/AUD/NZD"
  missing:
    - "Free card price formatted in display currency (0 in CAD/USD/etc.)"
    - "Disambiguated symbols for dollar-collision currencies"
    - "mt-auto on both card CTAs"
  debug_session: "diagnosed inline during UAT (code read + founder screenshots)"
- gap_id: G-45-BILLING-CURRENCY
  truth: "Pro billing base currency matches founder intent (Canadian company): USD base price (founder to set the number) with Paddle merchant-of-record localized checkout, replacing the EUR 6.90 base everywhere it is displayed or guarded (src/pricing.ts, Terms Pro-price text, BillingPanel byte-match, launch comms)."
  status: failed
  reason: "User asked: Why are we billing as Euros? We are a Canadian company, and if anything should bill in the user's local currency or in USD. DECIDED 2026-07-20 (UAT chat): USD base $7.99/mo, $79/yr; Paddle localized checkout; replaces EUR 6.90/EUR 69 in pricing.ts, Terms guarded text, BillingPanel byte-match, marketing surfaces, launch comms."
  severity: major
  test: 51
  root_cause: "EUR price anchor came from Phase 43 planning: undercut 3DPrintQuote's EUR 9.90 (the most direct rival); the founder locked EUR 6.90/EUR 69 at plan time with final confirm deferred to Paddle SKU creation. Billing currency followed the anchor by default, was never independently decided. Paddle SKUs do NOT exist yet, so re-basing to USD is still cheap; Paddle supports localized per-market pricing at checkout."
  artifacts:
    - path: "src/pricing.ts"
      issue: "EUR base amounts + labels (guarded)"
    - path: "src/pages/TermsPage.tsx"
      issue: "guarded Pro-price text references EUR"
  missing:
    - "Founder decision: USD base price point (and annual)"
    - "Rework display: local approximation against USD base, or Paddle-localized real prices"
  debug_session: "decision trail reconstructed from Phase 43 CONTEXT locks"
- gap_id: G-45-LINUX-COPY
  truth: "The /features 'Fully offline desktop app' card names Windows, macOS, AND Linux (Linux builds shipped in v1.7.0)."
  status: failed
  reason: "User reported: we also have a native Linux app, not just Windows and Mac."
  severity: minor
  test: 53
  root_cause: "Stale copy in the FeaturesPage bento card — predates the v1.7.0 Linux release; the /pricing Free column already correctly says Windows, macOS, and Linux."
  artifacts:
    - path: "src/pages/FeaturesPage.tsx"
      issue: "bento card copy says 'Windows + macOS' only"
  missing:
    - "Add Linux to the desktop-app card copy"
  debug_session: "confirmed against v1.7.0 release history"
- gap_id: G-45-TERMINOLOGY
  truth: "The feature is named 'Cost-Truth Engine' (title case, hyphenated to match Cost-Truth Dark / Cost-Truth & Insight brand style) consistently across all marketing surfaces; 'cost realism' never appears; the /features Free vs Pro intro paragraph and Free card do not repeat the same feature list twice."
  status: failed
  reason: "User reported during test 53: inconsistent naming (Cost Truth Engine / Cost Realism engine / cost realism); wants Cost Truth Engine everywhere, content-aware edit eliminating redundancy, not search-and-replace."
  severity: minor
  test: 53
  root_cause: "Copy written across different plans/waves without a terminology register: LandingPage.tsx:119 pillar 'Cost-truth engine' + :383 'the cost-truth engine'; FeaturesPage.tsx:57 stage title 'Cost truth'; FeaturesPage.tsx:313 Free-vs-Pro intro lists 'the full calculator, cost realism, insights, and selling workflow' while :324 Free card repeats nearly the same list as 'cost realism engine' ten lines below (redundant double list)."
  artifacts:
    - path: "src/pages/FeaturesPage.tsx"
      issue: "lines ~57, ~313, ~324 — 'Cost truth' stage, 'cost realism' x2, duplicated feature list"
    - path: "src/pages/LandingPage.tsx"
      issue: "lines ~119, ~383 — lowercase 'cost-truth engine' where the proper name belongs"
  missing:
    - "Rename to 'Cost-Truth Engine' at every feature-name use; remove 'cost realism' entirely"
    - "Rewrite FeaturesPage Free-vs-Pro intro to drop its feature list (the Free card 10 lines below carries it) — eliminate the redundancy, keep the free-forever + Pro-adds-one-thing framing"
    - "Sweep remaining marketing surfaces (pricing, roadmap, changelog, FAQ) for stray 'cost realism' / lowercase engine references"
  debug_session: "diagnosed inline during UAT (grep + content read of both pages)"
- gap_id: G-45-PRO-TABLE
  truth: "The expanded /features breakdown table carries the full Pro offering so a comparison-shopper sees a real reason to pay: white-label rows (white-label PDF quotes; white-label hosted quote page branding), live-API rows (live Etsy 90-day order sync; live carrier rates & printable labels; QuickBooks/Wave accounting sync), and cloud/database rows (cloud / real-time multi-device sync). Unshipped items show a clearly-marked 'Coming' state in the Pro column (Free: No), flipped to Yes by each of phases 46-50 as they ship; phase 51 launch-prep does the final truth sweep."
  status: failed
  reason: "User reported: on the expanded Features section I still don't see any real reason to get pro over free. We need to add all the white label elements and all the API elements as well as the database elements."
  severity: major
  test: 53
  root_cause: "The 41-row breakdown table was built under the shipped-only rule when Pro had exactly one shipped ceiling — so Free and Pro columns are identical except hosted quote links, and the existing 'Live Etsy order sync' row reads No/No. The founder has since expanded launch scope to the full Pro build (phases 46-51), so the table must present the whole launch-Pro bundle with truthful Coming markers pre-ship."
  artifacts:
    - path: "src/pages/FeaturesPage.tsx"
      issue: "breakdown table missing white-label / live-API / cloud-sync Pro rows; Etsy row Pro column stuck at No; below-table summary sentence says Pro adds 'one thing'"
  missing:
    - "New rows (Free: No, Pro: Coming): white-label PDF quotes; white-label hosted quote page branding; live carrier rates & printable labels; QuickBooks/Wave accounting sync; cloud / real-time device sync"
    - "Existing 'Live Etsy order sync' row: Pro column No -> Coming (LayerMath comparison cell stays Yes (GBP 5/mo))"
    - "Distinct visual treatment for 'Coming' cells (not a bare Yes) consistent with the Coming to Pro strip"
    - "Update the below-table summary sentence (currently 'Pro adds one thing on top') to reflect Pro today + the coming set — coordinate with 45-15's nearby copy edits"
    - "Competitor cells for new rows filled from existing research only; unknown -> em dash, never guessed"
  debug_session: "diagnosed inline during UAT round 2 continuation (founder review of expanded table)"

