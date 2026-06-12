# 3DCoster Project Instructions

## Project Overview
3DCoster is a 3D printing cost calculator with:
- **Web app**: React + Vite + Tailwind, hosted on Vercel
- **Desktop app**: Tauri (Rust) wrapper around the web app
- **PWA support**: Installable, works offline

## Tech Stack
- React 18 + TypeScript
- Vite for bundling
- Tailwind CSS for styling
- Tauri 2 for desktop builds
- IndexedDB for local storage (Dexie.js)
- React Router for navigation

## Project Structure
```
src/
├── components/
│   ├── ui/           # Shared UI components (Button, Input, Select, etc.)
│   ├── Header.tsx    # Global marketing site header
│   ├── Footer.tsx    # Global footer
│   └── UpdateBanner.tsx  # Desktop update notification
├── pages/            # Marketing pages (Landing, Download, FAQ, etc.)
├── App.tsx           # Main calculator app
└── main.tsx          # Entry point with routing

src-tauri/            # Tauri/Rust desktop app code
docs/                 # Documentation (ROADMAP.md)
.github/workflows/    # GitHub Actions (release.yml)
```

---

## Development

### Dev Server
Always use port 4173 (pinned in `vite.config.ts`):
```bash
npm run dev
```

### Build
```bash
npm run build        # Web build
npm run tauri build  # Desktop build (requires Rust)
```

### Environment Detection
Use `__IS_TAURI__` to detect desktop vs web:
```tsx
if (__IS_TAURI__) {
  // Desktop-only code
}
```

---

## Desktop App Release Process

### MANDATORY — CHANGELOG.md entry per release

**Every `v*` tag MUST have a matching `## [X.Y.Z] - YYYY-MM-DD` section in `CHANGELOG.md` BEFORE the tag is pushed.** The release workflow extracts this section via `scripts/extract-changelog.cjs` and uses it as the GitHub release body, which then surfaces verbatim on the `/changelog` page (front-end fetches GitHub Releases API).

