# Requirements: 3DCoster Multi-Material Support

**Defined:** 2026-04-14
**Core Value:** Accurate cost calculation for multi-material prints

## v1 Requirements

### Data Model

- [x] **DATA-01**: PrintJob stores multiple filaments as `filaments: FilamentUsage[]` replacing single `filamentId`/`filamentGrams`
- [x] **DATA-02**: Each FilamentUsage tracks filamentId, grams, optional pricePerGram override, and currency
- [x] **DATA-03**: Database migration (v4→v5) converts existing single-filament jobs to filaments array
- [x] **DATA-04**: Migration handles edge cases: empty filamentId, missing filamentGrams, undefined values

### G-code Parser

- [ ] **GCODE-01**: Parser extracts all filament types from semicolon-separated `filament_type` line
- [ ] **GCODE-02**: Parser extracts per-extruder weight from `filament used [g]` semicolon-separated values
- [ ] **GCODE-03**: Parser extracts all filament vendors and settings IDs (per-extruder arrays)
- [ ] **GCODE-04**: When only total weight available, first extruder gets total, rest get zero
- [ ] **GCODE-05**: Backward-compatible single fields remain as first-element aliases

### Import

- [ ] **IMPORT-01**: GcodeImport passes filaments array (not single filamentId) to CostCalculator
- [ ] **IMPORT-02**: Each imported filament is auto-matched independently against user's asset library
- [ ] **IMPORT-03**: Success toast shows all detected materials with weights

### Calculator UI

- [ ] **UI-01**: Form shows one filament row by default with FilamentSelector + grams input
- [ ] **UI-02**: "+" button adds additional filament rows (max 16)
- [ ] **UI-03**: Remove button on each row except the first
- [ ] **UI-04**: Each row has independent price/currency override
- [ ] **UI-05**: At least one filament must be selected for validation to pass

### Cost Calculation

- [ ] **COST-01**: Filament cost sums `grams * pricePerGram` across all filaments
- [ ] **COST-02**: Nozzle wear uses per-material density (not hardcoded PLA) via exported `getMaterialDensity`
- [ ] **COST-03**: Price override persisted on saved job for historical accuracy

### Jobs Display

- [ ] **JOBS-01**: JobsManager shows all filaments per job (e.g., "PETG 200g + PLA 50g")
- [ ] **JOBS-02**: Editing a job restores all filament rows with correct price fallback

### Persistence

- [ ] **PERSIST-01**: Session storage persists multi-filament form state
- [ ] **PERSIST-02**: Old session storage format (single filament) gracefully falls back to default

## v2 Requirements

### Cost Display

- **DISPLAY-01**: Per-filament cost breakdown in CostBreakdown summary
- **DISPLAY-02**: Filament usage analytics across saved jobs

### Inventory

- **INV-01**: AMS slot tracking / filament inventory management
- **INV-02**: Remaining spool weight tracking with alerts

## Out of Scope

| Feature | Reason |
|---------|--------|
| Backend sync | No backend exists, all data local |
| Per-filament CostBreakdown detail | Total sufficient for v1, adds UI complexity |
| AMS slot management | Separate feature, not cost calculation |
| Filament inventory/spool tracking | Separate feature |
| 3MF file import | Current parser uses gcode only |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DATA-01 | Phase 1 | Complete |
| DATA-02 | Phase 1 | Complete |
| DATA-03 | Phase 1 | Complete |
| DATA-04 | Phase 1 | Complete |
| GCODE-01 | Phase 2 | Pending |
| GCODE-02 | Phase 2 | Pending |
| GCODE-03 | Phase 2 | Pending |
| GCODE-04 | Phase 2 | Pending |
| GCODE-05 | Phase 2 | Pending |
| IMPORT-01 | Phase 3 | Pending |
| IMPORT-02 | Phase 3 | Pending |
| IMPORT-03 | Phase 3 | Pending |
| UI-01 | Phase 3 | Pending |
| UI-02 | Phase 3 | Pending |
| UI-03 | Phase 3 | Pending |
| UI-04 | Phase 3 | Pending |
| UI-05 | Phase 3 | Pending |
| COST-01 | Phase 3 | Pending |
| COST-02 | Phase 3 | Pending |
| COST-03 | Phase 3 | Pending |
| JOBS-01 | Phase 4 | Pending |
| JOBS-02 | Phase 4 | Pending |
| PERSIST-01 | Phase 3 | Pending |
| PERSIST-02 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 24 total
- Mapped to phases: 24
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-14*
*Last updated: 2026-04-14 after roadmap creation*
