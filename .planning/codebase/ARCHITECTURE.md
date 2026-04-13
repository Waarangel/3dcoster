# Architecture

**Analysis Date:** 2026-04-13

## Pattern Overview

**Overall:** Single-page application (SPA) with a dual-deployment model — the same React codebase is served as a web app (Vercel) and wrapped as a native desktop app (Tauri). The app is 100% client-side with no backend: all data persists locally in IndexedDB via Dexie.js.

**Key Characteristics:**
- No server-side rendering, no API server — fully offline-capable
- Build-time flag `__IS_TAURI__` branches web vs. desktop behavior at compile time
- Marketing site and calculator app share the same bundle, split by lazy-loaded routes
- Data layer is isolated in `src/db/` and exposed entirely through React hooks in `src/hooks/`

## Layers

**Routing / Entry (Web):**
- Purpose: Define routes, error boundary, and lazy-load marketing pages
- Location: `src/main.tsx`
- Contains: `BrowserRouter`, `Routes`, `ErrorBoundary`, `Suspense`, lazy-loaded page imports
- Depends on: React Router, Vercel Analytics, `App.tsx`, `src/pages/`
- Used by: Browser / Tauri WebView

**Calculator App Shell:**
- Purpose: Top-level tab controller for the calculator feature
- Location: `src/App.tsx`
- Contains: Tab navigation (`calculator | jobs | materials | settings`), all database hook subscriptions, modal state
- Depends on: All `src/hooks/useDatabase` hooks, feature components, `src/components/`
- Used by: `src/main.tsx` at routes `/` (Tauri) and `/app` (web)

**Database Layer:**
- Purpose: Dexie (IndexedDB) schema definition and typed CRUD helpers
- Location: `src/db/database.ts`
- Contains: `db` singleton, schema migrations (versions 1–4), typed `getSetting`/`setSetting` helpers, per-entity getters/setters
- Depends on: Dexie.js, `src/types.ts`
- Used by: `src/hooks/useDatabase.ts` only — nothing else imports `db` directly

**Hooks Layer (Data Access):**
- Purpose: Expose reactive IndexedDB data as React state; encapsulate all CRUD operations
- Location: `src/hooks/useDatabase.ts`
- Contains: `useAssets`, `useMaterials`, `usePrinters`, `usePrinterInstances`, `usePrinterSettings`, `useElectricitySettings`, `useLaborSettings`, `useUserProfile`, `useShippingConfig`, `useMarketplaceFees`, `useAllSettings`, `useJobs`, `useSales`
- Depends on: `src/db/database.ts`, `dexie-react-hooks` (`useLiveQuery`), `src/types.ts`, `src/data/defaultMaterials.ts`
- Used by: `src/App.tsx` exclusively (data is prop-drilled from App into feature components)

**Feature Components:**
- Purpose: UI panels for each calculator tab
- Location: `src/components/`
- Contains: `CostCalculator.tsx`, `JobsManager.tsx`, `AssetLibrary.tsx`, `PrinterSettings.tsx`, `SettingsModal.tsx`, `UserProfileModal.tsx`
- Depends on: Props from `App.tsx`, `src/types.ts`, `src/utils/`, `src/components/ui/`
- Used by: `src/App.tsx` (tab switching)

**Shared UI Components:**
- Purpose: Reusable, styled primitive components
- Location: `src/components/ui/`
- Contains: `Button.tsx`, `ButtonLink.tsx`, `Input.tsx`, `Select.tsx`, `Textarea.tsx`, `Card.tsx`; barrel re-exported via `index.ts`
- Depends on: Tailwind CSS only
- Used by: All feature components and marketing pages

**Marketing Pages:**
- Purpose: Public-facing site pages (landing, download, FAQ, features, feedback, changelog)
- Location: `src/pages/`
- Contains: `LandingPage.tsx`, `DownloadPage.tsx`, `FeaturesPage.tsx`, `FAQPage.tsx`, `FeedbackPage.tsx`, `ChangelogPage.tsx`
- Depends on: `src/components/Header.tsx`, `src/components/Footer.tsx`, shared UI
- Used by: `src/main.tsx` (web routes only, lazy-loaded, never loaded in Tauri builds)

