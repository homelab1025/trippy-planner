# Unit Test Suite Design — Vitest

**Date:** 2026-05-21  
**Scope:** Isolated module unit tests for `lttb`, `gpxParser`, and `weatherService`. `App.tsx` helpers left untested for now; covered by existing Playwright E2E suite.

---

## 1. Setup

**Dependencies to add (dev):**
- `vitest`
- `@vitest/coverage-v8`

**`vite.config.ts`:** Add a `test` block (Vitest reads from Vite config — no separate config file needed).

**`package.json` scripts:**
```json
"test": "vitest",
"test:coverage": "vitest run --coverage"
```

---

## 2. `lttb.ts` — `src/utils/lttb.test.ts`

No mocking. Pure algorithmic functions.

| Test | Assertion |
|------|-----------|
| Data shorter than target | Returns a copy unchanged |
| First and last points | Always preserved |
| Output length | Equals exactly `target` |
| Spike preservation | A dataset with a clear spike: the spike point survives downsampling |
| `lttbWithPinnedPoints` — dropped pinned point | Re-inserted into result |
| `lttbWithPinnedPoints` — sort order | Result sorted by x after re-insertion |
| `lttbWithPinnedPoints` — no duplicates | A pinned point already kept doesn't appear twice |

---

## 3. `gpxParser.ts` — `src/utils/gpxParser.test.ts`

No mocking. Real minimal GPX XML strings as inline fixtures (5–10 `<trkpt>` elements). The `gpxparser` library is pure (no network, no DOM) — safe to run directly.

| Test | Assertion |
|------|-----------|
| Valid GPX | Correct `name`, `totalDistance`, `totalElevationGain`, point count |
| Cumulative distances | First point is `0`; values increase monotonically |
| Elevation gain | Only positive deltas summed — descents do not subtract |
| Missing `ele` attribute | Defaults to `0` |
| Missing track name | Falls back to `'Untitled Route'` |
| No tracks in file | Throws `'No tracks found in GPX file'` |

---

## 4. `weatherService.ts` — `src/services/weatherService.test.ts`

**Required structural change:** Introduce an `HttpClient` interface in `weatherService.ts` and add it as an optional last parameter to `fetchWeatherForPoint`, defaulting to axios. Existing callers in `App.tsx` require no changes.

```ts
interface HttpClient {
  get(url: string, config?: { params?: Record<string, unknown> }): Promise<{ data: unknown }>;
}

export const fetchWeatherForPoint = async (
  lat: number,
  lon: number,
  timestamp: number,
  http: HttpClient = axios
): Promise<WeatherData> => { ... }
```

Tests use an inline stub object — no `vi.mock()`.

| Test | Assertion |
|------|-----------|
| Happy path | Stub returns valid hourly response → mapped `WeatherData` fields match |
| Hour not found (`timeIndex === -1`) | Returns fallback — condition includes `"Fallback"` |
| Stub throws | Returns fallback |
| Weather code `0` | `condition === 'Clear'` |
| Weather code `2` | `condition === 'Partly Cloudy'` |
| Weather code `50` | `condition === 'Rain'` |
| Weather code `75` | `condition === 'Snow'` |
| Weather code `95` | `condition === 'Storm'` |

Weather code cases are tested by controlling `weather_code` in the stub response — `getWeatherCondition` stays private.

---

## Out of scope

- `App.tsx` helpers (`getLocalDateString`, `getLocalTimeString`, `resolveDistanceToPoint`) — private, untested, covered by Playwright
- Component tests (`MapComponent`, `WeatherTimeline`) — Leaflet/recharts DOM dependencies; Playwright E2E already covers these
- React Testing Library — not added
