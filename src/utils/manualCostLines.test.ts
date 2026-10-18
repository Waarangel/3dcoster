import { describe, it, expect } from 'vitest';
import {
  newManualLine,
  sanitizeManualLines,
  normalizeManualLinesForSave,
} from './manualCostLines';
import type { ManualCostLine } from '../types';

describe('newManualLine', () => {
  it('returns a blank line with a non-empty id', () => {
    const line = newManualLine();
    expect(line.name).toBe('');
    expect(line.cost).toBe(0);
    expect(typeof line.id).toBe('string');
    expect(line.id.length).toBeGreaterThan(0);
  });

  it('returns unique ids across calls', () => {
    const ids = new Set(Array.from({ length: 50 }, () => newManualLine().id));
    expect(ids.size).toBe(50);
  });
});

describe('sanitizeManualLines (untrusted-input trust boundary)', () => {
  const nonArrays: Array<[string, unknown]> = [
    ['undefined', undefined],
    ['null', null],
    ['a string', 'x'],
    ['a number', 42],
    ['a plain object', {}],
    ['a boolean', true],
  ];
  it.each(nonArrays)('returns [] for %s', (_label, value) => {
    expect(sanitizeManualLines(value)).toEqual([]);
  });

  it('drops non-object entries, arrays, and entries with a bad id, name, or cost type; keeps valid ones in order', () => {
    const input = [
      { id: 'a', name: 'Auger', cost: 200 },
      null,
      'str',
      7,
      ['arr'],
      { id: '', name: 'No id', cost: 1 },
      { name: 'Missing id', cost: 1 },
      { id: 5, name: 'Numeric id', cost: 1 },
      { id: 'b', name: 42, cost: 1 },
      { id: 'c', name: 'Bad cost', cost: '3' },
      { id: 'd', name: 'Glue', cost: 3.5 },
    ];
    expect(sanitizeManualLines(input)).toEqual([
      { id: 'a', name: 'Auger', cost: 200 },
      { id: 'd', name: 'Glue', cost: 3.5 },
    ]);
  });

  it('maps non-finite and negative costs to 0', () => {
    const out = sanitizeManualLines([
      { id: 'a', name: 'A', cost: NaN },
      { id: 'b', name: 'B', cost: Infinity },
      { id: 'c', name: 'C', cost: -4 },
    ]);
    expect(out.map(l => l.cost)).toEqual([0, 0, 0]);
  });

  it('does not round the cost (drafts keep what was typed)', () => {
    expect(sanitizeManualLines([{ id: 'a', name: 'A', cost: 19.999 }])[0].cost).toBe(19.999);
  });

  it('keeps libraryPrompted only when it is exactly true', () => {
    const out = sanitizeManualLines([
      { id: 'a', name: 'A', cost: 1, libraryPrompted: true },
      { id: 'b', name: 'B', cost: 1, libraryPrompted: 'true' },
      { id: 'c', name: 'C', cost: 1, libraryPrompted: false },
      { id: 'd', name: 'D', cost: 1 },
    ]);
    expect(out[0]).toEqual({ id: 'a', name: 'A', cost: 1, libraryPrompted: true });
    expect('libraryPrompted' in out[1]).toBe(false);
    expect('libraryPrompted' in out[2]).toBe(false);
    expect('libraryPrompted' in out[3]).toBe(false);
  });

  it('copies only the four known keys, so hostile or extra keys do not propagate', () => {
    const hostile = JSON.parse(
      '{"id":"a","name":"A","cost":1,"extra":"x","__proto__":{"polluted":true},"constructor":{"prototype":{"p":1}}}',
    );
    const out = sanitizeManualLines([hostile]);
    expect(out).toHaveLength(1);
    expect(Object.keys(out[0]).sort()).toEqual(['cost', 'id', 'name']);
    expect(Object.getPrototypeOf(out[0])).toBe(Object.prototype);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('drops a later entry that repeats an earlier id (keeps the first)', () => {
    const out = sanitizeManualLines([
      { id: 'a', name: 'First', cost: 1 },
      { id: 'a', name: 'Second', cost: 2 },
      { id: 'b', name: 'Other', cost: 3 },
    ]);
    expect(out.map(l => l.name)).toEqual(['First', 'Other']);
  });

  it('returns new objects: mutating the output never mutates the input', () => {
    const input = [{ id: 'a', name: 'A', cost: 1 }];
    const out = sanitizeManualLines(input);
    out[0].name = 'Changed';
    out[0].cost = 99;
    expect(input[0]).toEqual({ id: 'a', name: 'A', cost: 1 });
  });

  it('keeps an in-progress draft row with an empty name and zero cost', () => {
    expect(sanitizeManualLines([{ id: 'a', name: '', cost: 0 }])).toEqual([{ id: 'a', name: '', cost: 0 }]);
  });
});

describe('normalizeManualLinesForSave (save boundary)', () => {
  const line = (over: Partial<ManualCostLine> = {}): ManualCostLine => ({ id: 'a', name: 'Auger', cost: 200, ...over });

  it('returns ok with no lines for an empty list', () => {
    expect(normalizeManualLinesForSave([])).toEqual({ ok: true, lines: [] });
  });

  it('trims names and rounds costs to cents', () => {
    const result = normalizeManualLinesForSave([
      line({ name: '  Auger  ', cost: 19.999 }),
      line({ id: 'b', name: 'Glue', cost: 3.5 }),
    ]);
    expect(result).toEqual({
      ok: true,
      lines: [
        { id: 'a', name: 'Auger', cost: 20 },
        { id: 'b', name: 'Glue', cost: 3.5 },
      ],
    });
  });

  it('silently drops a fully blank row (blank or whitespace name AND zero or invalid cost)', () => {
    const result = normalizeManualLinesForSave([
      line({ id: 'a', name: '', cost: 0 }),
      line({ id: 'b', name: '   ', cost: NaN }),
      line({ id: 'c', name: '', cost: -3 }),
      line({ id: 'd', name: 'Keep', cost: 5 }),
    ]);
    expect(result).toEqual({ ok: true, lines: [{ id: 'd', name: 'Keep', cost: 5 }] });
  });

  it("rejects a row with a cost but a blank name as 'missing-name'", () => {
    expect(normalizeManualLinesForSave([line({ name: '  ', cost: 12 })])).toEqual({ ok: false, reason: 'missing-name' });
  });

  it("rejects a named row whose rounded cost is 0 as 'missing-cost' with the trimmed lineName", () => {
    expect(normalizeManualLinesForSave([line({ name: ' Auger ', cost: 0 })])).toEqual({
      ok: false,
      reason: 'missing-cost',
      lineName: 'Auger',
    });
    expect(normalizeManualLinesForSave([line({ name: 'Tiny', cost: 0.004 })])).toEqual({
      ok: false,
      reason: 'missing-cost',
      lineName: 'Tiny',
    });
  });

  it('returns the first failure when several rows are invalid', () => {
    const result = normalizeManualLinesForSave([
      line({ id: 'a', name: 'NoCost', cost: 0 }),
      line({ id: 'b', name: '', cost: 9 }),
    ]);
    expect(result).toEqual({ ok: false, reason: 'missing-cost', lineName: 'NoCost' });
  });

  it('preserves id and libraryPrompted: true, and never sets libraryPrompted on lines that lacked it', () => {
    const result = normalizeManualLinesForSave([
      line({ id: 'a', libraryPrompted: true }),
      line({ id: 'b' }),
      line({ id: 'c', libraryPrompted: false }),
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lines[0]).toEqual({ id: 'a', name: 'Auger', cost: 200, libraryPrompted: true });
    expect('libraryPrompted' in result.lines[1]).toBe(false);
    expect('libraryPrompted' in result.lines[2]).toBe(false);
  });

  it('returns fresh objects: input lines are never mutated', () => {
    const input = [line({ name: '  Auger ', cost: 19.999 })];
    const result = normalizeManualLinesForSave(input);
    expect(input[0]).toEqual({ id: 'a', name: '  Auger ', cost: 19.999 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lines[0]).not.toBe(input[0]);
  });
});
