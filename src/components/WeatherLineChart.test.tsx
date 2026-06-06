// @vitest-environment jsdom
import { render, screen, cleanup, act } from '@testing-library/react';
import { vi, describe, it, expect, afterEach, beforeEach } from 'vitest';
import React from 'react';
import WeatherLineChart from './WeatherLineChart';
import type { WeatherLinePoint, WeatherLineConfig } from './WeatherLineChart';

let capturedMouseMove: ((state: { activeTooltipIndex?: number | null }) => void) | null = null;
let capturedMouseLeave: (() => void) | null = null;

vi.mock('recharts', () => ({
  ComposedChart: ({ children, onMouseMove, onMouseLeave }: {
    children: React.ReactNode;
    onMouseMove?: (state: { activeTooltipIndex?: number | null }) => void;
    onMouseLeave?: () => void;
  }) => {
    capturedMouseMove = onMouseMove ?? null;
    capturedMouseLeave = onMouseLeave ?? null;
    return <div>{children}</div>;
  },
  Line: ({ dataKey }: { dataKey: string }) => <div data-testid={`line-${dataKey}`} />,
  ReferenceLine: ({ x }: { x: number }) => <div data-testid="reference-line" data-x={x} />,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const sampleData: WeatherLinePoint[] = [
  { time: 1000, distance: 0, line1: 18, line2: 15 },
  { time: 2000, distance: 1, line1: 20, line2: 12 },
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
  hoveredIndex: null as number | null,
  onHoverIndex: vi.fn(),
  weatherAvailable: true as boolean | null,
};

describe('WeatherLineChart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedMouseMove = null;
    capturedMouseLeave = null;
  });

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

  it('does not show unavailable overlay when weatherAvailable is null', () => {
    render(<WeatherLineChart {...defaultProps} weatherAvailable={null} />);
    expect(screen.queryByText('Weather data unavailable for the selected date')).not.toBeInTheDocument();
  });

  it('renders reference line at hovered point distance when hoveredIndex is set', () => {
    render(<WeatherLineChart {...defaultProps} hoveredIndex={1} />);
    const line = screen.getByTestId('reference-line');
    expect(line).toBeInTheDocument();
    expect(line.dataset.x).toBe('1');
  });

  it('does not render reference line when hoveredIndex is null', () => {
    render(<WeatherLineChart {...defaultProps} hoveredIndex={null} />);
    expect(screen.queryByTestId('reference-line')).not.toBeInTheDocument();
  });

  it('does not render reference line when hoveredIndex is out of range', () => {
    render(<WeatherLineChart {...defaultProps} hoveredIndex={99} />);
    expect(screen.queryByTestId('reference-line')).not.toBeInTheDocument();
  });

  it('calls onHoverIndex with the active index on mouse move', () => {
    render(<WeatherLineChart {...defaultProps} />);
    act(() => { capturedMouseMove?.({ activeTooltipIndex: 1 }); });
    expect(defaultProps.onHoverIndex).toHaveBeenCalledWith(1);
  });

  it('calls onHoverIndex(null) when activeTooltipIndex is null on mouse move', () => {
    render(<WeatherLineChart {...defaultProps} />);
    act(() => { capturedMouseMove?.({ activeTooltipIndex: null }); });
    expect(defaultProps.onHoverIndex).toHaveBeenCalledWith(null);
  });

  it('calls onHoverIndex(null) when activeTooltipIndex is out of range', () => {
    render(<WeatherLineChart {...defaultProps} />);
    act(() => { capturedMouseMove?.({ activeTooltipIndex: 99 }); });
    expect(defaultProps.onHoverIndex).toHaveBeenCalledWith(null);
  });

  it('calls onHoverIndex(null) on mouse leave', () => {
    render(<WeatherLineChart {...defaultProps} />);
    act(() => { capturedMouseLeave?.(); });
    expect(defaultProps.onHoverIndex).toHaveBeenCalledWith(null);
  });

  it('renders only line1 when line2Config is absent', () => {
    const { line2Config: _omit, ...propsWithoutLine2 } = defaultProps;
    render(<WeatherLineChart {...propsWithoutLine2} />);
    expect(screen.getByTestId('line-line1')).toBeInTheDocument();
    expect(screen.queryByTestId('line-line2')).not.toBeInTheDocument();
  });
});
