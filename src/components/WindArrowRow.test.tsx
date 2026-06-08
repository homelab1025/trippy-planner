// @vitest-environment jsdom
import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import WindArrowRow from './WindArrowRow';
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

const makeSample = (distance: number, windSpeed: number, windDeg: number): ChartDataPoint => ({
  distance, elevation: 100, temp: 20, precipProb: 50, precipitation: 1,
  windSpeed, windDeg, time: 0, isSample: true,
});

describe('WindArrowRow', () => {
  it('renders nothing when samplePoints is empty', () => {
    const { container } = render(
      <WindArrowRow samplePoints={[]} distanceRange={[0, 10]} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders one arrow group per sample point', () => {
    const { container } = render(
      <WindArrowRow
        samplePoints={[makeSample(2, 15, 90), makeSample(5, 20, 180)]}
        distanceRange={[0, 10]}
      />
    );
    expect(container.querySelectorAll('g[data-arrow]')).toHaveLength(2);
  });

  it('applies windDeg as the rotation angle in each arrow group transform', () => {
    const { container } = render(
      <WindArrowRow
        samplePoints={[makeSample(5, 20, 135)]}
        distanceRange={[0, 10]}
      />
    );
    const g = container.querySelector('g[data-arrow]');
    expect(g?.getAttribute('transform')).toMatch(/rotate\(135[^)]*\)/);
  });

  it('renders a rounded speed label for each sample', () => {
    const { getByText } = render(
      <WindArrowRow
        samplePoints={[makeSample(5, 17.6, 0)]}
        distanceRange={[0, 10]}
      />
    );
    expect(getByText('18')).toBeTruthy();
  });

  it('renders a dashed baseline line', () => {
    const { container } = render(
      <WindArrowRow
        samplePoints={[makeSample(5, 10, 0)]}
        distanceRange={[0, 10]}
      />
    );
    const baseline = container.querySelector('line[stroke="#bfdbfe"]');
    expect(baseline?.getAttribute('stroke-dasharray')).toBeTruthy();
  });
});
