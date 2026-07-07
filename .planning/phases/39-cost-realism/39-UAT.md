---
status: complete
phase: 39-cost-realism
source: [39-01-SUMMARY.md, 39-02-SUMMARY.md, 39-03-SUMMARY.md, 39-04-SUMMARY.md, 39-05-SUMMARY.md]
started: 2026-07-07T17:05:00Z
updated: 2026-07-07T18:10:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: App loads fresh with no console errors. The Dexie v12 migration (two new stores) runs silently — all existing data (jobs, filaments, printers, sales) is intact. Calculator opens and prices a job exactly as before.
result: pass

### 2. Log a failure from a job
expected: Jobs tab shows a per-row "log failure" icon action. Clicking it opens a modal pre-filled with the job's printer/material. Set % completion, pick a reason, save — a toastless clean save, and the wasted filament is deducted from stock (visible in the material's stock level).
result: pass

### 3. Failures ledger in Reports
expected: Reports tab has a Failures section listing logged failures (printer, material, % completion, reason, date). A standalone "Log failure" action exists for failures not tied to a saved job. Notes render as plain text.
result: pass

### 4. Empirical failure-rate suggestion in calculator
expected: With ≥1 failure logged, the calculator's failure-rate field shows a suggestion hint ("your real rate is X% from N prints") beside the manual input — no layout shift. Clicking Apply copies the (0-99 clamped) rate into the field; the manual value stays authoritative until you Apply.
result: pass

### 5. TOU tariff editor in Settings
expected: Settings has a time-of-use electricity section: flat rate default plus up to 3 named bands (rate + HH:MM window). Adding a 4th band is prevented; overlapping windows are rejected with an inline error message; malformed times can't be saved.
result: issue
reported: "yes but fields are hard to use and colours are off for i icons (screenshot: band time inputs render as cramped '0 --' / 'PM' segments with clock icons)"
severity: minor

### 6. TOU electricity in the calculator
expected: With TOU bands configured, the calculator shows a print start-time picker. Setting a start time inside a cheaper band lowers the electricity cost line accordingly (overnight-spanning prints weight across bands). Leaving start time empty uses the flat rate. Saved jobs keep the rate they were saved with — editing tariffs later does NOT reprice history.
result: issue
reported: "not sure, cannot use the time entry to make Add Band functional"
severity: major

### 7. Log maintenance + per-printer drill-in
expected: Printer Settings has a per-printer Maintenance section. Log an event (part type, cost, date, printer-hours — nozzle events also ask nozzle type). The drill-in lists history and shows a predicted next swap once there's enough history. Save errors (if any) show a visible message, not a silent failure.
result: pass

### 8. Maintenance $/hr + abrasive surcharge in calculator
expected: With maintenance history, the calculator shows an amortized maintenance $/hr hint with Apply. Applied maintenance cost appears as its own labeled line in the cost breakdown. A CF/GF filament on a brass nozzle shows an abrasive wear surcharge line; marking that filament "Not abrasive" in the Asset Library override removes it.
result: pass

## Summary

total: 8
passed: 6
issues: 2
pending: 0
skipped: 0

## Gaps

- truth: "TOU band editor fields (HH:MM windows) are easy to use and info icons match the app's icon color conventions"
  status: resolved
  reason: "User reported: yes but fields are hard to use and colours are off for i icons — band time inputs render as cramped segmented '0 --'/'PM' controls; InfoTooltip icon color inconsistent with surrounding UI"
  severity: minor
  test: 5
  root_cause: "Native <input type='time'> renders as a segmented hh:mm AM/PM control with an embedded clock picker icon. (a) Width: the add-band grid gives each time input a 5rem (80px) column (SettingsModal.tsx:385) while the Input's md size eats 24px in px-3 padding (Input.tsx:16) — Chrome's 12h-locale time control needs ~90-110px, so the minute/AM-PM segments and picker icon clip into the '0 --' / 'PM' fragments in the screenshot. Edit-mode rows (SettingsModal.tsx:344-355) use compact (max-w-28 = 112px), still cramped. (b) Colors: no color-scheme:dark is declared anywhere in the app (index.html has only meta theme-color; no CSS targets ::-webkit-calendar-picker-indicator), so Chrome paints the input's internal clock icon and placeholder segments in default LIGHT-scheme colors — a near-black glyph on bg-slate-700, which reads as 'colours are off' for the in-field icons. The ⓘ InfoTooltip itself (InfoTooltip.tsx:33, text-slate-400) is the shared convention used by every other Settings field — the off-color icons are the native clock glyphs beside it."
  artifacts:
    - "src/components/SettingsModal.tsx:385 — grid-cols-[1fr_4rem_5rem_5rem_auto] gives time inputs only 5rem columns"
    - "src/components/SettingsModal.tsx:400-411 — new-band window inputs use native type='time' with compact"
    - "src/components/SettingsModal.tsx:344-355 — edit-mode band rows, same type='time' compact pattern"
    - "src/components/ui/Input.tsx:16,25 — md px-3 py-2 padding + compact max-w-28; no time-specific styling"
    - "index.html:8 — only meta theme-color; no color-scheme:dark anywhere in src (verified by grep)"
    - "src/components/calculator/CostParametersSection.tsx:195-201 — calculator start-time picker uses the identical type='time' compact pattern and inherits the dark-icon problem"
  missing:
    - "Time window inputs need adequate width (widen grid columns to fit the full segmented control, or drop compact/reduce padding for type='time')"
    - "Declare color-scheme: dark for time inputs (e.g. global input[type='time'] { color-scheme: dark } or Tailwind [color-scheme:dark]) so segments and the picker icon render for the dark UI — apply app-wide so CostParametersSection's picker is fixed too"
    - "Alternatively (fixes gap 2 as well): replace native time inputs with plain text inputs (placeholder '22:00') validated by the already-strict parseHHMM in upsertBand"

