// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import React from 'react';
import PrecipChart from './PrecipChart';

vi.mock('recharts', () => ({
  ComposedChart: ({ children }: { children?: React.ReactNode }) => <div data-testid="chart">{children}</div>,
  ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  XAxis: () => null, YAxis: () => null, Line: () => null,
  CartesianGrid: () => null, Tooltip: () => null,
}));

const mockData = [
  { distance: 0, elevation: 100, temp: 20, precipProb: 10, precipitation: 0.5, windSpeed: 5, time: 1000000, isSample: true },
];

describe('PrecipChart', () => {
  afterEach(() => { cleanup(); });

  it('renders without crash', () => {
    expect(() =>
      render(<PrecipChart data={mockData} xAxisMode="clock" onHoverDistance={vi.fn()} />)
    ).not.toThrow();
  });

  it('shows unavailability message when weatherAvailable is false', () => {
    const { getByText } = render(
      <PrecipChart data={mockData} xAxisMode="clock" onHoverDistance={vi.fn()} weatherAvailable={false} />
    );
    expect(getByText('Weather data unavailable for the selected date')).toBeInTheDocument();
  });

  it('does not show unavailability message when weatherAvailable is true', () => {
    const { queryByText } = render(
      <PrecipChart data={mockData} xAxisMode="clock" onHoverDistance={vi.fn()} weatherAvailable={true} />
    );
    expect(queryByText('Weather data unavailable for the selected date')).not.toBeInTheDocument();
  });
});
