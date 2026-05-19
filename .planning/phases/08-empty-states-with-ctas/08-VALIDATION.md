---
phase: 8
slug: empty-states-with-ctas
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-19
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Sourced from `08-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.4 + jsdom 29.0.2 (already installed) |
| **Config file** | `vitest.config.ts` (root) — `environment: 'jsdom'`, `include: ['src/**/*.test.ts']` |
| **Quick run command** | `npm test` (runs `vitest run`) |
| **Full suite command** | `npm test` (only one suite today) |
| **Estimated runtime** | < 5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run lint:no-raw-html && tsc -b` (< 5 s)
- **After every plan wave:** Run `npm test && npm run build`
- **Before `/gsd:verify-work`:** Full suite must be green; manual UAT (CTA interactions, NEW badge appearance) executed
- **Max feedback latency:** 5 seconds for unit; ~15 seconds for full build

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 8-01-* | 01 | 1 | UI-04 | — | EmptyState renders icon/title/description; omits CTA when prop undefined | unit | `npm test` | ❌ W0 | ⬜ pending |
| 8-01-* | 01 | 1 | UI-04 | — | `shouldShowEmptyState(items, isLoading)` returns true iff `!isLoading && items.length===0` | unit (4 branches) | `npm test` | ❌ W0 | ⬜ pending |
| 8-01-* | 01 | 1 | UI-04 | — | TypeScript strict mode passes for new files | automated | `tsc -b` | ✅ | ⬜ pending |
| 8-01-* | 01 | 1 | UI-04 | — | Lint guard exits 0 (no raw `<button>` introduced) | automated | `npm run lint:no-raw-html` | ✅ | ⬜ pending |
| 8-02-* | 02 | 2 | UI-04 | — | Build succeeds with all three consumer wirings | automated | `npm run build` | ✅ | ⬜ pending |
| 8-02-* | 02 | 2 | UI-04 | — | Lint guard exits 0 after consumer wirings | automated | `npm run lint:no-raw-html` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Task IDs are wave-level placeholders; planner assigns exact IDs in PLAN.md frontmatter. Every task in waves 1 and 2 inherits at minimum the `tsc -b` and lint-guard automated gates.*

---

## Wave 0 Requirements

- [ ] `src/components/ui/EmptyState.test.ts` — unit tests for component prop rendering (uses `renderToStaticMarkup` from `react-dom/server`, no new deps) AND for `shouldShowEmptyState` predicate (4 branches)
- [ ] Extract `shouldShowEmptyState<T>(items: T[], isLoading: boolean): boolean` as a pure exported function in `src/components/ui/EmptyState.tsx` (or sibling util) so the predicate is unit-testable without rendering

*Existing infrastructure (vitest, jsdom, `tsc -b`, `lint-no-raw-html.mjs`) covers everything else. No framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| App.tsx global loading gate masks empty states correctly | UI-04 | Visual / timing | Cold-reload the app with IndexedDB cleared; confirm "Loading…" text shows before any consumer renders an EmptyState |
| Jobs CTA switches active tab to Calculator | UI-04 | Cross-component interaction | Delete all saved jobs; navigate to Jobs tab; click "Open Calculator" CTA; confirm Calculator tab activates |
| Assets CTA opens Add Material form | UI-04 | Cross-component interaction | Delete all assets; navigate to Assets tab; click "Add Material" CTA; confirm Add Material form opens |
| Printers CTA opens Add Printer form | UI-04 | Cross-component interaction | Delete all printers; navigate to Settings → Printers; click "Add Printer" CTA; confirm Add Printer form opens |
| NEW badge appears on relevant tabs on fresh install | UI-04 | Time-gated localStorage (36 h window) | Fresh install with `empty-states` feature key freshly registered; confirm badge appears as `absolute -top-1 -right-1` overlay on the relevant tab heading(s); confirm it does NOT push/wrap/shrink sibling tabs |
| AssetLibrary auto-seed gotcha | UI-04 | `useAssets` seeds defaults when materials table is empty — so empty state only fires AFTER manual deletion, not on first run | Document in PR description; verify by manually clearing materials table via DevTools and re-rendering |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (EmptyState.test.ts, shouldShowEmptyState extraction)
- [ ] No watch-mode flags (vitest `run` not `watch`)
- [ ] Feedback latency < 5 s for unit; < 15 s for full build
- [ ] `nyquist_compliant: true` set in frontmatter once tests land and pass

**Approval:** pending
