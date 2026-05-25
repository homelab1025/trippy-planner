// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);
import App from './App';
import { fetchWeatherForPoint } from './services/weatherService';
import { parseGPXAsync } from './workers/gpxWorkerClient';

// ── Fixtures ────────────────────────────────────────────────────────────────

const mockRoute = {
  name: 'Test Route',
  totalDistance: 1000,
  totalElevationGain: 10,
  originalPointCount: 3,
  points: [
    { lat: 48.0,   lng: 2.0,   ele: 100, distance: 0    },
    { lat: 48.005, lng: 2.005, ele: 105, distance: 500  },
    { lat: 48.01,  lng: 2.01,  ele: 110, distance: 1000 },
  ],
};

const mockWeather = {
  temp: 20, feelsLike: 18, precipProb: 10,
  windSpeed: 12, windDeg: 270, condition: 'Clear',
};

// ── Module-level callback capture for WeatherTimeline mock ───────────────────

let capturedHoverCb: ((d: number | null) => void) | null = null;
let capturedXAxisMode: 'clock' | 'elapsed' | null = null;

// ── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('./workers/gpxWorkerClient', () => ({
  parseGPXAsync: vi.fn(),
}));

vi.mock('./services/weatherService', () => ({
  fetchWeatherForPoint: vi.fn(),
}));

vi.mock('./components/MapComponent', () => ({
  default: ({ hoveredPoint }: { hoveredPoint: { lat: number; lng: number } | null }) => (
    <div
      data-testid="map"
      data-hovered={hoveredPoint ? `${hoveredPoint.lat},${hoveredPoint.lng}` : ''}
    />
  ),
}));

vi.mock('./components/WeatherTimeline', () => ({
  default: ({ onHoverDistance, xAxisMode }: {
    onHoverDistance: (d: number | null) => void;
    xAxisMode: 'clock' | 'elapsed';
  }) => {
    capturedHoverCb = onHoverDistance;
    capturedXAxisMode = xAxisMode;
    return <div data-testid="weather-timeline" />;
  },
}));

vi.mock('./assets/logo.png', () => ({ default: 'logo.png' }));

// ── Helpers ──────────────────────────────────────────────────────────────────

async function uploadFile() {
  const file = new File(['<gpx/>'], 'test.gpx', { type: 'text/xml' });
  const input = document.getElementById('gpx-upload') as HTMLInputElement;
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  await act(async () => { fireEvent.change(input); });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('App', () => {
  beforeEach(() => {
    vi.mocked(parseGPXAsync).mockResolvedValue(mockRoute);
    vi.mocked(fetchWeatherForPoint).mockResolvedValue(mockWeather);
    capturedHoverCb = null;
    capturedXAxisMode = null;
    vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  it('shows upload button and no stats panel initially', () => {
    render(<App />);
    expect(screen.getByText('Upload GPX')).toBeInTheDocument();
    expect(screen.queryByTestId('map')).not.toBeInTheDocument();
    expect(screen.queryByTestId('weather-timeline')).not.toBeInTheDocument();
    expect(screen.queryByText('Distance')).not.toBeInTheDocument();
  });

  it('upload parses file, fetches weather, and shows route stats', async () => {
    render(<App />);
    await uploadFile();

    await waitFor(() => expect(parseGPXAsync).toHaveBeenCalledOnce());
    // updateWeather is called twice: once in handleFileUpload, once from useEffect when route state updates.
    // Each call finds 3 unique points from the fixture (0m, 500m, 1000m) → 6 total calls.
    await waitFor(() => expect(fetchWeatherForPoint).toHaveBeenCalledTimes(6));
    await waitFor(() => expect(screen.getByText('Test Route')).toBeInTheDocument());
    expect(screen.getByText('Distance')).toBeInTheDocument();
    expect(screen.getByText('Elevation Gain')).toBeInTheDocument();
  });
});
