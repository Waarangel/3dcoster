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

## [1.3.1] - 2025-05-26

### Added
- **Detailed in-app release notes** — The /changelog page now shows the most recent 5 releases with full release notes; older releases are accessible via the "All Releases on GitHub" button.

### Changed
- **Release process now requires a CHANGELOG.md section** per version. If a tag is pushed without a matching section, the release workflow falls back to a generic "See the changelog" template and warns in the build log (no longer silent).

### Fixed
- Customer Import modal layout now matches the Asset Import modal — template download button moved above the upload zone with a `👥 Customer template` label.

> _Note: v1.3.1 desktop release predates this changelog system. The list above reflects what shipped with this changelog entry being added — historical v1.3.x patches before 2026-05-28 had only the auto-generated "See the changelog" body._

---

## [1.3.0] - 2025-05-25

_Historical entry — released before CHANGELOG.md was adopted. The v1.3 GSD milestone (Hardening) backed this desktop release. See [.planning/MILESTONES.md](.planning/MILESTONES.md) for the full v1.3 accomplishment list including:_

- **`<Modal>` primitive + 10-surface a11y migration** (focus trap, scroll-lock, useId-labeled fields)
- **JobsManager decomposition** — extracted `<RecordSaleModal>`, `<SaleRow>`, `useCustomerPicker`, `useAllSales`; main JobsManager.tsx shrunk from 2067 → 1474 LOC
- **Dexie atomicity sweep** — `addSale`, `createQuote`, v9 upgrade callbacks all wrapped in transactions; defensive trio (`parsePositiveNumber`, async `versionchange`, `getSetting<T>` validator)
- **CSV + URL security** — formula-injection sanitization at all 4 Papa.unparse boundaries; `javascript:` URL render-time guard for job model links
- **First Customer-UI test files** — CustomerEditModal, CustomerCsvImportModal, CustomerLibrary covered; real-Dexie migration test via fake-indexeddb
- **Tauri 2.11.x upgrade** — eliminates dual-copy `@tauri-apps/api`
- **Bundle health** — main chunk dropped from 61.5 KB → 56.5 KB gzipped

---

## [1.2.4] - 2025-05-23

_Historical entry — released before CHANGELOG.md was adopted. Patch release; see [GitHub release](https://github.com/Waarangel/3dcoster/releases/tag/v1.2.4) for the original body._

---

## [1.2.3] - 2025-05-23

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