- truth: "User can enter a band's HH:MM time window and Add Band activates, enabling TOU bands to be configured and used by the calculator"
  status: resolved
  reason: "User reported: cannot use the time entry to make Add Band functional — time input never reaches a state that enables the Add Band button, so TOU bands cannot be created and the calculator TOU path (test 6) is unverifiable"
  severity: major
  test: 6
  root_cause: "Three-link chain: (1) a native <input type='time'> exposes .value === '' until EVERY segment (hour, minute, AND AM/PM in 12h locales) is complete — partial entry fires no change event carrying a value, so newBandStart/newBandEnd stay ''. (2) The 5rem grid column (SettingsModal.tsx:385) clips the minute/AM-PM segments and picker icon out of the visible/clickable area (gap 1), so the user cannot complete the segments they cannot see or reach. (3) The '+ Add band' button is hard-gated on non-empty state — disabled={!newBandName.trim() || !newBandRate || !newBandStart || !newBandEnd} (SettingsModal.tsx:414) — so it stays permanently disabled. There is no feedback loop: bandError (SettingsModal.tsx:422) is only set inside handleAddTouBand (SettingsModal.tsx:62-80), which can never run because the button never enables — the user gets a dead button with zero explanation. The validation layer itself is NOT at fault: a completed native time input yields 24h 'HH:MM' which parseHHMM (touElectricity.ts:23-31) accepts, and useTouTariff.upsertBand (useTouTariff.ts:58-86) would pass it — the blocker is purely the widget/gating UX. Because no band can be created, the calculator's start-time picker (CostParametersSection.tsx:189, rendered only when touBandsConfigured) never appears and the whole TOU pricing path is unverifiable."
  artifacts:
    - "src/components/SettingsModal.tsx:414 — disabled gate requires all four fields non-empty with no explanation when unmet"
    - "src/components/SettingsModal.tsx:400-411 — native type='time' inputs whose value is all-or-nothing"
    - "src/components/SettingsModal.tsx:385 — 5rem grid columns clip the segments the gate depends on"
    - "src/components/SettingsModal.tsx:62-80 — handleAddTouBand is the only place bandError is set; unreachable while the button is disabled"
    - "src/components/SettingsModal.test.tsx:412-464 — TOU tests only cover render/hide-at-3/remove; nothing types into the time inputs or clicks '+ Add band', and JSDOM has no segmented time control or layout, so neither the empty-value trap nor the 5rem clipping could ever surface in tests"
  missing:
    - "Make the time window entry completable: widen the inputs (gap 1) AND/OR replace native type='time' with plain text HH:MM inputs (placeholder '22:00') so entry is atomic and validated by the existing strict parseHHMM/upsertBand path"
    - "Replace the silent disabled gate with feedback: either keep the button enabled and surface upsertBand's validation message via bandError, or show an inline hint explaining what is still required while disabled"
    - "Add a browser-level (Playwright) or userEvent-driven test that actually completes the add-band flow — the current component tests structurally cannot catch this failure class"

# Both gaps resolved by gap-closure plan 39-06 (commits 51fce5d..8acc0cf) + delta review fixes CR-04/WR-09/WR-10 (998a6be, 705e30a, 610d9a9). Re-verified: 39-VERIFICATION.md status passed 2026-07-07.
