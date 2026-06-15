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

### Added
- **Add your own printer.** If your printer isn't in the built-in list, you can now add it as a custom model — just enter its name, average wattage, price, and expected lifespan in Printer Settings, and it's available everywhere like any built-in printer.
- **12 more printers in the catalog.** Added popular models including the Creality Ender-3 V3 SE/KE, K1 Max and K2 Plus, Prusa CORE One and XL, Anycubic Kobra 2 Pro / Kobra S1, Elegoo Neptune 4 / 4 Plus, Qidi Q1 Pro, and FlashForge Adventurer 5M.

### Fixed
- **More accurate electricity costs for several printers.** The Creality Ender-3 V3 and K1, Anycubic Kobra 3, and Elegoo Neptune 4 Pro were using their peak power-supply rating instead of real average printing draw, which overstated their electricity cost (often 2–3×). Wattages are now based on measured average draw, so cost comparisons across brands are fair. Also bumped the Bambu X1C/X1E figures and updated the Prusa MK4 to the current MK4S.

---

## [1.6.0] - 2026-06-12

### Added
- **Full backup & restore.** A new Data tab in Settings lets you download your entire 3DCoster database — jobs, sales, assets, customers, quotes, and settings — as a single file, and restore it on any device. Restoring shows exactly what will be replaced before anything happens, and a failed restore leaves your existing data untouched. Your safety net against a cleared browser or a new computer.
- **Summary totals on My Jobs.** A new bar above the jobs list shows your totals across all jobs at a glance: net revenue (after marketplace fees), profit, filament used (switches to kg past 1000 g), and total print time. Amounts recorded in other currencies are converted to your display currency using daily exchange rates; if a rate isn't available yet, the bar shows "—" instead of a misleading number.

