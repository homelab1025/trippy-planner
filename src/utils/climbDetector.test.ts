import { describe, it, expect } from 'vitest';
import { detectClimbs } from './climbDetector';
import type { RoutePoint } from './gpxParser';

function makePoints(segments: Array<{ distanceDelta: number; eleDelta: number }>): RoutePoint[] {
  const points: RoutePoint[] = [{ lat: 0, lng: 0, ele: 0, distance: 0 }];
  for (const seg of segments) {
    const prev = points[points.length - 1];
    points.push({ lat: 0, lng: 0, ele: prev.ele + seg.eleDelta, distance: prev.distance + seg.distanceDelta });
  }
  return points;
}

describe('detectClimbs', () => {
  it('returns empty array for fewer than 2 points', () => {
    expect(detectClimbs([])).toEqual([]);
    expect(detectClimbs([{ lat: 0, lng: 0, ele: 0, distance: 0 }])).toEqual([]);
  });

  it('detects a single clean climb and assigns Cat2', () => {
    // lengthM=5000, elevationGain=400, grade=8%, score=40000 → Cat2
    const points = makePoints([{ distanceDelta: 5000, eleDelta: 400 }]);
    const climbs = detectClimbs(points);
    expect(climbs).toHaveLength(1);
    expect(climbs[0].category).toBe('Cat2');
    expect(climbs[0].elevationGain).toBeCloseTo(400);
    expect(climbs[0].lengthM).toBeCloseTo(5000);
    expect(climbs[0].avgGrade).toBeCloseTo(8);
  });

  it('merges two ascending runs separated by a small dip (< 30m, < 500m)', () => {
    // run1: 3000m +200m, gap: 200m -10m (descent 10m < 30m), run2: 2000m +150m
    // merged: lengthM=5200, elevationGain=340, score=34000 → Cat2
    const points = makePoints([
      { distanceDelta: 3000, eleDelta: 200 },
      { distanceDelta: 200, eleDelta: -10 },
      { distanceDelta: 2000, eleDelta: 150 },
    ]);
    const climbs = detectClimbs(points);
    expect(climbs).toHaveLength(1);
    expect(climbs[0].elevationGain).toBeCloseTo(340);
    expect(climbs[0].lengthM).toBeCloseTo(5200);
    expect(climbs[0].category).toBe('Cat2');
  });

  it('does not merge runs when descent exceeds MAX_GAP_DESCENT_M (30m)', () => {
    // gap: 100m distance (well under 500m), but 50m descent (> 30m) — descent alone blocks merge
    // run1: 3000m +200m (score=20000 Cat3), run2: 3000m +250m (score=25000 Cat3)
    const points = makePoints([
      { distanceDelta: 3000, eleDelta: 200 },
      { distanceDelta: 100, eleDelta: -50 },
      { distanceDelta: 3000, eleDelta: 250 },
    ]);
    expect(detectClimbs(points)).toHaveLength(2);
  });

  it('does not merge runs when gap distance exceeds MAX_GAP_DISTANCE_M (500m)', () => {
    // gap: 600m distance (> 500m), only 5m descent (well under 30m) — distance alone blocks merge
    // run1: 3000m +200m (score=20000 Cat3), run2: 3000m +250m (score=25000 Cat3)
    const points = makePoints([
      { distanceDelta: 3000, eleDelta: 200 },
      { distanceDelta: 600, eleDelta: -5 },
      { distanceDelta: 3000, eleDelta: 250 },
    ]);
    expect(detectClimbs(points)).toHaveLength(2);
  });

  it('does not merge runs separated by a sub-threshold ascending gap', () => {
    // gap is uphill (0.75% grade, below 1% threshold) — should not merge since it's not a descent
    // run1: 3000m +200m (score=20000 Cat3), gap: 400m +3m (0.75%), run2: 3000m +250m (score=25000 Cat3)
    const points = makePoints([
      { distanceDelta: 3000, eleDelta: 200 },
      { distanceDelta: 400, eleDelta: 3 },
      { distanceDelta: 3000, eleDelta: 250 },
    ]);
    expect(detectClimbs(points)).toHaveLength(2);
  });

  it('does not merge runs when descent is exactly MAX_GAP_DESCENT_M (30m, strict boundary)', () => {
    // 30m descent is not < 30 — should not merge
    const points = makePoints([
      { distanceDelta: 3000, eleDelta: 200 },
      { distanceDelta: 100, eleDelta: -30 },
      { distanceDelta: 3000, eleDelta: 250 },
    ]);
    expect(detectClimbs(points)).toHaveLength(2);
  });

  it('does not detect a climb when score equals MIN_SCORE (8000)', () => {
    // lengthM=1000, elevationGain=80, grade=8%, score=8000 — not > 8000
    const points = makePoints([{ distanceDelta: 1000, eleDelta: 80 }]);
    expect(detectClimbs(points)).toHaveLength(0);
  });

  it('assigns Cat4 for score just above 8000', () => {
    // score = 85 * 100 = 8500 → Cat4
    const points = makePoints([{ distanceDelta: 1000, eleDelta: 85 }]);
    const climbs = detectClimbs(points);
    expect(climbs).toHaveLength(1);
    expect(climbs[0].category).toBe('Cat4');
  });

  it('assigns Cat4 for score exactly at Cat3 boundary (16000)', () => {
    // score = 160 * 100 = 16000 — not > 16000 → Cat4
    const points = makePoints([{ distanceDelta: 1000, eleDelta: 160 }]);
    const climbs = detectClimbs(points);
    expect(climbs[0].category).toBe('Cat4');
  });

  it('assigns Cat3 for score just above 16000', () => {
    // score = 165 * 100 = 16500 → Cat3
    const points = makePoints([{ distanceDelta: 2000, eleDelta: 165 }]);
    expect(detectClimbs(points)[0].category).toBe('Cat3');
  });

  it('assigns Cat3 for score exactly at Cat2 boundary (32000)', () => {
    // score = 320 * 100 = 32000 — not > 32000 → Cat3
    const points = makePoints([{ distanceDelta: 2000, eleDelta: 320 }]);
    expect(detectClimbs(points)[0].category).toBe('Cat3');
  });

  it('assigns Cat2 for score just above 32000', () => {
    // score = 325 * 100 = 32500 → Cat2
    const points = makePoints([{ distanceDelta: 4000, eleDelta: 325 }]);
    expect(detectClimbs(points)[0].category).toBe('Cat2');
  });

  it('assigns Cat2 for score exactly at Cat1 boundary (64000)', () => {
    // score = 640 * 100 = 64000 — not > 64000 → Cat2
    const points = makePoints([{ distanceDelta: 4000, eleDelta: 640 }]);
    expect(detectClimbs(points)[0].category).toBe('Cat2');
  });

  it('assigns Cat1 for score just above 64000', () => {
    // score = 645 * 100 = 64500 → Cat1
    const points = makePoints([{ distanceDelta: 8000, eleDelta: 645 }]);
    expect(detectClimbs(points)[0].category).toBe('Cat1');
  });

  it('assigns Cat1 for score exactly at HC boundary (80000)', () => {
    // score = 800 * 100 = 80000 — not > 80000 → Cat1
    const points = makePoints([{ distanceDelta: 8000, eleDelta: 800 }]);
    expect(detectClimbs(points)[0].category).toBe('Cat1');
  });

  it('assigns HC for score just above 80000', () => {
    // score = 805 * 100 = 80500 → HC
    const points = makePoints([{ distanceDelta: 10000, eleDelta: 805 }]);
    expect(detectClimbs(points)[0].category).toBe('HC');
  });

  it('returns empty array for a short hill below score threshold', () => {
    // grade=2% (> MIN_GRADE_PCT) but score=500*2=1000 ≤ 8000
    const points = makePoints([{ distanceDelta: 500, eleDelta: 10 }]);
    expect(detectClimbs(points)).toHaveLength(0);
  });

  it('returns empty array for a flat route', () => {
    const points = makePoints([
      { distanceDelta: 5000, eleDelta: 0 },
      { distanceDelta: 5000, eleDelta: 0 },
    ]);
    expect(detectClimbs(points)).toHaveLength(0);
  });

  it('returns multiple climbs in distance order', () => {
    const points = makePoints([
      { distanceDelta: 2000, eleDelta: 165 },  // score=16500 Cat3
      { distanceDelta: 1000, eleDelta: -100 },  // descent > 30m
      { distanceDelta: 3000, eleDelta: 245 },   // score=24500 Cat3
      { distanceDelta: 1000, eleDelta: -100 },  // descent > 30m
      { distanceDelta: 4000, eleDelta: 325 },   // score=32500 Cat2
    ]);
    const climbs = detectClimbs(points);
    expect(climbs).toHaveLength(3);
    expect(climbs[0].startDistance).toBeLessThan(climbs[1].startDistance);
    expect(climbs[1].startDistance).toBeLessThan(climbs[2].startDistance);
    expect(climbs[2].category).toBe('Cat2');
  });
});
