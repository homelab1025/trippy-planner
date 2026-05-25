// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
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
  windSpeed: 12, windDeg: 270, condition: 'Clear',
  point: mockRoute.points[0],
  arrivalTime: new Date('2026-05-24T08:00:00'),
};

describe('WeatherTimeline', () => {
  beforeEach(() => {
    capturedOnMouseMove = undefined;
    capturedOnMouseLeave = undefined;
  });

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
    // Trigger onMouseMove with activeTooltipIndex=0 → data[0].distance = 0 km
    act(() => { capturedOnMouseMove?.({ activeTooltipIndex: 0 }); });
    expect(onHoverDistance).toHaveBeenCalledWith(0);
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
});
