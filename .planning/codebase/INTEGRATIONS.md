# External Integrations

**Analysis Date:** 2026-04-13

## APIs & External Services

**GitHub Releases API:**
- Used for: version checking (desktop update banner) and displaying changelog
- Endpoints called:
  - `GET https://api.github.com/repos/Waarangel/3dcoster/releases/latest` — called by `src/components/UpdateBanner.tsx` (desktop only, gated with `__IS_TAURI__`) and `src/pages/DownloadPage.tsx`
  - `GET https://api.github.com/repos/Waarangel/3dcoster/releases?per_page=20` — called by `src/pages/ChangelogPage.tsx`
- Auth: None (unauthenticated public API; subject to 60 req/hr rate limit per IP)
- SDK/Client: Native `fetch()`
- Failure mode: Silently swallowed; fallback version string used for download URLs

**Formspree:**
- Used for: user feedback form
- Endpoint: `POST https://formspree.io/f/mbdgwnjl`
- Implementation: `src/pages/FeedbackPage.tsx` — submits `multipart/form-data` via `fetch()`
- Auth: Form ID embedded in URL (no secret required client-side)
- No SDK; raw fetch with `Accept: application/json` header

**Vercel Analytics:**
- Used for: aggregate page-view metrics (no user-level tracking, no login)
- Package: `@vercel/analytics` 1.6.1
- Integration point: `src/main.tsx` — `<Analytics />` component mounted outside the router
- No configuration required beyond package import; automatically activates on Vercel deployment

## Data Storage

**Databases:**
- IndexedDB via Dexie.js
  - Database name: `3DCosterDB`
  - Client: `dexie` 4.2.1 + `dexie-react-hooks` 4.2.0
  - Schema file: `src/db/database.ts`
  - Current schema version: 4
  - Tables: `materials`, `printers`, `printerInstances`, `jobs`, `sales`, `settings`
  - Connection: Browser-native; no connection string or env var required
  - All data is local to the user's browser/device; no sync or cloud backup

**File Storage:**
- Local filesystem only (export/import via JSON files; CSV export via PapaParse)
- No cloud file storage

**Caching:**
- PWA service worker (Workbox) caches static assets and Google Fonts
- `localStorage` used for lightweight UI state only:
  - `dismissedUpdateVersion` — tracks which update version the user dismissed
  - New-feature badge seen timestamps (`src/components/NewBadge.tsx`)

## Authentication & Identity

**Auth Provider:** None
- No login, no accounts, no sessions
- All data is local; no user identity concept exists in the app

## Monitoring & Observability

**Error Tracking:** None (no Sentry, Datadog, etc.)

**Logs:**
- Client-side `console.error()` only (e.g., failed update checks, React ErrorBoundary)
- No structured logging or log aggregation

## CI/CD & Deployment

**Hosting:**
- Web: Vercel — auto-deploys on every push to `main`
- Desktop: GitHub Releases — binaries attached to GitHub Release on tag push

**CI Pipeline:**
- GitHub Actions — `.github/workflows/release.yml`
- Trigger: Git tags matching `v*`
- Builds: macOS Apple Silicon (`.dmg`), macOS Intel (`.dmg`), Windows NSIS (`.exe`)
- Secret used: `GITHUB_TOKEN` (auto-provided by Actions) for creating GitHub Releases
- No code signing; macOS users must bypass Gatekeeper manually

## Environment Configuration

**Required env vars:** None for web deployment

**Build-time only:**
- `TAURI_ENV_PLATFORM` — set by Tauri CLI and GitHub Actions to signal desktop builds; controls `__IS_TAURI__` constant injected by Vite

**No `.env` file detected** — no secrets required to build or run the web app

## Webhooks & Callbacks

**Incoming:** None

**Outgoing:** None (Formspree submission is a direct POST, not a webhook pattern)

---

*Integration audit: 2026-04-13*
