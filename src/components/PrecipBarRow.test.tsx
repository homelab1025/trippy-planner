// @vitest-environment jsdom
import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import PrecipBarRow from './PrecipBarRow';
import type { ChartDataPoint } from '../hooks/useWeatherChartData';

afterEach(cleanup);

vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    ComposedChart: ({ children }: { children: React.ReactNode }) =>
      React.createElement('svg', null, children),
    XAxis: () => null,
    YAxis: () => null,
    ReferenceLine: ({ x, stroke, strokeDasharray }: { x?: number; stroke?: string; strokeDasharray?: string }) =>
      x != null
        ? React.createElement('line', { x1: x, x2: x, y1: 0, y2: 40, stroke, 'stroke-dasharray': strokeDasharray })
        : null,
    useXAxisScale: () => (v: number) => v * 69 + 55,
  };
});

const makeSample = (distance: number, precipProb: number, precipitation: number): ChartDataPoint => ({
  distance, elevation: 100, temp: 20, precipProb, precipitation,
  windSpeed: 10, windDeg: 0, time: 0, isSample: true,
});

describe('PrecipBarRow', () => {
  it('renders nothing when samplePoints is empty', () => {
    const { container } = render(
      <PrecipBarRow samplePoints={[]} distanceRange={[0, 10]} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders N+1 rect bars for N sample points', () => {
    const { container } = render(
      <PrecipBarRow
        samplePoints={[makeSample(3, 50, 1), makeSample(7, 80, 2)]}
        distanceRange={[0, 10]}
      />
    );
    expect(container.querySelectorAll('[data-testid="precip-bar"]')).toHaveLength(3);
  });

  it('sets rect opacity equal to precipProb / 100', () => {
    const { container } = render(
      <PrecipBarRow
        samplePoints={[makeSample(5, 60, 1)]}
        distanceRange={[0, 10]}
      />
    );
    const rects = container.querySelectorAll('[data-testid="precip-bar"]');
    rects.forEach(rect => {
      expect(Number(rect.getAttribute('opacity'))).toBeCloseTo(0.6, 2);
    });
  });

  it('renders a taller bar for the segment with higher precipitation', () => {
    const { container } = render(
      <PrecipBarRow
        samplePoints={[makeSample(3, 80, 1), makeSample(7, 80, 4)]}
        distanceRange={[0, 10]}
      />
    );
    const rects = Array.from(container.querySelectorAll('[data-testid="precip-bar"]'));
    const heights = rects.map(r => Number(r.getAttribute('height')));
    // segment 2 ([s1, dMax]) uses samplePoints[1].precipitation=4 → full MAX_BAR_HEIGHT
    // segment 0 ([dMin, s0]) uses samplePoints[0].precipitation=1 → 1/4 height
    expect(heights[2]).toBeGreaterThan(heights[0]);
  });

  it('renders a single sample point as 2 bars', () => {
    const { container } = render(
      <PrecipBarRow
        samplePoints={[makeSample(5, 40, 0.5)]}
        distanceRange={[0, 10]}
      />
    );
    expect(container.querySelectorAll('[data-testid="precip-bar"]')).toHaveLength(2);
  });
});
