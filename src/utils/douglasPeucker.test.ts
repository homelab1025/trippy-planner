import { describe, it, expect } from 'vitest';
import { douglasPeucker, fillGaps, DP_EPSILON_METERS } from './douglasPeucker';
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

  it('keeps a point when segment endpoints are identical (dAB = 0)', () => {
    const a = pt(0, 0);
    const b = pt(0, 0); // same as a
    const p = pt(1, 0); // ~111 km from a
    // With identical endpoints, perpDist = haversineMeters(a, p) >> epsilon
    const result = douglasPeucker([a, p, b], 5);
    expect(result).toHaveLength(3);
    expect(result).toContain(p);
  });

  it('uses nearest endpoint distance when P projects beyond segment end', () => {
    // A=(0,0), B=(0,0.1) — short equatorial segment (~11 km)
    // P=(0,1)  — far past B along the equator, so foot is outside segment
    // dBP ≈ 99 km, dAP ≈ 111 km → perpDist = min(dAP, dBP) ≈ 99 km >> epsilon=5
    const a = pt(0, 0);
    const b = pt(0, 0.1);
    const p = pt(0, 1);
    const result = douglasPeucker([a, p, b], 5);
    expect(result).toHaveLength(3);
    expect(result).toContain(p);
  });
});

describe('fillGaps', () => {
  // Helper: create a RoutePoint with a specific cumulative distance
  const mkPt = (distance: number): RoutePoint => ({ lat: 0, lng: 0, ele: 0, distance });

  it('returns simplified unchanged when maxGapMeters <= 0', () => {
    const original = [mkPt(0), mkPt(100), mkPt(200)];
    const simplified = [original[0], original[2]];
    expect(fillGaps(original, simplified, 0)).toBe(simplified);
    expect(fillGaps(original, simplified, -1)).toBe(simplified);
  });

  it('returns simplified unchanged when it has fewer than 2 points', () => {
    const original = [mkPt(0)];
    const simplified = [original[0]];
    expect(fillGaps(original, simplified, 100)).toBe(simplified);
  });

  it('returns simplified unchanged when no gap exceeds maxGapMeters', () => {
    const original = [mkPt(0), mkPt(100), mkPt(200)];
    const simplified = [original[0], original[2]]; // gap = 200
    const result = fillGaps(original, simplified, 500_000);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe(original[0]);
    expect(result[1]).toBe(original[2]);
  });

  it('does not insert when gap equals maxGapMeters exactly', () => {
    const original = [mkPt(0), mkPt(250_000), mkPt(500_000)];
    const simplified = [original[0], original[2]]; // gap = 500_000
    const result = fillGaps(original, simplified, 500_000); // not strictly greater
    expect(result).toHaveLength(2);
  });

  it('inserts one point when gap is slightly over maxGapMeters', () => {
    const original = [mkPt(0), mkPt(250_000), mkPt(500_001)];
    const simplified = [original[0], original[2]]; // gap = 500_001
    const result = fillGaps(original, simplified, 500_000);
    expect(result).toHaveLength(3);
    expect(result[0]).toBe(original[0]);
    expect(result[1]).toBe(original[1]);
    expect(result[2]).toBe(original[2]);
  });

  it('inserts two evenly-spaced points into a large gap', () => {
    // 5 original points at 0, 300k, 600k, 900k, 1200k
    // simplified keeps only endpoints (gap = 1200k, maxGap = 500k)
    // numInserts = ceil(1200000/500000) - 1 = 3 - 1 = 2
    // k=1: round(1*4/3) = round(1.33) = 1 → original[1]
    // k=2: round(2*4/3) = round(2.67) = 3 → original[3]
    const original = [mkPt(0), mkPt(300_000), mkPt(600_000), mkPt(900_000), mkPt(1_200_000)];
    const simplified = [original[0], original[4]];
    const result = fillGaps(original, simplified, 500_000);
    expect(result).toHaveLength(4);
    expect(result[0]).toBe(original[0]);
    expect(result[1]).toBe(original[1]);
    expect(result[2]).toBe(original[3]);
    expect(result[3]).toBe(original[4]);
  });

  it('all result points are references to original array objects — no copies', () => {
    const original = [mkPt(0), mkPt(300_000), mkPt(600_000), mkPt(900_000), mkPt(1_200_000)];
    const simplified = [original[0], original[4]];
    const result = fillGaps(original, simplified, 500_000);
    for (const p of result) {
      expect(original).toContain(p);
    }
  });

  it('result points are in strictly increasing distance order', () => {
    const original = [mkPt(0), mkPt(300_000), mkPt(600_000), mkPt(900_000), mkPt(1_200_000)];
    const simplified = [original[0], original[4]];
    const result = fillGaps(original, simplified, 500_000);
    for (let i = 1; i < result.length; i++) {
      expect(result[i].distance).toBeGreaterThan(result[i - 1].distance);
    }
  });

  it('clamps inserts to available original points in the gap', () => {
    // Only 1 original point between endpoints, but gap would call for 5 inserts
    const original = [mkPt(0), mkPt(50_000), mkPt(3_000_000)];
    const simplified = [original[0], original[2]]; // gap = 3_000_000, maxGap = 500_000
    const result = fillGaps(original, simplified, 500_000);
    // Would want 5 inserts but only 1 is available → clamps to 1
    expect(result).toHaveLength(3);
  });
});
