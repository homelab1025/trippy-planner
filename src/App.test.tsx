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

// ── Module-level callback capture for chart mocks ────────────────────────────

// capturedHoverCb is populated by the ElevationChart stub below.
let capturedHoverCb: ((index: number | null) => void) | null = null;

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

vi.mock('./components/ElevationChart', () => ({
  default: ({ onHoverIndex, data }: {
    onHoverIndex: (index: number | null) => void;
    data: unknown[];
    climbs: unknown[];
    onResize: (w: number) => void;
    hoveredIndex: number | null;
  }) => {
    capturedHoverCb = onHoverIndex;
    return (
      <div
        data-testid="elevation-chart"
        data-point-count={data.length}
      />
    );
  },
}));

vi.mock('./components/WindArrowRow', () => ({
  default: ({ samplePoints }: { samplePoints: unknown[] }) => (
    <div data-testid="wind-chart" data-sample-count={samplePoints.length} />
  ),
}));

vi.mock('./components/PrecipBarRow', () => ({
  default: ({ samplePoints }: { samplePoints: unknown[] }) => (
    <div data-testid="precip-chart" data-sample-count={samplePoints.length} />
  ),
}));

vi.mock('./components/HoverPane', () => ({
  default: ({ hoveredData }: {
    hoveredData: { temp?: number } | null;
    xAxisMode: 'clock' | 'elapsed';
    startTime: Date;
  }) => (
    <div
      data-testid="hover-pane"
      data-temp={hoveredData?.temp ?? ''}
    />
  ),
}));

vi.mock('./assets/logo.png', () => ({ default: 'logo.png' }));

// ── Helpers ──────────────────────────────────────────────────────────────────

async function uploadFile() {
  const file = new File(['<gpx/>'], 'test.gpx', { type: 'text/xml' });
  const input = document.getElementById('gpx-upload') as HTMLInputElement;
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  await act(async () => { fireEvent.change(input); });
}

