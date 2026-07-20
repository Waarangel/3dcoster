# Phase 45: Brand & Launch - Context

**Gathered:** 2026-07-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Merge the "Cost-Truth Dark" marketing-site redesign onto main, fill the three Pro-pricing spots with real numbers, and make main **launch-ready** (BRAND-01). This is the last phase before the v2.0 launch.

The phase ends when main is fully launch-ready: redesign ported, pricing live in the marketing code, v2.0.0 release artifacts prepped (CHANGELOG + version bumps, NOT tagged), and the launch-comms kit drafted. **The Launch-Day Checklist execution (deploy, env vars, webhook-auth migration, `v*` tag) is a founder-driven event outside this phase** — Claude assists live on launch day, but nothing in this phase deploys, tags, or pushes to production. Existing guards stay in force: `DEPLOY_OK=1` push gate, no autonomous tags, release timing is the founder's call.

**Key facts discovered at scout time:**
- Branch `test/design-skills-experiment` diverged from main 2026-06-15 (merge-base `d963e36`) and is **446 commits behind**. It redesigns 7 marketing pages + Header/Footer, adds the design system (CSS tokens in `src/index.css`, Bricolage display font, `motion/Reveal`, `landing/CostReveal`), the SupportNudge toast, and edits shared ui-kit primitives.
- Main has since gained: PrivacyPage + TermsPage (Phase 42/43 — old slate styling), the cookie-consent banner, DownloadPage Linux/asset logic evolution, ConfirmModal/IconButton/icons/PeriodPicker in the ui kit.
- Pro pricing is **already locked in shipped code**: EUR 6.90/mo, EUR 69/yr ("2 months free") in `BillingPanel.tsx` (byte-identical guard comment), `paddle.ts`, and `TermsPage.tsx` (regex-guarded test). Phase 45 surfaces these numbers on the marketing site; it must NOT change them.

</domain>

<decisions>
## Implementation Decisions

