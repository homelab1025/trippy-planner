// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import { App } from './App';
import { DEFAULT_PROVIDER, PROVIDERS } from './services/weatherProviders';
import { parseGPXAsync } from './workers/gpxWorkerClient';
import { DP_EPSILON_METERS, DP_MAX_GAP_METERS } from './utils/douglasPeucker';
// auth is mocked via vi.mock — no direct imports needed

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

vi.mock('./auth', () => ({
  getToken: vi.fn(() => null),
  setToken: vi.fn(),
  clearToken: vi.fn(),
  isAuthenticated: vi.fn(() => false),
}));

vi.mock('./apiClient', () => ({
  authApi: { getMe: vi.fn() },
  routesApi: {
    createRoute: vi.fn(),
    updateRoute: vi.fn(),
    listRoutes: vi.fn(),
    getRoute: vi.fn(),
  },
  shareApi: { getSharedRoute: vi.fn() },
  versionApi: { getVersion: vi.fn(() => Promise.resolve({ data: undefined })) },
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
  MapComponent: ({ hoveredPoint }: { hoveredPoint: { lat: number; lng: number } | null }) => (
    <div
      data-testid="map"
      data-hovered={hoveredPoint ? `${hoveredPoint.lat},${hoveredPoint.lng}` : ''}
    />
  ),
}));