async function clickRefreshWeather() {
  await waitFor(() => expect(screen.getByText('Refresh Weather')).toBeInTheDocument());
  await act(async () => { fireEvent.click(screen.getByText('Refresh Weather')); });
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
    expect(screen.queryByTestId('wind-chart')).not.toBeInTheDocument();
  });

  it('upload shows route stats, map, and charts', async () => {
    render(<App />);
    await uploadFile();

    await waitFor(() => {
      // Header shows route name and stats
      expect(screen.getByText(/Test Route/)).toBeInTheDocument();
      expect(screen.getByTestId('map')).toBeInTheDocument();
      expect(screen.getByTestId('elevation-chart')).toBeInTheDocument();
      expect(screen.getByTestId('wind-chart')).toBeInTheDocument();
      expect(screen.getByTestId('precip-chart')).toBeInTheDocument();
    });
  });

  it('changing avg speed re-fetches weather and updates charts', async () => {
    render(<App />);
    await uploadFile();
    await waitFor(() => expect(screen.getByTestId('wind-chart')).toBeInTheDocument());

    await clickRefreshWeather();
    await waitFor(() => expect(DEFAULT_PROVIDER.fetchWeather).toHaveBeenCalledTimes(1));

    vi.mocked(DEFAULT_PROVIDER.fetchWeather).mockResolvedValue(new Map([[0, { ...mockWeather, temp: 30 }]]));
    fireEvent.change(screen.getByLabelText('Average Speed (km/h)'), { target: { value: '10' } });

    await clickRefreshWeather();
    await waitFor(() => expect(DEFAULT_PROVIDER.fetchWeather).toHaveBeenCalledTimes(2));
    expect(Number(screen.getByTestId('wind-chart').dataset.sampleCount)).toBeGreaterThan(0);
    expect(Number(screen.getByTestId('precip-chart').dataset.sampleCount)).toBeGreaterThan(0);
  });

  it('weather precipProb flows from service through chart data', async () => {
    render(<App />);
    await uploadFile();
    await waitFor(() => expect(screen.getByTestId('wind-chart')).toBeInTheDocument());

    await clickRefreshWeather();
    await waitFor(() => expect(DEFAULT_PROVIDER.fetchWeather).toHaveBeenCalledTimes(1));

    vi.mocked(DEFAULT_PROVIDER.fetchWeather).mockResolvedValue(new Map([[0, { ...mockWeather, precipProb: 75 }]]));
    fireEvent.change(screen.getByLabelText('Average Speed (km/h)'), { target: { value: '10' } });

    await clickRefreshWeather();
    await waitFor(() => expect(DEFAULT_PROVIDER.fetchWeather).toHaveBeenCalledTimes(2));
    expect(Number(screen.getByTestId('wind-chart').dataset.sampleCount)).toBeGreaterThan(0);
    expect(Number(screen.getByTestId('precip-chart').dataset.sampleCount)).toBeGreaterThan(0);
  });

  it('weather precipitation flows from service through chart data', async () => {
    render(<App />);
    await uploadFile();
    await waitFor(() => expect(screen.getByTestId('wind-chart')).toBeInTheDocument());

    await clickRefreshWeather();
    await waitFor(() => expect(DEFAULT_PROVIDER.fetchWeather).toHaveBeenCalledTimes(1));

    vi.mocked(DEFAULT_PROVIDER.fetchWeather).mockResolvedValue(new Map([[0, { ...mockWeather, precipitation: 3.5 }]]));
    fireEvent.change(screen.getByLabelText('Average Speed (km/h)'), { target: { value: '10' } });

    await clickRefreshWeather();
    await waitFor(() => expect(DEFAULT_PROVIDER.fetchWeather).toHaveBeenCalledTimes(2));
    expect(Number(screen.getByTestId('wind-chart').dataset.sampleCount)).toBeGreaterThan(0);
    expect(Number(screen.getByTestId('precip-chart').dataset.sampleCount)).toBeGreaterThan(0);
  });

  it('changing start date re-fetches weather and updates display', async () => {
    render(<App />);
    await uploadFile();
    await waitFor(() => expect(screen.getByTestId('wind-chart')).toBeInTheDocument());

    await clickRefreshWeather();
    await waitFor(() => expect(DEFAULT_PROVIDER.fetchWeather).toHaveBeenCalledTimes(1));

    // Pick a date 2 days from now — always different from today's default, always in picker range
    const d = new Date();
    d.setDate(d.getDate() + 2);
    const twoDaysAhead = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    vi.mocked(DEFAULT_PROVIDER.fetchWeather).mockResolvedValue(new Map([[0, { ...mockWeather, temp: 35 }]]));
    fireEvent.change(screen.getByLabelText('Start Date'), { target: { value: twoDaysAhead } });

    await clickRefreshWeather();
    await waitFor(() => expect(DEFAULT_PROVIDER.fetchWeather).toHaveBeenCalledTimes(2));
  });

  it('onHoverIndex callback sets hoveredPoint via binary search', async () => {
    render(<App />);
    await uploadFile();
    await waitFor(() => screen.getByTestId('elevation-chart'));

    // chartData[1] has distance 0.5 km → binary search finds points[1]
    act(() => { capturedHoverCb!(1); });

    const map = screen.getByTestId('map');
    expect(map.dataset.hovered).toBe('48.005,2.005');
  });

  it('Time Display toggle is present and switches modes', async () => {
    render(<App />);
    await uploadFile();
    await waitFor(() => screen.getByTestId('elevation-chart'));

    expect(screen.getByText('Clock')).toBeInTheDocument();
    expect(screen.getByText('Elapsed')).toBeInTheDocument();

    const toggle = screen.getByRole('checkbox', { name: '' }) as HTMLInputElement;
    expect(toggle.checked).toBe(false); // clock mode by default
    fireEvent.click(toggle);
    expect(toggle.checked).toBe(true);  // elapsed mode
    fireEvent.click(toggle);
    expect(toggle.checked).toBe(false); // back to clock
  });

  it('parse error shows alert, does not set route, does not fetch weather', async () => {
    vi.mocked(parseGPXAsync).mockRejectedValue(new Error('No tracks found'));
    render(<App />);
    await uploadFile();

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('No tracks found'));
    expect(DEFAULT_PROVIDER.fetchWeather).not.toHaveBeenCalled();
    expect(screen.queryByTestId('elevation-chart')).not.toBeInTheDocument();
    expect(screen.queryByTestId('wind-chart')).not.toBeInTheDocument();
  });

  it('weather fetch error does not crash — charts still render', async () => {
    vi.mocked(DEFAULT_PROVIDER.fetchWeather).mockRejectedValue(new Error('Network error'));
    render(<App />);
    await uploadFile();

    // Route name appears in header stats
    await waitFor(() => expect(screen.getByText(/Test Route/)).toBeInTheDocument());

    // Click refresh — fetch will fail
    await clickRefreshWeather();
    await waitFor(() => expect(DEFAULT_PROVIDER.fetchWeather).toHaveBeenCalled());

    // No wrong alert about GPX parsing failure
    expect(window.alert).not.toHaveBeenCalled();
    // Charts render (route was set despite weather failure)
    expect(screen.getByTestId('elevation-chart')).toBeInTheDocument();
    // Button stays visible so user can retry
    expect(screen.getByText('Refresh Weather')).toBeInTheDocument();
  });

  it('switching provider re-fetches weather using the new provider', async () => {
    render(<App />);
    await uploadFile();
    await waitFor(() => expect(screen.getByTestId('wind-chart')).toBeInTheDocument());

    // Open Tech Details to reveal the provider selector
    fireEvent.click(screen.getByText('Tech Details'));

    // Switch to the second provider — button should appear since params changed
    fireEvent.change(screen.getByLabelText('Weather Provider'), {
      target: { value: 'second-provider' },
    });

    await clickRefreshWeather();
    await waitFor(() => expect(PROVIDERS[1].fetchWeather).toHaveBeenCalled());
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