**Tauri Native Shell:**
- Purpose: Rust wrapper that hosts the web app in a WebView and adds OS integrations
- Location: `src-tauri/src/main.rs`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`
- Contains: Tauri builder with `plugin-shell` (open URLs in system browser) and `plugin-window-state` (persist window size/position)
- Depends on: Rust `tauri` 2.x, `tauri-plugin-shell`, `tauri-plugin-window-state`
- Used by: Desktop distribution (`.exe` / `.dmg`)

**Utility Functions:**
- Purpose: Pure computation helpers (no side effects, no React)
- Location: `src/utils/`
- Contains: `currency.ts` (formatting, unit conversion), `gcodeParser.ts` (slicer detection + metadata extraction), `csvHelpers.ts` (CSV import parsing)
- Depends on: `src/types.ts` only
- Used by: Feature components that need calculations

## Data Flow

**Calculator save flow:**

1. User fills form in `CostCalculator.tsx`
2. `CostCalculator` calls `onSaveJob(job, printHours)` prop (passed from `App.tsx`)
3. `App.tsx` `handleSaveJob` calls `addJob(job)` then `addPrintHours(printerInstanceId, hours)`
4. `useJobs` and `usePrinterInstances` hooks write to IndexedDB via `db.jobs.add()` / `db.printerInstances.put()`
5. `useLiveQuery` in hooks re-triggers, React state updates, UI re-renders

**Settings persistence flow:**

1. User changes a setting in `SettingsModal` or `UserProfileModal`
2. Component calls the update callback prop (e.g., `onShippingChange`)
3. `App.tsx` delegates to the relevant hook's updater (e.g., `updateShippingConfig`)
4. Hook calls `setSetting(key, value)` which writes to `db.settings` as JSON string
5. Hook's local `useState` is set optimistically — no live query on settings (async read on mount only)

**G-code import flow:**

1. User drops/selects `.gcode` file in `GcodeImport.tsx`
2. `readGcodeFile()` in `src/utils/gcodeParser.ts` reads only header + footer bytes
3. `parseGcode()` detects slicer and extracts filament weight, print time, filament type
4. `findBestFilamentMatch()` looks up best matching Asset in user's library
5. Results are passed back to `CostCalculator` to pre-fill form fields

**State Management:**
- No global state store (no Redux, Zustand, or Context)
- All persistent state lives in IndexedDB, accessed via hooks
- Hooks use `useLiveQuery` (Dexie) for reactive table data, local `useState` for settings
- App-level UI state (active tab, modal visibility, `editingJob`) lives in `App.tsx` as `useState`
- Calculator form state uses `sessionStorage` for within-session persistence across tab switches

## Key Abstractions

**Asset (unified material/printer type):**
- Purpose: A single type covers all cost inputs — filaments, consumables, finishing supplies, packaging, and printers
- Examples: `src/types.ts` (`Asset` interface), `src/db/database.ts` (`db.materials` table)
- Pattern: Discriminated by `category` field (`'filament' | 'consumable' | 'finishing' | 'tool' | 'packaging' | 'printer'`). Printer-specific fields (`wattage`, `purchasePrice`, etc.) are optional on the shared type. `PrinterConfig` is a legacy derived type.

**PrinterInstance (user's physical machine):**
- Purpose: Separates "printer model config" (`PrinterConfig`) from "a specific machine the user owns" (`PrinterInstance`), allowing multiple instances of the same model and per-machine print hour tracking
- Examples: `src/types.ts`, `src/hooks/useDatabase.ts` (`usePrinterInstances`)
- Pattern: `PrinterInstance.printerConfigId` references a printer `Asset` id

**Feature Release Registry:**
- Purpose: Central record of feature release dates powering `NewBadge` visibility
- Examples: `src/features.ts`, `src/components/NewBadge.tsx`
- Pattern: Add entry to `featureReleases` map with ISO date → badge auto-expires after `NEW_FEATURE_MAX_AGE_DAYS`

**`__IS_TAURI__` build constant:**
- Purpose: Branch web vs. desktop code paths at build time (tree-shaken by Vite)
- Examples: `src/main.tsx` (routing), `src/App.tsx` (standalone detection), `src/components/UpdateBanner.tsx`
- Pattern: `vite.config.ts` injects `process.env.TAURI_ENV_PLATFORM` into the define block; declared in `src/globals.d.ts`

## Entry Points

**Web app entry:**
- Location: `src/main.tsx`
- Triggers: Browser page load at `https://3dcoster.vercel.app`
- Responsibilities: Mount React root, configure routing (web routes include marketing pages), attach `ErrorBoundary` and Vercel Analytics

**Desktop app entry:**
- Location: `src-tauri/src/main.rs`
- Triggers: User launches native `.exe` / `.dmg`
- Responsibilities: Initialize Tauri plugins (shell, window-state), load web content in WebView

**HTML entry:**
- Location: `index.html`
- Responsibilities: Mount point `<div id="root">`, load `src/main.tsx` via Vite script tag

**Calculator tab (app shell):**
- Location: `src/App.tsx`
- Triggers: Route `/app` (web) or route `/` (Tauri)
- Responsibilities: Initialize all database hooks, render tab UI, prop-drill data and callbacks to feature components

## Error Handling

**Strategy:** Defensive — errors are caught at boundaries, logged, and silently recovered where possible. No global error reporting service.

**Patterns:**
- `ErrorBoundary` class component in `src/main.tsx` catches render errors and shows a reload prompt
- Database hooks wrap `useEffect` init logic in try/catch and log to `console.error`
- `useLocalStorage` and `NewBadge` catch `localStorage` errors silently (storage may be full)
- `UpdateBanner` catches fetch errors silently — update check failure never surfaces to user
- Settings `getSetting` returns a `defaultValue` if JSON parse fails
- `readGcodeFile` / `parseGcode` return null fields rather than throwing when metadata is absent

## Cross-Cutting Concerns

**Logging:** `console.error` only, no structured logging library. Errors are logged at catch sites in hooks and utility functions.

**Validation:** No schema validation library. TypeScript types enforce correctness at compile time; runtime validation is ad-hoc (null checks, fallback defaults).

**Authentication:** None. App is fully local, no user accounts.

**Persistence:** Two tiers — IndexedDB (Dexie) for all structured data; `localStorage` for ephemeral flags (`dismissedUpdateVersion`, feature-seen timestamps). `sessionStorage` for calculator form state within a browser session.

**Platform branching:** `__IS_TAURI__` build constant used in `src/main.tsx`, `src/App.tsx`, `src/components/UpdateBanner.tsx`, and `src/components/GcodeImport.tsx` (if present).

---

*Architecture analysis: 2026-04-13*
