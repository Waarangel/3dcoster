---
phase: 45-brand-launch
plan: 10
subsystem: release-prep
tags: [changelog, release-prep, docs, launch-comms, semver]

# Dependency graph
requires:
  - phase: 45-brand-launch
    plan: "03"
    provides: src/pricing.ts (MONTHLY_PRICE_LABEL/ANNUAL_PRICE_LABEL) — the pricing truth summarized in the CHANGELOG
  - phase: 45-brand-launch
    plan: "04"
    provides: LandingPage Pro teaser and pillar copy referenced in the changelog/comms summary
  - phase: 45-brand-launch
    plan: "05"
    provides: FeaturesPage Pro column / comparison-table content summarized in the changelog
  - phase: 45-brand-launch
    plan: "06"
    provides: DownloadPage/FAQPage reconciliation (v1.7+ Linux correctness) referenced by docs/PRODUCT.md's page list
  - phase: 45-brand-launch
    plan: "07"
    provides: RoadmapPage/ChangelogPage restyle this plan's CHANGELOG section will render through
  - phase: 45-brand-launch
    plan: "08"
    provides: Legal-surface + consent-banner brand port referenced in the v2.0.0 Security changelog bullet
  - phase: 45-brand-launch
    plan: "09"
    provides: SupportNudge Pro retarget — the "one monetization voice" constraint this plan's launch-comms kit honors
provides:
  - "docs/PRODUCT.md + docs/DESIGN.md — ported from test/design-skills-experiment, reconciled for the shipped /pricing page and self-hosted font"
  - "CHANGELOG.md [2.0.0] section — user-facing bullets covering all 8 v2.0 phases, Keep-a-Changelog groupings"
  - "Version bump to 2.0.0 across src/version.ts, src-tauri/tauri.conf.json, src-tauri/Cargo.toml, src-tauri/Cargo.lock"
  - "docs/launch/LAUNCH-COMMS.md + updated announcement.json (active:false) — the launch-day publishing kit"
