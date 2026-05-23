import { describe, it, expect } from 'vitest';
import { douglasPeucker, DP_EPSILON_METERS } from './douglasPeucker';
import type { RoutePoint } from './gpxParser';

function pt(lat: number, lng: number): RoutePoint {
  return { lat, lng, ele: 0, distance: 0 };
}

describe('DP_EPSILON_METERS', () => {
  it('is 5', () => {
    expect(DP_EPSILON_METERS).toBe(5);
  });
});

describe('douglasPeucker', () => {
  it('returns empty array for empty input', () => {
    expect(douglasPeucker([], 5)).toEqual([]);
  });

  it('returns single point unchanged', () => {
    const p = pt(0, 0);
    const result = douglasPeucker([p], 5);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(p);
  });

  it('returns two points unchanged', () => {
    const a = pt(0, 0);
    const b = pt(1, 1);
    const result = douglasPeucker([a, b], 5);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe(a);
    expect(result[1]).toBe(b);
  });

  it('removes collinear intermediate points on a meridian', () => {
    // Points on the same meridian (lng=10) lie on a great circle — cross-track distance is 0
    const a = pt(0, 10);
    const mid1 = pt(0.25, 10);
    const mid2 = pt(0.5, 10);
    const mid3 = pt(0.75, 10);
    const b = pt(1, 10);
    const result = douglasPeucker([a, mid1, mid2, mid3, b], 5);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe(a);
    expect(result[1]).toBe(b);
  });

  it('keeps a point whose cross-track distance exceeds epsilon', () => {
    // pt(0.001, 0.5) is ~111 m north of the equatorial segment A→B
    const a = pt(0, 0);
    const p = pt(0.001, 0.5);
    const b = pt(0, 1);
    const result = douglasPeucker([a, p, b], 50); // 111 m > 50 m → kept
    expect(result).toHaveLength(3);
    expect(result).toContain(p);
  });

  it('removes a point whose cross-track distance is below epsilon', () => {
    // Same geometry — different epsilon
    const a = pt(0, 0);
    const p = pt(0.001, 0.5); // ~111 m cross-track
    const b = pt(0, 1);
    const result = douglasPeucker([a, p, b], 200); // 111 m < 200 m → removed
    expect(result).toHaveLength(2);
    expect(result).not.toContain(p);
  });

  it('always preserves first and last points regardless of epsilon', () => {
    const points = [pt(0, 0), pt(0, 0.5), pt(0, 1)];
    const result = douglasPeucker(points, 1_000_000);
    expect(result[0]).toBe(points[0]);
    expect(result[result.length - 1]).toBe(points[points.length - 1]);
  });

  it('returns same object references as the input array — no copies', () => {
    const points = [pt(0, 0), pt(0.001, 0.5), pt(0, 1)];
    const result = douglasPeucker(points, 50);
    for (const p of result) {
      expect(points).toContain(p);
    }
  });
});
