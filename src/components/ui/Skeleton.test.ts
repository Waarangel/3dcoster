import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Skeleton } from './Skeleton';

describe('Skeleton', () => {
  // --- UI-05 default render: animate-pulse, bg-slate-700, and role="status" all present ---
  it('Test 1 (UI-05 default render): renders with animate-pulse, bg-slate-700, and role="status"', () => {
    const html = renderToStaticMarkup(React.createElement(Skeleton));
    expect(html).toContain('animate-pulse');
    expect(html).toContain('bg-slate-700');
    expect(html).toMatch(/role="status"/);
  });

  // --- UI-05 line variant: h-4 and rounded classes are present ---
  it('Test 2 (UI-05 line variant): renders h-4 and rounded for line variant', () => {
    const html = renderToStaticMarkup(React.createElement(Skeleton, { variant: 'line' }));
    expect(html).toContain('h-4');
    expect(html).toContain('rounded');
  });

  // --- UI-05 card variant: h-24 and rounded-xl classes are present ---
  it('Test 3 (UI-05 card variant): renders h-24 and rounded-xl for card variant', () => {
    const html = renderToStaticMarkup(React.createElement(Skeleton, { variant: 'card' }));
    expect(html).toContain('h-24');
    expect(html).toContain('rounded-xl');
  });

  // --- UI-05 circle variant: rounded-full class is present ---
  it('Test 4 (UI-05 circle variant): renders rounded-full for circle variant', () => {
    const html = renderToStaticMarkup(React.createElement(Skeleton, { variant: 'circle' }));
    expect(html).toContain('rounded-full');
  });

  // --- UI-05 dimension props: width and height Tailwind classes appear in className ---
  it('Test 5 (UI-05 dimension props): applies width and height Tailwind classes', () => {
    const html = renderToStaticMarkup(React.createElement(Skeleton, { width: 'w-32', height: 'h-6' }));
    expect(html).toContain('w-32');
    expect(html).toContain('h-6');
  });

  // --- UI-05 rounded override: custom rounded class replaces variant default ---
  it('Test 6 (UI-05 rounded override): applies custom rounded class when provided', () => {
    const html = renderToStaticMarkup(React.createElement(Skeleton, { rounded: 'rounded-2xl' }));
    expect(html).toContain('rounded-2xl');
  });

  // --- UI-05 className override: consumer className is appended to root ---
  it('Test 7 (UI-05 className override): appends consumer className to root element', () => {
    const html = renderToStaticMarkup(React.createElement(Skeleton, { className: 'my-custom-class' }));
    expect(html).toContain('my-custom-class');
  });

  // --- WR-01 contract guarantee: consumer overrides REPLACE variant defaults,
  // they do not ride alongside them. A `card` variant with `width="w-12"` must
  // NOT also emit the variant's default `w-full`, and `rounded="rounded-full"`
  // must NOT also emit the variant's default `rounded-xl`.
  it('Test 8 (WR-01 override replacement): width/rounded overrides replace variant defaults', () => {
    const html = renderToStaticMarkup(
      React.createElement(Skeleton, { variant: 'card', width: 'w-12', rounded: 'rounded-full' })
    );
    expect(html).toContain('w-12');
    expect(html).toContain('rounded-full');
    expect(html).not.toContain('w-full');
    expect(html).not.toContain('rounded-xl');
  });

  // --- IN-04 a11y: aria-busy="true" is part of the Skeleton a11y contract
  // per CONTEXT.md. Lock it in so a future refactor that drops the attribute
  // surfaces in CI rather than at UAT.
  it('Test 9 (IN-04 a11y): renders aria-busy="true"', () => {
    const html = renderToStaticMarkup(React.createElement(Skeleton));
    expect(html).toMatch(/aria-busy="true"/);
  });

  // --- IN-04 props spread: SkeletonProps extends HTMLAttributes<HTMLDivElement>
  // and the implementation spreads `...props` onto the root div. Consumers rely
  // on that to pass `id`, `data-testid`, `style`, `aria-*`, etc. Lock the
  // surface in so a future refactor that drops the spread (or wraps it
  // conditionally) surfaces in CI.
  //
  // Two cases:
  //  1. `id` — a strongly typed HTML attribute, validates type-level forwarding.
  //  2. `data-testid` — a `data-*` attribute, validates the loosely typed
  //     surface that React allows via `[key: \`data-${string}\`]`. The spread
  //     is passed in via a typed object literal cast through the React props
  //     contract to avoid TS strict-mode warnings on unknown keys.
  it('Test 10 (IN-04 props spread): forwards arbitrary HTML attributes', () => {
    const extraProps = { 'data-testid': 'sk-1', id: 'sk-id-1' } as React.HTMLAttributes<HTMLDivElement>;
    const html = renderToStaticMarkup(React.createElement(Skeleton, extraProps));
    expect(html).toContain('data-testid="sk-1"');
    expect(html).toContain('id="sk-id-1"');
  });
});
