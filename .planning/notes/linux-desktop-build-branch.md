# Assessment: `feat/linux-desktop-build` branch

Date: 2026-08-27 · Repo: Waarangel/3dcoster · Assessed against `origin/main` @ d2d12a8

## Summary verdict: KILL (delete the branch — it is already fully merged)

The premise that this branch contains unmerged work is **incorrect**. The branch tip
`cf6f72d` is an **ancestor of `origin/main`**:

- `git merge-base origin/feat/linux-desktop-build origin/main` → `cf6f72d` (the branch tip itself)
- `git log origin/main..origin/feat/linux-desktop-build` → **0 unique commits**
- `git merge-base --is-ancestor` confirms the branch is fully contained in main.

(Note: the repo checkout was shallow, which initially hid this — after
`git fetch --deepen=200` the ancestry is unambiguous. A shallow clone is likely
why the branch appeared unmerged in the first place.)

## How the work actually landed

The branch was merged into main on **2026-06-18** via merge commit
**`f9c0298` — "Merge Linux desktop build into v1.7.0 release (AppImage/.deb/.rpm
targets + Linux-aware DownloadPage/FAQ)"**, which also carried the v1.7.0 version
bumps (version.ts, tauri.conf.json, Cargo.toml, CHANGELOG.md). It was then refined
on main by at least:

- `65a1f8f` — fix(release): list Linux artifacts + correct Windows installer name in release-body template
- `7fd120c` — fix: address v1.7.0 release review findings

## What the two Linux commits contain (all of it now on main)

1. **`7951dc6`** "feat: add Linux desktop build (CI + download page + FAQ + changelog)"
   - `.github/workflows/release.yml` (+26): Linux row in the tauri-action build matrix
   - `src/pages/DownloadPage.tsx` (+87/-2): Linux download section (AppImage/.deb/.rpm)
   - `src/pages/FAQPage.tsx` (+17/-1): Linux install FAQ entries
   - `CHANGELOG.md` (+3)
2. **`cf6f72d`** "ci: add build-only Linux workflow for testing artifacts"
   - `.github/workflows/linux-build-check.yml` (new, 79 lines)

## Current main already supersedes the branch

Every artifact of the branch exists on main today, in a **more mature** form:

| Branch file | Status on current main |
|---|---|
| `.github/workflows/release.yml` Linux matrix row | Present and improved: pinned to `ubuntu-22.04` with an explicit glibc-2.35 floor rationale (avoids the "GLIBC_2.39 not found" trap of ubuntu-latest), gated apt step installing libwebkit2gtk-4.1 + librsvg + patchelf; coexists with the later-added `notify-discord` job and cadence guard |
| `.github/workflows/linux-build-check.yml` | Present on main |
| `src/pages/DownloadPage.tsx` | 32 Linux references, typed `linuxAppImageUrl` field, handles the `_amd64` vs `.x86_64` artifact-naming asymmetry |
| `src/pages/FAQPage.tsx` | 5 Linux references |
| `CHANGELOG.md` | Linux entries shipped with v1.7.0 |

There is nothing left on the branch to cherry-pick, rebase, or rewrite. Any
"revival" would only regress main (the branch predates the notify-discord job,
cadence guard, the ubuntu-22.04 pin, the release-body artifact fix, and versions
1.7–1.9; current `APP_VERSION` is 1.9.0).

## Conflict analysis

Not applicable — with zero unique commits there is no diff to merge. No
`merge-tree`/scratch cherry-pick was needed; no worktree was created and the
working tree on `claude/status-check-k98qja` was left untouched.

## Effort to revive

Zero — and none warranted. The feature shipped in v1.7.0.

## Recommended path

1. Delete the stale remote branch: `git push origin --delete feat/linux-desktop-build`
   (safe: `git branch -r --merged origin/main` lists it; the merge commit `f9c0298`
   preserves full history).
2. If any tracking issue/PR for "Linux desktop build" is still open, close it
   pointing at `f9c0298` / the v1.7.0 release.
3. Optional hygiene: use full (non-shallow) fetches when auditing branch state, since
   shallow clones can make merged branches look unmerged (`git merge-base` fails).