### Branch-merge posture
- **D-01: Port, don't merge.** The branch is the *design reference*, not a merge source. Re-apply the design system + page redesigns onto current main as fresh commits, reconciling each page against what main now has (e.g. keep main's DownloadPage Linux/asset-fallback logic, apply branch styling on top). Archive the branch via tag after the port (same pattern as `archive/phase-33-ui`).
- **D-02: Dark-brand tokens are marketing-only.** The `/app` calculator keeps today's slate look. The branch's edits to shared primitives (Button, Card, Input, Select, Textarea, toast) must NOT visually change `/app` — implement so marketing surfaces get brand tokens while app surfaces resolve to current slate values (mechanism is planner's call: scoped token overrides, marketing-scoped classes, etc.). This matches the branch's own DESIGN.md intent ("the /app calculator keeps its own dense product UI").
- **D-03: SupportNudge retargets to Pro.** Keep the calm value-moment toast mechanic (gold toast on job-save/quote-create; no FAB/jiggle/auto-modal — those remain rejected), but the message points at Pro/hosted quotes instead of donations. One monetization voice at launch. Coordinate with the existing ShareQuoteButton Pro pitch so the two don't stack nag.
- **D-04: Drop the branch's stale planning cargo.** Phase 33 plan files, `v2.0-CANDIDATES.md` — do not port (Phase 33 was retired in Phase 40; content preserved on the branch/tag).
- **D-05: PRODUCT.md + DESIGN.md land in `docs/`** (`docs/PRODUCT.md`, `docs/DESIGN.md`), updated for anything the port changes (e.g. pricing page addition).

### Pro pricing presentation (the "3 spots")
- **D-06: Spot 1 = dedicated `/pricing` page.** New route in Header nav. Free column ("everything, forever") vs Pro column (EUR 6.90/mo · EUR 69/yr) — the floor-&-ceiling story gets a full page; landing + features link to it.
- **D-07: Spot 2 = landing-page Pro teaser.** Short section: free-forever statement + "Pro from €6.90/mo" card linking to /pricing.
- **D-08: Spot 3 = features-table Pro column.** The comparison table gains a 3DCoster Pro column with the price in the header — and the now-false "no Pro tier hiding the business features" copy is fixed in the same stroke.
- **D-09: Early-supporter launch framing.** "Launch price — €6.90/mo for early supporters": signals the deliberate undercut of the €9.90 3DPrintQuote anchor and that the price may rise later. No fake countdowns/urgency mechanics. (Phase 43 D-02 blessed this angle.)
- **D-10: Pro CTA goes into the app.** "Start free, upgrade in-app" → `/app`. Upgrade happens in Settings when users hit the ceiling. NO new marketing-side auth/checkout surface this phase.
- **Price-consistency lock:** all marketing pricing text must match `BillingPanel.tsx` labels (EUR 6.90/mo, EUR 69/yr). Consider a shared constant or a test guard mirroring the TermsPage regex-guard pattern.

### Launch copy & new pages
- **D-11: All four v2.0 pillars get headline billing**, with hierarchy: the cost-truth engine (failure rates + TOU electricity + wear/maintenance) stays the hero thesis (the hero already demonstrates it); device sync without accounts, STL instant quote, and insights/printer-ROI are major sections below. Everything shipped also lands in the /features table. The v2.0-secrecy constraint expires at launch — marketing copy may now name these features.
- **D-12: Full brand port for legal surfaces.** PrivacyPage, TermsPage, and the cookie-consent banner all get the dark-brand treatment. **Content stays byte-identical** — both pages carry regex-guard tests and the Terms Pro-price text must not change; restyle only. Phase 42's GDPR E2E verification must stay green.
- **D-13: /roadmap page refreshed with post-launch items.** Shipped v2.0 features move off the roadmap into /features; repopulate with safe post-launch candidates (currency expansion CURR-01, real-time sync ceiling SYNC-02, green-print nudge TOU-03). Honors the standing rule: unbuilt features only on /roadmap, never "Planned" in /features.
- **D-14: `docs/references/` mtnearz images are competitor/market research only** — not site material; keep them off marketing surfaces.

### Launch execution scope
- **D-15: Phase ends at launch-ready main** (see domain). Launch-Day Checklist execution is out of phase scope.
- **D-16: Full v2.0.0 release prep, no tag.** Write the v2.0.0 CHANGELOG.md section (user-facing bullets covering all 8 phases, Keep-a-Changelog groupings), bump the three version files (`src/version.ts`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`), verify `node scripts/extract-changelog.cjs v2.0.0` prints clean. Launch day is then: review → `DEPLOY_OK=1` push → tag.
- **D-17: Targeted release review.** Full review of Phase 45's own diff (the redesign port — genuinely new code) + a risk-focused sweep of the cumulative v1.9.0..HEAD diff (pricing surfaces, security-sensitive paths, launch-checklist-adjacent code) — NOT a re-read of 8 phases of already-reviewed work. This satisfies the mandatory pre-tag review gate.
- **D-18: Launch-comms kit drafted in-phase.** announcement.json banner copy, a launch changelog-highlight writeup, and 2–3 platform post drafts (e.g. Reddit r/3Dprinting, X). Founder publishes manually on launch day; nothing auto-posts. (Discord release post fires automatically on tag as already wired.)

### Claude's Discretion
- Port mechanics and commit sequencing (page-by-page vs system-first), and the token-scoping mechanism for D-02
- /pricing page layout/composition within the Cost-Truth Dark system (Free vs Pro columns, FAQ block, etc.)
- Which FAQ entries get refreshed for v2.0 features and Pro
- Changelog page presentation (MAX_RELEASES_DISPLAYED stays 5 unless a reason emerges)
- SupportNudge Pro-retarget copy + frequency caps (keep the branch's calm no-nag behavior)
- NEW-badge registration for user-facing marketing-visible features per `src/features.ts` conventions (note: marketing pages historically don't carry NEW badges — apply only where the convention says)
- Exact post-launch roadmap-page item copy (from the v2-deferred requirement pool)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — BRAND-01 exact text (redesign merged, v1.7+ DownloadPage/FAQPage Linux correctness ported, 3 Pro-pricing spots real)
- `.planning/ROADMAP.md` §Phase 45 — 2 success criteria; depends-on note (Phase 43 pricing); UI hint: yes

### The design source (on branch `test/design-skills-experiment`)
- `DESIGN.md` (branch root) — the full Cost-Truth Dark visual system: tokens, color rules (one blue accent, amber quarantined to support/warnings), typography (Bricolage display), motion. THE blueprint for the port. Lands as `docs/DESIGN.md` (D-05).
- `PRODUCT.md` (branch root) — strategy/users/principles behind the design. Lands as `docs/PRODUCT.md`.
- Branch `src/index.css` — the `:root` token definitions (`--bg #0a0e18`, `--surface`, `--brand #1796ff`, `--amber`, hairlines)
- Branch `src/components/motion/Reveal.tsx`, `src/components/landing/CostReveal.tsx` — motion system + animated hero
- Branch `src/components/SupportNudge.tsx` + `src/utils/supportNudge.ts` (+ tests) — the value-moment toast to retarget to Pro (D-03)
- Branch page files: `LandingPage`, `FeaturesPage`, `DownloadPage`, `FAQPage`, `ChangelogPage`, `FeedbackPage`, `RoadmapPage`, `Header`, `Footer` — the redesigned surfaces to port

### Pricing truth (must match byte-for-byte)
- `src/components/pro/BillingPanel.tsx` — locked price labels (EUR 6.90/mo, EUR 69/yr, "2 months free"); header comment mandates byte-identical consistency
- `src/lib/paddle.ts` — Paddle price-id env contract
- `src/pages/TermsPage.tsx` + `src/pages/TermsPage.test.tsx` — Pro terms text + the regex price guard (restyle must not trip it)

### Launch gating & process
- `docs/PRO-SECURITY-REVIEW.md` Part 5 — the v2.0 Launch-Day Checklist (deploy-time env, webhook-auth migration, Phase 42 live-gate item 0). Phase 45 preps toward it but does NOT execute it (D-15).
- `CHANGELOG.md` + `scripts/extract-changelog.cjs` — release-notes pipeline for D-16
- `.claude/CLAUDE.md` §Desktop App Release Process — version files, review gate, tag steps (launch-day reference)

### Surfaces main evolved after the branch diverged (port must preserve)
- `src/pages/DownloadPage.tsx` — Linux asset detection + `isSafeHttpUrl` fallback logic (BRAND-01 explicitly protects this)
- `src/pages/PrivacyPage.tsx`, `src/pages/PrivacyPage.test.tsx` — Phase 42 privacy policy (content locked, restyle only)
- Cookie-consent config (vanilla-cookieconsent, Phase 42) + `e2e/` consent specs — must stay green after restyle
- `src/components/ui/` — current primitives incl. post-branch additions (ConfirmModal, IconButton, icons/, PeriodPicker) that the port must not regress

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- The entire redesign exists working on the branch — this phase is a port + reconcile, not a from-scratch build
- `useToast` system (main) — SupportNudge's `support` variant extends it; branch already wired `ToastViewport`/`types` changes
- `src/features.ts` NEW-badge registry — for any user-facing in-app changes (SupportNudge retarget)
- Marketing pages already route through shared `Header`/`Footer` — the branch's redesigned versions swap in, plus new `/pricing` nav entry
- `vite.config.ts` on branch adds font/motion handling (+9 lines) — reconcile with main's current config (manualChunks, 300 KB gate)

### Established Patterns
- 300 KB gz main-chunk gate — Bricolage font + Motion additions must not blow it; check bundle impact of the display font strategy
- Regex-guard tests as content locks (TermsPage price, Privacy processor list) — restyles must keep them green; consider the same pattern for the new marketing pricing spots (D-06..08)
- Archive-tag-then-delete branch retirement (`archive/phase-33-ui` precedent) — apply to `test/design-skills-experiment` after the port (D-01)
- No-nag conventions — SupportNudge keeps its calm one-shot behavior after the Pro retarget
- `lint:no-raw-html` build check — ported pages must use shared primitives / carry `// allow-raw-html` justifications

### Integration Points
- `src/main.tsx` routing — new `/pricing` route; branch also touched main.tsx (+2)
- `Header.tsx` nav — /pricing link; reconcile branch redesign with main's post-branch changes (+4 lines since merge-base)
- `CostCalculator.tsx` / `PrintQuoteModal.tsx` / `RecordSaleModal.tsx` — branch's +3-line SupportNudge hooks are the ONLY app-side touches; keep them minimal and slate-styled (D-02)
- Cookie banner + Privacy/Terms — brand restyle layer only (D-12)
- `CHANGELOG.md` / version files — D-16 release prep

</code_context>

<specifics>
## Specific Ideas

- The hero already *demonstrates* the cost-truth thesis (animated cost reveal) — launch copy should keep that "show, don't tell" property while naming the now-real features (failure engine, TOU, sync, STL quote, insights)
- Amber stays quarantined: support/coffee band + genuine warnings only (DESIGN.md rule) — the SupportNudge Pro-retarget keeps its gold identity but must not spread amber elsewhere
- "Free forever" and "Pro" must never read as contradiction: every pricing surface leads with the free floor, Pro is the ceiling (floor-&-ceiling model, locked project-wide)
- One monetization voice at launch: SupportNudge (Pro), ShareQuoteButton pitch (Pro) — no donation asks anywhere at launch

</specifics>

<deferred>
## Deferred Ideas

- **Donation/support ask** — the original SupportNudge donation framing is parked, not dead; revisit post-launch once Pro conversion data exists (maybe as a secondary ask for never-subscribers)
- **App-wide dark-brand restyle** — "tokens now, app later" was considered; the /app calculator keeping slate is a launch-risk decision, not a forever decision. A future phase may unify the visual system app-wide.
- **Marketing-side direct checkout** — a /pricing → sign-in → Paddle flow without entering the app; only if funnel data shows the in-app upgrade path loses buyers
- **Testimonials/social proof on the marketing site** — no material yet (mtnearz images are competitor research); gather real user quotes post-launch

</deferred>

---

*Phase: 45-brand-launch*
*Context gathered: 2026-07-19*
