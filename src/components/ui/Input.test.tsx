import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Input } from './Input';

// ---------------------------------------------------------------------------
// Input `decimals` — display-only fixed precision for money inputs.
// Mirrors the app's controlled pattern: value={x || ''} + parseFloat(...) || 0.
// Typing must be untouched while focused; "3.5" shows as "3.50" after blur;
// the stored number is never rounded.
// ---------------------------------------------------------------------------

let container: HTMLDivElement | null = null;
let root: Root | null = null;
let stored: number[] = [];

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  stored = [];
});

afterEach(() => {
  if (root) { act(() => { root!.unmount(); }); root = null; }
  if (container) { container.remove(); container = null; }
});

function MoneyField({ initial = 0, clampMin }: { initial?: number; clampMin?: number }) {
  const [cost, setCost] = useState(initial);
  return (
    <Input
      type="number"
      step="0.01"
      aria-label="Money"
      decimals={2}
      value={cost || ''}
      onChange={e => {
        const parsed = parseFloat(e.target.value) || 0;
        const next = clampMin === undefined ? parsed : Math.max(parsed, clampMin);
        stored.push(next);
        setCost(next);
      }}
    />
  );
}

const input = () => container!.querySelector<HTMLInputElement>('input[aria-label="Money"]')!;

async function render(ui: React.ReactElement) {
  await act(async () => { root!.render(ui); });
}

async function focus() {
  await act(async () => { input().focus(); });
}

async function blur() {
  await act(async () => { input().blur(); });
}

async function type(value: string) {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
    setter.call(input(), value);
    input().dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('Input decimals (money display)', () => {
  it('shows a stored value at 2 decimals when not focused', async () => {
    await render(<MoneyField initial={3.5} />);
    expect(input().value).toBe('3.50');
  });

  it('keeps the typed text while focused, then formats to 2dp on blur', async () => {
    await render(<MoneyField />);
    await focus();
    await type('3.5');
    expect(input().value).toBe('3.5');
    await blur();
    expect(input().value).toBe('3.50');
    expect(stored.at(-1)).toBe(3.5);
  });

  it('does not round the stored value — display only', async () => {
    await render(<MoneyField />);
    await focus();
    await type('1.235');
    await blur();
    expect(input().value).toBe('1.24');
    expect(stored.at(-1)).toBe(1.235);
  });

  it('does not reformat on focus (no jump from "3.50" to "3.5")', async () => {
    await render(<MoneyField initial={3.5} />);
    await focus();
    expect(input().value).toBe('3.50');
  });

  it('does not expose raw floats or extra precision on focus', async () => {
    await render(<MoneyField initial={7.8100000000000005} />);
    await focus();
    expect(input().value).toBe('7.81');
    await blur();
    expect(input().value).toBe('7.81');
  });

  it('keeps a >2dp stored value at its 2dp display on focus (3.456 → "3.46")', async () => {
    await render(<MoneyField initial={3.456} />);
    await focus();
    expect(input().value).toBe('3.46');
  });

  it('treats a NaN parent value (parseFloat("")) as empty', async () => {
    await render(<Input aria-label="Money" type="number" decimals={2} value={NaN || ''} onChange={() => {}} />);
    expect(input().value).toBe('');
  });

  it('allows mid-entry text like "0.0" and an empty field while focused', async () => {
    await render(<MoneyField />);
    await focus();
    await type('0.0');
    expect(input().value).toBe('0.0');
    await type('');
    expect(input().value).toBe('');
    await blur();
    expect(input().value).toBe('');
  });

  it('formats whole numbers on blur ("12" → "12.00")', async () => {
    await render(<MoneyField />);
    await focus();
    await type('12');
    expect(input().value).toBe('12');
    await blur();
    expect(input().value).toBe('12.00');
  });

  it('shows the parent value when the parent changes it mid-entry (e.g. clamping)', async () => {
    await render(<MoneyField clampMin={5} />);
    await focus();
    await type('2');
    expect(input().value).toBe('5');
    await blur();
    expect(input().value).toBe('5.00');
  });

  it('leaves inputs without `decimals` showing the raw value', async () => {
    await render(<Input aria-label="Money" type="number" value={3.5} onChange={() => {}} />);
    expect(input().value).toBe('3.5');
  });
});

describe('Input decimals with non-number values', () => {
  it('formats numeric strings and float noise, passes empty/non-numeric through', async () => {
    const shown = async (value: string | number) => {
      await render(<Input aria-label="Money" decimals={2} value={value} onChange={() => {}} />);
      return input().value;
    };
    expect(await shown('0.1')).toBe('0.10');
    expect(await shown(0.1 + 0.2)).toBe('0.30');
    expect(await shown('')).toBe('');
    expect(await shown('abc')).toBe('abc');
  });
});
