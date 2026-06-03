// src/hooks/useWeatherChartData.test.ts
import { describe, it, expect } from 'vitest';
import { buildChartData } from './useWeatherChartData';

const mockRoute = {
  name: 'Test',
  totalDistance: 1000,
  totalElevationGain: 10,
  originalPointCount: 3,
  points: [
    { lat: 48.0,   lng: 2.0,   ele: 100, distance: 0    },
    { lat: 48.005, lng: 2.005, ele: 105, distance: 500  },
    { lat: 48.01,  lng: 2.01,  ele: 110, distance: 1000 },
  ],
};

const startTime = new Date('2026-06-01T08:00:00');
const base = { route: mockRoute, weatherPoints: [], chartWidth: 800, avgSpeed: 20, startTime };

const makeWp = (pointIdx: number, overrides: Partial<{ temp: number; windSpeed: number }> = {}) => ({
  temp: 20, feelsLike: 18, precipProb: 10, precipitation: 2.5,
  windSpeed: 12, windDeg: 270, condition: 'Clear',
  point: mockRoute.points[pointIdx],
  arrivalTime: new Date(`2026-06-01T08:${String(pointIdx * 10).padStart(2, '0')}:00`),
  label: String(pointIdx),
  ...overrides,
});

describe('buildChartData', () => {
  it('returns empty array when route is null', () => {
    expect(buildChartData({ ...base, route: null })).toEqual([]);
  });

  it('returns one data point per route point when no downsampling needed', () => {
    const result = buildChartData(base);
    expect(result).toHaveLength(3);
  });

  it('pins weather sample points into the output', () => {
    const result = buildChartData({ ...base, weatherPoints: [makeWp(1)] });
    const samples = result.filter(p => p.isSample);
    expect(samples).toHaveLength(1);
    expect(samples[0].temp).toBe(20);
  });

  it('interpolates temp between two sample points', () => {
    const result = buildChartData({
      ...base,
      weatherPoints: [makeWp(0, { temp: 10 }), makeWp(2, { temp: 20 })],
    });
    expect(result[1].temp).toBeCloseTo(15, 1);
  });

  it('interpolates windSpeed between two sample points', () => {
    const result = buildChartData({
      ...base,
      weatherPoints: [makeWp(0, { windSpeed: 4 }), makeWp(2, { windSpeed: 16 })],
    });
    expect(result[1].windSpeed).toBeCloseTo(10, 1);
  });

  it('non-sample points start with undefined weather values', () => {
    const result = buildChartData(base);
    expect(result[0].temp).toBeUndefined();
    expect(result[0].windSpeed).toBeUndefined();
  });

  it('handles a single-point route', () => {
    const single = {
      name: 'Single', totalDistance: 0, totalElevationGain: 0, originalPointCount: 1,
      points: [{ lat: 48.0, lng: 2.0, ele: 100, distance: 0 }],
    };
    expect(buildChartData({ ...base, route: single })).toHaveLength(1);
  });
});
