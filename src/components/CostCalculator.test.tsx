import { describe, it } from 'vitest';

// ---------------------------------------------------------------------------
// CostCalculator — Generate PDF surface retired (Phase 16 gap closure, D-13)
// The PDF button subcomponent and its 4 disabled-state tests were removed here
// in 16-06 because the CostCalculator no longer surfaces PDF generation.
// The only PDF entry point is the Print Quote modal in JobsManager (D-14 + D-18).
// Tests for that surface live in JobsManager.test.tsx.
// ---------------------------------------------------------------------------

describe('CostCalculator', () => {
  it.todo('CostCalculator tests TBD — PDF button retired per D-13');
});
