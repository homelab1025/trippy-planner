// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import App from './App';
import { DEFAULT_PROVIDER, PROVIDERS } from './services/weatherProviders';
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
  temp: 20, feelsLike: 18, precipProb: 10, precipitation: 1.5,
  windSpeed: 12, windDeg: 270, condition: 'Clear',
};

// ── Module-level callback captures populated by chart component stubs below ───

let capturedHoverCb: ((d: number | null) => void) | null = null;
let capturedXAxisMode: 'clock' | 'elapsed' | null = null;
let capturedWeatherPoints: Array<{ temp: number; precipProb: number; precipitation: number }> = [];

// ── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('./workers/gpxWorkerClient', () => ({
  parseGPXAsync: vi.fn(),
}));

vi.mock('./services/weatherProviders', () => {
  const mockProvider = {
    id: 'mock-provider',
    label: 'Mock',
    available: true,
    fetchWeather: vi.fn(),
  };
  const secondProvider = {
    id: 'second-provider',
    label: 'Second',
    available: true,
    fetchWeather: vi.fn(),
  };
  const unavailableProvider = {
    id: 'unavailable-provider',
    label: 'Unavailable',
    available: false,
    fetchWeather: vi.fn(),
  };
  return {
    PROVIDERS: [mockProvider, secondProvider, unavailableProvider],
    DEFAULT_PROVIDER: mockProvider,
    setWeatherDebug: vi.fn(),
  };
});

vi.mock('./components/MapComponent', () => ({
  default: ({ hoveredPoint }: { hoveredPoint: { lat: number; lng: number } | null }) => (
    <div
      data-testid="map"
      data-hovered={hoveredPoint ? `${hoveredPoint.lat},${hoveredPoint.lng}` : ''}
    />
  ),
}));

vi.mock('./hooks/useWeatherChartData', () => ({
  useWeatherChartData: vi.fn(({ weatherPoints }: { weatherPoints: Array<{ temp: number; precipProb: number; precipitation: number }> }) => {
    capturedWeatherPoints = weatherPoints;
    return [];
  }),
}));

vi.mock('./components/ElevationChart', () => ({
  default: ({ onHoverDistance, xAxisMode }: { onHoverDistance: (d: number | null) => void; xAxisMode: 'clock' | 'elapsed' }) => {
    capturedHoverCb = onHoverDistance;
    capturedXAxisMode = xAxisMode;
    return <div data-testid="elevation-chart" />;
  },
}));

vi.mock('./components/PrecipChart', () => ({
  default: ({ weatherAvailable }: { weatherAvailable: boolean | null }) => (
    <div
      data-testid="precip-chart"
      data-weather-available={String(weatherAvailable)}
    />
  ),
}));

