# Precipitation in Weather Timeline

**Date:** 2026-05-27
**Status:** Approved

## Summary

Add precipitation probability (%) as a visible line on the `WeatherTimeline` chart, and surface precipitation amount (mm) in the hover tooltip. Both values come from Open-Meteo's hourly forecast, which the app already queries.

## Scope

In scope:
- `precipitation_probability` (%) rendered as a line on the chart
- `precipitation` (mm) shown in the hover tooltip only
- Unit tests updated to cover the new fields

Out of scope:
- Map marker popups (the README TODO describing this is stale; the map component no longer has weather markers)
- Other precipitation sub-types (`rain`, `showers`, `snowfall`) — not included in this iteration

## Data Layer (`weatherService.ts`)

1. Add `precipitation: number` to the `WeatherData` interface.
2. Add `precipitation` to the `hourly` comma-separated param string sent to Open-Meteo.
3. Map `hourly.precipitation[timeIndex]` in the return object.
4. Add `precipitation: 0` to `mockFallback`.

No changes to `App.tsx` — `weatherPoints` already carries all `WeatherData` fields and flows to `WeatherTimeline` without modification.

## Chart Layer (`WeatherTimeline.tsx`)

### Data shape
Add `precipProb` and `precipitation` fields to each chart data point, populated from `weatherPoints` at sample indices — same pattern as `temp`.

### Interpolation
Both `precipProb` and `precipitation` are linearly interpolated between sample points inside the existing interpolation loop (which already handles `temp` and `time`). This gives a continuous line and meaningful tooltip values at every hover position.

### New chart elements
- A hidden `YAxis` with `yAxisId="precip"`, `domain={[0, 100]}`, `hide={true}` — keeps `precipProb` correctly scaled without cluttering the chart with a third axis label.
- A `Line` for `precipProb` using `yAxisId="precip"`, colour `#4A90D9` (blue), with dots at sample points only — same dot pattern as the temperature line.

### Tooltip-only precipitation amount
`precipitation` (mm) has no visual line. It is added as a `Line` with `stroke="none"`, `dot={false}`, and `legendType="none"` so recharts includes its value in tooltip payloads without rendering anything. The `formatter` renders it as `${value.toFixed(1)} mm`.

### Tooltip formatter extension
Extend the existing `formatter` to handle three named series:
- `"Temp"` → `${Math.round(value)}°C`
- `"Precip Prob"` → `${Math.round(value)}%`
- `"Precip"` → `${value.toFixed(1)} mm`

## Tests

### `weatherService.test.ts`
- Add `precipitation: [2.5]` to `makeStub` hourly response.
- Add `precipitation: [0]` to `missingHourStub`.
- Assert `result.precipitation === 2.5` in the "maps a valid API response" test.

### `WeatherTimeline.test.tsx`
- Add `precipitation: 2.5` to `mockWeatherPoint` fixture to satisfy the updated `WeatherData` type.
- No new behavioural tests — recharts is fully mocked; existing hover/leave tests remain valid.

### Playwright
No changes — E2E tests cover file upload and map rendering, not chart internals.

## Colour palette (after change)

| Series | Colour |
|---|---|
| Elevation | `#2d5a27` (green) |
| Temperature | `#ff7300` (orange) |
| Precip Probability | `#4A90D9` (blue) |
