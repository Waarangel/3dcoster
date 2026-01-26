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
Always use port 5173 (Google OAuth is configured there):
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

### Version Files to Update
When releasing a new version, update ALL THREE files:

1. **`src/components/UpdateBanner.tsx`** - `APP_VERSION` constant
   ```ts
   export const APP_VERSION = '1.1.0';
   ```

2. **`src-tauri/tauri.conf.json`** - `version` field
   ```json
   {
     "version": "1.1.0"
   }
   ```

3. **`src-tauri/Cargo.toml`** - `version` field
   ```toml
   [package]
   version = "1.1.0"
   ```

### Release Steps

1. Update version numbers in all three files
2. Commit and push:
   ```bash
   git add .
   git commit -m "chore: Bump version to 1.1.0"
   git push origin main
   ```
3. Create and push tag:
   ```bash
   git tag v1.1.0
   git push origin v1.1.0
   ```
4. GitHub Actions builds automatically:
   - Windows: NSIS `.exe` installer
   - macOS Apple Silicon: `_aarch64.dmg`
   - macOS Intel: `_x64.dmg`
5. Release published with all artifacts

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
