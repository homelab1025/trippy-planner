import React, { useState, useCallback, useMemo } from 'react';
import { setToken, clearToken, isAuthenticated } from './auth';
import { authApi } from './apiClient';
import { format } from 'date-fns';
import { Upload, Map as MapIcon, CloudRain, RefreshCw, CircleHelp, RotateCcw } from 'lucide-react';
import logo from './assets/logo.png';
import { parseGPXAsync } from './workers/gpxWorkerClient';
import type { RouteData, RoutePoint } from './utils/gpxParser';
import { DP_EPSILON_METERS, DP_MAX_GAP_METERS } from './utils/douglasPeucker';
import { detectClimbs } from './utils/climbDetector';
import { loadStoredRoute, saveStoredRoute, clearStoredRoute } from './services/routeStorage';
import { PROVIDERS, DEFAULT_PROVIDER, setWeatherDebug } from './services/weatherProviders';
import type { WeatherProvider, WeatherRequest } from './services/weatherProviders';
import { MapComponent } from './components/MapComponent';
import { SaveRouteButton } from './components/SaveRouteButton';
import { SignInPanel } from './components/SignInPanel';
import { MyRoutesPanel } from './components/MyRoutesPanel';
import { ShareToggle } from './components/ShareToggle';
import { shareApi } from './apiClient';
import { versionApi } from './apiClient';
import { AuthHeader } from './components/AuthHeader';
import { ElevationChart } from './components/ElevationChart';
import { HoverPane } from './components/HoverPane';
import { WindArrowRow } from './components/WindArrowRow';
import { PrecipBarRow } from './components/PrecipBarRow';
import { CheckpointTrackRow } from './components/CheckpointTrackRow';
import { Tooltip } from './components/Tooltip';
import { useWeatherChartData } from './hooks/useWeatherChartData';
import type { ChartDataPoint, WeatherSample } from './hooks/useWeatherChartData';
import type { Checkpoint } from './utils/speedProfile';
import { computeArrivalTime, defaultCheckpoints, buildSequence, impliedSpeedKmh } from './utils/speedProfile';

const getLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getLocalTimeString = (date: Date): string => {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

function App() {
  const [route, setRoute] = useState<RouteData | null>(null);
  const [avgSpeed, setAvgSpeed] = useState(25);
  const [startTime, setStartTime] = useState<Date>(new Date());
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  // Checkpoints not yet manually edited ("pinned: false") keep tracking Average
  // Speed / Start Time live; once a checkpoint's time is explicitly set it detaches.
  const effectiveCheckpoints = useMemo(
    () => checkpoints.map(cp => cp.pinned ? cp : {
      ...cp,
      arrivalTime: new Date(startTime.getTime() + (cp.distanceM / (avgSpeed * 1000)) * 3_600_000),
    }),
    [checkpoints, avgSpeed, startTime]
  );
  const [weatherPoints, setWeatherPoints] = useState<WeatherSample[]>([]);
  const [loading, setLoading] = useState(false);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [hoveredData, setHoveredData] = useState<ChartDataPoint | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [xAxisMode, setXAxisMode] = useState<'clock' | 'elapsed'>('clock');
  const [dpEpsilon, setDpEpsilon] = useState(DP_EPSILON_METERS);
  const [dpMaxGap, setDpMaxGap] = useState(DP_MAX_GAP_METERS);
  const [weatherDebug, setWeatherDebugState] = useState(false);
  const [activePanel, setActivePanel] = useState<'ride' | 'checkpoints' | 'routes' | 'tech' | null>('ride');
  const [selectedProvider, setSelectedProvider] = useState<WeatherProvider>(DEFAULT_PROVIDER);
  const [chartWidth, setChartWidth] = useState(800);
  const [lastFetchedParams, setLastFetchedParams] = useState<{
    avgSpeed: number;
    startTime: Date;
    selectedProvider: WeatherProvider;
    checkpoints: Checkpoint[];
  } | null>(null);

  const [user, setUser] = useState<{ id: number; email: string } | null>(null);
  const [backendVersion, setBackendVersion] = useState<{ version: string; buildTime: string } | null>(null);
  const [rawGpxContent, setRawGpxContent] = useState<string | null>(null);
  const [routeName, setRouteName] = useState('');
  const [savedRouteId, setSavedRouteId] = useState<string | null>(null);
  const [routesRefreshToken, setRoutesRefreshToken] = useState(0);
  const [isViewingShared, setIsViewingShared] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);

  const buildDate = format(new Date(__BUILD_DATE__), 'd MMM yyyy HH:mm');

  const climbs = useMemo(
    () => (route ? detectClimbs(route.points) : []),
    [route]
  );

  const chartData = useWeatherChartData({
    route,
    weatherPoints,
    chartWidth,
    startTime,
    checkpoints: effectiveCheckpoints,
    weatherStartTime: lastFetchedParams?.startTime,
    weatherCheckpoints: lastFetchedParams?.checkpoints,
  });

  const elevationData = useMemo(
    () => chartData.map(({ distance, elevation, temp }) => ({ distance, elevation, temp })),
    [chartData]
  );

  const samplePoints = useMemo(
    () => chartData.filter(p => p.isSample),
    [chartData]
  );

  const distanceRange = useMemo(
    (): [number, number] => chartData.length
      ? [chartData[0].distance, chartData[chartData.length - 1].distance]
      : [0, 1],
    [chartData]
  );

  const todayStr = getLocalDateString(new Date());
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 7);
  const maxDateStr = getLocalDateString(maxDate);

  const handleDateChange = (dateStr: string) => {
    if (!dateStr) return;
    const [year, month, day] = dateStr.split('-').map(Number);
    const newDate = new Date(startTime);
    newDate.setFullYear(year);
    newDate.setMonth(month - 1);
    newDate.setDate(day);
    setStartTime(newDate);
  };

  // TODO: test handleTimeChange - verify time parsing, boundary conditions (midnight rollover), and that it correctly updates startTime state
  const handleTimeChange = (timeStr: string) => {
    if (!timeStr) return;
    const [hours, minutes] = timeStr.split(':').map(Number);
    const newDate = new Date(startTime);
    newDate.setHours(hours);
    newDate.setMinutes(minutes);
    newDate.setSeconds(0);
    newDate.setMilliseconds(0);
    setStartTime(newDate);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const text = await file.text();
      const fileSizeKb = file.size / 1024;
      performance.mark('gpx-parse-start');
      const parsedRoute = await parseGPXAsync(text, dpEpsilon, dpMaxGap);
      performance.mark('gpx-parse-end');
      const measure = performance.measure('gpx-parse', 'gpx-parse-start', 'gpx-parse-end');
      console.log(`[gpx] parsed in ${measure.duration.toFixed(0)}ms (file: ${fileSizeKb.toFixed(1)}KB)`);
      appliedTechParamsRef.current = { dpEpsilon, dpMaxGap };
      setRawGpxContent(text);
      setRoute(parsedRoute);
      setRouteName(parsedRoute.name);
      setSavedRouteId(null);
      // A new GPX means the old checkpoint distances are meaningless — reset to
      // just the mandatory end checkpoint, seeded from the current Average Speed.
      const freshCheckpoints = defaultCheckpoints(parsedRoute.totalDistance, avgSpeed, startTime);
      setCheckpoints(freshCheckpoints);
      setWeatherLoading(true);
      const success = await updateWeather(parsedRoute, freshCheckpoints, startTime, selectedProvider);
      if (success) setLastFetchedParams({ avgSpeed, startTime, selectedProvider, checkpoints: freshCheckpoints });
    } catch (error) {
      console.error('Failed to parse GPX:', error);
      const message = error instanceof Error ? error.message : 'Failed to parse GPX file. Please ensure it is a valid track.';
      alert(message);
    } finally {
      setLoading(false);
      setWeatherLoading(false);
    }
  };

  const isDirty = route !== null &&
    lastFetchedParams !== null && (
      lastFetchedParams.avgSpeed !== avgSpeed ||
      lastFetchedParams.startTime.getTime() !== startTime.getTime() ||
      lastFetchedParams.selectedProvider !== selectedProvider ||
      JSON.stringify(lastFetchedParams.checkpoints) !== JSON.stringify(effectiveCheckpoints)
    );

  const updateWeather = useCallback(async (currentRoute: RouteData, cps: Checkpoint[], start: Date, provider: WeatherProvider): Promise<boolean> => {
    let weatherPointsDistance = 5000;
    let weatherPointsCount = currentRoute.totalDistance / weatherPointsDistance;
    if (weatherPointsCount < 10) {
      weatherPointsCount = 10;
      weatherPointsDistance = currentRoute.totalDistance / weatherPointsCount;
    }
    const requestMap = new Map<number, WeatherRequest>();
    const metaMap = new Map<number, { point: RoutePoint; arrivalTime: Date; label: string }>();
    const seenIndices = new Set<number>();
    for (let i = 0; i <= weatherPointsCount; i++) {
      const distance = i * weatherPointsDistance;
      const idx = currentRoute.points.findIndex(p => p.distance >= distance);
      const pointIdx = idx === -1 ? currentRoute.points.length - 1 : idx;
      if (seenIndices.has(pointIdx)) continue;
      seenIndices.add(pointIdx);
      const point = currentRoute.points[pointIdx];
      const arrivalTime = computeArrivalTime(distance, start, cps);
      requestMap.set(pointIdx, { lat: point.lat, lon: point.lng, timestamp: arrivalTime.getTime() / 1000 });
      metaMap.set(pointIdx, { point, arrivalTime, label: String(pointIdx) });
    }
    try {
      const weatherResult = await provider.fetchWeather(requestMap);
      const filtered: WeatherSample[] = [];
      for (const [key, weather] of weatherResult) {
        if (weather === null) continue;
        const meta = metaMap.get(key);
        if (!meta) continue;
        filtered.push({ ...weather, ...meta });
      }
      setWeatherPoints(filtered);
      return true;
    } catch (error) {
      console.error('Weather fetch failed:', error);
      setWeatherPoints([]);
      return false;
    }
  }, []);

  const loadRouteFromGpxText = useCallback(async (gpxContent: string, speed: number, start: Date, epsilon: number, maxGap: number, cps?: Checkpoint[]) => {
    setRawGpxContent(gpxContent);
    const parsedRoute = await parseGPXAsync(gpxContent, epsilon, maxGap);
    appliedTechParamsRef.current = { dpEpsilon: epsilon, dpMaxGap: maxGap };
    setRoute(parsedRoute);
    const resolvedCheckpoints = cps ?? defaultCheckpoints(parsedRoute.totalDistance, speed, start);
    setCheckpoints(resolvedCheckpoints);
    setWeatherLoading(true);
    try {
      const success = await updateWeather(parsedRoute, resolvedCheckpoints, start, selectedProvider);
      if (success) setLastFetchedParams({ avgSpeed: speed, startTime: start, selectedProvider, checkpoints: resolvedCheckpoints });
    } finally {
      setWeatherLoading(false);
    }
  }, [selectedProvider, updateWeather]);

  const handleRefreshWeather = useCallback(async () => {
    if (!route) return;
    setWeatherLoading(true);
    try {
      const success = await updateWeather(route, effectiveCheckpoints, startTime, selectedProvider);
      if (success) setLastFetchedParams({ avgSpeed, startTime, selectedProvider, checkpoints: effectiveCheckpoints });
    } finally {
      setWeatherLoading(false);
    }
  }, [route, effectiveCheckpoints, avgSpeed, startTime, selectedProvider, updateWeather]);

  // Tracks the DP epsilon/maxGap actually baked into the current `route`, so a blur/Enter
  // that didn't change either value is a no-op instead of a redundant re-parse.
  const appliedTechParamsRef = React.useRef<{ dpEpsilon: number; dpMaxGap: number } | null>(null);
  const techCommitInFlightRef = React.useRef(false);

  const applyTechParams = useCallback(async (epsilon: number, maxGap: number) => {
    if (!route || !rawGpxContent || techCommitInFlightRef.current) return;
    const applied = appliedTechParamsRef.current;
    if (applied && applied.dpEpsilon === epsilon && applied.dpMaxGap === maxGap) return;

    techCommitInFlightRef.current = true;
    try {
      performance.mark('gpx-reparse-start');
      const parsedRoute = await parseGPXAsync(rawGpxContent, epsilon, maxGap);
      performance.mark('gpx-reparse-end');
      const measure = performance.measure('gpx-reparse', 'gpx-reparse-start', 'gpx-reparse-end');
      console.log(`[gpx] re-parsed in ${measure.duration.toFixed(0)}ms`);
      appliedTechParamsRef.current = { dpEpsilon: epsilon, dpMaxGap: maxGap };
      setRoute(parsedRoute);
      setHoveredIndex(null);
      setHoveredPoint(null);
      setHoveredData(null);
      setWeatherLoading(true);
      const params = lastFetchedParams ?? { avgSpeed, startTime, selectedProvider, checkpoints: effectiveCheckpoints };
      try {
        const success = await updateWeather(parsedRoute, params.checkpoints, params.startTime, params.selectedProvider);
        if (success) setLastFetchedParams(params);
      } finally {
        setWeatherLoading(false);
      }
    } finally {
      techCommitInFlightRef.current = false;
    }
  }, [route, rawGpxContent, lastFetchedParams, avgSpeed, startTime, selectedProvider, effectiveCheckpoints, updateWeather]);

  const commitTechParams = useCallback(() => {
    applyTechParams(dpEpsilon, dpMaxGap);
  }, [applyTechParams, dpEpsilon, dpMaxGap]);

  const handleTechParamKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') e.currentTarget.blur();
  };

  const handleResetTechParams = useCallback(() => {
    setDpEpsilon(DP_EPSILON_METERS);
    setDpMaxGap(DP_MAX_GAP_METERS);
    applyTechParams(DP_EPSILON_METERS, DP_MAX_GAP_METERS);
  }, [applyTechParams]);

  React.useEffect(() => {
    setWeatherDebug(weatherDebug);
  }, [weatherDebug]);

  // Token landing — runs once on mount
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      setToken(token);
      params.delete('token');
      const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
      history.replaceState(null, '', newUrl);
    }

    if (isAuthenticated()) {
      authApi.getMe()
        .then(res => setUser(res.data))
        .catch(() => {
          clearToken();
          setUser(null);
        });
    }

    versionApi.getVersion()
      .then(res => setBackendVersion(res.data))
      .catch(() => setBackendVersion(null));

    const pathParts = window.location.pathname.split('/');
    const isSharePath = pathParts[1] === 'share' && !!pathParts[2];

    if (isSharePath) {
      const shareToken = pathParts[2];
      shareApi.getSharedRoute(shareToken)
        .then(res => {
          const data = res.data;
          const speed = data.avgSpeedKmh as number;
          const start = new Date(data.startTime as string);
          setIsViewingShared(true);
          setAvgSpeed(speed);
          setStartTime(start);
          setRouteName(data.name as string);
          loadRouteFromGpxText(data.gpxContent as string, speed, start, dpEpsilon, dpMaxGap, undefined);
        })
        .catch(() => {
          // Token invalid or route made private — let user upload
        });
    } else {
      const stored = loadStoredRoute();
      if (stored) {
        const start = new Date(stored.startTime);
        const epsilon = stored.dpEpsilonMeters ?? DP_EPSILON_METERS;
        const maxGap = stored.dpMaxGapMeters ?? DP_MAX_GAP_METERS;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time mount initialization from localStorage, not a prop-sync pattern
        setAvgSpeed(stored.avgSpeedKmh);
        setStartTime(start);
        setRouteName(stored.name);
        setSavedRouteId(stored.id ?? null);
        setDpEpsilon(epsilon);
        setDpMaxGap(maxGap);
        loadRouteFromGpxText(stored.gpxContent, stored.avgSpeedKmh, start, epsilon, maxGap, undefined)
          .catch(() => clearStoredRoute());
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally runs once on mount
  }, []);

  // Mirror the working route to localStorage so it survives a full-page reload
  // (e.g. the one triggered by clicking a magic-link email — see #44).
  React.useEffect(() => {
    if (isViewingShared) return;
    if (!route || !rawGpxContent) return;
    saveStoredRoute({
      name: routeName,
      gpxContent: rawGpxContent,
      avgSpeedKmh: avgSpeed,
      startTime: startTime.toISOString(),
      id: savedRouteId ?? undefined,
      dpEpsilonMeters: dpEpsilon,
      dpMaxGapMeters: dpMaxGap,
    });
  }, [route, rawGpxContent, avgSpeed, startTime, isViewingShared, routeName, savedRouteId, dpEpsilon, dpMaxGap]);

  const onHoverIndex = useCallback((index: number | null) => {
    setHoveredIndex(index);
    if (index === null || !route) {
      setHoveredPoint(null);
      setHoveredData(null);
      return;
    }
    const point = chartData[index];
    if (!point) { setHoveredPoint(null); setHoveredData(null); return; }
    const targetM = point.distance * 1000;
    const points = route.points;
    let lo = 0, hi = points.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (points[mid].distance < targetM) lo = mid + 1;
      else hi = mid;
    }
    setHoveredPoint({ lat: points[lo].lat, lng: points[lo].lng });
    setHoveredData(point);
  }, [route, chartData]);

  return (
    <div className="flex flex-col h-screen overflow-y-auto w-full p-3 sm:p-6 gap-4 sm:gap-6">
      <SignInPanel open={signInOpen} onClose={() => setSignInOpen(false)} />

      {/* Navbar with logo overlapping its bottom-left edge on lg+; inline on mobile */}
      <div className="relative flex-shrink-0">
        <div className="navbar bg-primary text-primary-content rounded-box shadow-lg lg:pl-[185px] pr-4 min-h-[58px]">
          {/* Logo inline on mobile only */}
          <div className="flex-none lg:hidden mr-2">
            <img src={logo} alt="Trippy Planner" className="h-9 w-auto" />
          </div>
          <div className="flex-none gap-3">
            <h1 className="text-xl font-bold">Trippy Planner</h1>
            <AuthHeader
              user={user}
              onSignOut={async () => {
                try {
                  await authApi.deleteSession()
                } catch {
                  // ignore - proceed to clear local session regardless
                }
                clearToken()
                setUser(null)
              }}
              onSignIn={() => setSignInOpen(true)}
            />
          </div>
        {route && (
          <div className="header-stats hidden md:flex flex-1 text-center text-sm opacity-90 px-4">
            {routeName}: {(route.totalDistance / 1000).toFixed(1)} km · {Math.round(route.totalElevationGain)} m of character-building
          </div>
        )}
        {isViewingShared && (
          <div className="badge badge-info badge-sm">Viewing a shared route</div>
        )}
        <div className="flex-none ml-auto">
          <label
            htmlFor="gpx-upload"
            className={`btn btn-sm btn-outline text-primary-content border-primary-content hover:bg-primary-content hover:text-primary gap-2 ${loading ? 'btn-disabled pointer-events-none' : ''}`}
          >
            {loading ? (
              <span className="hidden sm:inline">Processing...</span>
            ) : (
              <>
                <Upload size={16} />
                <span className="hidden sm:inline">Upload GPX</span>
              </>
            )}
          </label>
          <input id="gpx-upload" type="file" accept=".gpx" onChange={handleFileUpload} disabled={loading} className="hidden" />
        </div>
        </div>
        {/* Logo overflowing below navbar — desktop only */}
        <div className="hidden lg:block absolute bottom-0 left-1 translate-y-1/2 z-10">
          <img
            src={logo}
            alt="Trippy Planner"
            className="h-[102px] w-auto drop-shadow-lg"
          />
        </div>
      </div>

      {/* Main grid */}
      <div className="grid lg:grid-cols-[320px_1fr] grid-cols-1 gap-4 sm:gap-6 flex-1 min-h-0">

        {/* Sidebar — single-open accordion via collapse-open + activePanel state */}
        <div className="flex flex-col overflow-y-auto lg:pt-7">

          {/* Ride Details */}
          <div className={`control-card collapse collapse-arrow bg-base-100 shadow rounded-b-none rounded-t-box border border-base-300 ${activePanel === 'ride' ? 'collapse-open' : ''}`}>
            <div
              className="collapse-title font-medium cursor-pointer"
              onClick={() => setActivePanel(p => p === 'ride' ? null : 'ride')}
            >
              Ride Details
            </div>
            <div className="collapse-content flex flex-col gap-3">

              <div className="form-control w-full">
                <label htmlFor="avg-speed" className="label pb-1">
                  <span className="label-text">Average Speed (km/h)</span>
                </label>
                <input
                  id="avg-speed"
                  type="number"
                  value={avgSpeed}
                  onChange={(e) => setAvgSpeed(Number(e.target.value))}
                  min="5"
                  max="60"
                  className="input input-bordered input-sm w-full"
                />
              </div>

              <div className="flex gap-2">
                <div className="form-control flex-1">
                  <label htmlFor="start-date" className="label pb-1">
                    <span className="label-text">Start Date</span>
                  </label>
                  <input
                    id="start-date"
                    type="date"
                    value={getLocalDateString(startTime)}
                    onChange={(e) => handleDateChange(e.target.value)}
                    min={todayStr}
                    max={maxDateStr}
                    className="input input-bordered input-sm w-full"
                  />
                </div>
                <div className="form-control flex-1">
                  <label htmlFor="start-time" className="label pb-1">
                    <span className="label-text">Start Time</span>
                  </label>
                  <input
                    id="start-time"
                    type="time"
                    value={getLocalTimeString(startTime)}
                    onChange={(e) => handleTimeChange(e.target.value)}
                    className="input input-bordered input-sm w-full"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 w-full">
                <span className="label-text text-sm">Clock</span>
                <input
                  id="xaxis-toggle"
                  type="checkbox"
                  className="toggle toggle-primary toggle-sm"
                  checked={xAxisMode === 'elapsed'}
                  onChange={(e) => setXAxisMode(e.target.checked ? 'elapsed' : 'clock')}
                />
                <span className="label-text text-sm">Elapsed</span>
                {isDirty && (
                  <button
                    className={`btn btn-sm btn-primary ml-auto gap-1.5 ${weatherLoading ? 'btn-disabled' : ''}`}
                    onClick={handleRefreshWeather}
                    disabled={weatherLoading}
                  >
                    {weatherLoading ? (
                      <span className="loading loading-spinner loading-xs" />
                    ) : (
                      <RefreshCw size={13} />
                    )}
                    {weatherLoading ? 'Fetching…' : 'Refresh'}
                  </button>
                )}
              </div>

            </div>
          </div>

          {/* Checkpoints */}
          {route && (
            <div className={`collapse collapse-arrow bg-base-100 shadow rounded-none border-x border-b border-base-300 ${activePanel === 'checkpoints' ? 'collapse-open' : ''}`}>
              <div
                className="collapse-title font-medium cursor-pointer"
                onClick={() => setActivePanel(p => p === 'checkpoints' ? null : 'checkpoints')}
              >
                Checkpoints
              </div>
              <div className="collapse-content flex flex-col gap-1.5">
                {buildSequence(startTime, effectiveCheckpoints).map((p, i, seq) => {
                  const label = i === 0 ? 'Start' : i === seq.length - 1 ? 'Finish' : `CP ${i}`;
                  const speed = i > 0 ? impliedSpeedKmh(seq[i - 1], p) : null;
                  return (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span>{label} · {(p.distanceM / 1000).toFixed(1)} km</span>
                      <span className="font-mono">
                        {p.arrivalTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {speed !== null && <span className="text-base-content/50 text-xs ml-1">({Math.round(speed)} km/h)</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {((route && rawGpxContent && !isViewingShared) || (user && savedRouteId && !isViewingShared)) && (
            <div className="bg-base-100 shadow rounded-none border-x border-b border-base-300 p-4">
              <div className="flex flex-col gap-2">
                {route && rawGpxContent && !isViewingShared && (
                  <SaveRouteButton
                    isAuthenticated={isAuthenticated()}
                    name={routeName}
                    onNameChange={setRouteName}
                    routeData={{
                      gpxContent: rawGpxContent,
                      avgSpeedKmh: avgSpeed,
                      startTime: startTime.toISOString(),
                    }}
                    savedRouteId={savedRouteId}
                    onSaved={(id) => { setSavedRouteId(id); setRoutesRefreshToken(t => t + 1) }}
                    onRequireAuth={() => setSignInOpen(true)}
                  />
                )}

                {user && savedRouteId && !isViewingShared && (
                  <div>
                    <ShareToggle
                      routeId={savedRouteId}
                      isPublic={false}
                      shareToken={null}
                      baseUrl={window.location.origin}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {user && (
            <div className={`collapse collapse-arrow bg-base-100 shadow rounded-none border-x border-b border-base-300 ${activePanel === 'routes' ? 'collapse-open' : ''}`}>
              <div
                className="collapse-title font-medium cursor-pointer"
                onClick={() => setActivePanel(p => p === 'routes' ? null : 'routes')}
              >
                My routes
              </div>
              <div className="collapse-content overflow-hidden">
                <MyRoutesPanel
                  onLoadRoute={(gpxContent, avgSpeedKmh, startTime, id, name) => {
                    const start = new Date(startTime)
                    setAvgSpeed(avgSpeedKmh)
                    setStartTime(start)
                    setRouteName(name)
                    setSavedRouteId(id)
                    loadRouteFromGpxText(gpxContent, avgSpeedKmh, start, dpEpsilon, dpMaxGap)
                  }}
                  onDeleted={(id) => {
                    if (id === savedRouteId) {
                      setRoute(null)
                      setRawGpxContent(null)
                      setRouteName('')
                      setSavedRouteId(null)
                      clearStoredRoute()
                    }
                  }}
                  refreshKey={savedRouteId ? `${savedRouteId}:${routesRefreshToken}` : undefined}
                />
              </div>
            </div>
          )}

          {/* Tech Details */}
          <div className={`tech-details-card collapse collapse-arrow bg-base-100 shadow rounded-t-none rounded-b-box border-x border-b border-base-300 ${activePanel === 'tech' ? 'collapse-open' : ''}`}>
            <div
              className="collapse-title font-medium cursor-pointer"
              onClick={() => setActivePanel(p => p === 'tech' ? null : 'tech')}
            >
              Tech Details
            </div>
            <div className="collapse-content flex flex-col gap-3">

              <div className="form-control w-full">
                <label htmlFor="dp-epsilon" className="label pb-1">
                  <span className="label-text">DP Epsilon (m)</span>
                  <Tooltip
                    ariaLabel="DP Epsilon help"
                    text="Maximum distance a point can deviate from a straight line before it's kept. Higher values simplify the route more aggressively (fewer points, coarser shape); lower values preserve more detail."
                  >
                    <CircleHelp size={14} className="text-base-content/50" />
                  </Tooltip>
                </label>
                <input
                  id="dp-epsilon"
                  type="number"
                  min="1"
                  step="1"
                  value={dpEpsilon}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (Number.isFinite(n)) setDpEpsilon(Math.max(1, n));
                  }}
                  onBlur={commitTechParams}
                  onKeyDown={handleTechParamKeyDown}
                  className="input input-bordered input-sm w-full"
                />
              </div>

              <div className="form-control w-full">
                <label htmlFor="dp-max-gap" className="label pb-1">
                  <span className="label-text">Max Gap (m)</span>
                  <Tooltip
                    ariaLabel="Max Gap help"
                    text="Maximum distance allowed between two consecutive points after simplification. Prevents long straight stretches from becoming too sparse, keeping weather sampling accurate."
                  >
                    <CircleHelp size={14} className="text-base-content/50" />
                  </Tooltip>
                </label>
                <input
                  id="dp-max-gap"
                  type="number"
                  min="1"
                  step="10"
                  value={dpMaxGap}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (Number.isFinite(n)) setDpMaxGap(Math.max(1, n));
                  }}
                  onBlur={commitTechParams}
                  onKeyDown={handleTechParamKeyDown}
                  className="input input-bordered input-sm w-full"
                />
              </div>

              <button
                type="button"
                onClick={handleResetTechParams}
                className="btn btn-sm btn-outline w-full gap-1.5"
              >
                <RotateCcw size={13} />
                Reset to defaults
              </button>

              <div className="stats stats-vertical bg-base-200 shadow w-full">
                <div className="stat py-2 px-3">
                  <div className="stat-title text-xs">Original Points</div>
                  <div className="stat-value text-base">{route ? route.originalPointCount.toLocaleString() : '—'}</div>
                </div>
                <div className="stat py-2 px-3">
                  <div className="stat-title text-xs">Map Points</div>
                  <div className="stat-value text-base">{route ? route.points.length.toLocaleString() : '—'}</div>
                </div>
              </div>

              <div className="form-control w-full">
                <label htmlFor="weather-provider" className="label pb-1">
                  <span className="label-text">Weather Provider</span>
                </label>
                <select
                  id="weather-provider"
                  value={selectedProvider.id}
                  onChange={(e) => {
                    const next = PROVIDERS.find(p => p.id === e.target.value && p.available);
                    if (next) setSelectedProvider(next);
                  }}
                  className="select select-bordered select-sm w-full"
                >
                  {PROVIDERS.map(p => (
                    <option key={p.id} value={p.id} disabled={!p.available}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <label className="label cursor-pointer justify-start gap-3 p-0">
                <input
                  id="weather-debug"
                  type="checkbox"
                  checked={weatherDebug}
                  onChange={(e) => setWeatherDebugState(e.target.checked)}
                  className="checkbox checkbox-primary checkbox-sm"
                />
                <span className="label-text">Weather debug</span>
              </label>

              <div className="divider my-0" />
              <div className="text-sm font-semibold">Frontend v{__APP_VERSION__}</div>
              <div className="text-xs text-base-content/50">{buildDate}</div>
              {backendVersion && (
                <>
                  <div className="text-sm font-semibold">Backend v{backendVersion.version}</div>
                  <div className="text-xs text-base-content/50">
                    {format(new Date(backendVersion.buildTime), 'd MMM yyyy HH:mm')}
                  </div>
                </>
              )}

            </div>
          </div>

        </div>

        {/* Display area */}
        <div className="flex flex-col gap-6 min-h-0">

          {/* Elevation + precip + hover pane card */}
          <div className="card bg-base-100 shadow flex-shrink-0 overflow-hidden p-5 flex flex-row">
            {!route ? (
              <div className="flex flex-col items-center justify-center flex-1 text-base-content/40 gap-4" style={{ height: 300 }}>
                <CloudRain size={32} />
                <p>Weather timeline will appear here</p>
              </div>
            ) : (
              <>
                <div className="elevation-row flex flex-col flex-1 min-w-0">
                  <div style={{ height: 300 }}>
                    <ElevationChart
                      data={elevationData}
                      climbs={climbs}
                      onHoverIndex={onHoverIndex}
                      onResize={setChartWidth}
                      hoveredIndex={hoveredIndex}
                      checkpoints={effectiveCheckpoints}
                    />
                  </div>
                  <div className="border-t border-base-200" style={{ height: 30 }}>
                    <CheckpointTrackRow
                      checkpoints={effectiveCheckpoints}
                      startTime={startTime}
                      totalDistanceM={route.totalDistance}
                      distanceRange={distanceRange}
                      chartWidth={chartWidth}
                      onChange={setCheckpoints}
                    />
                  </div>
                  <div className="border-t border-base-200" style={{ height: 40 }}>
                    <WindArrowRow
                      samplePoints={samplePoints}
                      distanceRange={distanceRange}
                      chartWidth={chartWidth}
                      hoveredDistance={hoveredIndex !== null ? (chartData[hoveredIndex]?.distance ?? null) : null}
                    />
                  </div>
                  <div className="border-t border-base-200" style={{ height: 40 }}>
                    <PrecipBarRow
                      samplePoints={samplePoints}
                      distanceRange={distanceRange}
                      chartWidth={chartWidth}
                      hoveredDistance={hoveredIndex !== null ? (chartData[hoveredIndex]?.distance ?? null) : null}
                    />
                  </div>
                </div>
                <HoverPane hoveredData={hoveredData} xAxisMode={xAxisMode} startTime={startTime} />
              </>
            )}
          </div>

          {/* Map card */}
          <div className="card bg-base-100 shadow flex-1 min-h-[300px] overflow-hidden">
            {!route ? (
              <div className="flex flex-col items-center justify-center h-full text-base-content/40 gap-4">
                <MapIcon size={48} />
                <p>Upload a GPX file to see your route</p>
              </div>
            ) : (
              <MapComponent
                route={route}
                hoveredPoint={hoveredPoint}
                debugPins={weatherDebug ? weatherPoints.map(wp => ({ lat: wp.point.lat, lng: wp.point.lng, label: wp.label })) : undefined}
              />
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

export { App };
