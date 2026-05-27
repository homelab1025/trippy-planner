// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import WeatherTimeline from './WeatherTimeline';

// ── Recharts mock ─────────────────────────────────────────────────────────────

let capturedOnMouseMove: ((state: any) => void) | undefined;
let capturedOnMouseLeave: (() => void) | undefined;

vi.mock('recharts', () => ({
  ComposedChart: (props: any) => {
    capturedOnMouseMove = props.onMouseMove;
    capturedOnMouseLeave = props.onMouseLeave;
    return <div data-testid="chart">{props.children}</div>;
  },
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  XAxis: () => null,
  YAxis: () => null,
  Area: () => null,
  Line: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockRoute = {
  name: 'Test',
  totalDistance: 1000,
  totalElevationGain: 10,
  originalPointCount: 3,
  points: [
    { lat: 48.0,   lng: 2.0,   ele: 100, distance: 0    },
    { lat: 48.005, lng: 2.005, ele: 105, distance: 500  },
    { lat: 48.01,  lng: 2.01,  ele: 110, distance: 1000 },
  ],
};

const mockWeatherPoint = {
  temp: 20, feelsLike: 18, precipProb: 10,
  precipitation: 2.5,
  windSpeed: 12, windDeg: 270, condition: 'Clear',
  point: mockRoute.points[0],
  arrivalTime: new Date('2026-05-24T08:00:00'),
};

describe('WeatherTimeline', () => {
  beforeEach(() => {
    capturedOnMouseMove = undefined;
    capturedOnMouseLeave = undefined;
  });

  afterEach(() => { cleanup(); });

  it('calls onHoverDistance with data point distance on mouse move', () => {
    const onHoverDistance = vi.fn();
    render(
      <WeatherTimeline
        route={mockRoute}
        weatherPoints={[mockWeatherPoint]}
        onHoverDistance={onHoverDistance}
        xAxisMode="clock"
      />
    );
    // Trigger onMouseMove with activeTooltipIndex=1 → data[1].distance = 500 m = 0.5 km
    // Using index 1 so the expected value (0.5) is visually distinct from the index itself
    act(() => { capturedOnMouseMove?.({ activeTooltipIndex: 1 }); });
    expect(onHoverDistance).toHaveBeenCalledWith(0.5);
  });

  it('calls onHoverDistance(null) on mouse leave', () => {
    const onHoverDistance = vi.fn();
    render(
      <WeatherTimeline
        route={mockRoute}
        weatherPoints={[mockWeatherPoint]}
        onHoverDistance={onHoverDistance}
        xAxisMode="clock"
      />
    );
    act(() => { capturedOnMouseLeave?.(); });
    expect(onHoverDistance).toHaveBeenCalledWith(null);
  });

  it('renders without crash with empty weatherPoints', () => {
    expect(() =>
      render(
        <WeatherTimeline
          route={mockRoute}
          weatherPoints={[]}
          onHoverDistance={vi.fn()}
          xAxisMode="clock"
        />
      )
    ).not.toThrow();
  });

  it('shows unavailability message when weatherAvailable is false', () => {
    const { getByText } = render(
      <WeatherTimeline
        route={mockRoute}
        weatherPoints={[]}
        onHoverDistance={vi.fn()}
        xAxisMode="clock"
        weatherAvailable={false}
      />
    );
    expect(getByText('Weather data unavailable for the selected date')).toBeInTheDocument();
  });

  it('does not show unavailability message when weatherAvailable is true', () => {
    const { queryByText } = render(
      <WeatherTimeline
        route={mockRoute}
        weatherPoints={[mockWeatherPoint]}
        onHoverDistance={vi.fn()}
        xAxisMode="clock"
        weatherAvailable={true}
      />
    );
    expect(queryByText('Weather data unavailable for the selected date')).not.toBeInTheDocument();
  });
});