vi.mock('./components/TempWindChart', () => ({
  default: () => <div data-testid="tempwind-chart" />,
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
    vi.mocked(DEFAULT_PROVIDER.fetchWeather).mockResolvedValue(
      new Map([[0, mockWeather]])
    );
    vi.mocked(PROVIDERS[1].fetchWeather).mockResolvedValue(
      new Map([[0, { ...mockWeather, temp: 99 }]])
    );
    capturedHoverCb = null;
    capturedXAxisMode = null;
    capturedWeatherPoints = [];
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
    expect(screen.queryByTestId('elevation-chart')).not.toBeInTheDocument();
    expect(screen.queryByText('Distance')).not.toBeInTheDocument();
  });

  it('upload shows route stats, map, and elevation chart', async () => {
    render(<App />);
    await uploadFile();

    await waitFor(() => {
      expect(screen.getByText('Test Route')).toBeInTheDocument();
      expect(screen.getByText('Distance')).toBeInTheDocument();
      expect(screen.getByText('Elevation Gain')).toBeInTheDocument();
      expect(screen.getByTestId('map')).toBeInTheDocument();
      expect(screen.getByTestId('elevation-chart')).toBeInTheDocument();
    });
  });

  it('changing avg speed re-fetches weather and updates display', async () => {
    render(<App />);
    await uploadFile();
    await waitFor(() =>
      expect(capturedWeatherPoints[0]?.temp).toBe(20)
    );

    vi.mocked(DEFAULT_PROVIDER.fetchWeather).mockResolvedValue(new Map([[0, { ...mockWeather, temp: 30 }]]));
    fireEvent.change(screen.getByLabelText('Average Speed (km/h)'), { target: { value: '10' } });

    await waitFor(() =>
      expect(capturedWeatherPoints[0]?.temp).toBe(30)
    );
  });

  it('weather precipProb flows from service to chart weatherPoints', async () => {
    render(<App />);
    await uploadFile();
    await waitFor(() =>
      expect(capturedWeatherPoints[0]?.precipProb).toBe(10)
    );

    vi.mocked(DEFAULT_PROVIDER.fetchWeather).mockResolvedValue(new Map([[0, { ...mockWeather, precipProb: 75 }]]));
    fireEvent.change(screen.getByLabelText('Average Speed (km/h)'), { target: { value: '10' } });

    await waitFor(() =>
      expect(capturedWeatherPoints[0]?.precipProb).toBe(75)
    );
  });

  it('weather precipitation flows from service to chart weatherPoints', async () => {
    render(<App />);
    await uploadFile();
    await waitFor(() =>
      expect(capturedWeatherPoints[0]?.precipitation).toBe(1.5)
    );

    vi.mocked(DEFAULT_PROVIDER.fetchWeather).mockResolvedValue(new Map([[0, { ...mockWeather, precipitation: 3.5 }]]));
    fireEvent.change(screen.getByLabelText('Average Speed (km/h)'), { target: { value: '10' } });

    await waitFor(() =>
      expect(capturedWeatherPoints[0]?.precipitation).toBe(3.5)
    );
  });

  it('changing start date re-fetches weather and updates display', async () => {
    render(<App />);
    await uploadFile();
    await waitFor(() =>
      expect(capturedWeatherPoints[0]?.temp).toBe(20)
    );

    // Pick a date 2 days from now — always different from today's default, always in picker range
    const d = new Date();
    d.setDate(d.getDate() + 2);
    const twoDaysAhead = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    vi.mocked(DEFAULT_PROVIDER.fetchWeather).mockResolvedValue(new Map([[0, { ...mockWeather, temp: 35 }]]));
    fireEvent.change(screen.getByLabelText('Start Date'), { target: { value: twoDaysAhead } });

    await waitFor(() =>
      expect(capturedWeatherPoints[0]?.temp).toBe(35)
    );
  });

  it('onHoverDistance callback sets hoveredPoint via binary search', async () => {
    render(<App />);
    await uploadFile();
    await waitFor(() => screen.getByTestId('elevation-chart'));

    act(() => { capturedHoverCb!(0.5); }); // 0.5 km = 500 m → points[1]

    const map = screen.getByTestId('map');
    expect(map.dataset.hovered).toBe('48.005,2.005');
  });

  it('clicking Elapsed switches xAxisMode prop on chart components', async () => {
    render(<App />);
    await uploadFile();
    await waitFor(() => screen.getByTestId('elevation-chart'));
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
    expect(DEFAULT_PROVIDER.fetchWeather).not.toHaveBeenCalled();
    expect(screen.queryByText('Test Route')).not.toBeInTheDocument();
    expect(screen.queryByTestId('elevation-chart')).not.toBeInTheDocument();
  });

  it('weather fetch error does not crash — weatherPoints stays empty', async () => {
    vi.mocked(DEFAULT_PROVIDER.fetchWeather).mockRejectedValue(new Error('Network error'));
    render(<App />);
    await uploadFile();

    await waitFor(() => expect(screen.getByText('Test Route')).toBeInTheDocument());
    // Fetches were attempted (not silently skipped)
    expect(DEFAULT_PROVIDER.fetchWeather).toHaveBeenCalled();
    // No wrong alert about GPX parsing failure
    expect(window.alert).not.toHaveBeenCalled();
    // ElevationChart renders (route was set despite weather failure)
    expect(screen.getByTestId('elevation-chart')).toBeInTheDocument();
  });

  it('passes weatherAvailable=true to PrecipChart when weather fetch succeeds', async () => {
    render(<App />);
    await uploadFile();
    await waitFor(() =>
      expect(screen.getByTestId('precip-chart').dataset.weatherAvailable).toBe('true')
    );
  });

  it('passes weatherAvailable=false to PrecipChart when weather fetch returns null', async () => {
    vi.mocked(DEFAULT_PROVIDER.fetchWeather).mockResolvedValue(new Map());
    render(<App />);
    await uploadFile();
    await waitFor(() =>
      expect(screen.getByTestId('precip-chart').dataset.weatherAvailable).toBe('false')
    );
  });

  it('switching provider re-fetches weather using the new provider', async () => {
    render(<App />);
    await uploadFile();
    await waitFor(() =>
      expect(capturedWeatherPoints[0]?.temp).toBe(20)
    );

    // Open Tech Details to reveal the provider selector
    fireEvent.click(screen.getByText('Tech Details'));

    // Switch to the second provider
    fireEvent.change(screen.getByLabelText('Weather Provider'), {
      target: { value: 'second-provider' },
    });

    await waitFor(() =>
      expect(capturedWeatherPoints[0]?.temp).toBe(99)
    );
  });

  it('selecting an unavailable provider does not change selectedProvider', async () => {
    render(<App />);
    await uploadFile();
    await waitFor(() => screen.getByTestId('elevation-chart'));

    fireEvent.click(screen.getByText('Tech Details'));

    fireEvent.change(screen.getByLabelText('Weather Provider'), {
      target: { value: 'unavailable-provider' },
    });

    expect(
      (screen.getByLabelText('Weather Provider') as HTMLSelectElement).value
    ).toBe('mock-provider');
    expect(PROVIDERS[2].fetchWeather).not.toHaveBeenCalled();
  });
});