### Changed
- **Quote PDFs and update links now use 3dcoster.com.** The footer on customer-facing PDF quotes and the desktop "update available" download link point to the new home at [3dcoster.com](https://3dcoster.com) instead of the old 3dcoster.vercel.app address (which keeps working).

### Security
- The web app at [3dcoster.com](https://3dcoster.com) now ships hardened security headers (Content-Security-Policy, X-Frame-Options, and friends), matching the protection the desktop app already had. Nothing changes in how you use the app — it just blocks whole classes of injection and clickjacking attacks.

---

## [1.5.0] - 2026-06-12

### Added
- **Export your data to CSV.** New Export buttons let you download your print jobs, sales, and asset library as spreadsheet-ready CSV files — handy for bookkeeping, tax prep, or backups. Exports respect your active filter or search (the button shows exactly how many records you're getting, and the filename says when it's a filtered set), each row keeps the currency it was originally recorded in, and exports are protected against spreadsheet formula injection.
- **Public roadmap.** A new [/roadmap](https://3dcoster.vercel.app/roadmap) page shows what's being researched, what's planned, and what's actively being built — linked from the site footer, with a feature-request button so you can shape what comes next.

### Fixed
- **No more "Something went wrong" / "Reload App" crash screen.** After a new version was deployed, clicking a link in an already-open tab could crash the app and force a manual reload. The app now updates cleanly in the background and shows a small dismissible "new version available" prompt instead, and automatically recovers if it ever loads a stale page.

---

## [1.4.5] - 2026-06-08

### Fixed
- **Accessibility follow-up** — fixed a screen-reader issue introduced in 1.4.4 where the main tabs and the Settings tabs referenced a content panel that couldn't be found. (Plus minor internal cleanups from a code review.)

---

## [1.4.4] - 2026-06-08

A reliability, accessibility, and performance release.

### Added
- **Accessibility** — the app is now fully keyboard-navigable (the filament picker, the main tabs, and sortable tables), screen-reader friendly (proper labels on every form field, button, and control), and respects your system's "reduce motion" setting.

### Changed
- **Faster to load** — trimmed the startup download and made the desktop/PWA install noticeably lighter.

### Fixed
- **No more silent failures** — saving a job or sale, loading your library, or resetting to defaults now shows a clear message if something goes wrong, instead of looking like it succeeded.
- **Safer file imports** — oversized CSV and 3MF files are now rejected with a friendly message instead of freezing the tab.

### Security
- Hardened the desktop app's content security policy, validated external download/changelog links, and updated dependencies.

---

## [1.4.3] - 2026-06-08

### Fixed
- **Every price now shows your currency** — saved jobs, recorded sales, and the Printers tab no longer display a hardcoded "$". Job costs, sale prices, and printer cost-recovery stats now show in your selected currency. Existing jobs and sales are tagged with your current currency on first launch and displayed in the currency they were recorded in (a sale made at €20 always reads €20).
- **Printer prices convert in the Asset Library** — printer purchase price and nozzle cost now convert to your currency like every other asset, instead of staying on "$".

---

## [1.4.2] - 2026-06-08

### Fixed
- **Filaments always show in the picker** — the calculator's filament dropdown no longer hides filaments priced in a different currency (e.g. the built-in Bambu catalog for non-USD users). Every filament now appears regardless of its original currency, with no "Reset Filaments" workaround needed.
- **Prices follow your currency** — filament and material prices in the Asset Library and calculator now convert to your selected currency and update immediately when you change it, instead of being stuck in the price's original currency. Conversion uses live exchange rates (cached for offline use); when no rate is available yet, the original currency is shown honestly rather than a guessed amount.
- **All items now have a currency** — existing items that had no currency recorded (the built-in supplies and tools) are assigned your current currency on first launch, so they convert properly when you switch currency instead of just changing the label.

### Changed
- **Tidier price columns** — currency codes in the Asset Library now sit after the amount and line up in a clean column.

---

## [1.4.1] - 2026-05-29

### Changed
- **Cleaner filament picker** — filaments now sort A–Z within each brand, the dropdown shows just the filament name (the brand is already the group heading), and the selected field shows brand + name (e.g. "Bambu ASA").
- **Tidier filament rows** — removed the per-row "price per gram" box from the calculator. Filament pricing lives in the Asset Library and still feeds every cost calculation, so multi-filament jobs take up much less vertical space.

### Fixed
- **"Reset Filament" keeps your currency** — resetting the built-in filament catalog now re-prices it into your currency instead of leaving the filaments in USD (which could hide them from the picker).

---

## [1.4.0] - 2026-05-28

A huge release — 6 weeks of work shipped at once. The Customer Library, Printable PDF Quote, Job tags + search, three-layer tax model, Etsy ToS helper, and a full accessibility + security + performance pass. If you've been on v1.3.1, this update is the equivalent of three normal releases stacked into one.

### 👥 Customer Library — a whole new app section
- **New Customers tab** — manage your customer list as first-class records (name, email, company, address, notes). Virtualized list scales to thousands of customers without lag.
- **CSV bulk import** — drop a `.csv` of existing customers to seed your library in one step. Smart column detection, preview-before-import, and Skip / Update duplicate handling.
- **Combobox picker in Record Sale** — type a name or email when recording a sale and the matching customer pre-fills. Email auto-link finds the same customer across past sales.
- **By-value snapshots on Sales** — editing a Customer in the Library never mutates the customer fields on historical sales (audit-trail integrity is locked by a test contract).

### 📄 Printable PDF Quote — send professional quotes to your customers
- **One-click PDF quote** from any saved job, with your customer's details, line items, taxes, and totals laid out on a clean page.
- **Recent Quotes accordion** in the Jobs tab — every quote you've sent shows its status (Pending / Accepted / Declined / Converted) with one-click status changes.
- **Convert-to-Sale** — accepting a quote turns it into a Sale in one atomic operation; the quote and the sale stay linked so you can trace any sale back to its originating quote.
- **Lazy-loaded** — the PDF engine (`jsPDF`) only loads when you click "Create Quote", so the app's startup time stays fast for everyone who doesn't use quotes.
- **Free tier ships with a small "Made with 3DCoster" footer.** White-label PDFs (no footer, your logo) are planned for a future paid tier.

### 🏷️ Job tags + search — organize your library
- **Editable tags on every job** — free-text, comma-separated; auto-lowercased, trimmed, deduplicated, capped at 10 per job. Edit inline on the job title row without leaving the Jobs view.
- **Free-text search across the Jobs library** — search matches job title, customer name, and tags simultaneously. Type once, find anything.
- **Quick-duplicate helper** — `duplicateJob()` produces a copy of any saved job with PII reset, tax fields cleared, and a fresh id. (UI for one-click duplicate is queued for the next release; the helper is locked-in with a 7-case test contract for future consumers.)

### 💰 Three-layer tax model
- **Region defaults** — built-in tax rates for the EU 27, UK, AU, CA, JP, US (no-tax), and more. Pick your region in Settings; defaults apply to all new jobs.
- **Settings override** — set a project-wide default tax rate that overrides the region default (e.g. you're in the US but selling B2B with a flat 8.25%).
- **Per-job override** — tweak the rate on any individual job when an edge case demands it.
- Tax math is unit-tested with order-of-operations guards (tax applies to `sellingPrice`, never to `subtotal`).

### 🛒 Etsy ToS compliance helper
- **Inline checklist** on jobs where you've set `marketplace: etsy`. Covers Etsy's seller policy reminders (handmade verification, intellectual property, shipping disclosure) with the policy summary date and a link to the source.
- Conditional — only renders when relevant, never on the customer-facing PDF.

### 📅 Currency upgrades
- **Japanese Yen (JPY)** now formats correctly with 0 decimal places.
- Currency fallback formatting catches edge cases that previously rendered as raw numbers.
- Carrier costs and marketplace fees clamp at 0 — no more negative numbers from typos.

### ♿ Accessibility overhaul
- **`<Modal>` primitive** — every modal in the app (10 surfaces: Record Sale, Print Quote, Edit Customer, CSV Import, and more) now shares one WAI-ARIA dialog implementation with focus trap, scroll lock, Escape-to-close, and proper `useId()`-labeled fields.
- **Quote status pills announce their state** to screen readers (`"Status: Pending / Accepted / Declined / Converted"`).
- **Declined pill contrast** bumped to 4.6:1 (WCAG AA).
- **Form field labels** properly paired with their inputs for click-to-focus and screen-reader navigation.
- **Virtualized list rows** have ARIA roles so keyboard navigation works correctly.

### 🔒 Security
- **CSV exports neutralize formula injection** — cells starting with `=`, `+`, `-`, or `@` are escaped at the cell-serialization boundary, so opening an exported CSV in Excel / Numbers / LibreOffice can't trigger an accidental formula payload from a maliciously-named customer.
- **Model URL render guard** — pasting `javascript:alert(1)` or a `data:` URL as a job's Model URL renders as plain muted text with a "Link blocked" tooltip, not a clickable link.

### 🐛 Reliability
- **PDF saves work on Windows desktop** — fixed a Tauri filesystem permission that was silently blocking PDF writes outside the app's working folder. PDFs now save wherever you pick in the file dialog.
- **Crash-safe database operations** — recording a sale, creating a quote, and the v8→v9 database migration are now wrapped in transactions. A crash mid-operation never leaves your library half-updated (e.g. a Sale without its referenced Quote).
- **Break-even Units matches everywhere** — the per-row break-even count in the Jobs tab now equals what the Calculator tab's Break-even Units widget computes for the same job, in every currency. Old jobs are quietly auto-snapshotted on first launch so historical agreement holds too.
- **Tauri runtime deduplicated** — bundle no longer ships two nested copies of `@tauri-apps/api`.
- **Multi-tab safety** — opening the app in two tabs and triggering a schema migration in one no longer crashes the other; the affected tab reloads automatically.
- **G-code Windows line endings** — slicer exports with `\r\n` line endings now parse correctly (previously only Unix `\n` worked).

### ⚡ Performance
- **JobsManager refactor** — the Jobs tab is faster on large libraries: per-row break-even pre-computed once via memoized map; marketplace-fee no longer recalculates 3× per render; deduplicated database subscriptions.
- **300 KB main-chunk gate** — enforced as a build-time check so the app's startup time doesn't regress as we ship more features. Currently at 56.5 KB main + lazy-loaded PDF chunk, well under the ceiling.

### ✨ UI consistency + polish
- **Customer Library row layout** — "Last used" text vertically centered with Edit / Delete buttons.
- **Customer Import modal** — template download (`👥 Customer template`) now above the upload zone, matching the asset import pattern.
- **QuoteRow overflow menu** closes on Escape AND outside-click.
- **Compact numeric inputs** — currency, %, and rate inputs are visually narrower so small data doesn't live in wide fields.
- **Info-icon tooltips** replace verbose placeholder text on form fields — descriptions live next to labels, placeholders show example values.
- **Empty states** with helpful CTAs across the app (Jobs, Sales, Customers, Assets).
- **Skeleton loading states** while data hydrates from IndexedDB, so the app feels responsive from first paint.

### 🧪 Test coverage
- **First Customer-UI test files** — `CustomerEditModal.test.tsx` (7 tests), `CustomerCsvImportModal.test.tsx` (6 tests), `CustomerLibrary.test.tsx` (7 tests including the sort-order lock).
- **Real-Dexie migration test** via `fake-indexeddb` — locks the v7→v8 quotes-store migration at the actual transaction boundary, not just at the helper layer.
- **CostCalculator Vitest suite** — pure-function tax + cost math is now exhaustively unit-tested.
- **466 tests passing** across 31 test files (up from ~280 in v1.3.1).

### Behind the scenes
- **Release notes now come from `CHANGELOG.md`** — this release is the first whose notes were sourced from a versioned changelog file. Future releases auto-populate from the same source; if a release ever lands without a CHANGELOG entry the build warns loudly.
- **/changelog marketing page sources from CHANGELOG.md** at build time (not the GitHub Releases API), so the page never drifts from what we actually documented.
- **/changelog page caps at 5 most recent releases** with a "View full archive on GitHub" link.
- **Windows release builds work again** — a path-separator bug in the `lint-no-raw-html` script was silently failing the Windows matrix of every release attempt; the macOS matrix was unaffected so the failure went unnoticed until this release.
- **Nyquist validation contracts** authored for all 13 in-scope phases (audit traceability is now first-class).

---

## [1.3.1] - 2026-04-15

_Original v1.3.1 desktop release. This patch shipped before the CHANGELOG.md system was adopted; the GitHub release body was the auto-generated "See the changelog" placeholder. v1.4.0 above is the next release after v1.3.1 — there is no v1.3.2; the v1.3 numbering after this entry was retired in favor of a clean v1.4.0 minor bump that reflects the size of the 6-week change set._

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
