# Weather Unavailable Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the silent `mockFallback` with a centered overlay message in `WeatherTimeline` when weather data cannot be retrieved, while keeping the elevation profile visible.

**Architecture:** `fetchWeatherForPoint` returns `null` instead of fake data on failure. `App.tsx` tracks a `weatherAvailable: boolean | null` state and passes it to `WeatherTimeline`, which renders an absolutely-positioned overlay message when `weatherAvailable === false`.

**Tech Stack:** React, TypeScript, Vitest, @testing-library/react, Recharts

---

### Task 1: Update weatherService tests to expect `null` on failure

**Files:**
- Modify: `src/services/weatherService.test.ts`

- [ ] **Step 1: Update the two failure-path tests and fix null-safety in success tests**

Replace the body of `src/services/weatherService.test.ts` with:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { fetchWeatherForPoint } from './weatherService';
import type { HttpClient } from './weatherService';

// 2025-06-15T14:37:00 UTC — mid-hour so slice(0,14) rounding is exercised; slot is '2025-06-15T14:00'
const TS = new Date('2025-06-15T14:37:00.000Z').getTime() / 1000;

const makeStub = (weatherCode: number): HttpClient => ({
  get: vi.fn().mockResolvedValue({
    data: {
      hourly: {
        time: ['2025-06-15T14:00'],
        temperature_2m: [22],
        apparent_temperature: [20],
        precipitation_probability: [15],
        precipitation: [2.5],
        wind_speed_10m: [12],
        wind_direction_10m: [270],
        weather_code: [weatherCode],
      },
    },
  }),
});

const missingHourStub: HttpClient = {
  get: vi.fn().mockResolvedValue({
    data: {
      hourly: {
        time: ['2025-06-15T12:00'], // different hour — timeIndex will be -1
        temperature_2m: [20],
        apparent_temperature: [18],
        precipitation_probability: [0],
        precipitation: [0],
        wind_speed_10m: [5],
        wind_direction_10m: [180],
        weather_code: [0],
      },
    },
  }),
};

const throwingStub: HttpClient = {
  get: vi.fn().mockRejectedValue(new Error('network error')),
};

describe('fetchWeatherForPoint', () => {
  it('maps a valid API response to all WeatherData fields', async () => {
    const result = await fetchWeatherForPoint(48.8, 2.3, TS, makeStub(0));
    expect(result).not.toBeNull();
    expect(result!.temp).toBe(22);
    expect(result!.feelsLike).toBe(20);
    expect(result!.precipProb).toBe(15);
    expect(result!.precipitation).toBe(2.5);
    expect(result!.windSpeed).toBe(12);
    expect(result!.windDeg).toBe(270);
    expect(result!.condition).toBe('Clear');
  });

  it('returns null when the target hour is absent from the response', async () => {
    const result = await fetchWeatherForPoint(48.8, 2.3, TS, missingHourStub);
    expect(result).toBeNull();
  });

  it('returns null when the HTTP call throws', async () => {
    const result = await fetchWeatherForPoint(48.8, 2.3, TS, throwingStub);
    expect(result).toBeNull();
  });

  it.each([
    [0,  'Clear'],
    [2,  'Partly Cloudy'],
    [50, 'Rain'],
    [75, 'Snow'],
    [95, 'Storm'],
  ])('weather code %i → condition "%s"', async (code, expected) => {
    const result = await fetchWeatherForPoint(48.8, 2.3, TS, makeStub(code));
    expect(result!.condition).toBe(expected);
  });
});
```

- [ ] **Step 2: Run tests to verify the two failure-path tests fail**

```bash
npx vitest run src/services/weatherService.test.ts
```

Expected: `returns null when the target hour is absent` and `returns null when the HTTP call throws` both FAIL (currently they return a WeatherData object).

---

### Task 2: Update weatherService to return `null` instead of fake data

**Files:**
- Modify: `src/services/weatherService.ts`

- [ ] **Step 3: Delete `mockFallback` and change return type to `Promise<WeatherData | null>`**

Replace the full content of `src/services/weatherService.ts` with:

```typescript
import axios from 'axios';

export interface WeatherData {
  temp: number;
  feelsLike: number;
  precipProb: number;
  precipitation: number;
  windSpeed: number;
  windDeg: number;
  condition: string;
}

export interface HttpClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get(url: string, config?: { params?: any }): Promise<{ data: any }>;
}

let _debug = false;
export const setWeatherDebug = (enabled: boolean) => { _debug = enabled; };

