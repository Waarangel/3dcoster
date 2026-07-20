# Phase 45: Brand & Launch - Research

**Researched:** 2026-07-20
**Domain:** Marketing-site visual redesign port (branch → main reconciliation), Tailwind v4 CSS-token theming, launch release-prep mechanics
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Branch-merge posture**
- D-01: Port, don't merge. The branch is the *design reference*, not a merge source. Re-apply the design system + page redesigns onto current main as fresh commits, reconciling each page against what main now has. Archive the branch via tag after the port (same pattern as `archive/phase-33-ui`).
- D-02: Dark-brand tokens are marketing-only. The `/app` calculator keeps today's slate look. The branch's edits to shared primitives (Button, Card, Input, Select, Textarea, toast) must NOT visually change `/app` — implement so marketing surfaces get brand tokens while app surfaces resolve to current slate values (mechanism is planner's call).
- D-03: SupportNudge retargets to Pro. Keep the calm value-moment toast mechanic (gold toast on job-save/quote-create; no FAB/jiggle/auto-modal), but the message points at Pro/hosted quotes instead of donations. One monetization voice at launch. Coordinate with the existing ShareQuoteButton Pro pitch so the two don't stack nag.
- D-04: Drop the branch's stale planning cargo. Phase 33 plan files, `v2.0-CANDIDATES.md` — do not port.
- D-05: PRODUCT.md + DESIGN.md land in `docs/` (`docs/PRODUCT.md`, `docs/DESIGN.md`), updated for anything the port changes.

**Pro pricing presentation (the "3 spots")**
- D-06: Spot 1 = dedicated `/pricing` page. New route in Header nav. Free column ("everything, forever") vs Pro column (EUR 6.90/mo · EUR 69/yr).
- D-07: Spot 2 = landing-page Pro teaser. Short section: free-forever statement + "Pro from €6.90/mo" card linking to /pricing.
- D-08: Spot 3 = features-table Pro column. The comparison table gains a 3DCoster Pro column with the price in the header — and the now-false "no Pro tier hiding the business features" copy is fixed in the same stroke.
- D-09: Early-supporter launch framing. "Launch price — €6.90/mo for early supporters." No fake countdowns/urgency mechanics.
- D-10: Pro CTA goes into the app. "Start free, upgrade in-app" → `/app`. Upgrade happens in Settings when users hit the ceiling. NO new marketing-side auth/checkout surface this phase.
- Price-consistency lock: all marketing pricing text must match `BillingPanel.tsx` labels (EUR 6.90/mo, EUR 69/yr). Consider a shared constant or a test guard mirroring the TermsPage regex-guard pattern.

**Launch copy & new pages**
- D-11: All four v2.0 pillars get headline billing (cost-truth engine = hero thesis; device sync, STL instant quote, insights/printer-ROI = major sections below). Everything shipped also lands in the /features table. v2.0-secrecy expires at launch.
- D-12: Full brand port for legal surfaces. PrivacyPage, TermsPage, cookie-consent banner all get dark-brand treatment. Content stays byte-identical — both carry regex-guard tests; restyle only. Phase 42's GDPR E2E verification must stay green.
- D-13: /roadmap page refreshed with post-launch items. Shipped v2.0 features move off the roadmap into /features; repopulate with safe post-launch candidates (CURR-01, SYNC-02, TOU-03).
- D-14: `docs/references/` mtnearz images are competitor/market research only — keep off marketing surfaces.

**Launch execution scope**
- D-15: Phase ends at launch-ready main. Launch-Day Checklist execution is out of phase scope.
- D-16: Full v2.0.0 release prep, no tag. Write CHANGELOG.md v2.0.0 section, bump three version files, verify `node scripts/extract-changelog.cjs v2.0.0` prints clean.
- D-17: Targeted release review. Full review of Phase 45's own diff + risk-focused sweep of cumulative v1.9.0..HEAD diff — not a re-read of 8 already-reviewed phases.
- D-18: Launch-comms kit drafted in-phase. announcement.json banner copy, launch changelog-highlight writeup, 2-3 platform post drafts. Founder publishes manually on launch day.

### Claude's Discretion
- Port mechanics and commit sequencing (page-by-page vs system-first), and the token-scoping mechanism for D-02
- /pricing page layout/composition within the Cost-Truth Dark system (Free vs Pro columns, FAQ block, etc.)
- Which FAQ entries get refreshed for v2.0 features and Pro
- Changelog page presentation (MAX_RELEASES_DISPLAYED stays 5 unless a reason emerges)
- SupportNudge Pro-retarget copy + frequency caps (keep the branch's calm no-nag behavior)
- NEW-badge registration for user-facing marketing-visible features per `src/features.ts` conventions
- Exact post-launch roadmap-page item copy (from the v2-deferred requirement pool)

### Deferred Ideas (OUT OF SCOPE)
- Donation/support ask (parked, not dead — revisit post-launch)
- App-wide dark-brand restyle (tokens now, app later — /app keeping slate is a launch-risk decision, not forever)
- Marketing-side direct checkout (only if funnel data shows the in-app upgrade path loses buyers)
- Testimonials/social proof on the marketing site (no material yet)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BRAND-01 | The "Cost-Truth Dark" marketing-site redesign (branch `test/design-skills-experiment`) is merged for launch, with v1.7+ DownloadPage/FAQPage Linux correctness ported and the 3 Pro-pricing spots filled with real numbers | Full divergence map below (Architecture Patterns), token-scoping architecture recommendation, per-page reconciliation table, pricing byte-match mechanism, package legitimacy audit for `motion` + font self-hosting |

</phase_requirements>

## Summary

This phase is **not a merge** — it is a manual port of a design system from a branch that is 446 commits behind main, onto a main that has grown by 866 changed files (72,501 insertions) since the branch diverged at `d963e36` (2026-06-15). The two codebases only overlap on **15 files**: the 7 marketing pages, Header/Footer, 5 shared `ui/` primitives, `vite.config.ts`, `main.tsx`, `package.json`, and (surprisingly) `CostCalculator.tsx` — which no longer exists as a single file on main (Phase 38 split it into `src/components/calculator/`, deleting 1,690 lines from the original path). Every other branch file (DESIGN.md, PRODUCT.md, index.css tokens, motion/Reveal.tsx, landing/CostReveal.tsx, SupportNudge, ScrollToTop) is either wholly new or (in ScrollToTop's case) **already independently present on main, byte-identical**.

The critical technical finding is that **the branch never actually solved the D-02 problem** (marketing-only theming). Its shared `ui/` primitives (Button, Card, Input, Select, Textarea) hardcode `var(--brand)`, `var(--surface)`, etc. directly with no scoping — applied as-is, this would re-skin the `/app` calculator too, since Button/Card/Input are used everywhere. The branch's own `ToastViewport.tsx` shows the *correct* pattern by contrast: it left the non-`support` toast variants on hardcoded `bg-slate-800` and only switched the new `support` variant to a CSS var — proving the branch author understood app-safety for that one component but did not apply the same discipline to Button/Card/Input/Select/Textarea. The fix is straightforward Tailwind v4 + CSS custom-property cascade: define the token set at `:root` with **slate-equivalent default values** (so `/app`, which never opts in, is unaffected), then override the same properties inside a wrapper class/element applied only around the marketing route tree (Header/Footer/each marketing page), which the CSS cascade will resolve correctly since these are plain inherited custom properties, not Tailwind theme config.

A second major finding: main independently gained an a11y hardening pass (Phase 37, commit `499155f`) that added `<main>` landmarks, `aria-labelledby` on every section, and `aria-hidden="true"` on every decorative icon across LandingPage, FeaturesPage, DownloadPage, RoadmapPage, and FeedbackPage. The branch's page rewrites will silently drop all of this unless the port deliberately re-applies the pattern — this is not called out in CONTEXT.md and is a concrete regression risk.

A third finding, also not previously known: main's DownloadPage and the branch's DownloadPage **both independently added Linux support**, with different data structures (main: three flat `linuxAppImage/linuxDeb/linuxRpm` fields; branch: a unified `platforms` array with `primary`/`extras`). The branch's FAQPage, however, did **not** get the three Linux troubleshooting Q&As that shipped on main, and still carries stale "no data collection" and "3-day New badge" copy that main's Phase 42/43 corrected. The port must reconcile DownloadPage's *logic* (prefer main's exact URL-construction/fallback-version values, wrapped in the branch's cleaner unified layout) and must re-inject FAQPage's missing content wholesale (not just restyle the branch's stale content).

A fourth, concrete and verified finding: the branch's `index.html` loads "Bricolage Grotesque" via a Google Fonts `<link>` (`fonts.googleapis.com` / `fonts.gstatic.com`). The project's current CSP (`vercel.json`) is `font-src 'self' data:; style-src 'self' 'unsafe-inline'` — neither Google Fonts domain is allowlisted, so this would be **silently blocked by the browser at runtime** (font falls back to system-ui, no visible failure, easy to ship unnoticed). It is also a disclosed-processor problem: neither domain appears in `docs/DATA-FLOW-INVENTORY.md` or `PrivacyPage.tsx`'s processor list, and loading a Google Fonts stylesheet leaks the visitor's IP to Google (a documented GDPR concern). The correct fix is to self-host via `@fontsource/bricolage-grotesque` (verified on npm registry, official Fontsource org, static font files bundled — zero runtime third-party request), not to widen the CSP.

**Primary recommendation:** Treat this as a scoped-theming + content-reconciliation exercise, not a copy-paste port. Build the CSS-variable scoping layer first (Wave 0), self-host the display font, then port pages one at a time reconciling branch styling against main's a11y/Linux/security additions — verified via the byte-identical price/legal-content regex guards and the existing e2e consent-gate/free-floor specs staying green throughout.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Marketing page rendering (Landing/Features/Download/FAQ/Changelog/Roadmap/Feedback/Pricing/Privacy/Terms) | Browser / Client (lazy-loaded React routes) | CDN / Static (Vercel edge) | Pure client-rendered SPA routes, no SSR in this project |
| Dark-brand design tokens | Browser / Client (CSS custom properties, cascade-scoped) | — | Pure CSS; no server involvement |
| Pro pricing display (3 spots) | Browser / Client (static copy, sourced from a shared constant) | — | No live pricing API call — numbers are hardcoded to match `BillingPanel.tsx`/Paddle config, which itself is env-driven |
| Pro price *truth* (Paddle price IDs, entitlement) | API / Backend (Supabase + Paddle, Phase 43) | — | Out of scope for Phase 45 — marketing surfaces only *display* text that must match the already-shipped backend truth |
| CHANGELOG / version-file release prep | Build tooling (`scripts/extract-changelog.cjs`, CI workflow) | — | Static file edits, verified by a Node script; no runtime component |
| Font delivery (Bricolage Grotesque) | CDN / Static (self-hosted via npm package → bundled asset) | Browser / Client (`@font-face`) | Avoids third-party runtime request (CSP + GDPR); files ship in the build |
| Motion/animation (Reveal, CostReveal) | Browser / Client (`motion` package, isolated `motion-vendor` chunk) | — | Marketing-only; must not load in `/app` bundle |
| Launch-comms drafts (announcement.json, changelog highlight, social posts) | Build-time content / CDN (jsDelivr-served `announcement.json`) | — | No new runtime mechanism — reuses the existing `useAnnouncement` → jsDelivr fetch pattern already live |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `motion` | ^12.42.2 (branch pinned `^12.40.0`) | Reveal-on-scroll / mount animation primitives (`Reveal.tsx`, `CostReveal.tsx`) | Official successor to Framer Motion; 16M weekly downloads; already isolated into its own Rollup chunk in the branch's `vite.config.ts` diff `[CITED: npm registry, github.com/motiondivision/motion]` |
| `@fontsource/bricolage-grotesque` | ^5.3.0 | Self-hosted Bricolage Grotesque display font (headings) | Avoids the CSP-blocked / GDPR-risk Google Fonts `<link>` the branch used; Fontsource is the standard self-hosting solution for Google Fonts in Vite/npm projects `[CITED: npm registry, github.com/fontsource/font-files]` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none new) | — | — | The branch's only other dependency delta is `package.json` version bump churn from being 446 commits stale — no other new runtime deps are needed for the port itself |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@fontsource/bricolage-grotesque` | Widen CSP to allow `fonts.googleapis.com`/`fonts.gstatic.com` + add as a disclosed processor + consent-gate it | Rejected: adds a new third-party runtime call, a new GDPR processor-list entry, and a consent-gating decision for a purely cosmetic font — self-hosting removes all three problems for near-zero cost (~640 KB unpacked, tree-shaken to only the weights used) |
| CSS-var cascade scoping (marketing wrapper class overrides `:root` defaults) | Duplicate Button/Card/Input/Select/Textarea as marketing-only variants | Rejected: doubles maintenance surface for 5 primitives; the cascade approach is a ~10-line CSS change and matches how the branch already wrote the components (arbitrary-value `var()` references) |
| CSS-var cascade scoping | Tailwind v4 `@theme`/dark-variant selectors | Not applicable here — Tailwind v4's `@theme` defines *design tokens* compiled into utility classes at build time, not runtime-swappable per-subtree values; the branch's `bg-[var(--x)]` arbitrary-value pattern already relies on runtime CSS custom properties, which is the right primitive for a route-scoped (not global) theme swap |

**Installation:**
```bash
npm install motion@^12.42.2 @fontsource/bricolage-grotesque@^5.3.0
```

**Version verification:** Confirmed via `npm view motion version` → `12.42.2` (published 2026-06-30, react-facing successor to framer-motion) and `npm view @fontsource/bricolage-grotesque version` → `5.3.0` (published 2026-07-19). Both ecosystem: npm.

## Package Legitimacy Audit

| Package | Registry | Age signal | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `motion` | npm | Latest version published 2026-06-30 (package itself is the well-known ex-Framer-Motion library, actively released) | 16,125,361/wk | github.com/motiondivision/motion | SUS (`gsd-tools` reason: `too-new` — false positive, see note) | Approved with checkpoint — `too-new` fires on frequent-release cadence, not package age; 16M weekly downloads and the official `motiondivision` org make this a known-legitimate library. Still route through `checkpoint:human-verify` per protocol before `npm install`. |
| `@fontsource/bricolage-grotesque` | npm | Latest version published 2026-07-19 (Fontsource ships a version per font-metadata update, not per package age) | 41,370/wk | github.com/fontsource/font-files | SUS (`gsd-tools` reason: `too-new` — false positive, see note) | Approved with checkpoint — same false-positive pattern as `motion`; Fontsource is the standard, widely-used (2,900+ font packages, all auto-published from Google Fonts metadata) self-hosting solution. Still route through `checkpoint:human-verify` per protocol before `npm install`. |

**Packages removed due to [SLOP] verdict:** none

**Packages flagged as suspicious [SUS]:** `motion`, `@fontsource/bricolage-grotesque` — both false-positived on the seam's `too-new` heuristic (which reads the *latest publish timestamp*, not package first-release date, and both libraries release frequently). The planner should still insert a `checkpoint:human-verify` task before either `npm install`, per protocol, but the evidence above (download counts + official GitHub orgs) supports approval. This mirrors the documented Phase 44 precedent where `three` was flagged SUS and the user approved it as a false positive.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ Browser navigates to a marketing route (/, /features, /pricing…) │
└───────────────────────────────┬─────────────────────────────────┘
                                 │
                                 ▼
                   main.tsx <Routes> (React Router)
                                 │
              ┌──────────────────┴──────────────────┐
              │ __IS_TAURI__ ? /app-only routes      │  (desktop: no marketing routes at all)
              │ : full marketing + /app routes       │
              └──────────────────┬──────────────────┘
                                 │ web build only
                                 ▼
        lazyWithRetry() dynamic import of the page component
                                 │
                                 ▼
        ┌────────────────────────────────────────────┐
        │  <MarketingThemeScope> wrapper (NEW, D-02)  │  ← sets brand CSS vars
        │    <Header/> (brand-token styled)           │     that cascade DOWN
        │    <PageContent/> (Reveal/CostReveal motion) │     into Button/Card/
        │    <Footer/> (brand-token styled)            │     Input/Select/
        └────────────────────┬─────────────────────────┘     Textarea children
                              │
                              ▼
        Shared ui/ primitives (Button, Card, Input, Select,
        Textarea) resolve var(--brand)/var(--surface)/etc.
        from the NEAREST ancestor that defines them:
          - inside <MarketingThemeScope> → Cost-Truth Dark values
          - inside /app (CostCalculator tree, no wrapper)
            → :root slate-equivalent DEFAULT values (unchanged look)

┌─────────────────────────────────────────────────────────────────┐
│ Pro pricing display (3 spots: /pricing, landing teaser, features)│
│   reads a SHARED constant (mirrors BillingPanel.tsx's            │
│   MONTHLY_PRICE_LABEL/ANNUAL_PRICE_LABEL) — never re-typed        │
│   → guarded by a regex test (TermsPage.test.tsx precedent)       │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Value-moment save (CostCalculator / PrintQuoteModal /            │
│ RecordSaleModal onSaveJob/onQuoteCreated/onSaved success path)   │
│   → useSupportNudge() (retargeted to Pro copy, D-03)             │
│   → toast.show('support', ...) — gold variant, 12s auto-dismiss  │
│   → coordinated with ProPitchModal (Phase 43-04's "no other      │
│     toast pitches Pro" comment must be updated, see Pitfalls)    │
└─────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
src/
├── index.css                    # :root gets Cost-Truth Dark tokens
│                                 #   with SLATE-EQUIVALENT defaults (D-02 fix)
├── components/
│   ├── marketing/                # NEW — port target for brand-scoping wrapper
│   │   └── MarketingThemeScope.tsx  # sets .theme-brand-dark (or similar) on
│   │                                 # a wrapper div; Header/Footer/pages render inside it
│   ├── motion/Reveal.tsx         # ported from branch, unchanged
│   ├── landing/CostReveal.tsx    # ported from branch, unchanged
│   ├── SupportNudge.tsx          # ported + retargeted copy (D-03)
│   ├── Header.tsx                # ported; DROP the unused variant="light" branch (dead code, undefined --paper/--pine vars)
│   ├── Footer.tsx                # reconcile: branch restyle + main's Privacy/Terms/CookieSettingsLink links (already on main)
│   └── ui/                       # Button/Card/Input/Select/Textarea — apply var() refs,
│                                  # but ONLY after :root default values are slate-safe
├── pages/
│   ├── LandingPage.tsx           # branch redesign + main's a11y landmarks (Phase 37) re-applied
│   ├── FeaturesPage.tsx          # branch's competitor-matrix redesign + D-08 Pro column ADDED (branch has neither Pro column nor the old "no Pro tier" line — it's a net-new addition, not a restyle)
│   ├── DownloadPage.tsx          # branch's unified layout + main's exact Linux URL/version logic reconciled
│   ├── FAQPage.tsx               # branch's restyle + main's 3 missing Linux Qs + GDPR-aware "is it free" copy + 14-day/36-hour badge copy RE-INJECTED
│   ├── ChangelogPage.tsx         # branch's restyle + main's isSafeHttpUrl fix (branch still has the old inline url.startsWith check — regression risk)
│   ├── RoadmapPage.tsx           # branch's restyle + D-13 content refresh (shipped items → /features, post-launch items in)
│   ├── FeedbackPage.tsx          # branch's restyle, low main-divergence risk
│   ├── PricingPage.tsx           # NEW — D-06, does not exist on either branch or main
│   ├── PrivacyPage.tsx           # NOT on branch (main-only, Phase 42) — restyle only, content byte-identical, regex guard must stay green
│   └── TermsPage.tsx             # NOT on branch (main-only, Phase 43) — restyle only, content byte-identical, regex guard must stay green
├── utils/
│   └── supportNudge.ts           # ported + retargeted (SUPPORT_URL → Pro/upgrade link or app deep-link)
└── main.tsx                      # add /pricing route; ScrollToTop already present on main (byte-identical to branch — no-op)
```

### Pattern 1: CSS custom-property cascade scoping for route-level theming
**What:** Define brand-dark tokens at `:root` using values that visually equal the *current* slate app palette (e.g. `--brand: #2563eb` matching `bg-blue-600`), then define a second rule block — scoped to a class applied only around the marketing route tree — that overrides the same custom properties with the branch's actual Cost-Truth Dark values (`--brand: #1796ff`, `--bg: #0a0e18`, etc.).
**When to use:** Any time a shared component (Button, Card, Input) must render two different themes depending on which part of the route tree it's mounted in, without forking the component.
**Example:**
```css
/* src/index.css */
:root {
  /* Slate-equivalent defaults — /app inherits these unchanged */
  --brand: #2563eb;        /* blue-600, current primary button */
  --brand-soft: #1d4ed8;   /* blue-700, current hover (darkens, not lightens) */
  --surface: #1e293b;      /* slate-800 */
  --surface-2: #334155;    /* slate-700 */
  --hairline: #334155;     /* slate-700 border */
  --ink: #ffffff;
  --ink-soft: #cbd5e1;     /* slate-300 */
  --ink-faint: #94a3b8;    /* slate-400 */
  --bg: #0f172a;           /* slate-900 */
}

/* Marketing-only override — applied via a wrapper element around
   Header + page content + Footer for every marketing route */
.theme-brand-dark {
  --brand: #1796ff;
  --brand-soft: #5bb3ff;   /* NOTE: lightens on hover, opposite direction
                               from the slate default above — this is
                               intentional per DESIGN.md, both directions
                               work because they're independent token sets */
  --brand-deep: #0b6fd4;
  --brand-glow: rgba(23, 150, 255, 0.32);
  --bg: #0a0e18;
  --surface: #121829;
  --surface-2: #18203a;
  --hairline: rgba(255, 255, 255, 0.08);
  --hairline-strong: rgba(255, 255, 255, 0.14);
  --ink: #f2f5fb;
  --ink-soft: #a8b3c7;
  --ink-faint: #74809a;
  --amber: #f0b429;
  --amber-soft: rgba(240, 180, 41, 0.14);
}
```
```tsx
// Applied once, at the top of the marketing route tree (not inside every page)
export function MarketingThemeScope({ children }: { children: ReactNode }) {
  return <div className="theme-brand-dark">{children}</div>;
}
```
The shared primitives (`Button.tsx`, `Card.tsx`, etc.) then keep the branch's literal `bg-[var(--brand)]` styling **unmodified** — the value they resolve depends purely on DOM ancestry, not on any prop or context.

### Pattern 2: Byte-identical pricing guard (regex-guard test)
**What:** A single source-of-truth constant for the two price labels, imported everywhere marketing copy needs them, backed by a vitest that asserts the literal strings never drift from `BillingPanel.tsx`.
**When to use:** Any surface (this phase: `/pricing`, landing teaser, features-table header) that must display the same price as the billing/entitlement code.
**Example:**
```typescript
// Source: existing pattern in src/pages/TermsPage.test.tsx (Phase 43-02)
// src/components/pro/BillingPanel.tsx already defines:
const MONTHLY_PRICE_LABEL = 'EUR 6.90';
const ANNUAL_PRICE_LABEL = 'EUR 69';

// New: export these (or a shared src/pricing.ts re-export) and import
// on every marketing pricing surface instead of re-typing the string.
// Guard test (new, mirrors TermsPage.test.tsx precedent):
it('marketing pricing spots match BillingPanel byte-for-byte', () => {
  const pricingPageSource = readFileSync('src/pages/PricingPage.tsx', 'utf-8');
  expect(pricingPageSource).toMatch(/EUR 6\.90/);
  expect(pricingPageSource).toMatch(/EUR 69/);
});
```

### Pattern 3: Archive-then-delete branch retirement
**What:** Tag the branch tip before deleting it, so all commits stay reachable.
**When to use:** D-01 branch retirement, same as the Phase 33 precedent.
**Example:**
```bash
# Source: git log precedent — archive/phase-33-ui created at bcea107 (Phase 40-05)
git tag archive/design-skills-experiment test/design-skills-experiment
git push origin archive/design-skills-experiment
git branch -d test/design-skills-experiment
git push origin --delete test/design-skills-experiment
```

### Anti-Patterns to Avoid
- **Applying the branch's Button/Card/Input/Select/Textarea diffs verbatim:** re-skins `/app` too (D-02 violation) — see Pattern 1.
- **Copying the branch's `Header.tsx` `variant="light"` prop:** dead code referencing undefined `--paper`/`--pine`/`--surface-sunk` custom properties; DESIGN.md itself calls this "unused... harmless, non-breaking" — drop it during the port instead of preserving working-but-pointless code.
- **Loading Bricolage Grotesque via the branch's Google Fonts `<link>` tags:** blocked by the current CSP (`font-src 'self' data:`), and is an undisclosed GDPR processor if it weren't blocked. Self-host instead (Standard Stack above).
- **Trusting the branch's DownloadPage/FAQPage Linux content as "the" Linux correctness source:** the branch has its own, differently-structured, independently-written Linux download logic that predates the FAQ troubleshooting Qs. Main's FAQ content (3 Linux Q&As) must be manually re-added — restyling the branch's FAQ alone will not surface them.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Self-hosted display font | Manually downloading `.woff2` files + hand-written `@font-face` rules | `@fontsource/bricolage-grotesque` | Handles subsetting, unicode-range, font-display, and version updates; avoids a manual asset-pipeline step and license-file management |
| Marketing/app theme switch | A React context + `useTheme()` hook toggling className props through every component | CSS custom-property cascade scoping (Pattern 1) | Zero JS, zero re-renders, works with SSR-less lazy routes automatically, and the branch's components already reference `var(--x)` — no component code changes needed, only the token *definition* changes |
| Pricing-text consistency enforcement | A code-review checklist item ("remember to update all 3 pricing spots") | A shared constant + regex-guard vitest (Pattern 2) | The project already has this exact pattern twice (TermsPage price guard, PrivacyPage processor-list guard) — a checklist is not a build-time gate, a failing test is |

**Key insight:** Every "don't hand-roll" here has a working precedent already shipped in this codebase (regex guards, CSS-var theming already partially used by ToastViewport, Fontsource-style self-hosting is standard Vite practice) — the port should follow those precedents rather than inventing new mechanisms.

## Runtime State Inventory

> This phase is a code port/reconciliation, not a data migration — but it does retire a long-lived git branch and touches a feature-registry file with date-sensitive entries, so a lightweight inventory is included.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no Dexie schema, IndexedDB, or Supabase table changes in this phase | None |
| Live service config | `announcement.json` at repo root is fetched live from jsDelivr's CDN cache (`cdn.jsdelivr.net/gh/Waarangel/3dcoster@main/announcement.json`) with cache-purge latency noted in `src/utils/announcement.ts` — D-18's launch-comms copy must land in this file on `main` and account for jsDelivr's propagation delay before the founder flips `active: true` on launch day | Code edit (content) + operator awareness of CDN cache lag, no data migration |
| OS-registered state | None | None — verified: this phase touches no OS-level registrations (no Task Scheduler, pm2, launchd) |
| Secrets/env vars | None — Pro pricing display in this phase reads a static string constant, not `VITE_PADDLE_PRICE_ID_*` env vars (those stay Phase-43-owned, untouched) | None |
| Build artifacts | The retired `test/design-skills-experiment` branch itself, and its `archive/phase-33-ui` sibling tag pattern — no npm/pip artifacts affected | Tag-then-delete per Pattern 3; no reinstall needed |
| Feature registry (`src/features.ts`) | If any port-introduced surface counts as "user-facing" under the project's NEW-badge convention (marketing pages historically do NOT get NEW badges per CLAUDE.md/CONTEXT.md discretion note) | Likely none — confirm no new dated entries needed unless the SupportNudge Pro-retarget itself is judged user-facing enough (it already exists as a shipped mechanic, only its copy/target changes, so no new badge) |

## Common Pitfalls

### Pitfall 1: Applying shared ui/ primitive diffs unscoped re-skins `/app`
**What goes wrong:** Copying the branch's literal `Button.tsx`/`Card.tsx`/`Input.tsx`/`Select.tsx`/`Textarea.tsx` diffs makes every button, card, and input across the entire app (including `/app`, the calculator) resolve `var(--brand)` etc. If those custom properties are only ever defined once (at `:root`, with the branch's dark values), the calculator's whole visual identity changes — a direct D-02 violation and a launch-week regression risk since `/app` is the highest-traffic surface.
**Why it happens:** The branch was developed in isolation from `/app` and never needed to coexist with it; its author (per the ToastViewport counter-example) clearly understood the risk for ONE component but didn't generalize the fix.
**How to avoid:** Implement Pattern 1 (slate-equivalent `:root` defaults + `.theme-brand-dark` override scope) BEFORE porting any page. Verify by rendering `/app` after the token change and confirming zero visual diff (screenshot compare at minimum, or a quick manual check per `web/testing.md`'s visual-regression priority).
**Warning signs:** Any Playwright/manual screenshot of `/app` showing blue-glow buttons, dark-ink surfaces, or Bricolage-styled headings after the port.

### Pitfall 2: Google Fonts `<link>` tags are silently blocked by the current CSP
**What goes wrong:** The branch's `index.html` adds `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque...">`. The live CSP (`vercel.json`) is `style-src 'self' 'unsafe-inline'; font-src 'self' data:` — neither `fonts.googleapis.com` nor `fonts.gstatic.com` is allowlisted. The browser blocks the request; the font silently falls back to the system stack. No error is visible in the UI, only in the browser console — easy to ship without noticing in a quick visual check.
**Why it happens:** The branch was developed without the CSP that main later hardened, and CSP violations don't throw JS exceptions the app can catch.
**How to avoid:** Self-host via `@fontsource/bricolage-grotesque` (Standard Stack) — imports the CSS + woff2 files as local build assets, satisfying `font-src 'self'` with zero CSP changes.
**Warning signs:** Headings render in a generic sans-serif instead of Bricolage Grotesque; DevTools console shows a CSP violation for `fonts.googleapis.com`.

### Pitfall 3: Google Fonts is an undisclosed GDPR processor
**What goes wrong:** Even if the CSP were widened to allow it, loading a Google-hosted stylesheet transmits the visitor's IP address to Google before any consent gate — a well-documented GDPR concern (multiple 2022+ EU court rulings). Neither `fonts.googleapis.com` nor `fonts.gstatic.com` appears in `docs/DATA-FLOW-INVENTORY.md` or `PrivacyPage.tsx`'s processor list, both of which are process-gated ("update inventory first, then policy" per the file's own header comment).
**Why it happens:** Same root cause as Pitfall 2 — branch predates this project's GDPR hardening (Phase 42/43).
**How to avoid:** Self-hosting (Pitfall 2's fix) makes this a non-issue — no third-party network call means no new processor to disclose.
**Warning signs:** A new network request to a `*.google*` domain appears in the Network tab on a page load with no prior consent interaction.

### Pitfall 4: The branch's FAQPage is missing 3 Linux Q&As and carries stale GDPR/badge copy
**What goes wrong:** The branch's FAQPage was restyled (commit `2a741bc`) but its *content* still reflects the pre-Phase-42/43 world: "no data collection" (now false — Vercel Analytics + cookie consent exist), "3-day New badge" (now 14-day/36-hour per `features.ts`), and it has zero Linux troubleshooting entries despite the branch's own DownloadPage supporting Linux. A restyle-only port would ship these regressions.
**Why it happens:** The branch's FAQ redesign commit predates Phase 42 (GDPR) and Phase 43 (Pro) entirely, and its own Linux DownloadPage support (commit `97f6fdc`) was never followed up with matching FAQ content the way main's was.
**How to avoid:** Treat FAQPage as a content merge, not a pure restyle: take main's current Q&A array (11 entries incl. 3 Linux ones + GDPR-aware wording) and apply the branch's visual treatment on top, rather than restyling the branch's stale array.
**Warning signs:** FAQ page says "no data collection" while a cookie-consent banner is visible on the same site; missing Linux entries when `/download` prominently offers Linux binaries.

### Pitfall 5: Branch's DownloadPage and main's DownloadPage have independently-diverged Linux logic
**What goes wrong:** Both sides added Linux support after the shared merge-base, but with different code shapes (main: three separate `linuxAppImageUrl`/`linuxDebUrl`/`linuxRpmUrl` fields and three inline JSX blocks; branch: a unified `platforms` array with `primary`/`extras`). A naive merge (rather than a deliberate reconciliation) risks silently reverting main's exact fallback-URL construction, `isSafeHttpUrl` gating, or the `fallbackVersion` bump discipline that ships with every release.
**Why it happens:** Two people (or two AI sessions) solved the same problem independently on different branches without either being aware of the other.
**How to avoid:** Port the branch's unified layout/visual treatment, but re-derive the actual URL-fetching logic from main's version line-by-line (asset detection regex, `isSafeHttpUrl` wrapping, ChromeOS/Android UA exclusions in `detectPlatform`), not from the branch's independent implementation.
**Warning signs:** Download links point at a stale hardcoded version, or the Linux detection regex doesn't exclude Android/ChromeOS the way main's does.

### Pitfall 6: Main's Phase 37 a11y hardening (landmarks, aria-labelledby, aria-hidden) is not in the branch
**What goes wrong:** Commit `499155f` on main added `<main>` landmarks, `aria-labelledby` on every section, and `aria-hidden="true"` on every decorative SVG across LandingPage, FeaturesPage, DownloadPage, RoadmapPage, and FeedbackPage. The branch's rewrites of these same pages predate that commit and don't have any of it. A port that takes the branch's JSX as the base will regress accessibility that was deliberately shipped.
**Why it happens:** Same divergence-timing issue as the other pitfalls — the branch's page rewrite commits are older than main's a11y pass.
**How to avoid:** After porting each page's visual structure, re-apply the `<main>` wrapper + `aria-labelledby`/`aria-hidden` pattern (checkable via `git diff d963e36..main -- src/pages/<Page>.tsx` for the exact additions needed, already extracted in this research's Architecture Patterns section).
**Warning signs:** Missing `<main>` landmark in the rendered DOM; decorative icons announced by screen readers.

### Pitfall 7: ChangelogPage's branch version still uses the pre-hardening URL-safety check
**What goes wrong:** Main replaced an inline `url.startsWith('http://') || url.startsWith('https://')` check in `ChangelogPage.tsx`'s markdown-link renderer with the shared `isSafeHttpUrl` utility (which catches encoded-scheme payloads the inline check missed). The branch's ChangelogPage rewrite still has the old inline check.
**Why it happens:** Divergence timing, same pattern as Pitfalls 4-6.
**How to avoid:** When porting ChangelogPage, import and use `isSafeHttpUrl` from `utils/urlSecurity.ts` instead of re-adding the inline check.
**Warning signs:** A `git grep "url.startsWith('http"` hit inside `ChangelogPage.tsx` after the port is complete.

### Pitfall 8: SupportNudge's Pro-retarget conflicts with ProPitchModal's "no other toast pitches Pro" comment
**What goes wrong:** `src/components/pro/ProPitchModal.tsx` (Phase 43-04) carries the comment "No toasts or banners anywhere else pitch Pro (D-10 'no nags')" as a documented invariant. D-03 in this phase's CONTEXT.md deliberately introduces a SECOND Pro-pitching toast (the retargeted SupportNudge). If this stale comment is left as-is, a future reader (human or agent) will treat it as still-true documentation and may "fix" the SupportNudge Pro-copy as an accidental violation, or miss coordinating the two surfaces' frequency caps.
**Why it happens:** Phase 43-04 was written before Phase 45's D-03 decision existed; the comment was accurate at the time it was written.
**How to avoid:** Update the ProPitchModal.tsx docstring comment in the same phase that introduces the SupportNudge Pro-retarget, explicitly cross-referencing the new invariant (e.g., "as of Phase 45, SupportNudge also pitches Pro on save-success; the two are coordinated via [mechanism] so they never stack in one session").
**Warning signs:** A code reviewer citing the stale comment as grounds to reject the SupportNudge Pro-copy change.

### Pitfall 9: FeaturesPage's "no Pro tier hiding the business features" line is already self-contradicting on main
**What goes wrong:** Main's current `FeaturesPage.tsx` (line 32) says "All of it free, with no Pro tier hiding the business features" while the SAME file's comparison table already marks rows "(Pro)" (e.g., "Limited (SKU manager, Pro)", "Yes (Pro)") — a live self-contradiction shipped since Phase 43. If the port only focuses on the branch's competitor-matrix redesign (which has neither this line nor any Pro annotations), it's easy to forget this specific main-only copy bug needs fixing as part of D-08, since it doesn't show up in a branch-vs-branch diff at all.
**Why it happens:** The branch's FeaturesPage was rewritten around a different structure (competitor comparison, not a single-product Pro/Free table) before Pro existed at all — this bug is main-only and won't surface via branch diffing.
**How to avoid:** Explicitly grep main's FeaturesPage for "no Pro tier" / stale free-forever claims as a standalone task, independent of the branch-diff reconciliation, since D-08 requires fixing it "in the same stroke" as adding the Pro column.
**Warning signs:** Site copy claiming "no Pro tier" anywhere while a `/pricing` page and Pro-gated rows exist elsewhere on the same page.

### Pitfall 10: CostCalculator.tsx no longer exists at the path the branch's diff targets
**What goes wrong:** The branch's `+3 line` SupportNudge hook-up patch targets `src/components/CostCalculator.tsx` (a 1,690-line monolith at merge-base). Phase 38 (FOUND-01) deleted that file entirely and split it into `src/components/calculator/CostCalculator.tsx` (much smaller) plus sibling section components. Applying the branch's patch via `git cherry-pick` or literal patch application will fail outright (file not found) or, if forced, apply to the wrong file.
**Why it happens:** The two codebases have completely different `CostCalculator` architectures now.
**How to avoid:** Manually re-locate the `useSupportNudge()` import + call site in the CURRENT `src/components/calculator/CostCalculator.tsx` (confirmed present: `useToast()` at line 123, the `onSaveJob` success path at line 348) rather than attempting any automated patch/cherry-pick for this file. `PrintQuoteModal.tsx` and `RecordSaleModal.tsx` still exist at their original paths but have grown substantially (+204 / +96 lines since divergence) — re-locate the hook-up points by reading the current save-success handlers, not by line-number diffing.
**Warning signs:** A patch-apply or cherry-pick step in the port process failing with "file not found: src/components/CostCalculator.tsx".

### Pitfall 11: `motion`/`@fontsource` package-legitimacy check false-positives on "too-new"
**What goes wrong:** Both new dependencies flag `SUS` from the automated legitimacy check with reason `too-new`. This reads the latest-version publish timestamp, not the package's overall age — both libraries are long-established (Motion is the actively-maintained successor to Framer Motion; Fontsource is a widely-used font-hosting project) and release frequently, which triggers the same heuristic.
**Why it happens:** The heuristic can't distinguish "brand new sketchy package" from "mature package with a release yesterday."
**How to avoid:** Don't block on the SUS verdict alone — cross-check download counts (16M/wk and 41K/wk respectively) and GitHub org (`motiondivision`, `fontsource`) as done in this research. Still route through the mandated `checkpoint:human-verify` per protocol.
**Warning signs:** N/A — this is a documentation/process pitfall, not a runtime one.

## Code Examples

### Archiving the design branch (D-01)
```bash
# Source: git log precedent (archive/phase-33-ui, commit bcea107)
git tag archive/design-skills-experiment test/design-skills-experiment
git push origin archive/design-skills-experiment
git branch -d test/design-skills-experiment
git push origin --delete test/design-skills-experiment
```

### Diffing a specific overlapping file against BOTH divergence points before porting
```bash
# What the branch changed since the shared ancestor:
git diff d963e36..test/design-skills-experiment -- src/pages/DownloadPage.tsx
# What main changed since the same ancestor (the part that must survive):
git diff d963e36..main -- src/pages/DownloadPage.tsx
```
This two-sided diff is the reconciliation primitive for every one of the 15 overlapping files — run it per file before writing the ported version.

### Release-prep verification (D-16)
```bash
# Source: .claude/CLAUDE.md Desktop App Release Process
node scripts/extract-changelog.cjs v2.0.0   # must print clean release notes, no fallback warning
```

## State of the Art

| Old Approach (branch, merge-base d963e36) | Current Approach (main) | When Changed | Impact |
|--------------------------------------------|--------------------------|---------------|--------|
| `<section>` wrapping marketing page content | `<main>` landmark + `aria-labelledby` sections + `aria-hidden` decorative icons | Phase 37 (commit `499155f`, before v1.9.0) | Port must re-apply, not just restyle branch markup |
| Inline `url.startsWith('http://')` link-safety check | Shared `isSafeHttpUrl()` utility | Between v1.9.0 and Phase 43 hardening | ChangelogPage port must use the shared util |
| `CostCalculator.tsx` as a single 1,690-line file | Split into `src/components/calculator/` (CostCalculator + CostFormSection + CostParametersSection + CostSummaryPanel + PricingSection + ShippingSection) | Phase 38 (FOUND-01) | Any branch patch targeting the old path must be manually re-applied to the new structure |
| No Pro tier / "no Pro tier hiding business features" copy | Pro tier live (Supabase + Paddle, Phase 43), with `(Pro)`-tagged rows already in the SAME features table as the stale copy | Phase 43 | D-08 fix is a main-only bug fix, invisible in branch-diff tooling |
| Google Fonts loaded via CDN `<link>` (branch) | CSP `font-src 'self' data:` (hardened before branch's font-loading approach was ever deployed) | Unclear exact commit, but CSP predates this phase | Font loading must be self-hosted, not CDN-linked |

**Deprecated/outdated:**
- The branch's `Header.tsx` `variant="light"` prop and its `--paper`/`--pine`/`--surface-sunk` CSS var references — DESIGN.md itself documents this as dead code from an earlier abandoned light-theme exploration.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `motion` v12.42.2 and `@fontsource/bricolage-grotesque` v5.3.0 are legitimate despite the automated `too-new` SUS flag | Package Legitimacy Audit | Low — cross-verified via npm registry download counts + known official GitHub orgs; both are widely-recognized libraries in the JS ecosystem, but this cross-check is training-knowledge-informed, not purely tool-derived |
| A2 | The recommended `:root` slate-equivalent default values (e.g. `--brand: #2563eb`) exactly preserve `/app`'s current visual appearance | Architecture Patterns Pattern 1 | Low-medium — the mapping is derived directly from the current `Button.tsx`/`Card.tsx`/`Input.tsx` Tailwind classes (`bg-blue-600`, `bg-slate-800`, etc.) which ARE the ground truth, but the planner should verify visually (screenshot diff) rather than trust the mapping blindly, since hover-direction differs (slate darkens on hover via `blue-700`; brand lightens via `--brand-soft`) |
| A3 | No other npm dependency beyond `motion` and `@fontsource/bricolage-grotesque` is needed to port the branch's design system | Standard Stack | Low — confirmed via the full `package.json` branch-diff (`git diff d963e36..test/design-skills-experiment -- package.json`), which shows only these two additions |

**If this table is empty:** N/A — see entries above.

## Open Questions

1. **Exact CSS class/selector name and wrapper placement for the marketing theme scope (D-02 mechanism)**
   - What we know: A CSS custom-property cascade override is the right primitive (Pattern 1); it must wrap Header + page content + Footer for every marketing route.
   - What's unclear: Whether to apply it once in `main.tsx` around the whole non-Tauri route group, or per-page inside each page component (simpler to reason about per-page, but risks one page being forgotten).
   - Recommendation: Apply once, centrally, wrapping the `<Routes>` web-only branch in `main.tsx` (excluding the `__IS_TAURI__` branch entirely) — this guarantees no marketing page can ship un-themed or, worse, accidentally leak the theme into `/app`.

2. **How FeaturesPage reconciles the branch's competitor-matrix structure with D-08's "Pro column"**
   - What we know: The branch's FeaturesPage is a near-total rewrite (786-line diff) around a 5-6-column *competitor* comparison table (3DCoster vs SlicePrice3D etc.), not a Free-vs-Pro table. D-08 wants "the comparison table gains a 3DCoster Pro column."
   - What's unclear: Whether "the comparison table" in D-08 refers to this competitor matrix (add a 6th/7th column for 3DCoster Pro) or implies a second, separate Free-vs-Pro table should exist alongside it.
   - Recommendation: Add 3DCoster Pro as an additional column in the existing competitor matrix (cheapest, most consistent with the branch's actual structure) and let the dedicated `/pricing` page (D-06) carry the full Free vs Pro breakdown — avoids duplicating a second full-width table on the features page.

3. **SupportNudge/ProPitchModal frequency-cap coordination mechanism (D-03 "don't stack nag")**
   - What we know: Both are toast/modal Pro-pitch surfaces triggered by different events (SupportNudge: job save/quote create with a 90-day cooldown; ProPitchModal: signed-out ShareQuoteButton click, no cooldown since it's an intentional in-context action).
   - What's unclear: Whether "coordinate" means a shared cooldown key, or simply accepting they're different enough contexts (save-success toast vs explicit share-button click) that natural usage patterns won't stack them in practice.
   - Recommendation: No shared cooldown needed — ProPitchModal only fires on an explicit user click (never ambient), so the realistic double-nag risk is low; document the reasoning in the updated ProPitchModal comment (Pitfall 8) rather than building new coordination state.

## Environment Availability

Skipped — this phase's dependencies are npm packages resolved via the existing `npm install` / Vercel build pipeline already used by every other phase; no new external tool, service, or runtime is introduced. `node`, `npm`, and `git` are already confirmed available and in use throughout this research session.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 (unit/component) + Playwright 1.61.1 (e2e, Chromium only) |
| Config file | `vitest.config.ts`, `playwright.config.ts` |
| Quick run command | `npm test -- --run` (currently 1401 passed, 4 skipped, 1 todo, ~19s) |
| Full suite command | `npm run build` (includes `vitest run --coverage && tsc -b && vite build && ...bundle/pdf/three asserts`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BRAND-01 | `/app` visually unchanged after token port (D-02) | manual/visual | Manual screenshot check of `/app` at 320/768/1024/1440 before/after; no automated visual-regression harness exists yet | ❌ Wave 0 (no visual regression tooling installed — Playwright screenshot assertions would need to be added if automated coverage is desired) |
| BRAND-01 | Pricing text matches `BillingPanel.tsx` byte-for-byte on all 3 spots | unit | `npx vitest run src/pages/PricingPage.test.tsx` (new file, mirrors `TermsPage.test.tsx` regex-guard pattern) | ❌ Wave 0 |
| BRAND-01 | PrivacyPage/TermsPage content stays byte-identical after restyle | unit | `npx vitest run src/pages/PrivacyPage.test.tsx src/pages/TermsPage.test.tsx` | ✅ (existing) |
| BRAND-01 | Cookie-consent e2e stays green after restyle | e2e | `npx playwright test e2e/consent-gate.spec.ts` | ✅ (existing) |
| BRAND-01 | Free floor / no-network-before-consent stays green | e2e | `npx playwright test e2e/free-floor-no-network.spec.ts` | ✅ (existing) |
| BRAND-01 | Main bundle stays under 300 KB gz after adding `motion` + Bricolage font | build gate | `npm run build` (runs `scripts/assert-bundle-size.mjs`) | ✅ (existing gate, needs the `motion-vendor` chunk wired per vite.config.ts branch diff) |
| BRAND-01 | `extract-changelog.cjs v2.0.0` prints clean (D-16) | manual/build | `node scripts/extract-changelog.cjs v2.0.0` | ✅ (existing script) |

### Sampling Rate
- **Per task commit:** `npm test -- --run` (fast unit suite, ~19s)
- **Per wave merge:** `npm run build` (full gate incl. bundle-size, tsc -b, lint:no-raw-html)
- **Phase gate:** Full suite green + manual `/app` visual check + e2e specs green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/pages/PricingPage.test.tsx` — new file, regex-guard for the 3 pricing spots (mirrors `TermsPage.test.tsx`)
- [ ] Decide whether to add a Playwright screenshot baseline for `/app` (pre-port) to make the D-02 "no visual change" claim automatically verifiable, or accept manual verification — no existing visual-regression tooling in this repo (see Sources: `web/testing.md` calls for Playwright screenshots as priority-1 for visual-heavy work, but this project has never installed that pattern for the calculator)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Out of scope — no new auth surface (D-10 explicitly defers marketing-side checkout/auth) |
| V3 Session Management | No | No change |
| V4 Access Control | No | No change |
| V5 Input Validation | Yes (narrow) | Any new marketing-side link rendering (ChangelogPage) must use the existing `isSafeHttpUrl()` guard, not a re-invented check (Pitfall 7) |
| V6 Cryptography | No | No change |
| V14 Configuration (CSP) | Yes | Font/asset loading must satisfy the existing `vercel.json` CSP (`font-src 'self' data:`, `style-src 'self' 'unsafe-inline'`) — self-hosting via `@fontsource` requires zero CSP changes; do NOT widen the CSP to accommodate a Google Fonts CDN link |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Undisclosed third-party processor (Google Fonts IP leak) | Information Disclosure | Self-host fonts via `@fontsource` (no runtime third-party request); if a CDN font ever IS required in future, it must be added to `docs/DATA-FLOW-INVENTORY.md` + `PrivacyPage.tsx` processor list FIRST, then code, per the file's own documented process discipline |
| Markdown-link scheme injection in ChangelogPage (`javascript:`, `data:` payloads) | Tampering | Already mitigated on main via `isSafeHttpUrl()` — the port must preserve this, not reintroduce the branch's weaker inline check (Pitfall 7) |
| CSP-violating asset load silently degrading UX (not a security bug per se, but a supply-chain/config-drift risk) | — | Verify via a production-config preview deploy (Vercel preview) before merging to main, checking the browser console for CSP violations on every marketing route |

## Sources

### Primary (HIGH confidence)
- Local git repository (`d963e36` merge-base, `test/design-skills-experiment` branch, `main`) — every file-level diff cited in this document was run directly against the actual repo, not reconstructed from memory
- `npm view motion version` / `npm view @fontsource/bricolage-grotesque version` — live npm registry queries
- `node .../gsd-tools.cjs query package-legitimacy check` — automated legitimacy seam output

### Secondary (MEDIUM confidence)
- `docs/DATA-FLOW-INVENTORY.md`, `vercel.json` CSP header, `docs/PRO-SECURITY-REVIEW.md` — read directly from the repo, treated as authoritative project documentation

### Tertiary (LOW confidence)
- None — this research relied entirely on direct repo inspection and registry queries; no unverified web search was needed since the "design source" is a local git branch, not external documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - both new packages verified directly against the npm registry with concrete version/download/repo data
- Architecture (token-scoping, page reconciliation): HIGH - derived from direct diffs of the actual branch and main code, not inference
- Pitfalls: HIGH - all 11 pitfalls are backed by a specific `git diff`/`grep` finding cited inline, not speculation

**Research date:** 2026-07-20
**Valid until:** Until either `main` or `test/design-skills-experiment` receives further commits (the branch is expected to be archived and deleted during this phase per D-01, making this research's branch-side findings a point-in-time snapshot that will not need revalidation once the port lands)
