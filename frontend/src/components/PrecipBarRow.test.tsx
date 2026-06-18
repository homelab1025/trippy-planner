// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { PrecipBarRow } from './PrecipBarRow';
import type { ChartDataPoint } from '../hooks/useWeatherChartData';

afterEach(cleanup);

const makeSample = (distance: number, precipProb: number, precipitation: number): ChartDataPoint => ({
  distance, elevation: 100, temp: 20, precipProb, precipitation,
  windSpeed: 10, windDeg: 0, time: 0, isSample: true,
});

describe('PrecipBarRow', () => {
  it('renders nothing when samplePoints is empty', () => {
    const { container } = render(
      <PrecipBarRow samplePoints={[]} distanceRange={[0, 10]} chartWidth={800} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders N+1 rect bars for N sample points', () => {
    const { container } = render(
      <PrecipBarRow
        samplePoints={[makeSample(3, 50, 1), makeSample(7, 80, 2)]}
        distanceRange={[0, 10]}
        chartWidth={800}
      />
    );
    expect(container.querySelectorAll('rect')).toHaveLength(3);
  });

  it('sets rect opacity equal to precipProb / 100', () => {
    const { container } = render(
      <PrecipBarRow
        samplePoints={[makeSample(5, 60, 1)]}
        distanceRange={[0, 10]}
        chartWidth={800}
      />
    );
    const rects = container.querySelectorAll('rect');
    rects.forEach(rect => {
      expect(Number(rect.getAttribute('opacity'))).toBeCloseTo(0.6, 2);
    });
  });

  it('renders a taller bar for the segment with higher precipitation', () => {
    const { container } = render(
      <PrecipBarRow
        samplePoints={[makeSample(3, 80, 1), makeSample(7, 80, 4)]}
        distanceRange={[0, 10]}
        chartWidth={800}
      />
    );
    const rects = Array.from(container.querySelectorAll('rect'));
    const heights = rects.map(r => Number(r.getAttribute('height')));
    // segment 2 ([s1, dMax]) uses samplePoints[1].precipitation=4, max=4 → full height
    // segment 0 ([dMin, s0]) uses samplePoints[0].precipitation=1, max=4 → 1/4 height
    expect(heights[2]).toBeGreaterThan(heights[0]);
  });

  it('renders a single sample point as 2 bars', () => {
    const { container } = render(
      <PrecipBarRow
        samplePoints={[makeSample(5, 40, 0.5)]}
        distanceRange={[0, 10]}
        chartWidth={800}
      />
    );
    expect(container.querySelectorAll('rect')).toHaveLength(2);
  });
});