affects: [45-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cargo.lock version bumped alongside Cargo.toml on every release, per the v1.9.0 precedent (commit 1bb3ac1) — not in this plan's files_modified list but added to avoid a stale lockfile version"

key-files:
  created:
    - docs/PRODUCT.md
    - docs/DESIGN.md
    - docs/launch/LAUNCH-COMMS.md
  modified:
    - CHANGELOG.md
    - src/version.ts
    - src-tauri/tauri.conf.json
    - src-tauri/Cargo.toml
    - src-tauri/Cargo.lock
    - announcement.json

key-decisions:
  - "docs/PRODUCT.md and docs/DESIGN.md ported verbatim from the branch with two reconciliations: PRODUCT.md's brand-surface page list now includes /pricing (added in 45-03, didn't exist when the branch wrote the doc); DESIGN.md's Typography section now states the font is self-hosted via @fontsource (not Google Fonts) and its Header/Footer component note no longer references the branch's since-removed variant=\"light\" dead code (dropped in 45-02)"
  - "CHANGELOG [2.0.0] bullets grouped as Added/Changed/Security (no Deprecated/Removed/Fixed needed — v2.0 is additive, not a bugfix release) and written from the user's perspective (e.g. 'Real failure-rate tracking' not 'FAIL-01/02/03 implemented'), cross-checked against every one of REQUIREMENTS.md's 27 v1 requirements so nothing shipped is missing and nothing internal (refactors, output-equivalence test infra, Dexie migrations) leaked in"
  - "Cargo.lock bumped alongside Cargo.toml/tauri.conf.json/version.ts even though it isn't in this plan's files_modified — mirrors the v1.9.0 release commit's own precedent (1bb3ac1 'prepare v1.9.0 ... + Cargo.lock') so `cargo build` never reports a lockfile/manifest version mismatch"
  - "announcement.json id changed from the placeholder 'example-template' to 'v2-0-launch' — a new campaign id (not reusing any prior dismissed id) ensures every user sees the launch banner once flipped active, per announcement.ts's per-campaign dismissal-key design"
  - "Launch-comms kit written as Reddit + 2 X/Twitter drafts (one primary, one optional thread follow-up) rather than exactly 2-3 flat posts, since the two X drafts serve different purposes (standalone announcement vs. a values-forward thread continuation) and the founder can use either or both"

patterns-established: []

requirements-completed: []  # BRAND-01 spans all 11 plans; the final plan (45-11, targeted release review + branch archive) marks it complete per 45-01..09's established precedent

coverage:
  - id: D45-10-docs
    description: "docs/PRODUCT.md and docs/DESIGN.md exist, ported from the branch, updated for the port (new /pricing page, self-hosted font, removed dead Header variant), no Phase 33/v2.0-CANDIDATES cargo"
    requirement: "BRAND-01"
    verification:
      - kind: other
        ref: "test -f docs/PRODUCT.md && test -f docs/DESIGN.md && grep -qi 'pricing\\|font' docs/DESIGN.md -> DOCS_OK; grep -qi 'phase 33\\|v2.0-CANDIDATES' docs/PRODUCT.md docs/DESIGN.md -> no match"
        status: pass
    human_judgment: false
  - id: D45-10-changelog
    description: "CHANGELOG.md has a ## [2.0.0] - 2026-07-20 section with user-facing bullets in Keep-a-Changelog groupings covering all 8 v2.0 phases; node scripts/extract-changelog.cjs v2.0.0 prints it with no fallback warning"
    requirement: "BRAND-01"
    verification:
      - kind: other
        ref: "node scripts/extract-changelog.cjs v2.0.0 — printed the full What's New section + Download section, zero stderr WARNING output"
        status: pass
    human_judgment: false
  - id: D45-10-versions
    description: "src/version.ts, src-tauri/tauri.conf.json, src-tauri/Cargo.toml (and Cargo.lock) all read 2.0.0; no git tag created"
    requirement: "BRAND-01"
    verification:
      - kind: other
        ref: "grep -q 2.0.0 src/version.ts && grep -q '\"2.0.0\"' src-tauri/tauri.conf.json && grep -q 2.0.0 src-tauri/Cargo.toml -> VERSIONS_OK; git tag -l v2.0.0 -> empty"
        status: pass
    human_judgment: false
  - id: D45-10-comms
    description: "announcement.json has launch copy with active:false; docs/launch/LAUNCH-COMMS.md contains a changelog-highlight writeup + platform post drafts; no donation ask, Pro is the single monetization voice"
    requirement: "BRAND-01"
    verification:
      - kind: other
        ref: "test -f docs/launch/LAUNCH-COMMS.md && node -e \"process.exit(require('./announcement.json').active===false?0:1)\" -> COMMS_OK; grep -ni 'donat|coffee|buymeacoffee|ko-fi' docs/launch/LAUNCH-COMMS.md announcement.json -> only 2 meta-references confirming the ABSENCE of a donation ask, no actual ask present"
        status: pass
    human_judgment: false
  - id: D45-10-no-tag-no-push
    description: "No git tag created and nothing pushed to production during this plan"
    requirement: "BRAND-01"
    verification:
      - kind: other
        ref: "git tag -l v2.0.0 -> empty; no git push command run this plan; all 3 commits are local"
        status: pass
    human_judgment: false

duration: ~25min
completed: 2026-07-20
status: complete
---

# Phase 45 Plan 10: Release Prep — Docs, CHANGELOG, Version Bump, Launch Comms Summary

**Landed docs/PRODUCT.md + docs/DESIGN.md in docs/ (reconciled for the shipped /pricing page and self-hosted font), wrote the CHANGELOG.md [2.0.0] section covering all 8 v2.0 phases, bumped all four version artifacts to 2.0.0, and drafted the launch-comms kit (announcement.json + LAUNCH-COMMS.md) — main is now launch-ready with nothing tagged or pushed.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-07-20T18:46:14Z
- **Tasks:** 3 (all auto)
- **Files modified:** 8 (2 created for docs, 1 created for launch comms, 5 modified for release prep)

## Accomplishments
- Ported `docs/PRODUCT.md` and `docs/DESIGN.md` from `test/design-skills-experiment` verbatim, with two targeted reconciliations: PRODUCT.md's brand-surface page list now includes `/pricing` (built in 45-03, didn't exist when the branch wrote this doc), and DESIGN.md now documents the actually-shipped self-hosted `@fontsource` font strategy (not Google Fonts) and no longer references the branch's since-removed `Header` `variant="light"` dead code (dropped entirely in 45-02). No Phase 33 / `v2.0-CANDIDATES.md` planning cargo was ported (D-04).
- Wrote the `CHANGELOG.md` `## [2.0.0] - 2026-07-20` section: Added/Changed/Security groupings covering all 8 v2.0 phases (failure-rate engine, TOU electricity, wear/maintenance amortization, insights/printer ROI, what-if simulator, reprice alerts, STL instant quote, Quote Variants PDF, spool/moisture tracking, tax-threshold tracker, device sync, onboarding wizard, GDPR consent/privacy/terms, Pro hosted quotes, Cost-Truth Dark redesign) — every bullet cross-checked against `REQUIREMENTS.md`'s 27 v1 requirements, written as short user-facing sentences with no internal implementation detail.
- Bumped `APP_VERSION` (`src/version.ts`), `version` (`src-tauri/tauri.conf.json`), and `version` (`src-tauri/Cargo.toml`) to `2.0.0`; also bumped `src-tauri/Cargo.lock`'s pinned `print-cost-calculator` version entry to match (not in this plan's `files_modified` list, but done to mirror the v1.9.0 release commit's own precedent and avoid a lockfile/manifest mismatch).
- Verified `node scripts/extract-changelog.cjs v2.0.0` prints the full release body cleanly with zero fallback warning.
- Drafted the launch-comms kit: `announcement.json` updated with launch banner copy (new campaign id `v2-0-launch`, `active: false`) linking to `/changelog`, and `docs/launch/LAUNCH-COMMS.md` containing a changelog-highlight blog writeup (5 headline features + the free-floor/Pro-ceiling framing) plus a Reddit draft and two X/Twitter drafts — every draft leads with the free floor before mentioning Pro, and none contains a donation ask.
- Confirmed no git tag was created (`git tag -l v2.0.0` empty) and nothing was pushed — main is launch-ready, launch-day tagging remains a founder-driven event per D-15.

