# Precipitation Timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add precipitation probability as a visible line on the WeatherTimeline chart and surface precipitation amount (mm) in the hover tooltip.

**Architecture:** Add `precipitation` (mm) to `WeatherData` and the Open-Meteo API request; extend `WeatherTimeline` to interpolate both `precipProb` and `precipitation` between sample points, render `precipProb` as a blue line on a hidden Y axis, and expose `precipitation` via a stroke-less tooltip-only `Line`.

**Tech Stack:** TypeScript, React, recharts (`Line`, `YAxis`), Open-Meteo hourly API, Vitest.

---

## File Map

| File | Change |
|---|---|
| `src/services/weatherService.ts` | Add `precipitation` field to interface + API params + mapping + mock |
| `src/services/weatherService.test.ts` | Update stub data and assertion to cover `precipitation` |
| `src/components/WeatherTimeline.tsx` | Add precipProb/precipitation to data, interpolation, axes, lines, tooltip |
| `src/components/WeatherTimeline.test.tsx` | Add `precipitation` to fixture |

---

### Task 1: Extend `WeatherData` and Open-Meteo request

**Files:**
- Modify: `src/services/weatherService.ts`

- [ ] **Step 1: Add `precipitation` to the `WeatherData` interface**

In `src/services/weatherService.ts`, update the interface (lines 3–10):

```typescript
export interface WeatherData {
  temp: number;
  feelsLike: number;
  precipProb: number;
  precipitation: number;
  windSpeed: number;
  windDeg: number;
  condition: string;
}
```

- [ ] **Step 2: Add `precipitation` to the API params and return mapping**

Update the `hourly` param string (line 31) to include `precipitation`:

```typescript
hourly: 'temperature_2m,apparent_temperature,precipitation_probability,precipitation,wind_speed_10m,wind_direction_10m,weather_code',
```

Update the return object (lines 45–52) to include the new field:

```typescript
return {
  temp: hourly.temperature_2m[timeIndex],
  feelsLike: hourly.apparent_temperature[timeIndex],
  precipProb: hourly.precipitation_probability[timeIndex],
  precipitation: hourly.precipitation[timeIndex],
  windSpeed: hourly.wind_speed_10m[timeIndex],
  windDeg: hourly.wind_direction_10m[timeIndex],
  condition: getWeatherCondition(hourly.weather_code[timeIndex]),
};
```

- [ ] **Step 3: Add `precipitation` to `mockFallback`**

Update `mockFallback` return (lines 68–76):

```typescript
return {
  temp: 20 + Math.sin((hour - 6) * Math.PI / 12) * 5,
  feelsLike: 18,
  precipProb: 10,
  precipitation: 0,
  windSpeed: 12,
  windDeg: 270,
  condition: 'Sunny (Fallback)',
};
```

---

### Task 2: Update `weatherService` tests

**Files:**
- Modify: `src/services/weatherService.test.ts`

- [ ] **Step 1: Write the failing test assertion first**

Add `expect(result.precipitation).toBe(2.5)` to the existing "maps a valid API response" test (after the `precipProb` assertion, around line 49):

```typescript
it('maps a valid API response to all WeatherData fields', async () => {
  const result = await fetchWeatherForPoint(48.8, 2.3, TS, makeStub(0));
  expect(result.temp).toBe(22);
  expect(result.feelsLike).toBe(20);
  expect(result.precipProb).toBe(15);
  expect(result.precipitation).toBe(2.5);
  expect(result.windSpeed).toBe(12);
  expect(result.windDeg).toBe(270);
  expect(result.condition).toBe('Clear');
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/services/weatherService.test.ts
```

Expected: FAIL — `precipitation` is `undefined`, not `2.5`.

- [ ] **Step 3: Update stubs to include `precipitation`**

Update `makeStub` to add `precipitation: [2.5]` to the hourly response:

```typescript
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
```

Update `missingHourStub` to add `precipitation: [0]`:

```typescript
const missingHourStub: HttpClient = {
  get: vi.fn().mockResolvedValue({
    data: {
      hourly: {
        time: ['2025-06-15T12:00'],
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
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run src/services/weatherService.test.ts
```

