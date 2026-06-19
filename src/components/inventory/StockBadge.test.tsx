import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import type { ReactElement } from 'react';
import { StockBadge } from './StockBadge';

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root!.unmount());
  container!.remove();
  container = null;
  root = null;
});

function render(ui: ReactElement) {
  act(() => root!.render(ui));
}

const badge = () => container!.querySelector('span');

describe('StockBadge', () => {
  it('renders nothing when stock is not tracked', () => {
    render(<StockBadge stock={null} />);
    expect(container!.textContent).toBe('');
  });

  it('shows the amount with its unit when in stock', () => {
    render(<StockBadge stock={340} unit="g" />);
    expect(badge()!.textContent).toBe('340 g left');
  });

  it('trims fractional stock to one decimal', () => {
    render(<StockBadge stock={12.55} unit="units" />);
    expect(badge()!.textContent).toBe('12.6 units left');
  });

  it('flags low stock with a warning when at/below the threshold', () => {
    render(<StockBadge stock={50} threshold={100} unit="g" />);
    expect(badge()!.textContent).toContain('⚠');
    expect(badge()!.textContent).toContain('50 g left');
    expect(badge()!.className).toContain('amber');
  });

  it('does not flag low when above the threshold', () => {
    render(<StockBadge stock={500} threshold={100} unit="g" />);
    expect(badge()!.textContent).not.toContain('⚠');
    expect(badge()!.className).toContain('slate');
  });

  it('shows out-of-stock (not a negative amount) when stock is <= 0', () => {
    render(<StockBadge stock={-30} threshold={100} unit="g" />);
    expect(badge()!.textContent).toContain('Out of stock');
    expect(badge()!.textContent).toContain('⚠');
    expect(badge()!.className).toContain('red');
  });
});