export const fetchWeatherForPoint = async (
  lat: number,
  lon: number,
  timestamp: number,
  http: HttpClient = axios as HttpClient,
  label = '',
): Promise<WeatherData | null> => {
  const date = new Date(timestamp * 1000);
  const hourIso = date.toISOString().slice(0, 14) + '00'; // Round to the hour
  const dateStr = date.toISOString().slice(0, 10); // YYYY-MM-DD (UTC, consistent with hourIso)

  try {
    const response = await http.get(`https://api.open-meteo.com/v1/forecast`, {
      params: {
        latitude: lat,
        longitude: lon,
        hourly: 'temperature_2m,apparent_temperature,precipitation_probability,precipitation,wind_speed_10m,wind_direction_10m,weather_code',
        start_date: dateStr,
        end_date: dateStr,
      }
    });

    const hourly = response.data.hourly;
    const timeIndex = hourly.time.findIndex((t: string) => t === hourIso.slice(0, 16));

    if (timeIndex === -1) {
      return null;
    }

    if (_debug) {
      console.log('[weather]', {
        label,
        lat, lon,
        date: dateStr,
        hour: hourIso.slice(0, 16),
        timeIndex,
        temp: hourly.temperature_2m[timeIndex],
        precipProb: hourly.precipitation_probability[timeIndex],
      });
    }

    return {
      temp: hourly.temperature_2m[timeIndex],
      feelsLike: hourly.apparent_temperature[timeIndex],
      precipProb: hourly.precipitation_probability[timeIndex],
      precipitation: hourly.precipitation[timeIndex],
      windSpeed: hourly.wind_speed_10m[timeIndex],
      windDeg: hourly.wind_direction_10m[timeIndex],
      condition: getWeatherCondition(hourly.weather_code[timeIndex]),
    };
  } catch (error) {
    console.error('Weather API error:', error);
    return null;
  }
};

const getWeatherCondition = (code: number): string => {
  if (code === 0) return 'Clear';
  if (code < 4) return 'Partly Cloudy';
  if (code < 70) return 'Rain';
  if (code < 80) return 'Snow';
  return 'Storm';
};
```

- [ ] **Step 4: Run tests to verify all weatherService tests pass**

```bash
npx vitest run src/services/weatherService.test.ts
```

Expected: all 7 tests PASS.

---

### Task 3: Update App.tsx — add `weatherAvailable` state, handle `null` return, pass to WeatherTimeline

**Files:**
- Modify: `src/App.tsx:32-124,282-288`

- [ ] **Step 5: Add `weatherAvailable` state after line 40**

In `src/App.tsx`, after the existing `useState` declarations (after line 40, before `const todayStr`), add:

```typescript
const [weatherAvailable, setWeatherAvailable] = useState<boolean | null>(null);
```

- [ ] **Step 6: Update `updateWeather` to reset, handle null returns, and set availability**

Replace the `updateWeather` callback (lines 92–124) with:

```typescript
const updateWeather = useCallback(async (currentRoute: RouteData, speed: number, start: Date) => {
  if (!currentRoute) return;

  setWeatherAvailable(null);

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
    pointsToQuery.map(async ({ point, arrivalTime }, i) => {
      const label = String(i + 1);
      try {
        const weather = await fetchWeatherForPoint(point.lat, point.lng, arrivalTime.getTime() / 1000, undefined, label);
        if (weather === null) return null;
        return { ...weather, point, arrivalTime, label };
      } catch (error) {
        console.error('Failed to fetch weather for point:', error);
        return null;
      }
    })
  );

  const filtered = weatherResults.filter((result): result is NonNullable<typeof result> => result !== null);
  setWeatherPoints(filtered);
  setWeatherAvailable(filtered.length > 0);
}, []);
```

- [ ] **Step 7: Pass `weatherAvailable` to WeatherTimeline**

In `src/App.tsx`, find the `WeatherTimeline` JSX (around line 282–288):

```tsx
<WeatherTimeline
  route={route}
  weatherPoints={weatherPoints}
  onHoverDistance={onHoverDistance}
  xAxisMode={xAxisMode}
/>
```

Replace it with:

```tsx
<WeatherTimeline
  route={route}
  weatherPoints={weatherPoints}
  onHoverDistance={onHoverDistance}
  xAxisMode={xAxisMode}
  weatherAvailable={weatherAvailable}