vi.mock('./components/ElevationChart', () => ({
  ElevationChart: ({ onHoverIndex, data }: {
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
  WindArrowRow: ({ samplePoints }: { samplePoints: unknown[] }) => (
    <div data-testid="wind-chart" data-sample-count={samplePoints.length} />
  ),
}));

vi.mock('./components/PrecipBarRow', () => ({
  PrecipBarRow: ({ samplePoints }: { samplePoints: unknown[] }) => (
    <div data-testid="precip-chart" data-sample-count={samplePoints.length} />
  ),
}));

vi.mock('./components/HoverPane', () => ({
  HoverPane: ({ hoveredData }: {
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

// App persists the working route to real localStorage (see routeStorage.ts). Clear it
// before every test regardless of describe block, so one test's upload doesn't get
// rehydrated on mount by a later, unrelated test.
beforeEach(() => {
  localStorage.clear();
});

// ── Helpers ──────────────────────────────────────────────────────────────────

async function uploadFile() {
  const file = new File(['<gpx/>'], 'test.gpx', { type: 'text/xml' });
  const input = document.getElementById('gpx-upload') as HTMLInputElement;
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  await act(async () => { fireEvent.change(input); });
}

async function clickRefreshWeather() {
  await waitFor(() => expect(screen.getByText('Refresh')).toBeInTheDocument());
  await act(async () => { fireEvent.click(screen.getByText('Refresh')); });
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

    // Auto-fetch runs on load and fails
    await waitFor(() => expect(DEFAULT_PROVIDER.fetchWeather).toHaveBeenCalled());

    // No wrong alert about GPX parsing failure
    expect(window.alert).not.toHaveBeenCalled();
    // Charts render (route was set despite weather failure)
    expect(screen.getByTestId('elevation-chart')).toBeInTheDocument();
    // Button does not show — isDirty requires lastFetchedParams !== null
    expect(screen.queryByText('Refresh')).not.toBeInTheDocument();
  });

  it('switching provider re-fetches weather using the new provider', async () => {
    render(<App />);
    await uploadFile();
    await waitFor(() => expect(DEFAULT_PROVIDER.fetchWeather).toHaveBeenCalledTimes(1));

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

  it('DP Epsilon and Max Gap remain editable after a route is loaded', async () => {
    render(<App />);
    await uploadFile();
    await waitFor(() => screen.getByTestId('elevation-chart'));

    fireEvent.click(screen.getByText('Tech Details'));

    expect(screen.getByLabelText('DP Epsilon (m)')).not.toBeDisabled();
    expect(screen.getByLabelText('Max Gap (m)')).not.toBeDisabled();
  });

  it('DP Epsilon help icon opens an explanatory tooltip on click', async () => {
    render(<App />);
    await uploadFile();
    await waitFor(() => screen.getByTestId('elevation-chart'));

    fireEvent.click(screen.getByText('Tech Details'));

    fireEvent.click(screen.getByRole('button', { name: 'DP Epsilon help' }));
    expect(screen.getByRole('tooltip')).toHaveTextContent(/deviate/);
  });

  it('Max Gap help icon opens an explanatory tooltip on click', async () => {
    render(<App />);
    await uploadFile();
    await waitFor(() => screen.getByTestId('elevation-chart'));

    fireEvent.click(screen.getByText('Tech Details'));

    fireEvent.click(screen.getByRole('button', { name: 'Max Gap help' }));
    expect(screen.getByRole('tooltip')).toHaveTextContent(/consecutive points/);
  });

  it('editing DP Epsilon and blurring re-parses the route and re-fetches weather', async () => {
    render(<App />);
    await uploadFile();
    await waitFor(() => expect(parseGPXAsync).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(DEFAULT_PROVIDER.fetchWeather).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByText('Tech Details'));
    const epsilonInput = screen.getByLabelText('DP Epsilon (m)');
    fireEvent.change(epsilonInput, { target: { value: '10' } });
    await act(async () => { fireEvent.blur(epsilonInput); });

    await waitFor(() => expect(parseGPXAsync).toHaveBeenCalledTimes(2));
    expect(parseGPXAsync).toHaveBeenLastCalledWith(expect.any(String), 10, expect.any(Number));
    await waitFor(() => expect(DEFAULT_PROVIDER.fetchWeather).toHaveBeenCalledTimes(2));
  });

  it('pressing Enter in Max Gap commits the change like blur', async () => {
    render(<App />);
    await uploadFile();
    await waitFor(() => expect(parseGPXAsync).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByText('Tech Details'));
    const maxGapInput = screen.getByLabelText('Max Gap (m)');
    maxGapInput.focus();
    fireEvent.change(maxGapInput, { target: { value: '75' } });
    await act(async () => { fireEvent.keyDown(maxGapInput, { key: 'Enter' }); });

    await waitFor(() => expect(parseGPXAsync).toHaveBeenCalledTimes(2));
    expect(parseGPXAsync).toHaveBeenLastCalledWith(expect.any(String), expect.any(Number), 75);
  });

  it('blurring DP Epsilon without changing its value does not re-parse', async () => {
    render(<App />);
    await uploadFile();
    await waitFor(() => expect(parseGPXAsync).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByText('Tech Details'));
    const epsilonInput = screen.getByLabelText('DP Epsilon (m)');
    await act(async () => { fireEvent.blur(epsilonInput); });
    await act(async () => { await Promise.resolve(); });

    expect(parseGPXAsync).toHaveBeenCalledTimes(1);
  });

  it('Reset to defaults button appears after Max Gap and restores both values', async () => {
    render(<App />);
    await uploadFile();
    await waitFor(() => expect(parseGPXAsync).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByText('Tech Details'));
    const epsilonInput = screen.getByLabelText('DP Epsilon (m)') as HTMLInputElement;
    const maxGapInput = screen.getByLabelText('Max Gap (m)') as HTMLInputElement;

    fireEvent.change(epsilonInput, { target: { value: '10' } });
    await act(async () => { fireEvent.blur(epsilonInput); });
    fireEvent.change(maxGapInput, { target: { value: '75' } });
    await act(async () => { fireEvent.blur(maxGapInput); });
    await waitFor(() => expect(parseGPXAsync).toHaveBeenCalledTimes(3));

    const resetButton = screen.getByRole('button', { name: /reset to defaults/i });
    await act(async () => { fireEvent.click(resetButton); });

    await waitFor(() => expect(parseGPXAsync).toHaveBeenCalledTimes(4));
    expect(parseGPXAsync).toHaveBeenLastCalledWith(expect.any(String), DP_EPSILON_METERS, DP_MAX_GAP_METERS);
    expect(epsilonInput.value).toBe(String(DP_EPSILON_METERS));
    expect(maxGapInput.value).toBe(String(DP_MAX_GAP_METERS));
  });

  it('clicking Reset to defaults when already at defaults does not re-parse', async () => {
    render(<App />);
    await uploadFile();
    await waitFor(() => expect(parseGPXAsync).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByText('Tech Details'));
    const resetButton = screen.getByRole('button', { name: /reset to defaults/i });
    await act(async () => { fireEvent.click(resetButton); });
    await act(async () => { await Promise.resolve(); });

    expect(parseGPXAsync).toHaveBeenCalledTimes(1);
  });
});

describe('new UI theme', () => {
  afterEach(() => {
    window.history.pushState({}, '', '/');
    document.documentElement.removeAttribute('data-theme');
    cleanup();
  });

  it('sets data-theme to alpine and drops the max-width wrapper when ?ui=new', async () => {
    window.history.pushState({}, '', '/?ui=new');
    render(<App />);
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('alpine'));
    expect(document.querySelector('.max-w-\\[1400px\\]')).not.toBeInTheDocument();
  });

  it('sets data-theme to emerald and keeps the max-width wrapper without the param', async () => {
    window.history.pushState({}, '', '/');
    render(<App />);
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('emerald'));
    expect(document.querySelector('.max-w-\\[1400px\\]')).toBeInTheDocument();
  });
});

describe('token landing', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/')
  })

  it('stores token from URL and strips it', async () => {
    const { setToken } = await import('./auth')
    const { authApi } = await import('./apiClient')
    vi.mocked(setToken).mockImplementation(() => {})
    vi.mocked(authApi.getMe).mockResolvedValue({ data: { id: 1, email: 'a@b.com' } })

    window.history.replaceState({}, '', '/?token=mytesttoken')
    render(<App />)

    await waitFor(() => {
      expect(setToken).toHaveBeenCalledWith('mytesttoken')
      expect(window.location.search).toBe('')
    })
  })
})

describe('public route view', () => {
  it('loads a shared route from /share/:token URL', async () => {
    window.history.replaceState({}, '', '/share/publictoken123')

    const { shareApi, authApi } = await import('./apiClient')
    vi.mocked(shareApi.getSharedRoute).mockResolvedValue({
      data: {
        id: 'uuid-1',
        name: 'Shared Alpine Loop',
        gpxContent: '<gpx><trk><trkseg></trkseg></trk></gpx>',
        avgSpeedKmh: 20,
        startTime: '2026-06-17T08:00:00Z',
        isPublic: true,
      },
    })
    vi.mocked(authApi.getMe).mockRejectedValue(new Error('unauthorized'))

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText(/viewing a shared route/i)).toBeInTheDocument()
    })
  })
})

