# Vitest Unit Test Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Vitest and write unit tests for `lttb.ts`, `gpxParser.ts`, and `weatherService.ts`, with `HttpClient` injection on the service to avoid mocking axios directly.

**Architecture:** Pure functions (`lttb`, `gpxParser`) are tested with real inputs and no mocking — the libraries they depend on have no network or DOM side-effects. `weatherService` gets an exported `HttpClient` interface added as an optional 4th parameter (defaulting to axios), allowing tests to pass an inline stub object. No changes to `App.tsx`.

**Tech Stack:** Vitest, @vitest/coverage-v8, TypeScript

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Modify | `vite.config.ts` | Add `test` block for Vitest |
| Modify | `package.json` | Add `test` and `test:coverage` scripts |
| Modify | `src/services/weatherService.ts` | Export `HttpClient` interface; add optional `http` parameter |
| Create | `src/utils/lttb.test.ts` | Unit tests for LTTB downsampling algorithm |
| Create | `src/utils/gpxParser.test.ts` | Unit tests for GPX parser |
| Create | `src/services/weatherService.test.ts` | Unit tests for weather service with stub HttpClient |

---

### Task 1: Install Vitest and configure

**Files:**
- Modify: `vite.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Install dependencies**

```bash
npm install -D vitest @vitest/coverage-v8
```

Expected: `package.json` devDependencies gains `vitest` and `@vitest/coverage-v8`.

- [ ] **Step 2: Update `vite.config.ts`**

Replace the entire file content with:

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
  },
})
```

Note: `vitest/config` re-exports Vite's `defineConfig` augmented with the `test` type block. The `plugins: [react()]` still works unchanged.

- [ ] **Step 3: Add scripts to `package.json`**

In the `scripts` block, add these two entries alongside the existing ones:

```json
"test": "vitest",
"test:coverage": "vitest run --coverage"
```

- [ ] **Step 4: Verify the config is valid**

```bash
npx vitest run
```

Expected output (no test files exist yet):

```
No test files found, exiting with code 1
```

A "no test files" message (not a config error) confirms the setup is correct. Exit code 1 here is expected and not a failure.

- [ ] **Step 5: Commit**

```bash
git add vite.config.ts package.json package-lock.json
git commit -m "chore: add vitest and coverage tooling"
```

---

### Task 2: Unit tests for `lttb.ts`

**Files:**
- Create: `src/utils/lttb.test.ts`
- No changes to: `src/utils/lttb.ts`

`lttb` (the internal function) is not exported. All tests go through `lttbWithPinnedPoints`, passing `isPinned: () => false` to test base LTTB behaviour.

- [ ] **Step 1: Create the test file**

