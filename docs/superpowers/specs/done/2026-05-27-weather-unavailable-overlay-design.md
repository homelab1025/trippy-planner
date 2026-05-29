# Weather Unavailable Overlay

**Date:** 2026-05-27

## Problem

When the Open-Meteo API fails or the requested date is outside the 7-day forecast window, `weatherService.ts` silently returns synthetic data via `mockFallback`. The user sees plausible-looking temperature and precipitation values with no indication they are fake. This is misleading.

## Goal

Remove all fake data from the pipeline. When weather cannot be retrieved, show a clear message centered in the WeatherTimeline chart. The elevation profile continues to render normally.

## Design

### 1. `weatherService.ts`

- Delete `mockFallback`.
- Return type of `fetchWeatherForPoint` changes to `Promise<WeatherData | null>`.
- Both failure paths return `null`:
  - `timeIndex === -1` (exact hour not in API response)
  - `catch` block (network/API error)

### 2. `App.tsx`

- Add state: `const [weatherAvailable, setWeatherAvailable] = useState<boolean | null>(null)`
  - `null` = fetch in progress (route just changed)
  - `true` = fetch completed, at least one point returned
  - `false` = fetch completed, all points failed
- Reset to `null` at the start of the `useEffect` fetch.
- After `Promise.all` resolves and nulls are filtered, set to `filteredPoints.length > 0`.
- Pass `weatherAvailable` to `WeatherTimeline`.

### 3. `WeatherTimeline.tsx`

- Add `weatherAvailable: boolean | null` to props interface.
- When `weatherAvailable === false`:
  - Render a centered SVG `<text>` (or `<foreignObject>`) over the chart area with the message: **"Weather data unavailable for the selected date"**.
  - Hide the temperature and precipitation lines (they carry no data anyway).
  - Elevation area chart renders as normal.
- When `weatherAvailable === null` or `true`: existing behavior unchanged.

## Error handling

No new error boundaries needed. The `null` return from the service is handled in `App.tsx`'s existing filter and the new `weatherAvailable` flag. Individual point failures are transparent — if any subset succeeds, `weatherAvailable` is `true` and partial weather data renders normally (existing behavior for partially-missing points).

## Testing

- Unit test `fetchWeatherForPoint`: assert it returns `null` (not a `WeatherData` object) when the API throws or `timeIndex === -1`.
- Unit test `WeatherTimeline`: assert the overlay message renders when `weatherAvailable=false` + route present; assert it does not render when `weatherAvailable=true`.
- Existing E2E precipitation flow test should still pass (it uses a mocked HTTP client that returns valid data).
