# Codebase Structure

**Analysis Date:** 2026-04-13

## Directory Layout

```
3DCoster/
├── src/                      # React web app source
│   ├── main.tsx              # App entry point: routing, error boundary
│   ├── App.tsx               # Calculator shell: tabs, all hook subscriptions
│   ├── types.ts              # All shared TypeScript types and interfaces
│   ├── features.ts           # Feature release registry for NewBadge system
│   ├── globals.d.ts          # Build-time constant declaration (__IS_TAURI__)
│   ├── index.css             # Global Tailwind CSS entry
│   ├── components/           # React components
│   │   ├── ui/               # Primitive UI components (Button, Input, etc.)
│   │   ├── CostCalculator.tsx # Tab: main cost calculator form
│   │   ├── JobsManager.tsx   # Tab: saved jobs list and management
│   │   ├── AssetLibrary.tsx  # Tab: material/printer asset library
│   │   ├── PrinterSettings.tsx # Tab: printer instance management
│   │   ├── SettingsModal.tsx # Modal: shipping + marketplace fee config
│   │   ├── UserProfileModal.tsx # Modal: currency, labor rate, address
│   │   ├── FilamentSelector.tsx # Filament picker sub-component
│   │   ├── GcodeImport.tsx   # G-code file drop/parse UI
│   │   ├── BambuImport.tsx   # Bambu-specific import UI
│   │   ├── CsvImportModal.tsx # CSV bulk import modal
│   │   ├── NewBadge.tsx      # "New" feature badge with dual-gate logic
│   │   ├── UpdateBanner.tsx  # Desktop update notification (Tauri only)
│   │   ├── ImageCarousel.tsx # Screenshot carousel for marketing pages
│   │   ├── Header.tsx        # Marketing site shared header
│   │   └── Footer.tsx        # Shared footer (full + minimal variants)
│   ├── pages/                # Marketing site pages (lazy-loaded, web only)
│   │   ├── LandingPage.tsx
│   │   ├── DownloadPage.tsx
│   │   ├── FeaturesPage.tsx
│   │   ├── FAQPage.tsx
│   │   ├── FeedbackPage.tsx
│   │   └── ChangelogPage.tsx
│   ├── db/
│   │   └── database.ts       # Dexie DB singleton, schema (v1–v4), setting helpers
│   ├── hooks/
│   │   ├── useDatabase.ts    # All data hooks (assets, jobs, settings, etc.)
│   │   └── useLocalStorage.ts # Generic localStorage hook
│   ├── utils/
│   │   ├── currency.ts       # Currency config, formatting, unit conversion
│   │   ├── gcodeParser.ts    # G-code parsing for all major slicers
│   │   └── csvHelpers.ts     # CSV import parsing helpers
│   ├── data/
│   │   ├── defaultMaterials.ts # Default asset library (materials + printers)
│   │   └── bambuFilaments.ts   # Scraped Bambu Lab filament catalog
│   └── assets/
│       └── screenshots/      # App screenshot images for marketing carousel
├── src-tauri/                # Tauri desktop app (Rust)
│   ├── src/
│   │   └── main.rs           # Tauri entry point — plugin init only
│   ├── tauri.conf.json       # App name, version, window config, bundle IDs
│   ├── Cargo.toml            # Rust dependencies and app version
│   ├── capabilities/         # Tauri permission definitions
│   ├── icons/                # Desktop app icons (all platforms)
│   └── gen/schemas/          # Auto-generated Tauri JSON schemas
├── public/                   # Static web assets (copied as-is)
│   ├── pwa-192x192.png       # PWA icon
│   ├── pwa-512x512.png       # PWA icon
│   └── apple-touch-icon.png
├── scripts/                  # Development utility scripts
│   ├── generate-icons.mjs    # Generate PWA icon set
│   └── generate-tauri-icons.mjs # Generate Tauri icon set
├── docs/                     # Project documentation
├── .github/workflows/
│   └── release.yml           # GitHub Actions: build + publish releases on tag push
├── .planning/codebase/       # GSD codebase analysis documents
├── dist/                     # Vite build output (gitignored)
├── index.html                # HTML entry point
├── vite.config.ts            # Vite + Tailwind + PWA config; __IS_TAURI__ define
├── tsconfig.json             # TypeScript project references root
├── tsconfig.app.json         # App TypeScript config
├── tsconfig.node.json        # Node/Vite tooling TypeScript config
├── eslint.config.js          # ESLint configuration
├── package.json              # npm dependencies and scripts
└── vercel.json               # Vercel deployment config (SPA rewrites)
```

## Directory Purposes

**`src/components/`:**
- Purpose: All React components — both feature panels and shared UI
- Contains: Feature components (one per tab/modal), shared primitives in `ui/`, system components (`NewBadge`, `UpdateBanner`)
- Key files: `CostCalculator.tsx` (largest, main app logic), `JobsManager.tsx`, `AssetLibrary.tsx`

**`src/components/ui/`:**
- Purpose: Design system primitives — no business logic, only styled wrappers
- Contains: `Button.tsx`, `ButtonLink.tsx`, `Input.tsx`, `Select.tsx`, `Textarea.tsx`, `Card.tsx`, `index.ts` (barrel export)
- Key files: `index.ts` — always import UI components from here, not individual files

**`src/pages/`:**
- Purpose: Marketing website pages; only loaded on web, never in Tauri builds
- Contains: One file per route — each exports a named component matching the filename
- Key files: `LandingPage.tsx` (primary marketing entry), `DownloadPage.tsx` (Gatekeeper workaround docs)