Expected: all 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/weatherService.ts src/services/weatherService.test.ts
git commit -m "feat(weather): add precipitation amount to WeatherData and Open-Meteo request"
```

---

### Task 3: Update `WeatherTimeline` fixture and extend chart data

**Files:**
- Modify: `src/components/WeatherTimeline.test.tsx`
- Modify: `src/components/WeatherTimeline.tsx`

- [ ] **Step 1: Update the test fixture**

In `src/components/WeatherTimeline.test.tsx`, add `precipitation: 2.5` to `mockWeatherPoint` (around line 40):

```typescript
const mockWeatherPoint = {
  temp: 20, feelsLike: 18, precipProb: 10,
  precipitation: 2.5,
  windSpeed: 12, windDeg: 270, condition: 'Clear',
  point: mockRoute.points[0],
  arrivalTime: new Date('2026-05-24T08:00:00'),
};
```

- [ ] **Step 2: Run the existing tests to confirm they still pass (no regressions)**

```bash
npx vitest run src/components/WeatherTimeline.test.tsx
```

Expected: all 3 tests PASS.

- [ ] **Step 3: Extend the data shape in `WeatherTimeline.tsx`**

In `src/components/WeatherTimeline.tsx`, update the `data` useMemo mapping (around line 25) to add `precipProb` and `precipitation` fields:

```typescript
const d = route.points.map(pt => ({
  distance: pt.distance / 1000,
  elevation: Math.round(pt.ele),
  temp: undefined as number | undefined,
  precipProb: undefined as number | undefined,
  precipitation: undefined as number | undefined,
  time: undefined as number | undefined,
  isSample: false,
  weatherIdx: undefined as number | undefined,
}));
```

- [ ] **Step 4: Populate `precipProb` and `precipitation` at sample points**

Update the `weatherPoints.forEach` block (around line 34) to also set the new fields:

```typescript
weatherPoints.forEach((wp, wIdx) => {
  const rIdx = route.points.indexOf(wp.point);
  if (rIdx >= 0) {
    d[rIdx].temp = wp.temp;
    d[rIdx].precipProb = wp.precipProb;
    d[rIdx].precipitation = wp.precipitation;
    d[rIdx].time = wp.arrivalTime.getTime();
    d[rIdx].isSample = true;
    d[rIdx].weatherIdx = wIdx;
  }
});
```

- [ ] **Step 5: Extend the interpolation loop to cover `precipProb` and `precipitation`**

Update the interpolation `for` loop (around line 61) to interpolate the two new fields alongside `temp`:

```typescript
for (let i = 0; i < sampleIdxs.length - 1; i++) {
  const lo = sampleIdxs[i], hi = sampleIdxs[i + 1];
  const tLo = downsampled[lo].temp!, tHi = downsampled[hi].temp!;
  const ppLo = downsampled[lo].precipProb!, ppHi = downsampled[hi].precipProb!;
  const pLo = downsampled[lo].precipitation!, pHi = downsampled[hi].precipitation!;
  const timeLo = downsampled[lo].time!, timeHi = downsampled[hi].time!;
  for (let j = lo + 1; j < hi; j++) {
    const t = (j - lo) / (hi - lo);
    downsampled[j].temp = tLo + (tHi - tLo) * t;
    downsampled[j].precipProb = ppLo + (ppHi - ppLo) * t;
    downsampled[j].precipitation = pLo + (pHi - pLo) * t;
    downsampled[j].time = timeLo + (timeHi - timeLo) * t;
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add src/components/WeatherTimeline.tsx src/components/WeatherTimeline.test.tsx
git commit -m "feat(timeline): extend data shape with precipProb and precipitation fields"
```

---

### Task 4: Add precipitation axes, lines, and tooltip to the chart

**Files:**
- Modify: `src/components/WeatherTimeline.tsx`

- [ ] **Step 1: Add a hidden Y axis for `precipProb`**

In the JSX, after the existing `YAxis` for `temp` (around line 120), add:

```tsx
<YAxis
  yAxisId="precip"
  domain={[0, 100]}
  hide={true}
/>
```

- [ ] **Step 2: Add the `precipProb` line**

After the existing `Line` for `Temp` (around line 143), add:

```tsx
<Line
  yAxisId="precip"
  type="monotone"
  dataKey="precipProb"
  stroke="#4A90D9"
  dot={(props: any) => {
    if (!props.payload.isSample) return <g key={props.index} />;
    return <circle key={props.index} cx={props.cx} cy={props.cy} r={4} fill="#4A90D9" stroke="white" strokeWidth={1.5} />;
  }}
  name="Precip Prob"
  isAnimationActive={false}
/>
```

- [ ] **Step 3: Add a tooltip-only line for `precipitation`**

Directly after the `precipProb` line, add:

```tsx
<Line
  yAxisId="precip"
  type="monotone"
  dataKey="precipitation"
  stroke="none"
  dot={false}
  legendType="none"
  name="Precip"
  isAnimationActive={false}
/>
```

- [ ] **Step 4: Extend the tooltip `formatter`**

Update the `Tooltip` `formatter` prop (around line 130):

```tsx
formatter={(value, name) => {
  if (name === 'Temp') return [`${Math.round(Number(value))}°C`, name];
  if (name === 'Precip Prob') return [`${Math.round(Number(value))}%`, name];
  if (name === 'Precip') return [`${Number(value).toFixed(1)} mm`, name];
  return [value, name];
}}
```

- [ ] **Step 5: Run all unit tests**

```bash
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 6: Start the dev server and verify visually**

```bash
npm run dev
```

Open `http://localhost:5173`, upload a GPX file, and confirm:
- A blue line appears on the timeline chart representing precipitation probability.
- Hovering shows three values in the tooltip: temperature (°C), precip prob (%), and precip amount (mm).
- The blue line has dots only at the 11 sample points.
- Elevation and temperature lines are unaffected.

- [ ] **Step 7: Commit**

```bash
git add src/components/WeatherTimeline.tsx src/components/WeatherTimeline.test.tsx
git commit -m "feat(timeline): add precipitation probability line and amount tooltip"
```
