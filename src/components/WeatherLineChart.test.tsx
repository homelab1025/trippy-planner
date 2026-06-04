// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react';
import { vi, describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import WeatherLineChart from './WeatherLineChart';
import type { WeatherLinePoint, WeatherLineConfig } from './WeatherLineChart';

vi.mock('recharts', () => ({
  ComposedChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Line: ({ dataKey }: { dataKey: string }) => <div data-testid={`line-${dataKey}`} />,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const sampleData: WeatherLinePoint[] = [
  { time: 1000, distance: 0, line1: 18, line2: 15 },
];

const line1Config: WeatherLineConfig = {
  label: 'Temp',
  color: '#ff7300',
  format: (v) => `${Math.round(v)}°C`,
  yAxisId: 'left',
};

const line2Config: WeatherLineConfig = {
  label: 'Wind',
  color: '#4A9FD9',
  format: (v) => `${Math.round(v)} km/h`,
  yAxisId: 'right',
};

const defaultProps = {
  data: sampleData,
  line1Config,
  line2Config,
  xAxisMode: 'clock' as const,
  onHoverIndex: vi.fn(),
  weatherAvailable: true as boolean | null,
};

describe('WeatherLineChart', () => {
  afterEach(() => { cleanup(); });

  it('renders line1 and line2', () => {
    render(<WeatherLineChart {...defaultProps} />);
    expect(screen.getByTestId('line-line1')).toBeInTheDocument();
    expect(screen.getByTestId('line-line2')).toBeInTheDocument();
  });

  it('shows unavailable overlay when weatherAvailable is false', () => {
    render(<WeatherLineChart {...defaultProps} weatherAvailable={false} />);
    expect(screen.getByText('Weather data unavailable for the selected date')).toBeInTheDocument();
  });

  it('does not show unavailable overlay when weatherAvailable is true', () => {
    render(<WeatherLineChart {...defaultProps} weatherAvailable={true} />);
    expect(screen.queryByText('Weather data unavailable for the selected date')).not.toBeInTheDocument();
  });
});