Create `src/utils/lttb.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { lttbWithPinnedPoints } from './lttb';

type P = { x: number; y: number; pinned: boolean };

const noPin = () => false;
const getX = (p: P) => p.x;
const getY = (p: P) => p.y;

const flat = (n: number): P[] =>
  Array.from({ length: n }, (_, i) => ({ x: i, y: 0, pinned: false }));

describe('lttb (via lttbWithPinnedPoints with no pinned points)', () => {
  it('returns the original array when length is at or below target', () => {
    const data = flat(3);
    const result = lttbWithPinnedPoints(data, 5, noPin, getX, getY);
    expect(result).toBe(data); // same reference, not a copy
  });

  it('always preserves the first point', () => {
    const data = flat(20);
    const result = lttbWithPinnedPoints(data, 5, noPin, getX, getY);
    expect(result[0]).toBe(data[0]);
  });

  it('always preserves the last point', () => {
    const data = flat(20);
    const result = lttbWithPinnedPoints(data, 5, noPin, getX, getY);
    expect(result).toContain(data[data.length - 1]);
  });

  it('retains a visual peak when downsampling', () => {
    // 20 points, all flat except a spike at index 10
    const data: P[] = Array.from({ length: 20 }, (_, i) => ({
      x: i,
      y: i === 10 ? 100 : 0,
      pinned: false,
    }));
    const result = lttbWithPinnedPoints(data, 5, noPin, getX, getY);
    expect(result).toContain(data[10]);
  });
});

describe('lttbWithPinnedPoints', () => {
  it('re-inserts a pinned point that LTTB dropped', () => {
    // Flat line — LTTB has no visual reason to keep index 7
    const data: P[] = Array.from({ length: 20 }, (_, i) => ({
      x: i,
      y: 0,
      pinned: i === 7,
    }));
    const result = lttbWithPinnedPoints(data, 3, p => p.pinned, getX, getY);
    expect(result).toContain(data[7]);
  });

  it('result is sorted by x after re-inserting a pinned point', () => {
    const data: P[] = Array.from({ length: 20 }, (_, i) => ({
      x: i,
      y: 0,
      pinned: i === 7,
    }));
    const result = lttbWithPinnedPoints(data, 3, p => p.pinned, getX, getY);
    for (let i = 1; i < result.length; i++) {
      expect(result[i].x).toBeGreaterThanOrEqual(result[i - 1].x);
    }
  });

  it('does not duplicate a pinned point that LTTB already kept', () => {
    // data[0] is always the first element in LTTB output
    const data: P[] = Array.from({ length: 20 }, (_, i) => ({
      x: i,
      y: i,
      pinned: i === 0,
    }));
    const result = lttbWithPinnedPoints(data, 5, p => p.pinned, getX, getY);
    const count = result.filter(p => p === data[0]).length;
    expect(count).toBe(1);
  });
});
```

- [ ] **Step 2: Run the tests**

```bash
npx vitest run src/utils/lttb.test.ts
```

Expected: **7 tests PASS**. The implementation already exists, so all tests should be green immediately.

- [ ] **Step 3: Commit**

```bash
git add src/utils/lttb.test.ts
git commit -m "test: add unit tests for lttb downsampling"
```

---

### Task 3: Unit tests for `gpxParser.ts`

**Files:**
- Create: `src/utils/gpxParser.test.ts`
- No changes to: `src/utils/gpxParser.ts`

Tests use inline GPX XML fixture strings. `gpxparser` is a pure library (no network, no DOM), so it runs directly in `node` environment without mocking.

- [ ] **Step 1: Create the test file**

Create `src/utils/gpxParser.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseGPX } from './gpxParser';

// Build a minimal GPX XML string from parts
const gpx = (name: string, trkpts: string) => `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1">
  <trk>
    ${name ? `<name>${name}</name>` : ''}
    <trkseg>${trkpts}</trkseg>
  </trk>
</gpx>`;

const pt = (lat: number, lon: number, ele?: number) =>
  `<trkpt lat="${lat}" lon="${lon}">${ele !== undefined ? `<ele>${ele}</ele>` : ''}</trkpt>`;

// Five points: gains are 35→40 (+5) and 38→45 (+7), descents are ignored → totalElevationGain = 12m
const VALID = gpx('Test Route', [
  pt(48.8566, 2.3522, 35),
  pt(48.8600, 2.3600, 40),
  pt(48.8550, 2.3650, 38),
  pt(48.8520, 2.3700, 45),
  pt(48.8500, 2.3750, 42),
].join('\n'));

describe('parseGPX', () => {
  it('returns correct name, point count, and elevation gain for a valid GPX', () => {
    const result = parseGPX(VALID);
    expect(result.name).toBe('Test Route');
    expect(result.points).toHaveLength(5);
    expect(result.totalElevationGain).toBeCloseTo(12, 0);
  });

  it('first point has distance 0 and subsequent distances increase monotonically', () => {
    const { points } = parseGPX(VALID);
    expect(points[0].distance).toBe(0);
    for (let i = 1; i < points.length; i++) {
      expect(points[i].distance).toBeGreaterThan(points[i - 1].distance);
    }
  });

  it('elevation gain only counts positive deltas — descents are not subtracted', () => {
    const descending = gpx('Descent', [
      pt(48.85, 2.35, 100),
      pt(48.86, 2.36, 80),
      pt(48.87, 2.37, 60),
    ].join('\n'));
    expect(parseGPX(descending).totalElevationGain).toBe(0);
  });

  it('defaults elevation to 0 when ele attribute is absent', () => {
    const noEle = gpx('No Ele', [
      pt(48.85, 2.35),
      pt(48.86, 2.36),
    ].join('\n'));
    const { points } = parseGPX(noEle);
    expect(points[0].ele).toBe(0);
    expect(points[1].ele).toBe(0);
  });

  it('falls back to "Untitled Route" when track name is missing', () => {
    const noName = gpx('', [
      pt(48.85, 2.35, 10),
      pt(48.86, 2.36, 10),
    ].join('\n'));
    expect(parseGPX(noName).name).toBe('Untitled Route');
  });

  it('throws when the GPX file contains no tracks', () => {
    expect(() => parseGPX(`<?xml version="1.0"?><gpx version="1.1"></gpx>`))
      .toThrow('No tracks found in GPX file');
  });
});
```

