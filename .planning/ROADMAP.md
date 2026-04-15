# Roadmap: 3DCoster Multi-Material Support

## Overview

This milestone upgrades 3DCoster from single-filament to multi-material tracking. The work follows a strict dependency chain: the data model must ship first (everything compiles against it), then the G-code parser (which produces the array shape the UI consumes), then the full calculator UI and import wiring (the largest phase), and finally the jobs display (completes end-to-end visibility of saved multi-material jobs).

## Phases

- [x] **Phase 1: Data Foundation** - New FilamentUsage type, updated PrintJob shape, and v4->v5 database migration (completed 2026-04-14)
- [x] **Phase 2: G-code Parser** - Extract all filaments from semicolon-separated slicer output instead of discarding extras (completed 2026-04-14)
- [x] **Phase 3: Calculator UI + Import** - Multi-filament form rows, cost/nozzle calculations, import wiring, session persistence (completed 2026-04-15)
- [x] **Phase 4: Jobs Display** - JobsManager shows all filaments per job; edit restores full filament array (completed 2026-04-15)
- [ ] **Phase 5: Printer Maintenance Alerts** - Track print hours and warn at 500h maintenance intervals
- [ ] **Phase 6: 3MF Multi-Plate Project Import** - Import sliced 3MF files for total multi-plate project costing

## Phase Details

### Phase 1: Data Foundation
**Goal**: The data layer supports multiple filaments per job, and all existing jobs are migrated without data loss
**Depends on**: Nothing (first phase)
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04
**Success Criteria** (what must be TRUE):
  1. TypeScript compiles with the new FilamentUsage type and PrintJob no longer has filamentId/filamentGrams fields
  2. Opening the app after migration does not throw errors and existing jobs are visible with their filament data intact
  3. Jobs that previously had no filament selected migrate to an empty filaments array without crashing
  4. Jobs that previously had a filament selected migrate to a single-element filaments array with correct grams preserved
**Plans**: 1 plan

Plans:
- [x] 01-01-PLAN.md — Add FilamentUsage type, update PrintJob, write Dexie v4->v5 migration

### Phase 2: G-code Parser
**Goal**: The parser extracts all filaments from multi-material G-code instead of silently discarding extras
**Depends on**: Phase 1
**Requirements**: GCODE-01, GCODE-02, GCODE-03, GCODE-04, GCODE-05
**Success Criteria** (what must be TRUE):
  1. Importing a Bambu Studio multi-color G-code file yields filamentTypes[], filamentVendors[], filamentSettingsIds[], and filamentGramsPerExtruder[] arrays with correct element counts
  2. Importing a single-material G-code file produces single-element arrays; existing single-field aliases (filamentType, filamentGrams) are unchanged
  3. When only total filament weight is present (Bambu header only), the first extruder receives the total and remaining extruders receive zero
  4. getMaterialDensity is exported from gcodeParser.ts and usable by other modules
**Plans**: 1 plan

Plans:
- [x] 02-01-PLAN.md — Extend GcodeParseResult with array fields, update all slicer parsers, export getMaterialDensity

### Phase 3: Calculator UI + Import
**Goal**: Users can enter, import, and save multi-material jobs with accurate per-filament cost and nozzle wear calculations
**Depends on**: Phase 2
**Requirements**: UI-01, UI-02, UI-03, UI-04, UI-05, COST-01, COST-02, COST-03, IMPORT-01, IMPORT-02, IMPORT-03, PERSIST-01, PERSIST-02
**Success Criteria** (what must be TRUE):
  1. The calculator form shows one filament row by default; a "+" button adds up to 16 rows; each row except the first has a remove button
  2. Each filament row has its own material selector, gram input, and price/currency override that save independently to the job record
  3. Importing a multi-material G-code file populates all detected filament rows with matched assets and correct grams; the success toast lists all materials with weights
  4. Filament cost is the sum of (grams × pricePerGram) across all rows, and nozzle wear uses the correct density for each material instead of assuming PLA
  5. Refreshing the page restores the full multi-filament form state; old single-filament session storage falls back to the default single empty row without errors
**Plans**: 3 plans

Plans:
- [x] 03-01-PLAN.md — GcodeImport multi-material: widen onImport to filaments array, per-extruder matching, stacked toast
- [x] 03-02-PLAN.md — CostCalculator state refactor: replace scalar filament state with FilamentRow[] array, dynamic row UI
- [x] 03-03-PLAN.md — Cost calculation, save/restore, import wiring, session persistence with backward-compat fallback

### Phase 4: Jobs Display
**Goal**: Saved multi-material jobs are fully visible and editable in the jobs list
**Depends on**: Phase 3
**Requirements**: JOBS-01, JOBS-02
**Success Criteria** (what must be TRUE):
  1. The jobs list shows all filaments for a multi-material job (e.g., "PETG 200g + PLA 50g") and shows the single filament for single-material jobs in the same format as today
  2. Clicking edit on any saved job (including jobs migrated from the old schema) restores all filament rows with correct gram values and price overrides (or asset-library fallback for migrated jobs)
**Plans**: 1 plan

Plans:
- [x] 04-01-PLAN.md — Harden filament display edge cases in JobsManager, verify edit-restore round-trip

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Data Foundation | 1/1 | Complete   | 2026-04-14 |
| 2. G-code Parser | 1/1 | Complete | 2026-04-14 |
| 3. Calculator UI + Import | 3/3 | Complete | 2026-04-15 |
| 4. Jobs Display | 1/1 | Complete | 2026-04-15 |
| 5. Printer Maintenance Alerts | 0/1 | In progress | - |
| 6. 3MF Multi-Plate Project Import | 0/? | Not started | - |

### Phase 5: Printer Maintenance Alerts
**Goal**: Track accumulated print hours per printer instance and alert users at 500-hour maintenance intervals with a dismissable popup
**Depends on**: Nothing (uses existing PrinterInstance.printHours infrastructure)
**Requirements**: MAINT-01, MAINT-02
**Success Criteria** (what must be TRUE):
  1. When a printer's accumulated printHours crosses a 500-hour interval (500, 1000, 1500, etc.), a popup/toast warns the user that maintenance is due for that printer
  2. The maintenance alert is dismissable and does not re-trigger for the same interval after acknowledgment
**Plans**: 1 plan

Plans:
- [ ] 05-01-PLAN.md — Maintenance alert modal, boundary detection in handleSaveJob, localStorage dismissed state

### Phase 6: 3MF Multi-Plate Project Import
**Goal**: Users can import a sliced Bambu Studio / OrcaSlicer 3MF file to get total project cost across all build plates in a single import
**Depends on**: Nothing (new import path alongside existing gcode import)
**Requirements**: 3MF-01, 3MF-02, 3MF-03, 3MF-04
**Success Criteria** (what must be TRUE):
  1. Dropping a sliced 3MF file (Bambu/Orca) extracts per-plate filament grams, filament types, and print times from slice_info.config
  2. The import sums filament usage and print time across all plates and populates the calculator with the project totals
  3. Importing a non-sliced 3MF (geometry-only) shows a helpful error message explaining that the file needs to be sliced first
  4. The number of plates is displayed so the user knows this is a multi-plate project
**Plans**: TBD
