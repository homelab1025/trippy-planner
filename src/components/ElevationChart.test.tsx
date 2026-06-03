// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react';
import { vi, describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import ElevationChart from './ElevationChart';
import type { ChartDataPoint } from '../hooks/useWeatherChartData';

vi.mock('recharts', () => ({
  ComposedChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Area: ({ dataKey }: { dataKey: string }) => <div data-testid={`area-${dataKey}`} />,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('./ClimbOverlay', () => ({
  default: () => <div data-testid="climb-overlay" />,
}));

const sampleData: ChartDataPoint[] = [
  { distance: 0, elevation: 100, temp: undefined, precipProb: undefined, precipitation: undefined, windSpeed: undefined, time: 1000, isSample: false },
  { distance: 1, elevation: 200, temp: 18, precipProb: 40, precipitation: 0.2, windSpeed: 15, time: 2000, isSample: true },
];

const defaultProps = {
  data: sampleData,
  totalDistance: 2000,
  climbs: [],
  avgSpeed: 20,
  startTime: new Date('2026-06-03T08:00:00Z'),
  xAxisMode: 'clock' as const,
  onHoverIndex: vi.fn(),
  onResize: vi.fn(),
};

describe('ElevationChart', () => {
  afterEach(() => { cleanup(); });

  it('renders elevation area with correct dataKey', () => {
    render(<ElevationChart {...defaultProps} />);
    expect(screen.getByTestId('area-elevation')).toBeInTheDocument();
  });

  it('renders ClimbOverlay', () => {
    render(<ElevationChart {...defaultProps} />);
    expect(screen.getByTestId('climb-overlay')).toBeInTheDocument();
  });
});