**`src/db/`:**
- Purpose: Single source of truth for database access — nothing outside this folder touches Dexie directly
- Contains: `database.ts` only — the `db` singleton and all typed setting helpers
- Key files: `database.ts` — schema migrations live here; bump version here for schema changes

**`src/hooks/`:**
- Purpose: React interface to the database layer; all components get data through these hooks
- Contains: `useDatabase.ts` (all entity hooks), `useLocalStorage.ts` (localStorage wrapper)
- Key files: `useDatabase.ts` — add new entity hooks here

**`src/utils/`:**
- Purpose: Pure functions with no React dependencies
- Contains: Formatting, parsing, and calculation utilities
- Key files: `gcodeParser.ts` (complex, multi-slicer parser), `currency.ts` (all region/unit logic)

**`src/data/`:**
- Purpose: Static seed data — default asset library loaded on first run or reset
- Contains: `defaultMaterials.ts` (curated defaults), `bambuFilaments.ts` (Bambu catalog)
- Key files: `bambuFilaments.ts` — update this file when adding new Bambu products

**`src-tauri/`:**
- Purpose: Native desktop wrapper; the Rust code is minimal — just plugin initialization
- Contains: `main.rs`, `tauri.conf.json`, `Cargo.toml`, icons, capabilities
- Key files: `tauri.conf.json` + `Cargo.toml` — version must be kept in sync with `UpdateBanner.tsx`

**`scripts/`:**
- Purpose: Development-time icon generation utilities (run manually, not in CI)
- Generated: No — these are source scripts
- Committed: Yes

## Key File Locations

**Entry Points:**
- `src/main.tsx`: Web/desktop routing root, error boundary, Vercel Analytics
- `src-tauri/src/main.rs`: Desktop native entry, Tauri plugin registration
- `index.html`: HTML shell, Vite script injection

**Configuration:**
- `vite.config.ts`: Vite, Tailwind plugin, PWA manifest, `__IS_TAURI__` define, port 4173
- `src-tauri/tauri.conf.json`: App version (must match `UpdateBanner.tsx` and `Cargo.toml`)
- `vercel.json`: SPA rewrite rules for client-side routing
- `.github/workflows/release.yml`: Release pipeline — triggers on `v*` tags

**Core Logic:**
- `src/App.tsx`: Tab controller; owns all hook subscriptions and prop distribution
- `src/db/database.ts`: Schema and migration history
- `src/hooks/useDatabase.ts`: All data access patterns
- `src/types.ts`: All shared interfaces — start here when understanding the data model

**Feature Registry:**
- `src/features.ts`: Add new features here with a release date to activate `NewBadge`

**Static Data:**
- `src/data/defaultMaterials.ts`: Seed data for first-run and reset operations

## Naming Conventions

**Files:**
- Components: `PascalCase.tsx` — e.g., `CostCalculator.tsx`, `UserProfileModal.tsx`
- Hooks: `camelCase.ts` prefixed with `use` — e.g., `useDatabase.ts`, `useLocalStorage.ts`
- Utilities: `camelCase.ts` — e.g., `gcodeParser.ts`, `currency.ts`
- Data files: `camelCase.ts` — e.g., `defaultMaterials.ts`, `bambuFilaments.ts`
- Type definitions: `camelCase.ts` — `types.ts`, `globals.d.ts`

**Directories:**
- All lowercase, no hyphens: `components/`, `pages/`, `hooks/`, `utils/`, `data/`, `db/`
- Exception: `src-tauri/` follows Tauri convention (hyphenated)

**Exports:**
- Components: named exports (e.g., `export function CostCalculator(...)`)
- Hooks: named exports (e.g., `export function useAssets()`)
- Types: named exports from `src/types.ts`
- UI components: re-exported through `src/components/ui/index.ts` barrel

## Where to Add New Code

**New calculator feature or tab panel:**
- Component: `src/components/NewFeature.tsx`
- Data types: add to `src/types.ts`
- Database table: add schema version in `src/db/database.ts`, hook in `src/hooks/useDatabase.ts`
- Wire into app: add tab entry in `src/App.tsx`, hook subscriptions, prop drilling
- Feature badge: add to `src/features.ts`

**New shared UI primitive:**
- Implementation: `src/components/ui/NewComponent.tsx`
- Export: add to `src/components/ui/index.ts`

**New utility function:**
- Shared helpers: `src/utils/` in the relevant file (currency helpers → `currency.ts`, file parsing → new file)

**New marketing page:**
- Implementation: `src/pages/NewPage.tsx` with named export matching filename
- Route: add to `src/main.tsx` inside the `!__IS_TAURI__` route block

**New default asset/material:**
- Append to `src/data/defaultMaterials.ts` arrays
- For Bambu-specific: update `src/data/bambuFilaments.ts`

**New external SDK/API call:**
- Create a utility in `src/utils/` or a dedicated service file
- For Tauri-native calls: branch with `if (__IS_TAURI__)` and dynamic import from `@tauri-apps/*`

## Special Directories

**`dist/`:**
- Purpose: Vite production build output
- Generated: Yes (by `npm run build`)
- Committed: No (in `.gitignore`)

**`src-tauri/target/`:**
- Purpose: Rust/Cargo build artifacts
- Generated: Yes
- Committed: No

**`src-tauri/gen/`:**
- Purpose: Tauri-generated JSON schemas for capabilities system
- Generated: Yes (by Tauri CLI)
- Committed: Yes (schemas are stable reference files)

**`.planning/codebase/`:**
- Purpose: GSD architecture/convention analysis documents
- Generated: Yes (by GSD map-codebase command)
- Committed: Yes

---

*Structure analysis: 2026-04-13*