## Task Commits

Each task was committed atomically:

1. **Task 1: Land PRODUCT.md + DESIGN.md in docs/ (D-05)** - `5a71a0f` (docs)
2. **Task 2: Write the CHANGELOG [2.0.0] section + bump the three (four, incl. Cargo.lock) version files (D-16)** - `c62acb1` (chore)
3. **Task 3: Draft the launch-comms kit (announcement.json + writeup + platform posts) (D-18)** - `e93dd9e` (docs)

**Plan metadata:** committed after this SUMMARY (see final_commit step)

## Files Created/Modified
- `docs/PRODUCT.md` - New. Ported from the branch, page list updated to include `/pricing`
- `docs/DESIGN.md` - New. Ported from the branch, font-hosting and Header notes reconciled to shipped reality
- `CHANGELOG.md` - Added `## [2.0.0] - 2026-07-20` section (Added/Changed/Security)
- `src/version.ts` - `APP_VERSION` bumped `1.9.0` → `2.0.0`
- `src-tauri/tauri.conf.json` - `version` bumped `1.9.0` → `2.0.0`
- `src-tauri/Cargo.toml` - `version` bumped `1.9.0` → `2.0.0`
- `src-tauri/Cargo.lock` - `print-cost-calculator` pinned version bumped `1.9.0` → `2.0.0` (Rule 2 completion, mirrors v1.9.0 precedent)
- `announcement.json` - Launch banner copy (`v2-0-launch` id), `active: false`
- `docs/launch/LAUNCH-COMMS.md` - New. Changelog-highlight writeup + Reddit/X platform post drafts

