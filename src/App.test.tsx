// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
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
  temp: 20, feelsLike: 18, precipProb: 10, precipitation: 0,
  windSpeed: 12, windDeg: 270, condition: 'Clear',
};

// ── Module-level callback capture for WeatherTimeline mock ───────────────────

// capturedHoverCb and capturedXAxisMode are populated by the WeatherTimeline stub below;
// they are used in the tests added in Task 2 (speed, date, hover, xAxisMode).
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
  default: ({ onHoverDistance, xAxisMode, weatherPoints }: {
    onHoverDistance: (d: number | null) => void;
    xAxisMode: 'clock' | 'elapsed';
    weatherPoints: Array<{ temp: number; precipProb: number; precipitation: number }>;
  }) => {
    capturedHoverCb = onHoverDistance;
    capturedXAxisMode = xAxisMode;
    return (
      <div
        data-testid="weather-timeline"
        data-first-temp={weatherPoints[0]?.temp ?? ''}
        data-first-precip-prob={weatherPoints[0]?.precipProb ?? ''}
      />
    );
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
    vi.clearAllMocks(); // reset call counts
    vi.mocked(parseGPXAsync).mockResolvedValue(mockRoute);
    vi.mocked(fetchWeatherForPoint).mockResolvedValue(mockWeather);
    capturedHoverCb = null;
    capturedXAxisMode = null;
    vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it('shows upload button and no stats panel initially', () => {
    render(<App />);
    expect(screen.getByText('Upload GPX')).toBeInTheDocument();
    expect(screen.queryByTestId('map')).not.toBeInTheDocument();
    expect(screen.queryByTestId('weather-timeline')).not.toBeInTheDocument();
    expect(screen.queryByText('Distance')).not.toBeInTheDocument();
  });

  it('upload shows route stats, map, and weather timeline', async () => {
    render(<App />);
    await uploadFile();

    await waitFor(() => {
      expect(screen.getByText('Test Route')).toBeInTheDocument();
      expect(screen.getByText('Distance')).toBeInTheDocument();
      expect(screen.getByText('Elevation Gain')).toBeInTheDocument();
      expect(screen.getByTestId('map')).toBeInTheDocument();
      expect(screen.getByTestId('weather-timeline')).toBeInTheDocument();
    });
  });

  it('changing avg speed re-fetches weather and updates display', async () => {
    render(<App />);
    await uploadFile();
    await waitFor(() =>
      expect(screen.getByTestId('weather-timeline').dataset.firstTemp).toBe('20')
    );

    vi.mocked(fetchWeatherForPoint).mockResolvedValue({ ...mockWeather, temp: 30 });
    fireEvent.change(screen.getByLabelText('Average Speed (km/h)'), { target: { value: '10' } });

    await waitFor(() =>
      expect(screen.getByTestId('weather-timeline').dataset.firstTemp).toBe('30')
    );
  });

  it('weather precipProb flows from service to WeatherTimeline weatherPoints', async () => {
    render(<App />);
    await uploadFile();
    await waitFor(() =>
      expect(screen.getByTestId('weather-timeline').dataset.firstPrecipProb).toBe('10')
    );

    vi.mocked(fetchWeatherForPoint).mockResolvedValue({ ...mockWeather, precipProb: 75 });
    fireEvent.change(screen.getByLabelText('Average Speed (km/h)'), { target: { value: '10' } });

    await waitFor(() =>
      expect(screen.getByTestId('weather-timeline').dataset.firstPrecipProb).toBe('75')
    );
  });

  it('changing start date re-fetches weather and updates display', async () => {
    render(<App />);
    await uploadFile();
    await waitFor(() =>
      expect(screen.getByTestId('weather-timeline').dataset.firstTemp).toBe('20')
    );

    // Pick a date 2 days from now — always different from today's default, always in picker range
    const d = new Date();
    d.setDate(d.getDate() + 2);
    const twoDaysAhead = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    vi.mocked(fetchWeatherForPoint).mockResolvedValue({ ...mockWeather, temp: 35 });
    fireEvent.change(screen.getByLabelText('Start Date'), { target: { value: twoDaysAhead } });

    await waitFor(() =>
      expect(screen.getByTestId('weather-timeline').dataset.firstTemp).toBe('35')
    );
  });

  it('onHoverDistance callback sets hoveredPoint via binary search', async () => {
    render(<App />);
    await uploadFile();
    await waitFor(() => screen.getByTestId('weather-timeline'));

    act(() => { capturedHoverCb!(0.5); }); // 0.5 km = 500 m → points[1]

    const map = screen.getByTestId('map');
    expect(map.dataset.hovered).toBe('48.005,2.005');
  });

  it('clicking Elapsed switches xAxisMode prop on WeatherTimeline', async () => {
    render(<App />);
    await uploadFile();
    await waitFor(() => screen.getByTestId('weather-timeline'));
    expect(capturedXAxisMode).toBe('clock');

    fireEvent.click(screen.getByText('Elapsed'));
    expect(capturedXAxisMode).toBe('elapsed');

    fireEvent.click(screen.getByText('Clock'));
    expect(capturedXAxisMode).toBe('clock');
  });

  it('parse error shows alert, does not set route, does not fetch weather', async () => {
    vi.mocked(parseGPXAsync).mockRejectedValue(new Error('No tracks found'));
    render(<App />);
    await uploadFile();

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('No tracks found'));
    expect(fetchWeatherForPoint).not.toHaveBeenCalled();
    expect(screen.queryByText('Test Route')).not.toBeInTheDocument();
    expect(screen.queryByTestId('weather-timeline')).not.toBeInTheDocument();
  });

  it('weather fetch error does not crash — weatherPoints stays empty', async () => {
    vi.mocked(fetchWeatherForPoint).mockRejectedValue(new Error('Network error'));
    render(<App />);
    await uploadFile();

    await waitFor(() => expect(screen.getByText('Test Route')).toBeInTheDocument());
    // Fetches were attempted (not silently skipped)
    expect(fetchWeatherForPoint).toHaveBeenCalled();
    // No wrong alert about GPX parsing failure
    expect(window.alert).not.toHaveBeenCalled();
    // WeatherTimeline renders (route was set despite weather failure)
    expect(screen.getByTestId('weather-timeline')).toBeInTheDocument();
  });
});
