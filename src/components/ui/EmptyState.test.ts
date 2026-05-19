import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EmptyState, shouldShowEmptyState } from './EmptyState';

describe('EmptyState', () => {
  // --- UI-04 trigger: loading is true, list empty → suppress empty state ---
  it('Test 1 (UI-04 trigger): shouldShowEmptyState([], true) returns false', () => {
    expect(shouldShowEmptyState([], true)).toBe(false);
  });

  // --- UI-04 trigger: not loading, list empty → show empty state ---
  it('Test 2 (UI-04 trigger): shouldShowEmptyState([], false) returns true', () => {
    expect(shouldShowEmptyState([], false)).toBe(true);
  });

  // --- UI-04 trigger: not loading, list non-empty → suppress empty state ---
  it('Test 3 (UI-04 trigger): shouldShowEmptyState([1], false) returns false', () => {
    expect(shouldShowEmptyState([1], false)).toBe(false);
  });

  // --- UI-04 trigger: loading is true, list non-empty → suppress empty state ---
  it('Test 4 (UI-04 trigger): shouldShowEmptyState([1, 2, 3], true) returns false', () => {
    expect(shouldShowEmptyState([1, 2, 3], true)).toBe(false);
  });

  // --- UI-04 render with cta: title, description, and button are rendered ---
  it('Test 5 (UI-04 render with cta): renders title, description, and a button', () => {
    const html = renderToStaticMarkup(
      React.createElement(EmptyState, {
        icon: null,
        title: 'Test title',
        description: 'Test desc',
        cta: { label: 'Go', onClick: () => {} },
      })
    );
    expect(html).toContain('Test title');
    expect(html).toContain('Test desc');
    expect(html).toContain('<button');
  });

  // --- UI-04 render without cta: button must NOT appear when cta prop omitted ---
  it('Test 6 (UI-04 render without cta): omits the button when cta prop is absent', () => {
    const html = renderToStaticMarkup(
      React.createElement(EmptyState, {
        icon: null,
        title: 'No CTA title',
        description: 'No CTA desc',
      })
    );
    expect(html).toContain('No CTA title');
    expect(html).toContain('No CTA desc');
    expect(html).not.toContain('<button');
  });

  // --- UI-04 render description as ReactNode: <br/> mid-paragraph is preserved ---
  it('Test 7 (UI-04 render description as ReactNode): renders <br/> from description ReactNode', () => {
    const html = renderToStaticMarkup(
      React.createElement(EmptyState, {
        icon: null,
        title: 'BR test',
        description: React.createElement(
          React.Fragment,
          null,
          'A',
          React.createElement('br'),
          'B'
        ),
      })
    );
    expect(html).toContain('<br');
  });
});