## Decisions Made
See `key-decisions` in frontmatter. Most notable: bumping `Cargo.lock` alongside the three named version files, even though it wasn't in this plan's `files_modified` — the v1.9.0 release commit (`1bb3ac1`) did the same thing for the same reason (avoid a stale lockfile pin), so this follows established project precedent rather than introducing a new pattern.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Bumped `src-tauri/Cargo.lock`'s pinned version alongside the three named version files**
- **Found during:** Task 2, after bumping `src-tauri/Cargo.toml`
- **Issue:** `Cargo.lock` pins `print-cost-calculator`'s own version independently of `Cargo.toml`; bumping only `Cargo.toml` would leave the lockfile reporting `1.9.0` for the workspace's own package, a manifest/lockfile mismatch that `cargo build` would either silently tolerate (Rust doesn't hard-fail on this for path/workspace packages) or require a follow-up `cargo update` to fix later. Checked `git log` for the v1.9.0 release commit and found it explicitly bumped `Cargo.lock` in the same commit as the other three artifacts.
- **Fix:** Bumped the single `version = "1.9.0"` line under `name = "print-cost-calculator"` in `Cargo.lock` to `"2.0.0"`, matching the precedent exactly.
- **Files modified:** `src-tauri/Cargo.lock`
- **Verification:** `grep -A1 'name = "print-cost-calculator"' src-tauri/Cargo.lock` shows `version = "2.0.0"`.
- **Committed in:** `c62acb1` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing-critical completion, following existing project precedent)
**Impact on plan:** Purely additive consistency fix within the same commit; no scope creep, no new surface, no tag/push.

## Issues Encountered
None.

## User Setup Required
None. `announcement.json`'s `active: false` and the CHANGELOG/version bumps require no external service configuration — the founder's remaining launch-day steps (flip the banner, review, tag, push) are documented in `docs/PRO-SECURITY-REVIEW.md` Part 5 and this plan's own `docs/launch/LAUNCH-COMMS.md` notes.

## Next Phase Readiness
- All of D-05/D-16/D-18 are satisfied: `docs/PRODUCT.md`/`docs/DESIGN.md` exist and are reconciled; `CHANGELOG.md` has a clean `[2.0.0]` section; all four version artifacts read `2.0.0`; the launch-comms kit is drafted with `announcement.json` staged inactive.
- No git tag exists and nothing was pushed — main is launch-ready but not launched, exactly per D-15.
- 45-11 (targeted release review + design-branch archive) can now proceed: it depends on this plan's version/CHANGELOG state being final before its own risk-focused `v1.9.0..HEAD` diff sweep, and its scope explicitly includes reviewing this plan's own diff as part of "Phase 45's own diff (the redesign port)."
- REQUIREMENTS.md `BRAND-01` checkbox intentionally left unmarked — this is plan 10 of 11; 45-11 (the phase's final, non-autonomous plan) marks it complete once the targeted review passes and the design branch is archived, per 45-01 through 45-09's established precedent.

---
*Phase: 45-brand-launch*
*Completed: 2026-07-20*

## Self-Check: PASSED

All 8 files confirmed present on disk (docs/PRODUCT.md, docs/DESIGN.md, docs/launch/LAUNCH-COMMS.md, CHANGELOG.md, src/version.ts, src-tauri/tauri.conf.json, src-tauri/Cargo.toml, src-tauri/Cargo.lock). All 3 commits (5a71a0f, c62acb1, e93dd9e) confirmed present in `git log --oneline -5`. `node scripts/extract-changelog.cjs v2.0.0` re-verified clean with no fallback warning. `git tag -l v2.0.0` confirmed empty.