- [ ] **Step 2: Run the tests**

```bash
npx vitest run src/utils/gpxParser.test.ts
```

Expected: **6 tests PASS**.

- [ ] **Step 3: Commit**

```bash
git add src/utils/gpxParser.test.ts
git commit -m "test: add unit tests for GPX parser"
```

---

### Task 4: HttpClient injection + weatherService tests

**Files:**
- Modify: `src/services/weatherService.ts`
- Create: `src/services/weatherService.test.ts`

This is the only task that modifies existing production code. The change is non-breaking: callers that omit the 4th argument continue to use axios.

- [ ] **Step 1: Write the failing tests first**

Create `src/services/weatherService.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { fetchWeatherForPoint } from './weatherService';
import type { HttpClient } from './weatherService';

// 2025-06-15T14:00:00 UTC — the hourly slot the service will look up is '2025-06-15T14:00'
const TS = new Date('2025-06-15T14:00:00.000Z').getTime() / 1000;

const makeStub = (weatherCode: number): HttpClient => ({
  get: vi.fn().mockResolvedValue({
    data: {
      hourly: {
        time: ['2025-06-15T14:00'],
        temperature_2m: [22],
        apparent_temperature: [20],
        precipitation_probability: [15],
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
    expect(result.temp).toBe(22);
    expect(result.feelsLike).toBe(20);
    expect(result.precipProb).toBe(15);
    expect(result.windSpeed).toBe(12);
    expect(result.windDeg).toBe(270);
    expect(result.condition).toBe('Clear');
  });

  it('returns fallback when the target hour is absent from the response', async () => {
    const result = await fetchWeatherForPoint(48.8, 2.3, TS, missingHourStub);
    expect(result.condition).toContain('Fallback');
  });

  it('returns fallback when the HTTP call throws', async () => {
    const result = await fetchWeatherForPoint(48.8, 2.3, TS, throwingStub);
    expect(result.condition).toContain('Fallback');
  });

  it.each([
    [0,  'Clear'],
    [2,  'Partly Cloudy'],
    [50, 'Rain'],
    [75, 'Snow'],
    [95, 'Storm'],
  ])('weather code %i → condition "%s"', async (code, expected) => {
    const result = await fetchWeatherForPoint(48.8, 2.3, TS, makeStub(code));
    expect(result.condition).toBe(expected);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
npx vitest run src/services/weatherService.test.ts
```

Expected: **TypeScript/compile error** — `HttpClient` is not exported from `weatherService.ts` and `fetchWeatherForPoint` does not accept a 4th argument.

- [ ] **Step 3: Update `weatherService.ts`**

Replace the full contents of `src/services/weatherService.ts`:

