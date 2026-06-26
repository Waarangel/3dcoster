import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// App tab bar — A11Y C-01 (WCAG 2.4.3 / WAI-ARIA APG Tabs keyboard contract).
//
// App.tsx wires a large hook/IndexedDB graph that the raw createRoot+act
// harness can't render in isolation, so the roving-tabindex contract is
// verified at the source level — the same pattern SettingsModal.test.tsx uses
// for its focus-target contract. We assert App ports the EXACT proven pattern
// from SettingsModal: a tablist onKeyDown handler with Left/Right wrap +
// Home/End, roving tabIndex (selected = 0, others = -1), and focus moved to the
// newly-selected TAB (not the tabpanel).
// ---------------------------------------------------------------------------

const SRC = readFileSync(resolve(__dirname, 'App.tsx'), 'utf8');

describe('App tab bar roving-tabindex contract (C-01)', () => {
  it('wires an onKeyDown handler on the role="tablist"', () => {
    expect(SRC).toContain('role="tablist"');
    expect(SRC).toContain('onKeyDown={handleTablistKeyDown}');
  });

  it('applies roving tabIndex (selected tab 0, others -1)', () => {
    expect(SRC).toContain('tabIndex={activeTab === tab.id ? 0 : -1}');
  });

  it('handles ArrowRight / ArrowLeft with wraparound', () => {
    expect(SRC).toContain("e.key === 'ArrowRight'");
    expect(SRC).toContain("e.key === 'ArrowLeft'");
    // Modulo wrap on both directions.
    expect(SRC).toContain('(currentIdx + 1) % tabs.length');
    expect(SRC).toContain('(currentIdx - 1 + tabs.length) % tabs.length');
  });

  it('handles Home / End jumps', () => {
    expect(SRC).toContain("e.key === 'Home'");
    expect(SRC).toContain("e.key === 'End'");
    expect(SRC).toContain('nextIdx = tabs.length - 1');
  });

  it('moves focus to the newly-selected TAB, not the tabpanel', () => {
    expect(SRC).toContain('document.getElementById(`tab-${nextTab.id}`)?.focus()');
    // Must not focus the panel on arrow press (the regression SettingsModal hit).
    expect(SRC).not.toContain('app-tabpanel")?.focus()');
  });

  it('preventDefault is called so the page does not scroll on arrow nav', () => {
    expect(SRC).toContain('e.preventDefault()');
  });
});
