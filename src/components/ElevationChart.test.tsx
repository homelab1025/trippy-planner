// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import ElevationChart from './ElevationChart';

let capturedOnMouseMove: ((state: any) => void) | undefined;
let capturedOnMouseLeave: (() => void) | undefined;

vi.mock('recharts', () => ({
  ComposedChart: (props: any) => {
    capturedOnMouseMove = props.onMouseMove;
    capturedOnMouseLeave = props.onMouseLeave;
    return <div data-testid="chart">{props.children}</div>;
  },
  ResponsiveContainer: ({ children, onResize }: any) => {
    onResize?.(800);
    return <div>{children}</div>;
  },
  XAxis: () => null,
  YAxis: () => null,
  Area: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  useXAxisScale: () => () => undefined,
  useYAxisScale: () => () => undefined,
  usePlotArea: () => ({ x: 10, y: 10, width: 800, height: 300 }),
}));

const mockRoute = {
  name: 'Test', totalDistance: 1000, totalElevationGain: 10, originalPointCount: 3,
  points: [
    { lat: 48.0,   lng: 2.0,   ele: 100, distance: 0    },
    { lat: 48.005, lng: 2.005, ele: 105, distance: 500  },
    { lat: 48.01,  lng: 2.01,  ele: 110, distance: 1000 },
  ],
};

const mockData = [
  { distance: 0,   elevation: 100, temp: 20, precipProb: 10, precipitation: 0, windSpeed: 5, time: 1000000, isSample: true  },
  { distance: 0.5, elevation: 105, temp: 21, precipProb: 11, precipitation: 0, windSpeed: 6, time: 1090000, isSample: false },
  { distance: 1,   elevation: 110, temp: 22, precipProb: 12, precipitation: 0, windSpeed: 7, time: 1180000, isSample: true  },
];

const defaultProps = {
  route: mockRoute,
  data: mockData,
  avgSpeed: 20,
  startTime: new Date('2026-06-01T08:00:00'),
  xAxisMode: 'clock' as const,
  onHoverDistance: vi.fn(),
  onResize: vi.fn(),
};

describe('ElevationChart', () => {
  beforeEach(() => { capturedOnMouseMove = undefined; capturedOnMouseLeave = undefined; });
  afterEach(() => { cleanup(); });

  it('renders without crash', () => {
    expect(() => render(<ElevationChart {...defaultProps} />)).not.toThrow();
  });

  it('calls onHoverDistance with km distance on mouse move', () => {
    const onHoverDistance = vi.fn();
    render(<ElevationChart {...defaultProps} onHoverDistance={onHoverDistance} />);
    act(() => { capturedOnMouseMove?.({ activeTooltipIndex: 1 }); });
    expect(onHoverDistance).toHaveBeenCalledWith(0.5);
  });

  it('calls onHoverDistance(null) on mouse leave', () => {
    const onHoverDistance = vi.fn();
    render(<ElevationChart {...defaultProps} onHoverDistance={onHoverDistance} />);
    act(() => { capturedOnMouseLeave?.(); });
    expect(onHoverDistance).toHaveBeenCalledWith(null);
  });
});
