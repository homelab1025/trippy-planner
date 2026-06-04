// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import React from 'react';
import PrecipChart from './PrecipChart';
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

describe('PrecipChart', () => {
  it('renders precipProb and precipitation lines', () => {
    render(<PrecipChart {...defaultProps} />);
    expect(screen.getByTestId('line-precipProb')).toBeInTheDocument();
    expect(screen.getByTestId('line-precipitation')).toBeInTheDocument();
  });

  it('shows unavailable overlay when weatherAvailable is false', () => {
    render(<PrecipChart {...defaultProps} weatherAvailable={false} />);
    expect(screen.getByText('Weather data unavailable for the selected date')).toBeInTheDocument();
  });
});