/>
```

- [ ] **Step 8: Run existing App tests to confirm nothing is broken**

```bash
npx vitest run src/App.test.tsx
```

Expected: all existing tests PASS. (The mock for `fetchWeatherForPoint` still returns `mockWeather`, so `weatherAvailable` will be `true` after upload — no regressions.)

---

### Task 4: Update App.test.tsx — expose `weatherAvailable` in mock and add tests

**Files:**
- Modify: `src/App.test.tsx`

- [ ] **Step 9: Write new failing tests for `weatherAvailable` propagation**

In `src/App.test.tsx`, update the `WeatherTimeline` mock (around lines 54–71) to also capture and expose `weatherAvailable`:

```typescript
vi.mock('./components/WeatherTimeline', () => ({
  default: ({ onHoverDistance, xAxisMode, weatherPoints, weatherAvailable }: {
    onHoverDistance: (d: number | null) => void;
    xAxisMode: 'clock' | 'elapsed';
    weatherPoints: Array<{ temp: number; precipProb: number; precipitation: number }>;
    weatherAvailable: boolean | null;
  }) => {
    capturedHoverCb = onHoverDistance;
    capturedXAxisMode = xAxisMode;
    return (
      <div
        data-testid="weather-timeline"
        data-first-temp={weatherPoints[0]?.temp ?? ''}
        data-first-precip-prob={weatherPoints[0]?.precipProb ?? ''}
        data-first-precipitation={weatherPoints[0]?.precipitation ?? ''}
        data-weather-available={String(weatherAvailable)}
      />
    );
  },
}));
```

Then add two new tests at the end of the `describe('App', ...)` block:

```typescript
it('passes weatherAvailable=true to WeatherTimeline when weather fetch succeeds', async () => {
  render(<App />);
  await uploadFile();
  await waitFor(() =>
    expect(screen.getByTestId('weather-timeline').dataset.weatherAvailable).toBe('true')
  );
});

it('passes weatherAvailable=false to WeatherTimeline when weather fetch returns null', async () => {
  vi.mocked(fetchWeatherForPoint).mockResolvedValue(null);
  render(<App />);
  await uploadFile();
  await waitFor(() =>
    expect(screen.getByTestId('weather-timeline').dataset.weatherAvailable).toBe('false')
  );
});
```

- [ ] **Step 10: Run tests to verify new tests pass**

```bash
npx vitest run src/App.test.tsx
```

Expected: all tests including the 2 new ones PASS.

---

### Task 5: Add WeatherTimeline overlay test

**Files:**
- Modify: `src/components/WeatherTimeline.test.tsx`

- [ ] **Step 11: Write a failing test for the overlay message**

Add this test inside the `describe('WeatherTimeline', ...)` block in `src/components/WeatherTimeline.test.tsx`:

```typescript
it('shows unavailability message when weatherAvailable is false', () => {
  render(
    <WeatherTimeline
      route={mockRoute}
      weatherPoints={[]}
      onHoverDistance={vi.fn()}
      xAxisMode="clock"
      weatherAvailable={false}
    />
  );
  expect(screen.getByText('Weather data unavailable for the selected date')).toBeInTheDocument();
});

