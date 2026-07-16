import { describe, it, expect } from 'vitest';
import { buildChartData } from './useWeatherChartData';
import type { RouteData, RoutePoint } from '../utils/gpxParser';

const makeRoute = (pts: { distance: number; ele: number }[]): RouteData => ({
  name: 'Test',
  points: pts.map(p => ({ lat: 0, lng: 0, ele: p.ele, distance: p.distance }) as RoutePoint),
  totalDistance: pts.at(-1)?.distance ?? 0,
  totalElevationGain: 0,
  originalPointCount: pts.length,
});

const START = new Date('2026-06-03T08:00:00Z');
const BASE = { chartWidth: 100, avgSpeed: 20, startTime: START };

describe('buildChartData', () => {
  it('returns empty array for empty route', () => {
    expect(buildChartData({ route: makeRoute([]), weatherPoints: [], ...BASE })).toHaveLength(0);
  });

  it('maps elevation and distance correctly for a single point', () => {
    const route = makeRoute([{ distance: 0, ele: 123.7 }]);
    const result = buildChartData({ route, weatherPoints: [], ...BASE });
    expect(result).toHaveLength(1);
    expect(result[0].elevation).toBe(124); // Math.round
    expect(result[0].distance).toBe(0);
  });

  it('pins weather sample points so LTTB does not drop them', () => {
    const pts = Array.from({ length: 50 }, (_, i) => ({ distance: i * 1000, ele: 100 }));
    const route = makeRoute(pts);
    const samplePoint = route.points[25];
    const weatherPoints = [{
      point: samplePoint,
      arrivalTime: new Date(START.getTime() + 3_600_000),
      label: '25',
      temp: 18, precipProb: 40, precipitation: 0.2, windSpeed: 15, windDeg: 180,
    }];
    const result = buildChartData({ route, weatherPoints, chartWidth: 10, avgSpeed: 20, startTime: START });
    const sample = result.find(p => p.isSample);
    expect(sample).toBeDefined();
    expect(sample?.temp).toBe(18);
    expect(sample?.windSpeed).toBe(15);
  });

  it('interpolates temp and windSpeed between two sample points', () => {
    const pts = [
      { distance: 0, ele: 100 },
      { distance: 1000, ele: 100 },
      { distance: 2000, ele: 100 },
    ];
    const route = makeRoute(pts);
    const makeWP = (idx: number, temp: number, windSpeed: number) => ({
      point: route.points[idx],
      arrivalTime: new Date(START.getTime() + idx * 180_000),
      label: String(idx),
      temp, precipProb: 0, precipitation: 0, windSpeed, windDeg: 0,
    });
    const weatherPoints = [makeWP(0, 10, 5), makeWP(2, 20, 15)];
    const result = buildChartData({ route, weatherPoints, chartWidth: 1000, avgSpeed: 20, startTime: START });
    const mid = result.find(p => Math.abs(p.distance - 1) < 0.01);
    expect(mid?.temp).toBeCloseTo(15, 0);
    expect(mid?.windSpeed).toBeCloseTo(10, 0);
  });

  it('interpolates precipProb and precipitation between sample points', () => {
    const pts = [
      { distance: 0, ele: 100 },
      { distance: 1000, ele: 100 },
      { distance: 2000, ele: 100 },
    ];
    const route = makeRoute(pts);
    const makeWP = (idx: number, precipProb: number, precipitation: number) => ({
      point: route.points[idx],
      arrivalTime: new Date(START.getTime() + idx * 180_000),
      label: String(idx),
      temp: 0, precipProb, precipitation, windSpeed: 0, windDeg: 0,
    });
    const result = buildChartData({
      route,
      weatherPoints: [makeWP(0, 0, 0), makeWP(2, 100, 2)],
      chartWidth: 1000,
      avgSpeed: 20,
      startTime: START,
    });
    const mid = result.find(p => Math.abs(p.distance - 1) < 0.01);
    expect(mid?.precipProb).toBeCloseTo(50, 0);
    expect(mid?.precipitation).toBeCloseTo(1, 0);
  });

  it('interpolates windDeg between sample points', () => {
    const pts = [
      { distance: 0, ele: 100 },
      { distance: 1000, ele: 100 },
      { distance: 2000, ele: 100 },
    ];
    const route = makeRoute(pts);
    const makeWP = (idx: number, windDeg: number) => ({
      point: route.points[idx],
      arrivalTime: new Date(START.getTime() + idx * 180_000),
      label: String(idx),
      temp: 0, precipProb: 0, precipitation: 0, windSpeed: 10, windDeg,
    });
    const result = buildChartData({
      route,
      weatherPoints: [makeWP(0, 0), makeWP(2, 90)],
      chartWidth: 1000,
      avgSpeed: 20,
      startTime: START,
    });
    const mid = result.find(p => Math.abs(p.distance - 1) < 0.01);
    expect(mid?.windDeg).toBeCloseTo(45, 0);
  });

  it('interpolates wind direction correctly across the 0/360 boundary', () => {
    const pts = [
      { distance: 0, ele: 100 },
      { distance: 1000, ele: 100 },
      { distance: 2000, ele: 100 },
    ];
    const route = makeRoute(pts);
    const makeWP = (idx: number, windDeg: number) => ({
      point: route.points[idx],
      arrivalTime: new Date(START.getTime() + idx * 180_000),
      label: String(idx),
      temp: 0, precipProb: 0, precipitation: 0, windSpeed: 10, windDeg,
    });
    // 350° → 10°: correct midpoint is 0° (north); scalar gives 180° (south)
    const result = buildChartData({
      route,
      weatherPoints: [makeWP(0, 350), makeWP(2, 10)],
      chartWidth: 1000,
      avgSpeed: 20,
      startTime: START,
    });
    const mid = result.find(p => Math.abs(p.distance - 1) < 0.01);
    const deg = mid?.windDeg ?? 0;
    // 0° and 360° are equivalent; measure angular distance from north
    expect(Math.min(deg, 360 - deg)).toBeCloseTo(0, 0);
  });

  it('interpolated wind speed reflects vector magnitude, not scalar average', () => {
    const pts = [
      { distance: 0, ele: 100 },
      { distance: 1000, ele: 100 },
      { distance: 2000, ele: 100 },
    ];
    const route = makeRoute(pts);
    const makeWP = (idx: number, windDeg: number, windSpeed: number) => ({
      point: route.points[idx],
      arrivalTime: new Date(START.getTime() + idx * 180_000),
      label: String(idx),
      temp: 0, precipProb: 0, precipitation: 0, windSpeed, windDeg,
    });
    // 30 km/h NW (315°) → 30 km/h NE (45°): vector midpoint is ~21.2 km/h N (0°)
    // scalar interpolation would give 30 km/h — wrong
    const result = buildChartData({
      route,
      weatherPoints: [makeWP(0, 315, 30), makeWP(2, 45, 30)],
      chartWidth: 1000,
      avgSpeed: 20,
      startTime: START,
    });
    const mid = result.find(p => Math.abs(p.distance - 1) < 0.01);
    expect(mid?.windSpeed).toBeCloseTo(30 / Math.SQRT2, 0); // ≈ 21.2
    expect(mid?.windDeg).toBeCloseTo(0, 0);
  });

  it('uses time-based interpolation factor, not index-based', () => {
    // Route: 3 pts at 0m, 1000m, 2000m. avgSpeed=20 km/h gives model time at pt[1]:
    //   START + (1000 / 20000) * 3_600_000 = START + 180_000ms (3 min)
    // Sample times: sample0=START, sample2=START+1h
    //   → t at pt[1] = 3min / 1h = 0.05, far from 0.5 (index midpoint)
    const pts = [
      { distance: 0, ele: 100 },
      { distance: 1000, ele: 100 },
      { distance: 2000, ele: 100 },
    ];
    const route = makeRoute(pts);
    const result = buildChartData({
      route,
      weatherPoints: [
        {
          point: route.points[0],
          arrivalTime: START,
          label: '0',
          temp: 0, precipProb: 0, precipitation: 0, windSpeed: 0, windDeg: 0,
        },
        {
          point: route.points[2],
          arrivalTime: new Date(START.getTime() + 3_600_000), // 1 hour later
          label: '2',
          temp: 100, precipProb: 0, precipitation: 0, windSpeed: 0, windDeg: 0,
        },
      ],
      chartWidth: 1000,
      avgSpeed: 20,
      startTime: START,
    });
    const mid = result.find(p => Math.abs(p.distance - 1) < 0.01);
    // time-based: t ≈ 0.05 → temp ≈ 5
    // index-based: t = 0.5 → temp ≈ 50
    expect(mid?.temp).toBeCloseTo(5, 0);
  });

  it('freezes the interpolation model to weatherAvgSpeed/weatherStartTime, ignoring live avgSpeed/startTime edits', () => {
    // Regression test: when the user edits ride details (speed, date/time) without
    // pressing Refresh, weatherPoints (the actual fetched data) don't change, so the
    // interpolated temp/wind/precip curve shouldn't change either — matching how the
    // wind/precip rows already behave, since they only ever plot the raw sample points.
    const pts = [
      { distance: 0, ele: 100 },
      { distance: 1000, ele: 100 },
      { distance: 2000, ele: 100 },
    ];
    const route = makeRoute(pts);
    const weatherPoints = [
      {
        point: route.points[0],
        arrivalTime: START,
        label: '0',
        temp: 0, precipProb: 0, precipitation: 0, windSpeed: 0, windDeg: 0,
      },
      {
        point: route.points[2],
        arrivalTime: new Date(START.getTime() + 3_600_000),
        label: '2',
        temp: 100, precipProb: 0, precipitation: 0, windSpeed: 0, windDeg: 0,
      },
    ];

    // Fetched with avgSpeed=20/START — this is what's frozen into weatherAvgSpeed/weatherStartTime.
    const fetched = buildChartData({
      route, weatherPoints, chartWidth: 1000, avgSpeed: 20, startTime: START,
      weatherAvgSpeed: 20, weatherStartTime: START,
    });

    // User bumps avgSpeed to 40 and pushes startTime forward without refreshing —
    // weatherAvgSpeed/weatherStartTime still reflect the last actual fetch (20, START).
    const edited = buildChartData({
      route, weatherPoints, chartWidth: 1000, avgSpeed: 40, startTime: new Date(START.getTime() + 3_600_000),
      weatherAvgSpeed: 20, weatherStartTime: START,
    });

    const midFetched = fetched.find(p => Math.abs(p.distance - 1) < 0.01);
    const midEdited = edited.find(p => Math.abs(p.distance - 1) < 0.01);
    expect(midEdited?.temp).toBeCloseTo(midFetched?.temp ?? NaN, 6);
  });

  it('re-interpolates once weatherAvgSpeed/weatherStartTime catch up after a refresh', () => {
    // Once the user presses Refresh, App.tsx re-fetches weatherPoints AND advances
    // lastFetchedParams, so weatherAvgSpeed/weatherStartTime move to match avgSpeed/startTime
    // — at that point the curve is expected to change.
    const pts = [
      { distance: 0, ele: 100 },
      { distance: 1000, ele: 100 },
      { distance: 2000, ele: 100 },
    ];
    const route = makeRoute(pts);
    const weatherPoints = [
      {
        point: route.points[0],
        arrivalTime: START,
        label: '0',
        temp: 0, precipProb: 0, precipitation: 0, windSpeed: 0, windDeg: 0,
      },
      {
        point: route.points[2],
        arrivalTime: new Date(START.getTime() + 3_600_000),
        label: '2',
        temp: 100, precipProb: 0, precipitation: 0, windSpeed: 0, windDeg: 0,
      },
    ];

    const before = buildChartData({
      route, weatherPoints, chartWidth: 1000, avgSpeed: 20, startTime: START,
      weatherAvgSpeed: 20, weatherStartTime: START,
    });
    const after = buildChartData({
      route, weatherPoints, chartWidth: 1000, avgSpeed: 40, startTime: START,
      weatherAvgSpeed: 40, weatherStartTime: START,
    });

    const midBefore = before.find(p => Math.abs(p.distance - 1) < 0.01);
    const midAfter = after.find(p => Math.abs(p.distance - 1) < 0.01);
    expect(midAfter?.temp).not.toBeCloseTo(midBefore?.temp ?? NaN, 6);
  });
});
