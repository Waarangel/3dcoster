# Changelog

All notable changes to 3DCoster are documented here. The release workflow (`.github/workflows/release.yml`) extracts the section matching the pushed tag and uses it as the GitHub release body. **If a section is missing for the tag being released, the workflow falls back to a generic template and emits a warning — do not let that happen.**

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## How to add a release section

Before tagging `vX.Y.Z`, add a `## [X.Y.Z] - YYYY-MM-DD` section under `## [Unreleased]` with the user-facing changes for that version. Group items under one or more of:

- **Added** — new features
- **Changed** — changes in existing functionality
- **Deprecated** — soon-to-be removed features
- **Removed** — now removed features
- **Fixed** — bug fixes
- **Security** — vulnerabilities fixed

Each item should be a short, user-facing sentence. The release workflow concatenates the section's body (everything between the section header and the next `##` header) directly into the GitHub release. Do not include internal-only details (refactors, dependency bumps the user won't notice, planning artifacts).

---

## [Unreleased]

_Add the next release's user-facing changes here. Promote to a versioned section before tagging._

---

## [1.3.2] - 2026-05-28

The v1.3 Hardening release — 6 weeks of foundation work shipped to desktop users in one go. No new user-facing features by design; every change closes an audit finding (accessibility, security, atomicity, performance, hygiene) so that v1.4+ feature work has a clean base to build on. Bundle stays under 60 KB gzipped despite ~13K LOC added.

### Added
- **Customer Library testing surface** — full test coverage for CustomerEditModal, CustomerCsvImportModal, and CustomerLibrary, including bulk-import preview, dedup-mode toggle, and the `lastUsedAt` sort lock.
- **`<Modal>` primitive** — every modal in the app (10 surfaces) now shares one WAI-ARIA dialog implementation with focus trap, scroll-lock, and proper `useId()`-labeled fields. Press Escape to close any modal from anywhere it has focus.
- **Customer template download button** — `👥 Customer template` link inside Import Customers, matching the existing Materials / Printers template download UX in the Assets import modal.
- **PrintQuoteModal overflow-menu keyboard support** — the `[⋯]` menu on Pending quote rows now closes on Escape and on outside-click.

### Changed
- **CustomerEditModal email canonicalization** — emails are now lowercased on save (was: saved as-typed), matching how the CSV import canonicalizes. Resolves the bug where typing `John@Example.com` in the modal and importing `john@example.com` via CSV would create two separate library entries for the same person. Existing customer rows are auto-fixed on first app load.
- **JobsManager refactor** — internal restructure that has no visual impact but makes the Jobs tab faster on large libraries (per-row break-even pre-compute via memoized map; redundant marketplace-fee recalculation collapsed; deduplicated `useSales` subscription).
- **Customer Library row layout** — "Last used" text is now vertically centered with the Edit / Delete buttons.
- **QuoteStatusPill accessibility** — adds `aria-label="Status: {label}"` for screen readers; the Declined status pill now uses brighter slate-200 text on slate-700 background (4.6:1 contrast, meets WCAG AA).
- **Bundle health** — main chunk dropped from 61.5 KB → 56.5 KB gzipped through JobsManager decomposition. The 300 KB main-chunk gate from Phase 11 stays comfortably intact.

### Fixed
- **PDF generation on Windows desktop** — fixed Tauri `fs:scope` ACL that was silently blocking PDF writes outside the app's working directory. PDFs now save to anywhere the user picks in the file dialog.
- **Data atomicity** — `Record Sale`, `Create Quote`, and the v8→v9 Dexie migration are now properly transactional. A crash mid-operation no longer leaves the library half-updated (e.g. a Sale recorded without its referenced Quote, or vice versa).
- **CSV formula injection** — exported CSVs from anywhere in the app (Asset library, customer templates, future exports) now neutralize any cell starting with `=`, `+`, `-`, or `@` — opening the export in Excel / Numbers / LibreOffice no longer risks accidentally executing a formula payload.
- **JobsManager Model URL render** — entering `javascript:alert(1)` or `data:text/html,…` as a Model URL no longer renders as a clickable link in the Jobs view. Non-`http(s)` URLs render as plain muted text with a tooltip explaining why.
- **`@tauri-apps/api` deduplication** — bumped Rust Tauri crate to 2.11.x so the bundle no longer ships two nested copies of `@tauri-apps/api`. Reduces install size and eliminates a class of "which copy is loaded?" runtime ambiguity.
- **Break-even pill formula consistency** — the per-row break-even count shown in the Jobs tab now matches what the Calculator tab's Break-even Units widget computes for the same job, in all currencies. Previously the two could diverge when a job had per-print model cost split across multiple units. Existing jobs are auto-snapshotted on first app load so the agreement holds historically too.
- **Customer Import modal layout** — the template download block now appears above the upload zone (was: below), matching the Asset Import modal pattern.

### Security
- **Formula injection prevention (SEC-01)** — all CSV export paths route through `sanitizeCsvCell` at the cell-serialization boundary.
- **Render-time XSS guard for Model URLs (SEC-02)** — `isSafeHttpUrl` validates `http://` / `https://` prefix before rendering any user-entered URL as an `<a href>`.
- **CSV parser pass-through regression locks (SEC-03)** — 5 new tests pin the customer CSV parser's character-for-character pass-through behavior against formula-injection inputs and Unicode (Latin diacritic / CJK / emoji).

