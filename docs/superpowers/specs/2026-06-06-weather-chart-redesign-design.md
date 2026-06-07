# Weather Chart Redesign — Temperature into Elevation, Wind Reduction

## Overview

Merge temperature into the elevation chart (dual-axis) and reduce the wind chart to a single-line, shorter panel.

## Current State

- **ElevationChart** (300px): elevation area with left Y axis
- **WeatherLineChart: temp + wind** (80px): two-line chart, left Y = temperature, right Y = wind
- **WeatherLineChart: precip prob + amount** (40px): two-line chart, left Y = probability, right Y = amount
- Hover sync: `hoveredIndex` drives reference lines across all three charts

## Target State

- **ElevationChart** (300px): elevation area (left Y) + temperature line (right Y, `domain="auto"`)
- **WeatherLineChart: wind only** (40px): single-line chart, left Y = wind speed
- **WeatherLineChart: precip prob + amount** (40px): two-line chart, left Y = probability, right Y = amount

## Component Changes

### ElevationChart

- Add `temp?: number` to `ElevationPoint` interface
- Add `YAxis` with `yAxisId="temp"`, `orientation="right"`, `domain="auto"`, `fontSize={10}`, tick formatter `${Math.round(v)}°C`
- Add `Line` with `dataKey="temp"`, `stroke="#ff7300"`, `dot={false}`, `isAnimationActive={false}`, `yAxisId="temp"`
- When `hoveredIndex` is set, render a `ReferenceLine` on the `temp` yAxisId (same vertical dashed line as elevation)
- When `hoveredIndex` is set, render a `ReferenceDot` on the `temp` yAxisId (orange dot at the data point)
- Right axis ticks visible only when `hoveredIndex !== null` (same pattern as the existing weather charts)

### WeatherLineChart

- Make `line2Config` optional (`line2Config?: WeatherLineConfig`)
- When `line2Config` is `undefined`: skip rendering the second `YAxis`, second `Line`, and second `ReferenceLine`
- When `line2Config` is `undefined`: the first `YAxis` stays on the left, no right axis

### App.tsx

- Compute `tempData` from `chartData`: map each point to `{ distance, elevation, temp }`
- Pass `tempData` as `data` prop to `ElevationChart` (merge into existing data flow — `chartData` already contains `temp` per point)
- Pass `hoveredIndex` reference dot/line to temperature axis
- Change wind chart container height from `80px` to `40px`
- Change precip chart container height from `80px` to `40px`
- **Split data in `App.tsx`**: derive separate `windData` (windSpeed only) and `tempData` (temp only) from `chartData` — no unused data passed to any chart
- Wind `WeatherLineChart` receives `WIND_LINE` as `line1Config`, `windData` as data — `line2Config` omitted entirely

### Data Flow

- `chartData` from `useWeatherChartData` already has `temp: number | undefined` per point
- `ElevationChart` receives the full `chartData` array (no new interpolation needed)
- Temperature points that are `undefined` are simply skipped by the `Line` component

## Test Changes

- **ElevationChart.test.tsx**: add tests for temperature rendering, temperature reference dot/line on hover, right axis visibility
- **WeatherLineChart.test.tsx**: add tests for missing `line2Config` — no second axis/line rendered, first axis still works
- **App.test.tsx**: update mocks if needed for new props

## Decision Log

- Temperature Y axis domain: **auto** (approved by user, 2026-06-06)
- Wind chart height: **40px**
- Precip chart height: **40px** (reduced from 80px)
- Approach: **A** — extend `ElevationChart` with second axis, add `hideLine2` to `WeatherLineChart` (minimal interface change)