```ts
import axios from 'axios';

export interface WeatherData {
  temp: number;
  feelsLike: number;
  precipProb: number;
  windSpeed: number;
  windDeg: number;
  condition: string;
}

export interface HttpClient {
  get(url: string, config?: { params?: Record<string, unknown> }): Promise<{ data: unknown }>;
}

export const fetchWeatherForPoint = async (
  lat: number,
  lon: number,
  timestamp: number,
  http: HttpClient = axios as HttpClient
): Promise<WeatherData> => {
  const date = new Date(timestamp * 1000);
  const hourIso = date.toISOString().slice(0, 14) + '00';

  try {
    const response = await http.get(`https://api.open-meteo.com/v1/forecast`, {
      params: {
        latitude: lat,
        longitude: lon,
        hourly: 'temperature_2m,apparent_temperature,precipitation_probability,wind_speed_10m,wind_direction_10m,weather_code',
        forecast_days: 2,
      },
    });

    const hourly = (response.data as any).hourly;
    const timeIndex = hourly.time.findIndex((t: string) => t === hourIso.slice(0, 16));

    if (timeIndex === -1) {
      return mockFallback(timestamp);
    }

    return {
      temp: hourly.temperature_2m[timeIndex],
      feelsLike: hourly.apparent_temperature[timeIndex],
      precipProb: hourly.precipitation_probability[timeIndex],
      windSpeed: hourly.wind_speed_10m[timeIndex],
      windDeg: hourly.wind_direction_10m[timeIndex],
      condition: getWeatherCondition(hourly.weather_code[timeIndex]),
    };
  } catch (error) {
    console.error('Weather API error:', error);
    return mockFallback(timestamp);
  }
};

const getWeatherCondition = (code: number): string => {
  if (code === 0) return 'Clear';
  if (code < 4) return 'Partly Cloudy';
  if (code < 70) return 'Rain';
  if (code < 80) return 'Snow';
  return 'Storm';
};

const mockFallback = (timestamp: number): WeatherData => {
  const hour = new Date(timestamp * 1000).getHours();
  return {
    temp: 20 + Math.sin((hour - 6) * Math.PI / 12) * 5,
    feelsLike: 18,
    precipProb: 10,
    windSpeed: 12,
    windDeg: 270,
    condition: 'Sunny (Fallback)',
  };
};
```

Changes from the original (only these three things changed):
1. Added `export interface HttpClient` with a single `get` method
2. Added `http: HttpClient = axios as HttpClient` as an optional 4th parameter
3. Changed `axios.get(...)` → `http.get(...)` and added `(response.data as any)` cast (needed because `HttpClient.get` returns `{ data: unknown }` rather than axios's typed response)

`App.tsx` calls `fetchWeatherForPoint(point.lat, point.lng, arrivalTime.getTime() / 1000)` with three arguments — the axios default is used. No changes to `App.tsx`.

- [ ] **Step 4: Run the weatherService tests**

```bash
npx vitest run src/services/weatherService.test.ts
```

Expected: **8 tests PASS** (3 explicit + 5 from `it.each`).

- [ ] **Step 5: Run the full suite**

```bash
npx vitest run
```

Expected: **21 tests PASS** across all three test files (7 lttb + 6 gpxParser + 8 weatherService).

- [ ] **Step 6: Commit**

```bash
git add src/services/weatherService.ts src/services/weatherService.test.ts
git commit -m "test: add weatherService unit tests with HttpClient injection"
```

---

### Task 5: Verify coverage and regression

**Files:** No changes.

- [ ] **Step 1: Run coverage report**

```bash
npm run test:coverage
```

Expected: terminal coverage table printed; `coverage/` directory created. The three tested modules should show high line and branch coverage.

- [ ] **Step 2: Confirm TypeScript build still passes**

```bash
npm run build
```

Expected: type-check and Vite build complete with no errors.

- [ ] **Step 3: Confirm E2E tests still pass**

```bash
npx playwright test
```

Expected: all existing Playwright tests PASS.
