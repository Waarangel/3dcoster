---
phase: 09
slug: skeleton-loading-states
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-19
---

# Phase 09 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Distilled from 09-RESEARCH.md § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.4 + jsdom 29.0.2 |
| **Config file** | `vitest.config.ts` (root) — `environment: 'jsdom'`, `include: ['src/**/*.test.ts']` |
| **Quick run command** | `npm test` (runs `vitest run`) |
| **Full suite command** | `npm test && npm run build` (full lint + tsc + vite + PWA pipeline) |
| **Estimated runtime** | ~5 s unit; ~30 s full build |

---

## Sampling Rate

- **After every task commit:** `npm run lint:no-raw-html && npx tsc -b` (~5 s)
- **After every plan wave:** `npm test && npm run build` (~30 s)
- **Before `/gsd:verify-work`:** Full suite must be green AND manual UAT script signed off
- **Max feedback latency:** 5 s for unit, 30 s for full build

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 1 | UI-05 | unit (RED test for Skeleton primitive + variants) | `npm test` | ❌ Wave 0 | ⬜ pending |
| 09-01-02 | 01 | 1 | UI-05 | unit (GREEN — Skeleton implementation passes RED tests) | `npm test` | ❌ Wave 0 | ⬜ pending |
| 09-01-03 | 01 | 1 | UI-05 | barrel re-export (Skeleton + shouldShowEmptyState) | `npx tsc -b && npm run lint:no-raw-html` | ✅ (modify existing) | ⬜ pending |
| 09-02-01 | 02 | 2 | UI-05 | automated grep — App.tsx contains no "Loading..." text and no global `if (isLoading)` block | `grep -n 'Loading' src/App.tsx` (must NOT match the gate text) | ✅ (modify existing) | ⬜ pending |
| 09-02-02 | 02 | 2 | UI-05 | AssetLibrary wires isLoading prop + AssetListSkeleton co-located | `npx tsc -b && npm run lint:no-raw-html` | ✅ (modify existing) | ⬜ pending |
| 09-02-03 | 02 | 2 | UI-05 | JobsManager single-return refactor + JobsListSkeleton co-located | `npx tsc -b && npm run lint:no-raw-html` | ✅ (modify existing) | ⬜ pending |
| 09-02-04 | 02 | 2 | UI-05 | PrinterSettings wires isLoading prop + PrinterListSkeleton co-located | `npx tsc -b && npm run lint:no-raw-html` | ✅ (modify existing) | ⬜ pending |
| 09-02-05 | 02 | 2 | UI-05 | Manual UAT checkpoint (7 visual / timing checks below) | manual | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/ui/Skeleton.tsx` — primitive component (variants: line / card / circle; width / height / rounded / className props; `animate-pulse` built in; `role="status"` for a11y)
- [ ] `src/components/ui/Skeleton.test.ts` — RED→GREEN unit tests covering all variants, prop overrides, className composition, `role="status"`, `animate-pulse` class assertion
- [ ] `src/components/ui/index.ts` — add `Skeleton` named export AND re-export `shouldShowEmptyState` (currently exported only from EmptyState.tsx)

*Existing infrastructure (vitest, jsdom, tsc -b, lint-no-raw-html.mjs) covers everything else. No framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| AssetLibrary skeleton appears during cold load | UI-05 D-01 | Timing-sensitive; depends on IndexedDB warm/cold state | DevTools → Application → IndexedDB → 3DCoster → Clear. Cold-reload (Ctrl+Shift+R). Switch to Materials tab. Confirm AssetListSkeleton (5 table rows or 3 mobile cards) appears with `animate-pulse` (visible as pulsing opacity). Confirm it's replaced by real materials after ~200-500 ms. |
| JobsManager skeleton appears during cold load | UI-05 D-01 | Same as above | DevTools clear IDB. Cold-reload. Switch to Jobs tab. Confirm 4 placeholder job rows with pulse animation. Confirm replacement by empty state (no jobs default) or real jobs if any. |
| PrinterSettings skeleton appears during cold load | UI-05 D-01 | Same as above | DevTools clear IDB. Cold-reload. Switch to Settings tab. Confirm 3 placeholder printer rows. Confirm replacement by empty state (no printer instances default) or real instances if any. |
| No flicker after load | UI-05 D-05 | Visual transition quality | After cold-reload, observe each list — skeleton should transition smoothly to real content. Acceptable: single-frame opacity dip if Tailwind animation isn't done playing. NOT acceptable: white flash, jitter, or skeleton persisting after real data lands. |
| App shell + Calculator interactive during load | UI-05 D-01 | Interaction during transient state | Cold-reload with throttled CPU (DevTools → Performance → CPU 4× slowdown). While skeletons render on list tabs, click the header settings gear, navigate via tab buttons, type into Calculator inputs. Confirm all responsive. |
| Empty-state-vs-skeleton ordering | UI-05 D-10 | Data-dependent timing | Cold-reload with empty jobs DB. Switch to Jobs tab. Confirm: skeleton appears first → transitions to EmptyState (NOT a flash of EmptyState during loading). |
| No NEW badge appears | UI-05 D-08 | Negative check | Confirm no badge on any tab heading for "skeleton-loading". Inspect `src/features.ts` — no `'skeleton-loading'` key registered. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify (8 tasks, all have verify)
- [ ] Wave 0 covers all MISSING references (Skeleton.tsx, Skeleton.test.ts, index.ts barrel)
- [ ] No watch-mode flags (vitest `run` not `watch`)
- [ ] Feedback latency < 5 s for unit; < 30 s for full build
- [ ] `nyquist_compliant: true` set in frontmatter once tests land and pass
- [ ] Manual UAT script executed and signed off (7 checks above)

**Approval:** pending
