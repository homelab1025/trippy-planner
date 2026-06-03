// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react';
import { vi, describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import TempWindChart from './TempWindChart';
import type { ChartDataPoint } from '../hooks/useWeatherChartData';

vi.mock('recharts', () => ({
  ComposedChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Line: ({ dataKey }: { dataKey: string }) => <div data-testid={`line-${dataKey}`} />,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const sampleData: ChartDataPoint[] = [
  { distance: 0, elevation: 100, temp: 18, precipProb: 40, precipitation: 0.2, windSpeed: 15, time: 1000, isSample: true },
];

const defaultProps = {
  data: sampleData,
  xAxisMode: 'clock' as const,
  onHoverIndex: vi.fn(),
  weatherAvailable: true as boolean | null,
};

describe('TempWindChart', () => {
  afterEach(() => {
    cleanup();
  });
  it('renders temp and windSpeed lines', () => {
    render(<TempWindChart {...defaultProps} />);
    expect(screen.getByTestId('line-temp')).toBeInTheDocument();
    expect(screen.getByTestId('line-windSpeed')).toBeInTheDocument();
  });

  it('shows unavailable overlay when weatherAvailable is false', () => {
    render(<TempWindChart {...defaultProps} weatherAvailable={false} />);
    expect(screen.getByText('Weather data unavailable for the selected date')).toBeInTheDocument();
  });

  it('does not show unavailable overlay when weatherAvailable is true', () => {
    render(<TempWindChart {...defaultProps} weatherAvailable={true} />);
    expect(screen.queryByText('Weather data unavailable for the selected date')).not.toBeInTheDocument();
  });
});