describe('save / update lifecycle', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/')
    vi.clearAllMocks()
    vi.mocked(parseGPXAsync).mockResolvedValue(mockRoute)
    vi.mocked(DEFAULT_PROVIDER.fetchWeather).mockResolvedValue(new Map([[0, mockWeather]]))
  })

  afterEach(() => {
    vi.restoreAllMocks()
    cleanup()
  })

  async function renderAuthenticated() {
    const { isAuthenticated } = await import('./auth')
    const { authApi, routesApi } = await import('./apiClient')
    vi.mocked(isAuthenticated).mockReturnValue(true)
    vi.mocked(authApi.getMe).mockResolvedValue({ data: { id: 1, email: 'a@b.com' } })
    vi.mocked(routesApi.listRoutes).mockResolvedValue({ data: [] })
    return routesApi
  }

  it('a freshly uploaded route offers no "Save as new" option even after a previous route was saved', async () => {
    const routesApi = await renderAuthenticated()
    vi.mocked(routesApi.createRoute).mockResolvedValue({ data: { id: 'saved-1' } })

    render(<App />)
    await uploadFile()
    await waitFor(() => screen.getByRole('button', { name: /save route/i }))

    fireEvent.click(screen.getByRole('button', { name: /save route/i }))
    await waitFor(() => expect(screen.getByRole('button', { name: /save as new/i })).toBeInTheDocument())

    // Uploading a different GPX file starts a brand new, unsaved route
    vi.mocked(parseGPXAsync).mockResolvedValue({ ...mockRoute, name: 'Second Route' })
    await uploadFile()

    await waitFor(() => expect(screen.getByRole('button', { name: /save route/i })).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /save as new/i })).not.toBeInTheDocument()
  })

  it('re-saving an already-saved route updates it instead of creating a duplicate', async () => {
    const routesApi = await renderAuthenticated()
    vi.mocked(routesApi.createRoute).mockResolvedValue({ data: { id: 'saved-1' } })
    vi.mocked(routesApi.updateRoute).mockResolvedValue({ data: { id: 'saved-1' } })

    render(<App />)
    await uploadFile()
    await waitFor(() => screen.getByRole('button', { name: /save route/i }))
    fireEvent.click(screen.getByRole('button', { name: /save route/i }))
    await waitFor(() => expect(routesApi.createRoute).toHaveBeenCalledTimes(1))

    fireEvent.click(await screen.findByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(routesApi.updateRoute).toHaveBeenCalledWith('saved-1', expect.any(Object)))
    expect(routesApi.createRoute).toHaveBeenCalledTimes(1)
  })

  it('loading a route from My Routes tracks its id so Save updates it, and shows its name', async () => {
    const routesApi = await renderAuthenticated()
    vi.mocked(routesApi.listRoutes).mockResolvedValue({
      data: [{ id: 'route-9', name: 'Alpine Loop', avgSpeedKmh: 18, isPublic: false,
        startTime: '2026-06-17T08:00:00Z', createdAt: '2026-06-17T08:00:00Z' }],
    })
    vi.mocked(routesApi.getRoute).mockResolvedValue({
      data: { id: 'route-9', name: 'Alpine Loop', gpxContent: '<gpx/>', avgSpeedKmh: 18,
        startTime: '2026-06-17T08:00:00Z', isPublic: false, createdAt: '2026-06-17T08:00:00Z' },
    })
    vi.mocked(routesApi.updateRoute).mockResolvedValue({ data: { id: 'route-9' } })

    render(<App />)
    await waitFor(() => screen.getByText('Alpine Loop'))
    fireEvent.click(screen.getByText('Alpine Loop'))

    fireEvent.click(await screen.findByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(routesApi.updateRoute).toHaveBeenCalledWith('route-9', expect.objectContaining({ name: 'Alpine Loop' })))
    expect(routesApi.createRoute).not.toHaveBeenCalled()
  })

  it('saving a renamed route refreshes the My Routes list', async () => {
    const routesApi = await renderAuthenticated()
    vi.mocked(routesApi.createRoute).mockResolvedValue({ data: { id: 'saved-1' } })
    vi.mocked(routesApi.updateRoute).mockResolvedValue({ data: { id: 'saved-1' } })
    const listItem = { id: 'saved-1', avgSpeedKmh: 20, isPublic: false, startTime: '2026-06-17T08:00:00Z', createdAt: '2026-06-17T08:00:00Z' }
    vi.mocked(routesApi.listRoutes)
      .mockResolvedValueOnce({ data: [] }) // before the route is ever saved
      .mockResolvedValueOnce({ data: [{ ...listItem, name: 'Test Route' }] }) // right after create
      .mockResolvedValueOnce({ data: [{ ...listItem, name: 'Renamed Route' }] }) // right after the rename is saved

    render(<App />)
    await uploadFile()
    await waitFor(() => screen.getByRole('button', { name: /save route/i }))
    fireEvent.click(screen.getByRole('button', { name: /save route/i }))
    await waitFor(() => expect(routesApi.createRoute).toHaveBeenCalledTimes(1))
    await screen.findByText('Test Route') // My Routes list picked up the create

    fireEvent.change(screen.getByLabelText(/route name/i), { target: { value: 'Renamed Route' } })
    fireEvent.click(await screen.findByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(routesApi.updateRoute).toHaveBeenCalledWith('saved-1', expect.objectContaining({ name: 'Renamed Route' })))
    await screen.findByText('Renamed Route') // My Routes list picked up the rename
    expect(screen.queryByText('Test Route')).not.toBeInTheDocument()
  })
})

describe('backend version display', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/')
  })

  afterEach(() => {
    cleanup()
  })

  it('shows the backend version and build time under the frontend version', async () => {
    const { versionApi } = await import('./apiClient')
    vi.mocked(versionApi.getVersion).mockResolvedValue({
      data: { version: '2.2.0', buildTime: '2026-08-15T12:00:00Z' },
    })

    render(<App />)
    fireEvent.click(screen.getByText('Tech Details'))

    await waitFor(() => {
      expect(screen.getByText('Backend v2.2.0')).toBeInTheDocument()
    })
  })

  it('shows nothing for the backend version when the fetch fails', async () => {
    const { versionApi } = await import('./apiClient')
    vi.mocked(versionApi.getVersion).mockRejectedValue(new Error('network error'))

    render(<App />)
    fireEvent.click(screen.getByText('Tech Details'))

    await waitFor(() => {
      expect(versionApi.getVersion).toHaveBeenCalled()
    })
    // Only the frontend's own version line should render — the backend
    // one is conditional on a successful fetch, with no fallback text.
    expect(screen.queryByText(/^Frontend v/)).toBeInTheDocument()
    expect(screen.queryByText(/^Backend v/)).not.toBeInTheDocument()
  })
})
