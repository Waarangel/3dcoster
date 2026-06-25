---
phase: 35
slug: accessibility-tier-4
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-25
---

# Phase 35 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (jsdom) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run <file>` |
| **Full suite command** | `npm test` (`vitest run`) |
| **Estimated runtime** | ~30–60 seconds |

**Convention note (from RESEARCH.md):** existing component tests use **raw `createRoot` + `act`**
(see `InfoTooltip.test.tsx`), not `@testing-library/react`. New a11y tests follow the same pattern.
No `jest-axe`/`axe-core` dependency is present; assertions are explicit ARIA-attribute and
behavior checks (`getAttribute`, `role`, focus state, keydown dispatch) rather than axe scans.

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <touched test file(s)>`
- **After every plan wave:** Run `npm test` (full suite)
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

*Populated by the planner. Each A11Y requirement maps to explicit ARIA-attribute / keyboard-behavior
assertions. Indicative coverage:*

| Requirement | Surface | Test Type | Indicative Assertion |
|-------------|---------|-----------|----------------------|
| A11Y-10 | SettingsModal tabs | unit | Left/Right/Home/End keydown moves `aria-selected` + roving `tabIndex`; panel receives focus |
| A11Y-11 | AssetLibrary form error | unit | error container `role="alert"`; failing input `aria-invalid="true"` + `aria-describedby` → error id |
| A11Y-12 | Settings marketplace / Asset rows | unit | icon-only buttons expose descriptive `aria-label` |
| A11Y-13 | FilamentSelector | unit | trigger has accessible name (label association); submenu `role="menu"` has `aria-label` |
| A11Y-14 | JobsManager tag chips | unit | remove button bounding box ≥ 24×24; focus-visible reveals + rings the control |
| A11Y-15 | App main / break-even / InfoTooltip / filter | unit | `tabpanel` `tabIndex={-1}`; `role="progressbar"` + `aria-valuenow/min/max`; InfoTooltip Escape-dismiss + concise label; back-to-site link label; category `role="group"` label |

---

## Wave 0 Requirements

- [ ] New test files (raw `createRoot + act`) for SettingsModal tabs, AssetLibrary form error, JobsManager tag chips, FilamentSelector labels, and App/InfoTooltip AA cleanups — created by the plans that touch each surface (no separate framework install needed; vitest + jsdom already configured).
- [ ] Update existing `InfoTooltip.test.tsx` when its `aria-label` changes from the full sentence to a concise label.

*Existing infrastructure (vitest + jsdom) covers all phase requirements — no framework install.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Screen-reader announcement of active tab / submenu option / form error | A11Y-10, A11Y-11, A11Y-13 | Live SR announcement timing (VoiceOver/NVDA) is not assertable in jsdom | Smoke-test with VoiceOver: switch Settings tabs, trigger an AssetLibrary form error, open FilamentSelector submenu — confirm spoken feedback |
| Touch discoverability of tag-remove chip | A11Y-14 | Real touch target / hover-reveal behavior | On a touch device or emulator, confirm the ✕ is tappable at ≥24px and reachable without hover |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags (use `vitest run`, never `vitest --watch`)
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
