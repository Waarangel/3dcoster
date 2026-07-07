---
status: complete
phase: 39-cost-realism
source: [39-01-SUMMARY.md, 39-02-SUMMARY.md, 39-03-SUMMARY.md, 39-04-SUMMARY.md, 39-05-SUMMARY.md]
started: 2026-07-07T17:05:00Z
updated: 2026-07-07T17:40:00Z
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
  status: failed
  reason: "User reported: yes but fields are hard to use and colours are off for i icons — band time inputs render as cramped segmented '0 --'/'PM' controls; InfoTooltip icon color inconsistent with surrounding UI"
  severity: minor
  test: 5
  artifacts: []  # Filled by diagnosis
  missing: []    # Filled by diagnosis

- truth: "User can enter a band's HH:MM time window and Add Band activates, enabling TOU bands to be configured and used by the calculator"
  status: failed
  reason: "User reported: cannot use the time entry to make Add Band functional — time input never reaches a state that enables the Add Band button, so TOU bands cannot be created and the calculator TOU path (test 6) is unverifiable"
  severity: major
  test: 6
  artifacts: []  # Filled by diagnosis
  missing: []    # Filled by diagnosis