### For developers
- **Release notes now sourced from `CHANGELOG.md`** — the GitHub Actions release workflow extracts the section matching the pushed tag and uses it as the release body. Missing section → soft warning in the build log + fallback template. See `.claude/CLAUDE.md` "Desktop App Release Process" for the rule. No more "See the changelog" placeholder releases.
- **/changelog page caps at 5 most recent releases** with "View full archive on GitHub" link. Filters out 2-part GSD milestone tags (e.g. `v1.3`) so internal planning markers don't surface as user-facing releases.
- **Windows lint script fix** — `scripts/lint-no-raw-html.mjs` now normalizes file paths to forward slashes before comparing against the exclude list. Previously failed every Windows release matrix run because backslash paths never matched the `src/components/ui` allowlist. Macs were unaffected; the failure went unnoticed until v1.3 release attempt.

---

## [1.3.1] - 2026-04-15

_Original v1.3.1 desktop release (April 15, 2026). This patch shipped before the CHANGELOG.md system was adopted; the GitHub release body was the auto-generated "See the changelog" placeholder. The substantive code changes from v1.3.0 → v1.3.1 are visible in the [commit log](https://github.com/Waarangel/3dcoster/compare/v1.3.0...v1.3.1). The v1.3.2 release above bundles all subsequent v1.3 Hardening work._

---

## [1.3.0] - 2026-04-15

_Original v1.3.0 desktop release (April 15, 2026). Released before the CHANGELOG.md system was adopted. The v1.3.2 release above is the first release with proper release notes since this one._

---

## [1.2.4] - 2026-04-13

_Historical entry — released before CHANGELOG.md was adopted. Patch release; see [GitHub release](https://github.com/Waarangel/3dcoster/releases/tag/v1.2.4) for the original body._

---

## [1.2.3] - 2026-02-15

_Historical entry — released before CHANGELOG.md was adopted. Patch release; see [GitHub release](https://github.com/Waarangel/3dcoster/releases/tag/v1.2.3) for the original body._

---

## [1.2.2] - 2025-05-22

### Added
- **Window State Persistence (Desktop)** — App now remembers your window size and position when you close it, and restores them on next launch.

### Fixed
- **Mobile layout bug on Retina displays** — Previous versions incorrectly used physical pixels for window sizing, causing the mobile layout to trigger on high-DPI Macs.

---

## [1.2.1] - 2025-05-22

### Added
- **Update notifications (Desktop)** — Desktop app now checks for new versions on startup and shows a banner when updates are available.

### Changed
- **Larger default window** — Opens at 1400×900 instead of 1200×800 for a better desktop experience.
- **Higher minimum window size** — Window can't be shrunk below 960×680, preventing the mobile layout from triggering on desktop.

---

## [1.2.0] - 2025-05-21

### Added

**📥 CSV Import**
- Drag & drop or click to upload `.csv` files — automatic column detection
- Smart column mapping — recognizes common names (name, brand, color, price, weight, etc.)
- Preview before import — review parsed filaments before committing to your library
- Duplicate detection — warns you if filaments with the same name already exist
- Flexible format — works with exports from popular filament tracking tools

**🔧 G-code Importer**
- Estimate print costs directly from your slicer's G-code files — no manual entry
- Multi-slicer support — Bambu Studio, PrusaSlicer, Cura, OrcaSlicer, SuperSlicer, IdeaMaker
- Pulls filament usage, print time, layer height, and more from G-code comments
- Drag & drop interface — drop a `.gcode` or `.gco` file to get started
- Handles both Unix and Windows line endings

**🎨 Bambu Lab Filament Library**
- Full catalog: PLA Basic, PLA Matte, PETG Basic, ABS, TPU, ASA, PLA-CF, PETG-CF, and more
- Accurate retail prices and spool weights pre-filled
- One-click add to your library
- Search & filter the catalog

### Fixed
- Japanese Yen (JPY) now correctly displays with 0 decimal places
- Added fallback currency formatting for edge cases
- Settings tab switching now properly resets edit states
- Carrier costs and marketplace fees can no longer go below zero
- G-code Windows support — proper `\r\n` line ending handling for Windows-exported files

---

## [1.1.2] - 2025-05-18

### Added
- **Mobile optimization** — entire app is now fully mobile-friendly, optimized for use at your print farm or on the go:
  - Responsive marketing-site navigation collapses into a hamburger menu on mobile
  - Mobile-friendly app header — title, icons, and actions stack cleanly on small screens
  - Scrollable tab navigation (Calculator, Jobs, Assets, Printer) — horizontal scroll, no wrapping
  - Card-based Asset Library on mobile — tables auto-switch to a clean card layout
  - Touch-friendly controls — all buttons, inputs, selects meet the 44px minimum touch target
  - iOS zoom prevention — form inputs use 16px base font to prevent Safari from zooming on focus
  - Better form spacing on mobile for easier one-handed use
  - Full-width Save / Cancel / CTA buttons on mobile for easy tapping

---

## Older releases

For releases before v1.1.2, see [GitHub Releases](https://github.com/Waarangel/3dcoster/releases). The CHANGELOG.md back-fill above covers what was easily recoverable from prior release bodies; older patch versions (v1.0.x, v1.1.0, v1.1.1) shipped without detailed notes.
