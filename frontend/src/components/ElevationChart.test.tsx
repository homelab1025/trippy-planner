// @vitest-environment jsdom
import { render, screen, cleanup, act } from '@testing-library/react';
import { vi, describe, it, expect, afterEach, beforeEach } from 'vitest';
import React from 'react';
import { ElevationChart, type ElevationPoint } from './ElevationChart';
import { CLIMB_BADGE_HEIGHT, CLIMB_POLE_HEIGHT, ELEVATION_PLOT_HEIGHT } from './chartConstants';

let capturedMouseMove: ((state: { activeTooltipIndex?: number | null }) => void) | null = null;
let capturedMouseLeave: (() => void) | null = null;
let capturedElevationDomain: ((domain: readonly [number, number]) => [number, number]) | null = null;

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
  ReferenceDot: ({ x, y, fill }: { x: number; y: number; fill?: string }) => (
    <div data-testid="reference-dot" data-x={x} data-y={y} data-fill={fill} />
  ),
  XAxis: () => null,
  YAxis: ({ yAxisId, domain }: { yAxisId: string; domain?: (d: readonly [number, number]) => [number, number] }) => {
    if (yAxisId === 'elevation') capturedElevationDomain = domain ?? null;
    return null;
  },
  CartesianGrid: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('./ClimbOverlay', () => ({
  ClimbOverlay: () => <div data-testid="climb-overlay" />,
}));

vi.mock('./CheckpointOverlay', () => ({
  CheckpointOverlay: () => <div data-testid="checkpoint-overlay" />,
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
  checkpoints: [],
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

  it('renders CheckpointOverlay', () => {
    render(<ElevationChart {...defaultProps} />);
    expect(screen.getByTestId('checkpoint-overlay')).toBeInTheDocument();
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

  it('does not render temp line when no data points have temp', () => {
    render(<ElevationChart {...defaultProps} />);
    expect(screen.queryByTestId('line-temp')).not.toBeInTheDocument();
  });

  it('renders temp line when at least one data point has a temp value', () => {
    const dataWithTemp = [
      { distance: 0, elevation: 100, temp: 18 },
      { distance: 1, elevation: 200, temp: 20 },
    ];
    render(<ElevationChart {...defaultProps} data={dataWithTemp} />);
    expect(screen.getByTestId('line-temp')).toBeInTheDocument();
  });

  describe('elevation Y-axis domain', () => {
    const sampleClimb = {
      startDistance: 0,
      endDistance: 1000,
      elevationGain: 500,
      lengthM: 1000,
      avgGrade: 10,
      score: 1000,
      category: 'HC' as const,
    };

    it('leaves the domain untouched when there are no climbs', () => {
      render(<ElevationChart {...defaultProps} climbs={[]} />);
      expect(capturedElevationDomain).not.toBeNull();
      expect(capturedElevationDomain!([100, 2000])).toEqual([90, 2000]);
    });

    it('reserves headroom above the highest point so a climb badge always fits', () => {
      render(<ElevationChart {...defaultProps} climbs={[sampleClimb]} />);
      expect(capturedElevationDomain).not.toBeNull();
      const [domainMin, domainMax] = capturedElevationDomain!([100, 2000]);
      expect(domainMin).toBe(90);

      const badgeHeadroomPx = CLIMB_POLE_HEIGHT + CLIMB_BADGE_HEIGHT;
      const range = 2000 - domainMin;
      const expectedExtra = (badgeHeadroomPx * range) / (ELEVATION_PLOT_HEIGHT - badgeHeadroomPx);
      expect(domainMax).toBeCloseTo(2000 + expectedExtra);

      // The reserved headroom, converted back to pixels over the padded range,
      // must cover at least a pole + badge worth of space above the peak.
      const paddedRange = domainMax - domainMin;
      const headroomPx = ((domainMax - 2000) / paddedRange) * ELEVATION_PLOT_HEIGHT;
      expect(headroomPx).toBeGreaterThanOrEqual(badgeHeadroomPx - 0.001);
    });
  });
});
