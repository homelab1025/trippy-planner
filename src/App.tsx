import React, { useState, useCallback, useMemo } from 'react';
import { format } from 'date-fns';
import { Upload, Map as MapIcon, CloudRain } from 'lucide-react';
import logo from './assets/logo.png';
import { parseGPXAsync } from './workers/gpxWorkerClient';
import type { RouteData, RoutePoint } from './utils/gpxParser';
import { DP_EPSILON_METERS, DP_MAX_GAP_METERS } from './utils/douglasPeucker';
import { detectClimbs } from './utils/climbDetector';
import { PROVIDERS, DEFAULT_PROVIDER, setWeatherDebug } from './services/weatherProviders';
import type { WeatherProvider, WeatherRequest } from './services/weatherProviders';
import MapComponent from './components/MapComponent';
import ElevationChart from './components/ElevationChart';
import WeatherLineChart from './components/WeatherLineChart';
import type { WeatherLineConfig } from './components/WeatherLineChart';
import HoverPane from './components/HoverPane';
import { useWeatherChartData } from './hooks/useWeatherChartData';
import type { ChartDataPoint, WeatherSample } from './hooks/useWeatherChartData';

const TEMP_LINE: WeatherLineConfig = {
  label: 'Temp', color: '#ff7300', format: (v) => `${Math.round(v)}°C`, yAxisId: 'left',
};
const WIND_LINE: WeatherLineConfig = {
  label: 'Wind', color: '#4A9FD9', format: (v) => `${Math.round(v)} km/h`, yAxisId: 'right',
};
const PROB_LINE: WeatherLineConfig = {
  label: 'Prob', color: '#4A90D9', format: (v) => `${Math.round(v)}%`, yAxisId: 'left', domain: [0, 100],
};
const AMOUNT_LINE: WeatherLineConfig = {
  label: 'Amount', color: '#A0C8F0', format: (v) => `${v.toFixed(1)} mm`, yAxisId: 'right',
};

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
  const [weatherPoints, setWeatherPoints] = useState<WeatherSample[]>([]);
  const [loading, setLoading] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [hoveredData, setHoveredData] = useState<ChartDataPoint | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [xAxisMode, setXAxisMode] = useState<'clock' | 'elapsed'>('clock');
  const [dpEpsilon, setDpEpsilon] = useState(DP_EPSILON_METERS);
  const [dpMaxGap, setDpMaxGap] = useState(DP_MAX_GAP_METERS);
  const [parseMetrics, setParseMetrics] = useState<{ totalMs: number; fileSizeKb: number } | null>(null);
  const [weatherDebug, setWeatherDebugState] = useState(false);
  const [activePanel, setActivePanel] = useState<'ride' | 'weather' | 'tech' | null>('ride');
  const [weatherAvailable, setWeatherAvailable] = useState<boolean | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<WeatherProvider>(DEFAULT_PROVIDER);
  const [chartWidth, setChartWidth] = useState(800);

  const buildDate = format(new Date(__BUILD_DATE__), 'd MMM yyyy HH:mm');

  const climbs = useMemo(
    () => (route ? detectClimbs(route.points) : []),
    [route]
  );

  const chartData = useWeatherChartData({ route, weatherPoints, chartWidth, avgSpeed, startTime });

  const elevationData = useMemo(
    () => chartData.map(({ distance, elevation, time }) => ({ distance, elevation, time })),
    [chartData]
  );

  const tempWindData = useMemo(
    () => chartData.map(({ time, distance, temp, windSpeed }) => ({ time, distance, line1: temp, line2: windSpeed })),
    [chartData]
  );

  const precipData = useMemo(
    () => chartData.map(({ time, distance, precipProb, precipitation }) => ({ time, distance, line1: precipProb, line2: precipitation })),
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
    setParseMetrics(null);
    try {
      const text = await file.text();
      const fileSizeKb = file.size / 1024;
      performance.mark('gpx-parse-start');
      const parsedRoute = await parseGPXAsync(text, dpEpsilon, dpMaxGap);
      performance.mark('gpx-parse-end');
      const measure = performance.measure('gpx-parse', 'gpx-parse-start', 'gpx-parse-end');
      setParseMetrics({ totalMs: measure.duration, fileSizeKb });
      setRoute(parsedRoute);
      setActivePanel(p => (p === 'ride' || p === null) ? 'weather' : p);
    } catch (error) {
      console.error('Failed to parse GPX:', error);
      const message = error instanceof Error ? error.message : 'Failed to parse GPX file. Please ensure it is a valid track.';
      alert(message);
    } finally {
      setLoading(false);
    }
  };

  const updateWeather = useCallback(async (currentRoute: RouteData, speed: number, start: Date, provider: WeatherProvider) => {
    setWeatherAvailable(null);
    const interval = currentRoute.totalDistance / 10;
    const requestMap = new Map<number, WeatherRequest>();
    const metaMap = new Map<number, { point: RoutePoint; arrivalTime: Date; label: string }>();
    const seenIndices = new Set<number>();
    for (let i = 0; i <= 10; i++) {
      const distance = i * interval;
      const idx = currentRoute.points.findIndex(p => p.distance >= distance);
      const pointIdx = idx === -1 ? currentRoute.points.length - 1 : idx;
      if (seenIndices.has(pointIdx)) continue;
      seenIndices.add(pointIdx);
      const point = currentRoute.points[pointIdx];
      const travelTimeHours = distance / (speed * 1000);
      const arrivalTime = new Date(start.getTime() + travelTimeHours * 3600 * 1000);
      requestMap.set(pointIdx, { lat: point.lat, lon: point.lng, timestamp: arrivalTime.getTime() / 1000 });
      metaMap.set(pointIdx, { point, arrivalTime, label: String(pointIdx) });
    }
    try {
      const weatherResult = await provider.fetchWeather(requestMap);
      const filtered: WeatherSample[] = [];
      for (const [key, weather] of weatherResult) {
        if (weather === null) continue;
        const meta = metaMap.get(key)!;
        filtered.push({ ...weather, ...meta });
      }
      setWeatherPoints(filtered);
      setWeatherAvailable(filtered.length > 0);
    } catch (error) {
      console.error('Weather fetch failed:', error);
      setWeatherPoints([]);
      setWeatherAvailable(false);
    }
  }, []);

  React.useEffect(() => {
    if (route) updateWeather(route, avgSpeed, startTime, selectedProvider);
  }, [route, avgSpeed, startTime, selectedProvider, updateWeather]);

  React.useEffect(() => {
    setWeatherDebug(weatherDebug);
  }, [weatherDebug]);

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
    <div className="flex flex-col h-screen max-w-[1400px] mx-auto p-6 gap-6">

      {/* Navbar */}
      <div className="navbar bg-primary text-primary-content rounded-box shadow-lg px-4 flex-shrink-0">
        <div className="flex-none gap-3">
          <img src={logo} alt="Trippy Planner" className="w-10 h-10 rounded-full object-cover" />
          <h1 className="text-xl font-bold">Trippy Planner</h1>
        </div>
        {route && (
          <div className="flex-1 text-center text-sm opacity-90 px-4">
            {route.name}: {(route.totalDistance / 1000).toFixed(1)} km · {Math.round(route.totalElevationGain)} m of character-building
          </div>
        )}
        <div className="flex-none ml-auto">
          <label
            htmlFor="gpx-upload"
            className={`btn btn-sm btn-outline text-primary-content border-primary-content hover:bg-primary-content hover:text-primary gap-2 ${loading ? 'btn-disabled pointer-events-none' : ''}`}
          >
            {loading ? 'Processing...' : (
              <>
                <Upload size={16} />
                Upload GPX
              </>
            )}
          </label>
          <input id="gpx-upload" type="file" accept=".gpx" onChange={handleFileUpload} disabled={loading} className="hidden" />
        </div>
      </div>

      {/* Main grid */}
      <div className="grid lg:grid-cols-[320px_1fr] grid-cols-1 gap-6 flex-1 min-h-0">

        {/* Sidebar — single-open accordion via collapse-open + activePanel state */}
        <div className="flex flex-col overflow-y-auto">

          {/* Ride Details */}
          <div className={`collapse collapse-arrow bg-base-100 shadow rounded-b-none rounded-t-box border border-base-300 ${activePanel === 'ride' ? 'collapse-open' : ''}`}>
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

              <div>
                <div className="label-text text-sm mb-2">X Axis Mode</div>
                <div className="join">
                  <button
                    className={`btn btn-sm join-item ${xAxisMode === 'clock' ? 'btn-primary' : ''}`}
                    onClick={() => setXAxisMode('clock')}
                  >
                    Clock
                  </button>
                  <button
                    className={`btn btn-sm join-item ${xAxisMode === 'elapsed' ? 'btn-primary' : ''}`}
                    onClick={() => setXAxisMode('elapsed')}
                  >
                    Elapsed
                  </button>
                </div>
              </div>

            </div>
          </div>

          {/* Weather */}
          <div className={`collapse collapse-arrow bg-base-100 shadow rounded-none border-x border-b border-base-300 ${activePanel === 'weather' ? 'collapse-open' : ''}`}>
            <div
              className="collapse-title font-medium cursor-pointer"
              onClick={() => setActivePanel(p => p === 'weather' ? null : 'weather')}
            >
              Weather
            </div>
            <div className="collapse-content">
              {route ? (
                <>
                  <div className="h-[180px] flex-shrink-0 overflow-hidden">
                    <WeatherLineChart
                      data={tempWindData}
                      line1Config={TEMP_LINE}
                      line2Config={WIND_LINE}
                      xAxisMode={xAxisMode}
                      hoveredIndex={hoveredIndex}
                      onHoverIndex={onHoverIndex}
                      weatherAvailable={weatherAvailable}
                    />
                  </div>
                  <div className="h-[180px] flex-shrink-0 overflow-hidden mt-3">
                    <WeatherLineChart
                      data={precipData}
                      line1Config={PROB_LINE}
                      line2Config={AMOUNT_LINE}
                      xAxisMode={xAxisMode}
                      hoveredIndex={hoveredIndex}
                      onHoverIndex={onHoverIndex}
                      weatherAvailable={weatherAvailable}
                    />
                  </div>
                </>
              ) : (
                <p className="text-base-content/50 text-sm text-center py-2">
                  Load a route to see weather
                </p>
              )}
            </div>
          </div>

          {/* Tech Details */}
          <div className={`collapse collapse-arrow bg-base-100 shadow rounded-t-none rounded-b-box border-x border-b border-base-300 ${activePanel === 'tech' ? 'collapse-open' : ''}`}>
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
                </label>
                <input
                  id="dp-epsilon"
                  type="number"
                  min="1"
                  step="1"
                  value={dpEpsilon}
                  disabled={route !== null}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (Number.isFinite(n)) setDpEpsilon(Math.max(1, n));
                  }}
                  className="input input-bordered input-sm w-full"
                />
              </div>

              <div className="form-control w-full">
                <label htmlFor="dp-max-gap" className="label pb-1">
                  <span className="label-text">Max Gap (m)</span>
                </label>
                <input
                  id="dp-max-gap"
                  type="number"
                  min="1"
                  step="10"
                  value={dpMaxGap}
                  disabled={route !== null}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (Number.isFinite(n)) setDpMaxGap(Math.max(1, n));
                  }}
                  className="input input-bordered input-sm w-full"
                />
              </div>

              <div className="stats stats-vertical bg-base-200 shadow w-full">
                <div className="stat py-2 px-3">
                  <div className="stat-title text-xs">Original Points</div>
                  <div className="stat-value text-base">{route ? route.originalPointCount.toLocaleString() : '—'}</div>
                </div>
                <div className="stat py-2 px-3">
                  <div className="stat-title text-xs">Map Points</div>
                  <div className="stat-value text-base">{route ? route.points.length.toLocaleString() : '—'}</div>
                </div>
                <div className="stat py-2 px-3">
                  <div className="stat-title text-xs">Parse time</div>
                  <div className="stat-value text-base">{parseMetrics ? `${parseMetrics.totalMs.toFixed(0)} ms` : '—'}</div>
                </div>
                <div className="stat py-2 px-3">
                  <div className="stat-title text-xs">File</div>
                  <div className="stat-value text-base">{parseMetrics ? `${parseMetrics.fileSizeKb.toFixed(1)} KB` : '—'}</div>
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
              <div className="text-sm font-semibold">v{__APP_VERSION__}</div>
              <div className="text-xs text-base-content/50">{buildDate}</div>

            </div>
          </div>

        </div>

        {/* Display area */}
        <div className="flex flex-col gap-6 min-h-0">

          {/* Map card */}
          <div className="card bg-base-100 shadow flex-[2] min-h-0 overflow-hidden">
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

          {/* Elevation + hover pane card */}
          <div className="card bg-base-100 shadow flex-1 min-h-0 overflow-hidden p-5 flex">
            {!route ? (
              <div className="flex flex-col items-center justify-center flex-1 text-base-content/40 gap-4">
                <CloudRain size={32} />
                <p>Weather timeline will appear here</p>
              </div>
            ) : (
              <>
                <div className="flex-1 min-w-0">
                  <ElevationChart
                    data={elevationData}
                    totalDistance={route.totalDistance}
                    climbs={climbs}
                    avgSpeed={avgSpeed}
                    startTime={startTime}
                    xAxisMode={xAxisMode}
                    onHoverIndex={onHoverIndex}
                    onResize={setChartWidth}
                    hoveredIndex={hoveredIndex}
                  />
                </div>
                <HoverPane hoveredData={hoveredData} xAxisMode={xAxisMode} startTime={startTime} />
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

export default App;
