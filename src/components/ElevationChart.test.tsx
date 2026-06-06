// @vitest-environment jsdom
import { render, screen, cleanup, act } from '@testing-library/react';
import { vi, describe, it, expect, afterEach, beforeEach } from 'vitest';
import React from 'react';
import ElevationChart, { type ElevationPoint } from './ElevationChart';

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
  Area: ({ dataKey }: { dataKey: string }) => <div data-testid={`area-${dataKey}`} />,
  Line: ({ dataKey }: { dataKey: string }) => <div data-testid={`line-${dataKey}`} />,
  ReferenceLine: ({ x }: { x: number }) => <div data-testid="reference-line" data-x={x} />,
  ReferenceDot: ({ x, y }: { x: number; y: number }) => <div data-testid="reference-dot" data-x={x} data-y={y} />,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('./ClimbOverlay', () => ({
  default: () => <div data-testid="climb-overlay" />,
}));

const sampleData: ElevationPoint[] = [
  { distance: 0, elevation: 100 },
  { distance: 1, elevation: 200 },
];

const defaultProps = {
  data: sampleData,
  climbs: [],
  onHoverIndex: vi.fn(),
  onResize: vi.fn(),
  hoveredIndex: null as number | null,
};

describe('ElevationChart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedMouseMove = null;
    capturedMouseLeave = null;
  });

  afterEach(() => { cleanup(); });

  it('renders elevation area with correct dataKey', () => {
    render(<ElevationChart {...defaultProps} />);
    expect(screen.getByTestId('area-elevation')).toBeInTheDocument();
  });

  it('renders ClimbOverlay', () => {
    render(<ElevationChart {...defaultProps} />);
    expect(screen.getByTestId('climb-overlay')).toBeInTheDocument();
  });

  it('renders reference line and dot at hovered point distance when hoveredIndex is set', () => {
    render(<ElevationChart {...defaultProps} hoveredIndex={1} />);
    const line = screen.getByTestId('reference-line');
    const dot = screen.getByTestId('reference-dot');
    expect(line).toBeInTheDocument();
    expect(line.dataset.x).toBe('1');
    expect(dot).toBeInTheDocument();
    expect(dot.dataset.x).toBe('1');
    expect(dot.dataset.y).toBe('200');
  });

  it('does not render reference line or dot when hoveredIndex is null', () => {
    render(<ElevationChart {...defaultProps} hoveredIndex={null} />);
    expect(screen.queryByTestId('reference-line')).not.toBeInTheDocument();
    expect(screen.queryByTestId('reference-dot')).not.toBeInTheDocument();
  });

  it('does not render reference line or dot when hoveredIndex is out of range', () => {
    render(<ElevationChart {...defaultProps} hoveredIndex={99} />);
    expect(screen.queryByTestId('reference-line')).not.toBeInTheDocument();
    expect(screen.queryByTestId('reference-dot')).not.toBeInTheDocument();
  });

  it('calls onHoverIndex with the active index on mouse move', () => {
    render(<ElevationChart {...defaultProps} />);
    act(() => { capturedMouseMove?.({ activeTooltipIndex: 1 }); });
    expect(defaultProps.onHoverIndex).toHaveBeenCalledWith(1);
  });

  it('calls onHoverIndex(null) when activeTooltipIndex is null on mouse move', () => {
    render(<ElevationChart {...defaultProps} />);
    act(() => { capturedMouseMove?.({ activeTooltipIndex: null }); });
    expect(defaultProps.onHoverIndex).toHaveBeenCalledWith(null);
  });

  it('calls onHoverIndex(null) when activeTooltipIndex is out of range', () => {
    render(<ElevationChart {...defaultProps} />);
    act(() => { capturedMouseMove?.({ activeTooltipIndex: 99 }); });
    expect(defaultProps.onHoverIndex).toHaveBeenCalledWith(null);
  });

  it('calls onHoverIndex(null) on mouse leave', () => {
    render(<ElevationChart {...defaultProps} />);
    act(() => { capturedMouseLeave?.(); });
    expect(defaultProps.onHoverIndex).toHaveBeenCalledWith(null);
  });

  it('renders temperature line when data contains temp values', () => {
    const dataWithTemp: ElevationPoint[] = [
      { distance: 0, elevation: 100, temp: 15 },
      { distance: 1, elevation: 200, temp: 12 },
    ];
    render(<ElevationChart {...defaultProps} data={dataWithTemp} />);
    expect(screen.getByTestId('line-temp')).toBeInTheDocument();
  });

  it('renders temperature reference line and dot when hoveredIndex has temp data', () => {
    const dataWithTemp: ElevationPoint[] = [
      { distance: 0, elevation: 100, temp: 15 },
      { distance: 1, elevation: 200, temp: 12 },
    ];
    render(<ElevationChart {...defaultProps} data={dataWithTemp} hoveredIndex={1} />);
    const refLines = screen.getAllByTestId('reference-line');
    const refDots = screen.getAllByTestId('reference-dot');
    expect(refLines.length).toBeGreaterThanOrEqual(2);
    expect(refDots.length).toBeGreaterThanOrEqual(2);
  });

  it('does not render temperature reference line and dot when hoveredIndex has no temp', () => {
    render(<ElevationChart {...defaultProps} hoveredIndex={1} />);
    const refLines = screen.getAllByTestId('reference-line');
    const refDots = screen.getAllByTestId('reference-dot');
    expect(refLines.length).toBe(1);
    expect(refDots.length).toBe(1);
  });
});
