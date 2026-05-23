import React, { useState, useCallback } from 'react';
import { Upload, Map as MapIcon, CloudRain, Navigation } from 'lucide-react';
import { parseGPXAsync } from './workers/gpxWorkerClient';
import type { RouteData, RoutePoint } from './utils/gpxParser';
import { DP_EPSILON_METERS } from './utils/douglasPeucker';
import { fetchWeatherForPoint } from './services/weatherService';
import type { WeatherData } from './services/weatherService';
import MapComponent from './components/MapComponent';
import WeatherTimeline from './components/WeatherTimeline';
import './App.css';

// We'll create separate components for Map and Timeline later
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
  const [avgSpeed, setAvgSpeed] = useState(25); // km/h
  const [startTime, setStartTime] = useState<Date>(new Date());
  const [weatherPoints, setWeatherPoints] = useState<(WeatherData & { point: RoutePoint; arrivalTime: Date })[]>([]);
  const [loading, setLoading] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [xAxisMode, setXAxisMode] = useState<'clock' | 'elapsed'>('clock');
  const [dpEpsilon, setDpEpsilon] = useState(DP_EPSILON_METERS);

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
    try {
      const text = await file.text();
      const parsedRoute = await parseGPXAsync(text, dpEpsilon);
      setRoute(parsedRoute);

      // Initially calculate weather for key points (e.g., every 10km)
      await updateWeather(parsedRoute, avgSpeed, startTime);
    } catch (error) {
      console.error('Failed to parse GPX:', error);
      alert('Failed to parse GPX file. Please ensure it is a valid track.');
    } finally {
      setLoading(false);
    }
  };

  const updateWeather = useCallback(async (currentRoute: RouteData, speed: number, start: Date) => {
    if (!currentRoute) return;
    
    const pointsToQuery = [];
    const interval = currentRoute.totalDistance / 10;
    const seen = new Set();

    for (let i = 0; i <= 10; i++) {
      const distance = i * interval;
      const point = currentRoute.points.find(p => p.distance >= distance) || currentRoute.points[currentRoute.points.length - 1];
      if (seen.has(point)) continue;
      seen.add(point);

      const travelTimeHours = distance / (speed * 1000);
      const arrivalTime = new Date(start.getTime() + travelTimeHours * 3600 * 1000);
      pointsToQuery.push({ point, arrivalTime });
    }

    const weatherResults = await Promise.all(
      pointsToQuery.map(async ({ point, arrivalTime }) => {
        const weather = await fetchWeatherForPoint(point.lat, point.lng, arrivalTime.getTime() / 1000);
        return { ...weather, point, arrivalTime };
      })
    );

    setWeatherPoints(weatherResults);
  }, []);

  React.useEffect(() => {
    if (route) {
      updateWeather(route, avgSpeed, startTime);
    }
  }, [route, avgSpeed, startTime, updateWeather]);

  // Stable reference prevents WeatherTimeline (React.memo'd) from re-rendering on every hover
  const onHoverDistance = useCallback((distanceKm: number | null) => {
    if (distanceKm === null || !route) { setHoveredPoint(null); return; }
    const targetM = distanceKm * 1000;
    const points = route.points;
    let lo = 0, hi = points.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (points[mid].distance < targetM) lo = mid + 1;
      else hi = mid;
    }
    setHoveredPoint({ lat: points[lo].lat, lng: points[lo].lng });
  }, [route]);

  return (
    <div className="app-container">
      <header className="header">
        <div className="logo">
          <Navigation className="logo-icon" />
          <h1>Trippy Planner</h1>
        </div>
        
        <div className="upload-section">
          <label htmlFor="gpx-upload" className={`btn-primary ${loading ? 'disabled' : ''}`} style={{ pointerEvents: loading ? 'none' : 'auto' }}>
            {loading ? 'Processing...' : (
              <>
                <Upload size={20} />
                Upload GPX
              </>
            )}
          </label>
          <input 
            id="gpx-upload" 
            type="file" 
            accept=".gpx" 
            onChange={handleFileUpload} 
            disabled={loading}
            style={{ display: 'none' }}
          />
        </div>
      </header>

      <main className="main-content">
        <aside className="sidebar">
          <div className="glass-panel control-card">
            <h3>Ride Details</h3>
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
          </div>

          {route && (
            <div className="glass-panel stats-card">
              <h3>{route.name}</h3>
              <div className="stats-grid">
                <div className="stat-item">
                  <span className="stat-label">Distance</span>
                  <span className="stat-value">{(route.totalDistance / 1000).toFixed(1)} km</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Elevation Gain</span>
                  <span className="stat-value">{Math.round(route.totalElevationGain)} m</span>
                </div>
              </div>
            </div>
          )}

          <div className="glass-panel stats-card">
            <h3>Tech Details</h3>
            <div className="stats-grid">
              <div className="stat-item">
                <label htmlFor="dp-epsilon" className="stat-label">DP Epsilon</label>
                <span className="stat-value">
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
                    style={{ width: '60px' }}
                  />
                  {' '}m
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Original Points</span>
                <span className="stat-value">{route ? route.originalPointCount.toLocaleString() : '—'}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Map Points</span>
                <span className="stat-value">{route ? route.points.length.toLocaleString() : '—'}</span>
              </div>
            </div>
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
              <MapComponent route={route} hoveredPoint={hoveredPoint} />
            )}
          </div>

          <div className="glass-panel timeline-container">
            {!route ? (
              <div className="empty-state">
                <CloudRain size={32} />
                <p>Weather timeline will appear here</p>
              </div>
            ) : (
              <WeatherTimeline
                route={route}
                weatherPoints={weatherPoints}
                onHoverDistance={onHoverDistance}
                xAxisMode={xAxisMode}
              />
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
