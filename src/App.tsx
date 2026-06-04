import React, { useState, useCallback, useMemo } from 'react';
import { format } from 'date-fns';
import { Upload, Map as MapIcon, CloudRain, ChevronDown, ChevronRight } from 'lucide-react';
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
import './App.css';

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
  const [techDetailsOpen, setTechDetailsOpen] = useState(false);
  const [rideDetailsOpen, setRideDetailsOpen] = useState(true);
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
      setRideDetailsOpen(false);
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
    <div className="app-container">
      <header className="header">
        <div className="logo">
          <img src={logo} alt="Trippy Planner" className="logo-icon" />
          <h1>Trippy Planner</h1>
        </div>
        {route && (
          <div className="header-stats">
            {route.name}: {(route.totalDistance / 1000).toFixed(1)} km · {Math.round(route.totalElevationGain)} m of character-building
          </div>
        )}
        <div className="upload-section">
          <label htmlFor="gpx-upload" className={`btn-primary ${loading ? 'disabled' : ''}`} style={{ pointerEvents: loading ? 'none' : 'auto' }}>
            {loading ? 'Processing...' : (
              <>
                <Upload size={20} />
                Upload GPX
              </>
            )}
          </label>
          <input id="gpx-upload" type="file" accept=".gpx" onChange={handleFileUpload} disabled={loading} style={{ display: 'none' }} />
        </div>
      </header>

      <main className="main-content">
        <aside className="sidebar">
          <div className="sidebar-scrollable">
            <div className="glass-panel control-card">
              <h3
                onClick={() => setRideDetailsOpen(o => !o)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: rideDetailsOpen ? '20px' : 0 }}
              >
                Ride Details
                {rideDetailsOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </h3>
              {rideDetailsOpen && (
                <>
                  <div className="input-group">
                    <label htmlFor="avg-speed">Average Speed (km/h)</label>
                    <input
                      id="avg-speed"
                      type="number"
                      value={avgSpeed}
                      onChange={(e) => setAvgSpeed(Number(e.target.value))}
                      min="5"
                      max="60"
                    />
                  </div>
                  <div className="datetime-row">
                    <div className="input-group">
                      <label htmlFor="start-date">Start Date</label>
                      <input
                        id="start-date"
                        type="date"
                        value={getLocalDateString(startTime)}
                        onChange={(e) => handleDateChange(e.target.value)}
                        min={todayStr}
                        max={maxDateStr}
                      />
                    </div>
                    <div className="input-group">
                      <label htmlFor="start-time">Start Time</label>
                      <input
                        id="start-time"
                        type="time"
                        value={getLocalTimeString(startTime)}
                        onChange={(e) => handleTimeChange(e.target.value)}
                      />
                    </div>
                  </div>
                  <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
                    <button
                      className={xAxisMode === 'clock' ? 'btn-primary' : ''}
                      style={xAxisMode === 'clock'
                        ? { padding: '6px 16px', fontSize: '0.875rem' }
                        : { padding: '6px 16px', fontSize: '0.875rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontWeight: '600' }
                      }
                      onClick={() => setXAxisMode('clock')}
                    >
                      Clock
                    </button>
                    <button
                      className={xAxisMode === 'elapsed' ? 'btn-primary' : ''}
                      style={xAxisMode === 'elapsed'
                        ? { padding: '6px 16px', fontSize: '0.875rem' }
                        : { padding: '6px 16px', fontSize: '0.875rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontWeight: '600' }
                      }
                      onClick={() => setXAxisMode('elapsed')}
                    >
                      Elapsed
                    </button>
                  </div>
                </>
              )}
            </div>

            {route && (
              <div className="glass-panel tempwind-container">
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
            )}

            {route && (
              <div className="glass-panel precip-container">
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
            )}
          </div>
        </aside>

        <section className="display-area">
          <div className="glass-panel map-container">
            {!route ? (
              <div className="empty-state">
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

          <div className="glass-panel elevation-row">
            {!route ? (
              <div className="empty-state" style={{ flex: 1 }}>
                <CloudRain size={32} />
                <p>Weather timeline will appear here</p>
              </div>
            ) : (
              <>
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
                <HoverPane hoveredData={hoveredData} xAxisMode={xAxisMode} startTime={startTime} />
              </>
            )}
          </div>
        </section>

        <div className="sidebar-bottom">
          <div className="glass-panel stats-card tech-details-card">
            <h3
              onClick={() => setTechDetailsOpen(o => !o)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: techDetailsOpen ? '20px' : 0 }}
            >
              Tech Details
              {techDetailsOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </h3>
            {techDetailsOpen && (
              <>
                <div className="input-group">
                  <label htmlFor="dp-epsilon">DP Epsilon (m)</label>
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
                  />
                </div>
                <div className="input-group" style={{ marginTop: '16px' }}>
                  <label htmlFor="dp-max-gap">Max Gap (m)</label>
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
                  />
                </div>
                <div className="stats-grid" style={{ marginTop: '20px' }}>
                  <div className="stat-item">
                    <span className="stat-label">Original Points</span>
                    <span className="stat-value">{route ? route.originalPointCount.toLocaleString() : '—'}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Map Points</span>
                    <span className="stat-value">{route ? route.points.length.toLocaleString() : '—'}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Parse time</span>
                    <span className="stat-value">{parseMetrics ? `${parseMetrics.totalMs.toFixed(0)} ms` : '—'}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">File</span>
                    <span className="stat-value">{parseMetrics ? `${parseMetrics.fileSizeKb.toFixed(1)} KB` : '—'}</span>
                  </div>
                </div>
                <div className="input-group" style={{ marginTop: '16px' }}>
                  <label htmlFor="weather-provider">Weather Provider</label>
                  <select
                    id="weather-provider"
                    value={selectedProvider.id}
                    onChange={(e) => {
                      const next = PROVIDERS.find(p => p.id === e.target.value && p.available);
                      if (next) setSelectedProvider(next);
                    }}
                  >
                    {PROVIDERS.map(p => (
                      <option key={p.id} value={p.id} disabled={!p.available}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="input-group" style={{ marginTop: '16px', flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
                  <input
                    id="weather-debug"
                    type="checkbox"
                    checked={weatherDebug}
                    onChange={(e) => setWeatherDebugState(e.target.checked)}
                  />
                  <label htmlFor="weather-debug" style={{ marginBottom: 0, cursor: 'pointer' }}>Weather debug</label>
                </div>
                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                  <div className="build-info-version">v{__APP_VERSION__}</div>
                  <div className="build-info-meta">{buildDate}</div>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
