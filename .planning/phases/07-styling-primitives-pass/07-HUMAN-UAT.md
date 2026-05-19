---
status: partial
phase: 07-styling-primitives-pass
source: [07-VERIFICATION.md]
started: 2026-05-19T14:53:00Z
updated: 2026-05-19T14:53:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. SettingsModal — tabs, carrier CRUD, save
expected: All tab switches, carrier add/edit/delete, and Save behave identically to pre-refactor; tab active-state indicator (border-b-2 border-blue-400) visible on selected tab
result: [pending]

### 2. CostCalculator — print name, printer select, license checkbox, cancel
expected: All numeric inputs accept and coerce values (parseFloat) and recalculate totals; per-unit license checkbox toggles cleanly with accent-blue-500 styling; Cancel clears the form
result: [pending]

### 3. AssetLibrary — Add Material, Cancel, custom-category +New/Cancel, submit
expected: Only the explicit submit button submits the form. Cancel and custom-category Cancel close their flows without saving. Required validation triggers when name is empty.
result: [pending]

### 4. PrinterSettings — add/edit/delete printer instance
expected: All CRUD operations work; printer dropdown populates options; nickname input accepts text
result: [pending]

### 5. JobsManager — inline edit, delete, sort/filter
expected: parseInt/parseFloat coercion intact; values persist; row deletes; sort/filter reorders list
result: [pending]

### 6. ImageCarousel — prev/next arrows, dot indicators
expected: Arrows navigate slides; dot indicators reflect active state with dynamic w-6 (active) / w-2.5 (inactive) widths
result: [pending]

### 7. Header — hamburger menu at mobile viewport
expected: Hamburger button opens/closes mobile menu; click-outside dismisses menu; buttonRef forwards correctly through Button primitive
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps
