import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { useCustomerPicker, PICKER_VISIBLE_LIMIT } from './useCustomerPicker';
import type { Customer } from '../types';

// ---------------------------------------------------------------------------
// useCustomerPicker — Phase 22 plan 22-01 hook unit tests.
//
// Test strategy: raw createRoot + act + DOM dispatch. No third-party render-
// hook library (project precedent — see PrintQuoteModal.test.tsx). PickerHarness is a thin
// function component that mounts the hook and exposes its return shape via
// data-testid spans/buttons so each `it(...)` block can read the post-event
// state without touching React internals.
//
// Covers the 14 behaviors locked in 22-01-PLAN.md <behavior>:
//   1. Return shape — 11 keys present
//   2. filteredCustomers empty on blank query (D-02)
//   3. filteredCustomers matches name OR email substring case-insensitive
//   4. visibleCustomers sliced to PICKER_VISIBLE_LIMIT (=8)
//   5. ArrowDown opens + cycles forward
//   6. ArrowDown no-op when visibleCustomers empty (WR-04)
//   7. ArrowUp wraps last → first → last
//   8. Enter with active match calls onPick + resets state
//   9. Enter with no match closes without calling onPick
//  10. Escape closes AND calls stopPropagation (CR-04)
//  11. Tab closes without auto-picking
//  12. pick(c) calls onPick + resets state
//  13. reset() clears state without calling onPick
//  14. PICKER_VISIBLE_LIMIT === 8 named export
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Fixtures + harness
// ---------------------------------------------------------------------------

function makeCustomer(overrides: Partial<Customer> & { id: string }): Customer {
  return {
    createdAt: new Date('2026-01-01'),
    ...overrides,
  } as Customer;
}