it('does not show unavailability message when weatherAvailable is true', () => {
  render(
    <WeatherTimeline
      route={mockRoute}
      weatherPoints={[mockWeatherPoint]}
      onHoverDistance={vi.fn()}
      xAxisMode="clock"
      weatherAvailable={true}
    />
  );
  expect(screen.queryByText('Weather data unavailable for the selected date')).not.toBeInTheDocument();
});
```

- [ ] **Step 12: Run test to verify it fails**

```bash
npx vitest run src/components/WeatherTimeline.test.tsx
```

Expected: the two new tests FAIL (`WeatherTimeline` does not yet accept `weatherAvailable` prop).

---

### Task 6: Update WeatherTimeline to accept prop and render overlay

**Files:**
- Modify: `src/components/WeatherTimeline.tsx:6-12,81-204`

- [ ] **Step 13: Add `weatherAvailable` to props interface and render overlay**

In `src/components/WeatherTimeline.tsx`, update the props interface (lines 6–12):

```typescript
interface WeatherTimelineProps {
  route: RouteData;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  weatherPoints: any[];
  onHoverDistance: (distanceKm: number | null) => void;
  xAxisMode: 'clock' | 'elapsed';
  weatherAvailable?: boolean | null;
}
```

Update the component signature (line 21) to destructure the new prop:

```typescript
const WeatherTimeline: React.FC<WeatherTimelineProps> = ({ route, weatherPoints, onHoverDistance, xAxisMode, weatherAvailable }) => {
```

Replace the `return` statement (lines 81–204) with:

```tsx
return (
  <div style={{ width: '100%', height: '100%', position: 'relative' }}>
    <ResponsiveContainer width="100%" height="100%" onResize={(w) => setChartWidth(w)}>
      <ComposedChart
        data={data}
        margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
        onMouseMove={(state) => {
          const rIdx = state.activeTooltipIndex != null ? Number(state.activeTooltipIndex) : NaN;
          if (isNaN(rIdx) || !data[rIdx]) { onHoverDistance(null); return; }
          onHoverDistance(data[rIdx].distance);
        }}
        onMouseLeave={() => onHoverDistance(null)}
      >
        <defs>
          <linearGradient id="colorEle" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#2d5a27" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="#2d5a27" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
        <XAxis
          dataKey="time"
          type="number"
          domain={['dataMin', 'dataMax']}
          tickFormatter={(v) => xAxisMode === 'clock'
            ? new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : formatElapsed(v - (data[0]?.time ?? v))
          }
          fontSize={11}
          tickLine={false}
          axisLine={false}
          stroke="#888"
        />
        <YAxis
          yAxisId="elevation"
          axisLine={false}
          tickLine={false}
          fontSize={10}
          stroke="#888"
          tickFormatter={(v) => `${Math.round(v)}m`}
        />
        <YAxis
          yAxisId="temp"
          orientation="right"
          axisLine={false}
          tickLine={false}
          fontSize={10}
          stroke="#888"
          tickFormatter={(v) => `${Math.round(v)}°C`}
        />
        <YAxis
          yAxisId="precip"
          domain={[0, 100]}
          hide={true}
        />
        <Tooltip
          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
          labelFormatter={(label, payload) => {
            const km = (payload?.[0]?.payload?.distance as number | undefined)?.toFixed(1) ?? '?';
            const timeStr = xAxisMode === 'clock'
              ? new Date(Number(label)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : formatElapsed(Number(label) - (data[0]?.time ?? Number(label)));
            return `${timeStr} · ${km} km`;
          }}
          formatter={(value, name) => {
            if (name === 'Temp') return [`${Math.round(Number(value))}°C`, name];
            if (name === 'Precip Prob') return [`${Math.round(Number(value))}%`, name];
            if (name === 'Precip') return [`${Number(value).toFixed(1)} mm`, name];
            return [value, name];
          }}
        />
        <Area
          yAxisId="elevation"
          type="monotone"
          dataKey="elevation"
          stroke="#2d5a27"
          fillOpacity={1}
          fill="url(#colorEle)"
          name="Elevation"
          dot={false}
          isAnimationActive={false}
        />
        <Line
          yAxisId="temp"
          type="monotone"
          dataKey="temp"
          stroke="#ff7300"
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          dot={(props: any) => {
            if (!props.payload.isSample) return <g key={props.index} />;
            return <circle key={props.index} cx={props.cx} cy={props.cy} r={4} fill="#ff7300" stroke="white" strokeWidth={1.5} />;
          }}
          name="Temp"
          isAnimationActive={false}
        />
        <Line
          yAxisId="precip"
          type="monotone"
          dataKey="precipProb"
          stroke="#4A90D9"
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          dot={(props: any) => {
            if (!props.payload.isSample) return <g key={props.index} />;
            return <circle key={props.index} cx={props.cx} cy={props.cy} r={4} fill="#4A90D9" stroke="white" strokeWidth={1.5} />;
          }}
          name="Precip Prob"
          isAnimationActive={false}
        />
        <Line
          yAxisId="precip"
          type="monotone"
          dataKey="precipitation"
          stroke="none"
          strokeWidth={0}
          activeDot={false}
          dot={false}
          legendType="none"
          name="Precip"
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
    {weatherAvailable === false && (
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        <span style={{ color: '#888', fontSize: '0.875rem', fontWeight: 500 }}>
          Weather data unavailable for the selected date
        </span>
      </div>
    )}
  </div>
);
```

- [ ] **Step 14: Run all unit tests**

```bash
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 15: Run build to check TypeScript**

```bash
npm run build
```

Expected: no TypeScript errors, build succeeds.

---

### Verification

- [ ] **Step 16: Manual smoke test**

Start the dev server (`npm run dev`), upload a GPX file, and verify:
1. Normal date (within 7 days): weather lines render as before, no overlay message.
2. To simulate failure, temporarily change the `missingHourStub` scenario by opening browser DevTools → Network → block `api.open-meteo.com`. Upload a GPX file — the overlay message "Weather data unavailable for the selected date" should appear centered on the chart; the elevation profile should still be visible beneath it.
3. Unblock the network — re-upload the file. Overlay should disappear and weather data should appear.
