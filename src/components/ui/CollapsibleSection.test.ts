import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CollapsibleSection } from './CollapsibleSection';

describe('CollapsibleSection', () => {
  // --- D-03: defaults to collapsed; body always in DOM but hidden; aria-expanded="false" ---
  // Updated for A11Y-08: body is always rendered (never conditionally mounted) so
  // aria-controls always references a present DOM id; hidden attribute hides it when collapsed.
  it('Test 1 (D-03 collapsed-by-default): body is hidden (not absent) and aria-expanded="false"', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        CollapsibleSection,
        { title: 'Customer' },
        React.createElement('div', null, 'body content')
      )
    );
    expect(html).toContain('Customer');
    // Body is present in DOM but hidden — assert the hidden attribute is set
    expect(html).toContain('body content');
    expect(html).toMatch(/hidden=""/);
    expect(html).toMatch(/aria-expanded="false"/);
  });

  // --- defaultOpen={true}: body IS in DOM; aria-expanded="true" ---
  it('Test 2 (defaultOpen=true exposes body): renders children and aria-expanded="true"', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        CollapsibleSection,
        { title: 'Customer', defaultOpen: true },
        React.createElement('div', null, 'visible body')
      )
    );
    expect(html).toContain('visible body');
    expect(html).toMatch(/aria-expanded="true"/);
  });

  // --- badge slot: NewBadge-like ReactNode is rendered into the relative host ---
  it('Test 3 (badge slot renders): badge prop is rendered alongside the header', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        CollapsibleSection,
        {
          title: 'Customer',
          badge: React.createElement('span', { 'data-testid': 'b' }, 'NEW'),
        },
        React.createElement('div', null, 'body content')
      )
    );
    expect(html).toContain('data-testid="b"');
  });
});
