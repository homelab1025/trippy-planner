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
      arrivalTime: new Date(START.getTime() + idx * 3_600_000),
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
      arrivalTime: new Date(START.getTime() + idx * 3_600_000),
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
});
