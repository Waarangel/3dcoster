# Technology Stack

**Analysis Date:** 2026-04-13

## Languages

**Primary:**
- TypeScript 5.9.3 - All frontend source code in `src/`
- Rust (stable, edition 2021) - Desktop shell in `src-tauri/src/main.rs`

**Secondary:**
- CSS (Tailwind utility classes) - Styling via `src/index.css` and inline Tailwind

## Runtime

**Environment:**
- Node.js LTS (CI uses `lts/*`; local dev uses v22.x)

**Package Manager:**
- npm (lockfile version 3)
- Lockfile: `package-lock.json` present and committed

## Frameworks

**Core:**
- React 19.2.0 - UI rendering (`src/App.tsx`, `src/main.tsx`)
- React Router DOM 7.13.0 - Client-side routing (`src/main.tsx`)
- Tailwind CSS 4.1.18 - Utility-first styling (via `@tailwindcss/vite` Vite plugin)

**Desktop:**
- Tauri 2 (tauri 2, tauri-plugin-shell 2, tauri-plugin-window-state 2) - Native desktop wrapper in `src-tauri/`

**PWA:**
- vite-plugin-pwa 1.2.0 - Service worker + manifest generation (`vite.config.ts`)

**Build/Dev:**
- Vite 7.2.4 - Bundler and dev server (`vite.config.ts`); dev port 4173
- `@vitejs/plugin-react` 5.1.1 - React Fast Refresh and JSX transform

## Key Dependencies

**Critical:**
- `dexie` 4.2.1 - IndexedDB ORM; all user data storage (`src/db/database.ts`)
- `dexie-react-hooks` 4.2.0 - Reactive Dexie queries inside React components
- `react-router-dom` 7.13.0 - Full SPA routing; separate paths for Tauri vs web (`src/main.tsx`)
- `@tauri-apps/plugin-shell` 2.3.5 - Opens external URLs in system browser from desktop app
- `@vercel/analytics` 1.6.1 - Aggregate page analytics injected in `src/main.tsx`

**Data Processing:**
- `papaparse` 5.5.3 - CSV export/import of print jobs (`@types/papaparse` 5.5.2)

**Build Utilities:**
- `sharp` 0.34.5 - PWA icon generation at build time
- `@tauri-apps/api` 2.9.1 (devDependency) - TypeScript bindings for Tauri APIs
- `@tauri-apps/cli` 2.9.6 (devDependency) - `tauri dev` / `tauri build` commands

## Configuration

**Build-time environment flag:**
- `__IS_TAURI__` - Boolean constant injected by Vite (`vite.config.ts`); true when `TAURI_ENV_PLATFORM` env var is set (done by Tauri CLI and GitHub Actions). Used throughout `src/` to gate desktop-only code paths.

**TypeScript:**
- Strict mode enabled with `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`
- Target: ES2022, module resolution: bundler
- Config files: `tsconfig.json` (composite root), `tsconfig.app.json` (src), `tsconfig.node.json` (vite config)
- Build command: `tsc -b && vite build` (enforces stricter checks than `--noEmit`)

**Linting:**
- ESLint 9.x flat config (`eslint.config.js`)
- Plugins: `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`

**PWA manifest:**
- Configured inline in `vite.config.ts` under `VitePWA()`
- Service worker strategy: `autoUpdate`
- Workbox caches: all static assets + Google Fonts CacheFirst (1 year)

**Vercel:**
- `vercel.json` — single SPA rewrite rule: all paths → `/`
- Auto-deploys on push to `main`

## Platform Requirements

**Development:**
- Node.js LTS
- Rust stable toolchain (only needed for desktop builds)
- `npm run dev` starts Vite dev server on port 4173

**Production:**
- Web: Vercel (static hosting + SPA rewrites)
- Desktop: GitHub Actions builds `.dmg` (macOS Apple Silicon + Intel) and `.exe` (Windows NSIS) on tag push; no code signing

---

*Stack analysis: 2026-04-13*
