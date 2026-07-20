# Phase 45: Brand & Launch - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-19
**Phase:** 45-brand-launch
**Areas discussed:** Branch-merge posture, Pro pricing presentation, Launch copy & new pages, Launch execution scope

---

## Branch-merge posture

### How should the redesign land on main? (branch 446 commits behind)

| Option | Description | Selected |
|--------|-------------|----------|
| Port onto main (Recommended) | Branch as design reference; re-apply design system + pages as fresh commits, reconciling each page against current main; archive branch via tag | ✓ |
| Git merge + fix conflicts | Merge directly, resolve ~15 conflicting files; risks silently reverting v1.7–v2.0 fixes | |
| You decide | Researcher/planner picks after inspecting conflict surface | |

**User's choice:** Port onto main

### Should the dark-brand token restyle reach /app?

| Option | Description | Selected |
|--------|-------------|----------|
| Whole app wears the brand | Token swap app-wide; every app surface needs a visual + a11y pass | |
| Marketing-only (Recommended) | Marketing gets the new look; /app resolves tokens to today's slate; matches branch DESIGN.md intent | ✓ |
| Tokens now, app later | Token indirection app-wide mapped 1:1 to slate; future single-file restyle | |

**User's choice:** Marketing-only

### SupportNudge donation toast — ship now that Pro exists?

| Option | Description | Selected |
|--------|-------------|----------|
| Retarget to Pro (Recommended) | Keep the calm value-moment toast mechanic, point it at Pro/hosted quotes; one monetization message | ✓ |
| Ship as donations | Keep the donation ask; Pro pitch lives elsewhere | |
| Drop from Phase 45 | Launch with only the ShareQuoteButton Pro pitch; revisit with conversion data | |

**User's choice:** Retarget to Pro

### Where do PRODUCT.md and DESIGN.md live on main?

| Option | Description | Selected |
|--------|-------------|----------|
| docs/ folder (Recommended) | docs/PRODUCT.md + docs/DESIGN.md alongside other project docs | ✓ |
| Repo root | Keep at root as the branch has them | |
| You decide | Planner picks placement | |

**User's choice:** docs/ folder

---

## Pro pricing presentation

### Primary pricing surface?

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated /pricing page (Recommended) | New route in Header nav; Free vs Pro columns; canonical pricing URL | ✓ |
| Landing-page section | Pricing block on landing; no new route; no canonical URL | |
| Features-page integration | Pro column in the comparison table only | |

**User's choice:** Dedicated /pricing page

### Other two pricing spots? (multi-select)

| Option | Description | Selected |
|--------|-------------|----------|
| Landing-page Pro teaser (Recommended) | Free-forever statement + "Pro from €6.90/mo" card linking to /pricing | ✓ |
| Features-table Pro column (Recommended) | Pro column with price in header; fixes the now-false "no Pro tier" copy | ✓ |
| Download-page mention | Small Pro note on the download page | |
| FAQ pricing entries | FAQ questions with the real numbers | |

**User's choice:** Landing-page Pro teaser + Features-table Pro column

### Pro framing vs free-forever promise?

| Option | Description | Selected |
|--------|-------------|----------|
| Early-supporter launch price (Recommended) | "Launch price — €6.90/mo for early supporters"; undercut story told; no fake countdown | ✓ |
| Straight value framing | No launch angle; calmer but undercut story untold | |
| Free-floor hero framing | Free tier as hero, Pro as "support the project" | |

**User's choice:** Early-supporter launch price

### Pro CTA destination?

| Option | Description | Selected |
|--------|-------------|----------|
| Into the app (Recommended) | "Start free, upgrade in-app" → /app; upgrade from Settings; no new checkout surface | ✓ |
| Direct checkout link | Marketing-side sign-in + Paddle checkout; new flow to build | |
| You decide | Planner picks based on Phase 43 surfaces | |

**User's choice:** Into the app

---

## Launch copy & new pages

### Which v2.0 features get headline billing? (multi-select)