function PickerHarness({
  customers,
  onPick,
}: {
  customers: Customer[];
  onPick: (c: Customer) => void;
}) {
  const {
    query,
    open,
    activeIndex,
    visibleCustomers,
    filteredCustomers,
    setQuery,
    handleKeyDown,
    pick,
    reset,
  } = useCustomerPicker(customers, { onPick });

  return (
    <div>
      <input
        data-testid="picker-input"
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <span data-testid="query">{query}</span>
      <span data-testid="open">{String(open)}</span>
      <span data-testid="active-index">{String(activeIndex)}</span>
      <span data-testid="filtered-count">{filteredCustomers.length}</span>
      <span data-testid="visible-count">{visibleCustomers.length}</span>
      <button data-testid="reset" onClick={() => reset()} type="button">reset</button>
      {visibleCustomers.map(c => (
        <button
          key={c.id}
          data-testid={`option-${c.id}`}
          onClick={() => pick(c)}
          type="button"
        >
          {c.name}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DOM harness
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
    act(() => {
      root!.unmount();
    });
    root = null;
  }
  if (container) {
    container.remove();
    container = null;
  }
});

function render(customers: Customer[], onPick: (c: Customer) => void) {
  act(() => {
    root!.render(<PickerHarness customers={customers} onPick={onPick} />);
  });
}

function input(): HTMLInputElement {
  const el = container!.querySelector('[data-testid="picker-input"]');
  if (!el) throw new Error('picker-input not found');
  return el as HTMLInputElement;
}

function readText(testid: string): string {
  const el = container!.querySelector(`[data-testid="${testid}"]`);
  if (!el) throw new Error(`${testid} not found`);
  return el.textContent ?? '';
}

function setQuery(value: string) {
  const el = input();
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )?.set;
  act(() => {
    setter?.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function fireKeyDown(key: string) {
  act(() => {
    input().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  });
}

function clickOption(id: string) {
  const el = container!.querySelector(`[data-testid="option-${id}"]`);
  if (!el) throw new Error(`option-${id} not found`);
  act(() => {
    (el as HTMLButtonElement).click();
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useCustomerPicker', () => {
  it('Test 1: returns object with all 11 keys', () => {
    let captured: ReturnType<typeof useCustomerPicker> | null = null;
    function CapturingHarness() {
      captured = useCustomerPicker([], { onPick: vi.fn() });
      return null;
    }
    act(() => {
      root!.render(<CapturingHarness />);
    });
    expect(captured).not.toBeNull();
    const expectedKeys = [
      'query',
      'open',
      'activeIndex',
      'visibleCustomers',
      'filteredCustomers',
      'setQuery',
      'setOpen',
      'setActiveIndex',
      'handleKeyDown',
      'pick',
      'reset',
    ];
    for (const k of expectedKeys) {
      expect(captured).toHaveProperty(k);
    }
    expect(Object.keys(captured!).sort()).toEqual([...expectedKeys].sort());
  });

  it('Test 2: filteredCustomers is empty when query trim() is empty', () => {
    const customers = [
      makeCustomer({ id: 'a', name: 'Alice', email: 'a@x.com' }),
      makeCustomer({ id: 'b', name: 'Bob', email: 'b@x.com' }),
    ];
    render(customers, vi.fn());
    expect(readText('filtered-count')).toBe('0');
    // Whitespace-only query still empty (trim guard)
    setQuery('   ');
    expect(readText('filtered-count')).toBe('0');
  });

  it('Test 3: filteredCustomers matches by name OR email substring (case-insensitive)', () => {
    const customers = [
      makeCustomer({ id: 'a', name: 'Alice', email: 'alice@example.com' }),
      makeCustomer({ id: 'b', name: 'Bob', email: 'ali@example.com' }),
      makeCustomer({ id: 'c', name: 'Charlie', email: 'charlie@example.com' }),
    ];
    render(customers, vi.fn());
    setQuery('ali');
    // 'Alice' matches by name, 'Bob' matches by email 'ali@...' — both included.
    expect(readText('filtered-count')).toBe('2');
    expect(container!.querySelector('[data-testid="option-a"]')).not.toBeNull();
    expect(container!.querySelector('[data-testid="option-b"]')).not.toBeNull();
    expect(container!.querySelector('[data-testid="option-c"]')).toBeNull();

    // Case-insensitivity
    setQuery('CHAR');
    expect(readText('filtered-count')).toBe('1');
    expect(container!.querySelector('[data-testid="option-c"]')).not.toBeNull();
  });

  it('Test 4: visibleCustomers slices filteredCustomers to PICKER_VISIBLE_LIMIT', () => {
    // 12 matching customers, all named "Match N"
    const customers = Array.from({ length: 12 }, (_, i) =>
      makeCustomer({ id: `c-${i}`, name: `Match${i}`, email: `m${i}@x.com` }),
    );
    render(customers, vi.fn());
    setQuery('match');
    expect(readText('filtered-count')).toBe('12');
    expect(readText('visible-count')).toBe(String(PICKER_VISIBLE_LIMIT));
    expect(PICKER_VISIBLE_LIMIT).toBe(8);
  });

  it('Test 5: ArrowDown opens picker and advances activeIndex with wrap', () => {
    const customers = [
      makeCustomer({ id: 'a', name: 'Alice' }),
      makeCustomer({ id: 'b', name: 'Bob' }),
      makeCustomer({ id: 'c', name: 'Charlie' }),
    ];
    render(customers, vi.fn());
    setQuery('a');
    // Just typing doesn't open the dropdown (matches Phase 15.1 behavior — only ArrowDown opens it)
    expect(readText('open')).toBe('false');

    fireKeyDown('ArrowDown');
    expect(readText('open')).toBe('true');
    expect(readText('active-index')).toBe('0');

    fireKeyDown('ArrowDown');
    expect(readText('active-index')).toBe('1');

    // Wrap from last → first
    // Filter "a" matches Alice + Charlie (both contain "a"); also Bob has no "a" in name/email
    // — match count depends on email defaults. Use a broader query for predictable wrap test.
    setQuery(''); // reset
    setQuery('e'); // matches Alice + Charlie
    fireKeyDown('ArrowDown'); // opens, activeIndex=0
    fireKeyDown('ArrowDown'); // activeIndex=1
    fireKeyDown('ArrowDown'); // wrap to 0
    expect(readText('active-index')).toBe('0');
  });

  it('Test 6: ArrowDown is a no-op when visibleCustomers is empty (WR-04)', () => {
    const customers = [makeCustomer({ id: 'a', name: 'Alice' })];
    render(customers, vi.fn());
    setQuery('zzz-no-match');
    expect(readText('filtered-count')).toBe('0');
    expect(readText('visible-count')).toBe('0');
    expect(readText('open')).toBe('false');

    fireKeyDown('ArrowDown');
    // WR-04: empty dropdown must NOT open
    expect(readText('open')).toBe('false');
    expect(readText('active-index')).toBe('0');
  });

  it('Test 7: ArrowUp wraps first → last', () => {
    const customers = [
      makeCustomer({ id: 'a', name: 'Alice' }),
      makeCustomer({ id: 'b', name: 'Bobi' }),
      makeCustomer({ id: 'c', name: 'Charli' }),
    ];
    render(customers, vi.fn());
    setQuery('i'); // matches Alice, Bobi, Charli
    expect(readText('filtered-count')).toBe('3');

    fireKeyDown('ArrowDown'); // open, activeIndex=0
    expect(readText('active-index')).toBe('0');
    fireKeyDown('ArrowUp');
    // wrap 0 → 2 (last)
    expect(readText('active-index')).toBe('2');
  });

  it('Test 8: Enter while open with active match calls onPick and resets state', () => {
    const onPick = vi.fn();
    const customers = [
      makeCustomer({ id: 'a', name: 'Alice', email: 'a@x.com' }),
      makeCustomer({ id: 'b', name: 'Alice2', email: 'b@x.com' }),
    ];
    render(customers, onPick);
    setQuery('alice');
    fireKeyDown('ArrowDown'); // open, activeIndex=0
    fireKeyDown('Enter');
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith(customers[0]);
    // Reset state per D-04
    expect(readText('query')).toBe('');
    expect(readText('open')).toBe('false');
    expect(readText('active-index')).toBe('0');
  });

  it('Test 9: Enter while open with no visibleCustomers[activeIndex] closes dropdown without calling onPick', () => {
    // Build a flow where open=true but visibleCustomers becomes empty afterwards.
    // Simpler approach matching production behavior: open is true via ArrowDown
    // after a match, then user types a non-matching query (state remains open=true
    // with non-empty trimmed query but visibleCustomers empty). Enter then closes.
    const onPick = vi.fn();
    const customers = [makeCustomer({ id: 'a', name: 'Alice', email: 'a@x.com' })];
    render(customers, onPick);
    setQuery('alice');
    fireKeyDown('ArrowDown'); // open, activeIndex=0
    expect(readText('open')).toBe('true');

    // User now types a non-matching query — open stays true, visibleCustomers empties.
    setQuery('zzz-no-match');
    expect(readText('visible-count')).toBe('0');
    expect(readText('open')).toBe('true');

    fireKeyDown('Enter');
    expect(onPick).not.toHaveBeenCalled();
    // WR-01 branch — no match + non-empty trimmed query => close dropdown
    expect(readText('open')).toBe('false');
  });

  it('Test 10: Escape while open closes dropdown AND calls stopPropagation (CR-04)', () => {
    const onPick = vi.fn();
    const customers = [makeCustomer({ id: 'a', name: 'Alice' })];
    render(customers, onPick);
    setQuery('alice');
    fireKeyDown('ArrowDown');
    expect(readText('open')).toBe('true');

    // Spy on KeyboardEvent.prototype.stopPropagation so we can detect the call
    // path through React's synthetic event wrapper.
    const stopSpy = vi.spyOn(Event.prototype, 'stopPropagation');
    fireKeyDown('Escape');
    expect(readText('open')).toBe('false');
    expect(stopSpy).toHaveBeenCalled();
    stopSpy.mockRestore();
    expect(onPick).not.toHaveBeenCalled();
  });

  it('Test 11: Tab closes dropdown without auto-picking', () => {
    const onPick = vi.fn();
    const customers = [
      makeCustomer({ id: 'a', name: 'Alice' }),
      makeCustomer({ id: 'b', name: 'Alex' }),
    ];
    render(customers, onPick);
    setQuery('al');
    fireKeyDown('ArrowDown'); // open
    expect(readText('open')).toBe('true');

    fireKeyDown('Tab');
    expect(readText('open')).toBe('false');
    expect(onPick).not.toHaveBeenCalled();
  });

  it('Test 12: pick(c) invokes onPick then resets state', () => {
    const onPick = vi.fn();
    const customers = [
      makeCustomer({ id: 'a', name: 'Alice', email: 'a@x.com' }),
      makeCustomer({ id: 'b', name: 'Alex', email: 'b@x.com' }),
    ];
    render(customers, onPick);
    setQuery('al');
    fireKeyDown('ArrowDown'); // open dropdown so options render
    expect(readText('open')).toBe('true');

    clickOption('b');
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith(customers[1]);
    expect(readText('query')).toBe('');
    expect(readText('open')).toBe('false');
    expect(readText('active-index')).toBe('0');
  });

  it('Test 13: reset() clears state without calling onPick', () => {
    const onPick = vi.fn();
    const customers = [makeCustomer({ id: 'a', name: 'Alice' })];
    render(customers, onPick);
    setQuery('al');
    fireKeyDown('ArrowDown');
    expect(readText('query')).toBe('al');
    expect(readText('open')).toBe('true');

    const resetBtn = container!.querySelector('[data-testid="reset"]') as HTMLButtonElement;
    act(() => {
      resetBtn.click();
    });
    expect(readText('query')).toBe('');
    expect(readText('open')).toBe('false');
    expect(readText('active-index')).toBe('0');
    expect(onPick).not.toHaveBeenCalled();
  });

  it('Test 14: PICKER_VISIBLE_LIMIT === 8 is exported as a named constant', () => {
    expect(PICKER_VISIBLE_LIMIT).toBe(8);
    // Type-level check (runtime): must be a number, not a function
    expect(typeof PICKER_VISIBLE_LIMIT).toBe('number');
  });
});
