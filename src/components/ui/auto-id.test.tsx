import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Input } from './Input';
import { Textarea } from './Textarea';
import { Select } from './Select';

// ---------------------------------------------------------------------------
// UI primitive auto-id — A11Y-07 foundation (Phase 19 Plan 02)
// Asserts the priority-ordering contract: consumer-supplied id always wins;
// generated id (via useId()) is the fallback when no id is supplied.
// ---------------------------------------------------------------------------

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  if (root) {
    act(() => { root!.unmount(); });
    root = null;
  }
  if (container) {
    container.remove();
    container = null;
  }
});

describe('UI primitive auto-id (A11Y-07 foundation)', () => {
  // -------------------------------------------------------------------------
  // Input
  // -------------------------------------------------------------------------

  it('Input: consumer-supplied id wins', () => {
    act(() => { root!.render(<Input id="custom-id" />); });
    const input = container!.querySelector('input');
    expect(input?.getAttribute('id')).toBe('custom-id');
  });

  it('Input: generates a non-empty id when none is supplied', () => {
    act(() => { root!.render(<Input />); });
    const input = container!.querySelector('input');
    const id = input?.getAttribute('id');
    expect(id).toBeTruthy();
    expect(id?.length ?? 0).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // Textarea
  // -------------------------------------------------------------------------

  it('Textarea: consumer-supplied id wins', () => {
    act(() => { root!.render(<Textarea id="custom-id" />); });
    const textarea = container!.querySelector('textarea');
    expect(textarea?.getAttribute('id')).toBe('custom-id');
  });

  it('Textarea: generates a non-empty id when none is supplied', () => {
    act(() => { root!.render(<Textarea />); });
    const textarea = container!.querySelector('textarea');
    const id = textarea?.getAttribute('id');
    expect(id).toBeTruthy();
    expect(id?.length ?? 0).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // Select
  // -------------------------------------------------------------------------

  it('Select: consumer-supplied id wins', () => {
    act(() => {
      root!.render(<Select id="custom-id"><option value="">--</option></Select>);
    });
    const select = container!.querySelector('select');
    expect(select?.getAttribute('id')).toBe('custom-id');
  });

  it('Select: generates a non-empty id when none is supplied', () => {
    act(() => {
      root!.render(<Select><option value="">--</option></Select>);
    });
    const select = container!.querySelector('select');
    const id = select?.getAttribute('id');
    expect(id).toBeTruthy();
    expect(id?.length ?? 0).toBeGreaterThan(0);
  });
});
