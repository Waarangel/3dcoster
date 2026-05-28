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

A hardening release — no new features, just a sweep through accessibility, security, reliability, and polish so v1.4+ can build on a clean foundation.

### ♿ Accessibility
- **Every modal in the app now shares one foundation** — focus trap, scroll lock, Escape-to-close, and proper screen-reader labels work consistently across all 10 modal surfaces (Record Sale, Print Quote, Edit Customer, CSV Import, and more)
- **Better contrast on quote status pills** — Declined pills are now noticeably more readable (4.6:1 WCAG AA contrast); all status pills announce their state to screen readers as "Status: Pending / Accepted / Declined / Converted"
- **Form field labels properly paired** — every input now has its label associated for click-to-focus and screen-reader navigation

### 🔒 Security
- **CSV exports no longer risk formula injection** — opening an exported CSV in Excel, Numbers, or LibreOffice can no longer trigger an accidental formula payload from data like `=HYPERLINK(...)` in a customer name
- **Model URL field rejects dangerous schemes** — pasting `javascript:alert(1)` or a `data:` URL as a job's Model URL renders it as plain muted text with a "Link blocked" tooltip, not a clickable link

### 🐛 Reliability
- **PDF saves work properly on Windows desktop** — the Tauri filesystem permission that was silently blocking PDF writes outside the app's working folder is fixed; PDFs now save wherever you pick in the file dialog
- **Crash-safe database operations** — recording a sale, creating a quote, and the v8→v9 database migration are now wrapped in transactions; a crash mid-operation no longer leaves your library half-updated
- **Break-even Units matches everywhere** — the per-row break-even count in the Jobs tab now equals what the Calculator tab's Break-even Units widget computes for the same job, in every currency. Old jobs are quietly auto-fixed on first launch
- **Tauri runtime deduplicated** — Rust crate bumped to 2.11.x; bundle no longer ships two nested copies of `@tauri-apps/api`, eliminating a class of "which copy is loaded?" runtime ambiguity

### ✨ Customer Library
- **Same customer, every time** — emails are lowercased on save in the Edit Customer modal (matching the CSV importer), so typing `John@Example.com` once and importing `john@example.com` from a CSV no longer creates two library entries for the same person. Existing duplicates auto-resolve on first launch
- **Customer template download button now in Import Customers** — matches the Materials / Printers template UX in the Assets importer
- **"Last used" text vertically centered with Edit / Delete buttons** — a small alignment fix that's been bugging us

### ⚡ Performance
- **JobsManager refactor** — the Jobs tab is faster on large libraries (per-row break-even is pre-computed once, marketplace-fee no longer recalculates 3× per render, deduplicated database subscriptions)
- **Smaller bundle** — main chunk dropped from 61.5 KB → 56.5 KB gzipped despite ~13K lines of new code, well under the 300 KB ceiling

### Behind the scenes
- **Release notes now come from `CHANGELOG.md`** — this release is the first one whose notes were sourced from a versioned changelog file. Future releases auto-populate from the same source; if a release ever lands without a CHANGELOG entry the build warns loudly
- **/changelog marketing page now shows the 5 most recent releases** with a "View full archive on GitHub" link (was: 20)
- **Windows release builds work again** — a path-separator bug in our lint script was silently failing the Windows matrix of every release attempt; macOS builds were unaffected so the failure went unnoticed until this release

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
