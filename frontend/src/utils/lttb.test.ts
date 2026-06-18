import { describe, it, expect } from 'vitest';
import { lttbWithPinnedPoints } from './lttb';

type P = { x: number; y: number; pinned: boolean };

const noPin = () => false;
const getX = (p: P) => p.x;
const getY = (p: P) => p.y;

const flat = (n: number): P[] =>
  Array.from({ length: n }, (_, i) => ({ x: i, y: 0, pinned: false }));

describe('lttb (via lttbWithPinnedPoints with no pinned points)', () => {
  it('returns the original array when length is at or below target', () => {
    const data = flat(3);
    const result = lttbWithPinnedPoints(data, 5, noPin, getX, getY);
    expect(result).toBe(data); // same reference, not a copy
  });

  it('always preserves the first point', () => {
    const data = flat(20);
    const result = lttbWithPinnedPoints(data, 5, noPin, getX, getY);
    expect(result[0]).toBe(data[0]);
  });

  it('always preserves the last point', () => {
    const data = flat(20);
    const result = lttbWithPinnedPoints(data, 5, noPin, getX, getY);
    expect(result).toContain(data[data.length - 1]);
  });

  it('retains a visual peak through downsampling', () => {
    // 20 points, all flat except a spike at index 10
    const data: P[] = Array.from({ length: 20 }, (_, i) => ({
      x: i,
      y: i === 10 ? 100 : 0,
      pinned: false,
    }));
    const result = lttbWithPinnedPoints(data, 5, noPin, getX, getY);
    expect(result).toContain(data[10]);
  });
});

describe('lttbWithPinnedPoints', () => {
  it('re-inserts a pinned point dropped by LTTB', () => {
    // Flat line — LTTB has no visual reason to keep index 7
    const data: P[] = Array.from({ length: 20 }, (_, i) => ({
      x: i,
      y: 0,
      pinned: i === 7,
    }));
    const result = lttbWithPinnedPoints(data, 3, p => p.pinned, getX, getY);
    expect(result).toContain(data[7]);
  });

  it('result is sorted by x after re-inserting a pinned point', () => {
    const data: P[] = Array.from({ length: 20 }, (_, i) => ({
      x: i,
      y: 0,
      pinned: i === 7,
    }));
    const result = lttbWithPinnedPoints(data, 3, p => p.pinned, getX, getY);
    for (let i = 1; i < result.length; i++) {
      expect(result[i].x).toBeGreaterThanOrEqual(result[i - 1].x);
    }
  });

  it('does not duplicate a pinned point already kept by LTTB', () => {
    // data[0] is always the first element in LTTB output
    const data: P[] = Array.from({ length: 20 }, (_, i) => ({
      x: i,
      y: i,
      pinned: i === 0,
    }));
    const result = lttbWithPinnedPoints(data, 5, p => p.pinned, getX, getY);
    const count = result.filter(p => p === data[0]).length;
    expect(count).toBe(1);
  });
});
