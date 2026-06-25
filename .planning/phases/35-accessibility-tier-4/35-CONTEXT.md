# Phase 35: Accessibility Tier 4 - Context

**Gathered:** 2026-06-25
**Status:** Ready for planning
**Source:** Direct (requirements + Tier 4 audit are the spec — no discuss-phase run)

<domain>
## Phase Boundary

Accessibility remediation of **existing** calculator-app components. No new features,
no visual redesign beyond the single tag-chip change below. Each fix targets a specific
WCAG success criterion at the file/line locations identified in the Tier 4 audit
(`docs/CALCULATOR_APP_AUDIT.md` §4.1–4.6). Two items are WCAG **Critical**
(A11Y-10 Settings tab keyboard nav, A11Y-11 form-error association).

In scope: A11Y-10..15 only. Out of scope: Tier 2 brand cohesion, Tier 3 onboarding,
Tier 5 performance (Phase 36), Tier 6 God-component splits.

This phase ships inside the single v1.9 desktop release — touches the calculator app,
so it is part of the bundled v1.9 tag (no piecemeal web push).
</domain>

<decisions>
## Implementation Decisions

### Tag-remove chip buttons (A11Y-14 / audit 4.5) — LOCKED
- Provide a **24×24px minimum hit target** (WCAG 2.5.8 AA) via padding / an enlarged
  hit-area on the existing `✕` control — do NOT necessarily grow the visible glyph to 24px.
- The `✕` glyph stays **visually subtle at rest** and is **revealed on hover/focus** of the
  chip. Keep the current clean look; do not make the `✕` always-on.
- The control MUST remain **keyboard-focusable and operable at all times** — `opacity-0`
  at rest must not prevent the focus ring from being visible or the button from being
  reachable/usable via keyboard (focus must force it visible). Touch users get the full
  24px target regardless of hover state.
- Not adopting the stricter AAA 44×44 (2.5.5) target — AA 24×24 is the bar for v1.9.

### Settings inner tabs (A11Y-10 / audit 4.1) — direction
- Follow the WAI-ARIA Authoring Practices **Tabs** pattern: roving/arrow-key navigation
  (Left/Right, with Home/End where natural), and move focus to the active tabpanel on switch.
- Research (RESEARCH.md) pins the exact roving-tabindex vs aria-activedescendant choice and
  focus-management details before planning finalizes.

### Form-error association (A11Y-11 / audit 4.2) — direction
- Error containers announce via `role="alert"`; each failing input sets `aria-invalid="true"`
  and `aria-describedby` pointing at the id of its error text. Use the existing `useId`
  pattern already in the codebase for id generation.

### FilamentSelector (A11Y-13 / audit 4.4) — direction
- Give the menu/trigger an accessible name; the submenu announces the active option via a
  live region or `aria-activedescendant`. Research pins which mechanism fits the existing
  FilamentSelector keyboard-nav implementation (audit notes its keyboard nav is already good).

### Icon-button labels (A11Y-12 / audit 4.3)
- Every icon-only edit/delete button (Settings carriers/marketplaces, Asset rows) gets a
  descriptive `aria-label` (e.g. `Edit {name}` / `Delete {name}`), reusing the shared
  `EditButton`/`DeleteButton`/`IconButton` label convention from `src/components/ui`.

### A11Y-15 AA cleanups (audit 4.6)
- Main `<main role="tabpanel">` gets `tabIndex={-1}` for post-switch focus.
- Break-even bar exposes `role="progressbar"` with `aria-valuenow/min/max` (+ `aria-valuetext`).
- `InfoTooltip`: concise `aria-label` (not the full sentence) + Escape-to-dismiss.
- Mobile "Back to site" icon-only link gets a label.
- Category filter becomes a labelled `role="group"`.
- SortIndicator `▲/▼` and per-unit `invisible`+`aria-hidden` label patterns cleaned up.

### No full UI-SPEC
- This is remediation of existing UI, not new visual design. The only visual change
  (tag chip) is locked above. UI-SPEC generation is intentionally skipped.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Audit + requirements (source of truth for scope)
- `docs/CALCULATOR_APP_AUDIT.md` §4.1–4.6 — exact findings, files, line numbers, WCAG refs
- `.planning/REQUIREMENTS.md` lines 19–24 — A11Y-10..15 acceptance phrasing

### Project a11y + icon-button conventions
- `src/components/ui/` — shared `EditButton`/`DeleteButton`/`RemoveButton`/`IconButton`
  (required pattern: icon-only controls carry a descriptive `aria-label` built from `label`)
- `src/lib/dialogA11y.ts` — existing focus-trap/restore/scroll-lock (keep; reference pattern)
- `.claude/CLAUDE.md` "Action buttons & icons" section — mandatory icon-button + aria-label rules

### Target components (from audit)
- `SettingsModal.tsx:175-198` (tabs), `:488-521` (icon buttons)
- `AssetLibrary.tsx:1027-1031` (form error), `:310-396` (icon buttons), `:483-485,972-997` (4.6)
- `CostCalculator.tsx` (form error), `:885-898` (4.6 patterns)
- `FilamentSelector.tsx:299-379` (menu/submenu a11y)
- `JobsManager.tsx:539-547` (tag chips), `:707-714` (break-even progressbar)
- `App.tsx:282,199-208` (main tabpanel, back-to-site link)
- `InfoTooltip.tsx` (label + Escape)
</canonical_refs>

<specifics>
## Specific Ideas

- Reuse existing patterns wherever they already exist (`useId`, shared icon buttons,
  `dialogA11y.ts`) — the audit explicitly flags these as "already good; keep."
- Prefer the WAI-ARIA Authoring Practices Guide canonical patterns over hand-rolled ARIA.
- Each fix is small and component-local; group plans by surface area to enable parallel waves
  while avoiding two plans editing the same file.
</specifics>

<deferred>
## Deferred Ideas

- AAA target sizes (2.5.5 44×44) — not this milestone.
- Tier 6 God-component splits (CostCalculator/JobsManager > 800 lines) — refactor risk,
  excluded from v1.9.
</deferred>

---

*Phase: 35-accessibility-tier-4*
*Context gathered: 2026-06-25 (direct — requirements + audit are the spec)*
