// Shape + id-stability test for the Etsy ToS self-review checklist (Phase 14 ETSY-01, ETSY-02).
// The 5 `id` values are LOCKED (D-16) — saved `PrintJob.etsyChecks` state on existing jobs uses these
// exact strings as keys. If anyone renames an id, persisted check state silently orphans, which is why
// this test exists as a tripwire.

import { describe, it, expect } from 'vitest';
import { etsyChecklist, policySummaryAsOf, policyLink } from './etsyToS';

describe('etsyToS', () => {
  it('exports exactly 5 checklist items', () => {
    expect(etsyChecklist).toHaveLength(5);
  });

  it('locks the 5 stable id values (saved etsyChecks state depends on these)', () => {
    expect(etsyChecklist.map(i => i.id)).toEqual([
      'original-design',
      'no-third-party-templates',
      'ip-copyright',
      'production-partner-disclosure',
      'ai-disclosure',
    ]);
  });

  it('exports policy link pointing at etsy.com/legal/creativity', () => {
    expect(policyLink).toMatch(/etsy\.com\/legal\/creativity/);
  });

  it('exports a policySummaryAsOf date string in YYYY-MM-DD form', () => {
    expect(policySummaryAsOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