| Option | Description | Selected |
|--------|-------------|----------|
| Cost-truth engine (Recommended) | Failure engine + TOU + wear/maintenance — the brand thesis | ✓ |
| Device sync without accounts | Local-first differentiator, privacy story | ✓ |
| STL instant quote | Demo-able, visual, shareable | ✓ |
| Insights & printer ROI | "Know your business" angle | ✓ |

**User's choice:** All four (hierarchy noted: cost-truth stays the hero; others as major sections)

### Legal surfaces (Privacy/Terms/cookie banner) dark-brand treatment?

| Option | Description | Selected |
|--------|-------------|----------|
| Full brand port (Recommended) | All three restyled; content byte-identical (regex-guard tests stay green) | ✓ |
| Light-touch wrapper only | Branded Header/Footer + background only | |
| Leave them alone | Stay slate; zero risk to Phase 42 verification | |

**User's choice:** Full brand port

### Public /roadmap page at launch?

| Option | Description | Selected |
|--------|-------------|----------|
| Refresh with post-launch items (Recommended) | Shipped v2.0 → /features; roadmap repopulated with safe post-launch candidates | ✓ |
| Shipped-highlights + thin future | "Just shipped" celebration + 1-2 vague directions | |
| You decide | Planner decides, honoring the /roadmap-vs-/features rule | |

**User's choice:** Refresh with post-launch items

### docs/references mtnearz images — purpose?

| Option | Description | Selected |
|--------|-------------|----------|
| Competitor/market research | Positioning reference only, not for the site | ✓ |
| Testimonial/social proof | Material for a marketing social-proof element | |
| Unrelated to Phase 45 | Ignore for this phase | |

**User's choice:** Competitor/market research

---

## Launch execution scope

### Where does Phase 45 end?

| Option | Description | Selected |
|--------|-------------|----------|
| Launch-ready main (Recommended) | Phase ends at launch-ready; Launch-Day Checklist is a founder-driven event outside GSD | ✓ |
| Launch is the final plan | Checklist execution as the phase's last plan with blocking human gates | |
| Separate Phase 46: Launch Day | Dedicated launch phase after 45 | |

**User's choice:** Launch-ready main

### Prep v2.0.0 release artifacts (without tagging)?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, full prep (Recommended) | CHANGELOG v2.0.0 section + 3 version-file bumps + extract-changelog verification | ✓ |
| CHANGELOG only | Leave version bumps for launch day | |
| Leave for launch day | No release prep in the phase | |

**User's choice:** Yes, full prep

### How should the pre-tag release-review gate run? (v1.9.0..HEAD is ~8 phases)

| Option | Description | Selected |
|--------|-------------|----------|
| Targeted release review (Recommended) | Full review of Phase 45's own diff + risk-focused sweep of the cumulative diff | ✓ |
| Full cumulative review | Whole v1.9.0..HEAD treated as unreviewed | |
| You decide | Reviewer picks depth at release time | |

**User's choice:** Targeted release review

### Launch communications in scope?

| Option | Description | Selected |
|--------|-------------|----------|
| Draft materials in-phase (Recommended) | announcement.json copy + changelog highlight + 2-3 platform post drafts; founder publishes manually | ✓ |
| Banner only | Only the in-app announcement banner copy | |
| Out of scope | All comms handled separately | |

**User's choice:** Draft materials in-phase

---

## Claude's Discretion

- Port mechanics / commit sequencing; token-scoping mechanism for the marketing-only restyle
- /pricing page layout within the Cost-Truth Dark system
- FAQ refresh selection; changelog page presentation
- SupportNudge Pro-retarget copy + frequency caps (keep no-nag behavior)
- NEW-badge registration where conventions apply
- Post-launch roadmap-page item copy (from the v2-deferred pool)

## Deferred Ideas

- Donation/support ask (original SupportNudge framing) — revisit post-launch with Pro conversion data
- App-wide dark-brand restyle — future phase may unify marketing + app visuals
- Marketing-side direct checkout flow — only if funnel data shows the in-app path loses buyers
- Testimonials/social proof — gather real user quotes post-launch