If a section is missing:
- The release still ships (soft gate, doesn't block).
- A loud `⚠ WARNING` lands in the GitHub Actions build log.
- The release body falls back to a generic "See the commits" template — the same anti-pattern that caused v1.2.3, v1.2.4, v1.3.0, v1.3.1 to ship with empty release notes.

Use the [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format with these section groupings (only include those that apply):
- **Added** — new features
- **Changed** — changes in existing functionality
- **Deprecated** — soon-to-be removed features
- **Removed** — now removed features
- **Fixed** — bug fixes
- **Security** — vulnerabilities fixed

Each bullet should be a short, user-facing sentence. **Do not include internal-only details** (refactors, dep bumps the user won't notice, planning artifacts).

### Version Files to Update
When releasing a new version, update ALL FOUR artifacts:

1. **`CHANGELOG.md`** — promote `## [Unreleased]` content into a new `## [X.Y.Z] - YYYY-MM-DD` section

2. **`src/components/UpdateBanner.tsx`** - `APP_VERSION` constant
   ```ts
   export const APP_VERSION = '1.1.0';
   ```

3. **`src-tauri/tauri.conf.json`** - `version` field
   ```json
   {
     "version": "1.1.0"
   }
   ```

4. **`src-tauri/Cargo.toml`** - `version` field
   ```toml
   [package]
   version = "1.1.0"
   ```

### Release Steps

> **🔒 MANDATORY GATE — code review before any `v*` tag.** Before bumping the
> version or tagging, run a code review of the release diff
> (`git diff <last-tag>..HEAD`) — `/code-review`, or a `code-reviewer` /
> language-specific reviewer agent. Fix every CRITICAL/HIGH finding before
> proceeding. A green build + passing tests + a smoke test is **NOT** a review:
> it catches compile/test/obvious-runtime breakage, not logic bugs or problems
> in code you didn't read. This gate matters MOST for large, parallel, or
> agent-authored changesets — exactly the ones tempting to rush. (Added after
> v1.4.4 shipped a real `aria-controls` a11y regression that the build gate
> sailed past; a post-ship review caught it → v1.4.5.) Tagging triggers the
> desktop build + nudges every desktop user, so the bar is "reviewed," not "compiles."

0. **Code review the diff** and clear CRITICAL/HIGH findings (see gate above).
1. Update CHANGELOG.md — promote `[Unreleased]` content into a new `## [X.Y.Z] - YYYY-MM-DD` section
2. Update version numbers in the three version files
3. **Verify locally**: `node scripts/extract-changelog.cjs vX.Y.Z` should print your release notes (no fallback warning)
4. Commit and push:
   ```bash
   git add .
   git commit -m "chore: Bump version to 1.1.0"
   git push origin main
   ```
5. Create and push tag:
   ```bash
   git tag v1.1.0
   git push origin v1.1.0
   ```
6. GitHub Actions builds automatically:
   - Windows: NSIS `.exe` installer
   - macOS Apple Silicon: `_aarch64.dmg`
   - macOS Intel: `_x64.dmg`
7. Release published with all artifacts AND with the CHANGELOG.md section as the body
8. `discord-notify.yml` posts the release notes to the community Discord automatically when the release publishes (requires the `DISCORD_RELEASE_WEBHOOK` repo secret — a Discord channel webhook URL; missing secret = soft-gate warning, never blocks). Retroactive/manual posts: Actions → "Discord release notification" → Run workflow with the tag, or `gh workflow run discord-notify.yml -f tag=vX.Y.Z`

### Why this matters
Earlier releases (v1.2.3, v1.2.4, v1.3.0, v1.3.1) shipped with only "See the [changelog](commits/...) for details" as the release body because the workflow had no source of detailed notes. Result: the `/changelog` page on the marketing site looked progressively emptier as the project matured. The CHANGELOG.md + extract-script + soft-warning system was added 2026-05-28 to prevent that pattern from recurring.

The marketing `/changelog` page (`src/pages/ChangelogPage.tsx`) shows the most recent `MAX_RELEASES_DISPLAYED` releases (currently 5 — industry best practice). Older releases are accessible via the "All Releases on GitHub" CTA. Adjust the constant in that file if cadence changes.

### How Users Get Updates

**Web App (Vercel)**:
- Auto-deploys on push to `main`
- Users get new version on next page load

**Desktop App**:
- `UpdateBanner` checks GitHub releases API on startup
- Shows dismissable banner if newer version exists
- Links to download page for manual update

---

## Shared UI Components

Located in `src/components/ui/`:

| Component | Size Prop | Variants |
|-----------|-----------|----------|
| `Button` | `btnSize` | primary, secondary, success, danger, ghost |
| `ButtonLink` | `btnSize` | Same as Button |
| `Input` | `inputSize` | - |
| `Select` | `selectSize` | - |
| `Textarea` | `textareaSize` | - |
| `Card` | `padding` | - |

**Note**: Use `btnSize`/`inputSize`/etc. NOT `size` (TypeScript conflict with HTML attribute)

---

## Key URLs & APIs

- **GitHub Repo**: https://github.com/Waarangel/3dcoster
- **Live Site**: https://3dcoster.vercel.app
- **Releases API**: https://api.github.com/repos/Waarangel/3dcoster/releases/latest
- **Feedback Form**: Formspree (https://formspree.io/f/mbdgwnjl)

---

## Analytics

Vercel Analytics added to `src/main.tsx`:
```tsx
import { Analytics } from '@vercel/analytics/react'
```
No user-level tracking (no login). Aggregate metrics only.

---

## macOS Gatekeeper Issue

The app isn't code-signed (Apple Developer Program costs $99/year).

**User sees**: "3DCoster is damaged and can't be opened"

**User fix**: Right-click app → Open → Click "Open" in dialog
Or: `xattr -cr /Applications/3DCoster.app`

**Documented in**: FAQ page + Download page warning

---

## GitHub Actions Workflow

`.github/workflows/release.yml`:
- **Trigger**: Tags matching `v*`
- **Builds**: Windows (NSIS .exe), macOS Intel + Apple Silicon (.dmg)
- **Creates**: GitHub Release with download assets

---

## Design Patterns

### Styling Consistency
- **Cards**: `rounded-xl` for regular, `rounded-2xl` for hero sections
- **Colors**: Slate-based dark theme with blue accent
- **Spacing**: Use Tailwind scale consistently (4, 6, 8)

### Navigation
- Marketing pages use shared `Header` component
- Desktop app routes directly to calculator (no marketing pages)

### Data Flow
- All data stored locally in IndexedDB via Dexie.js
- No backend, no sync (yet)
- Export/import via JSON files
