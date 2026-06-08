---
title: Temperature in Elevation Chart
date: 2026-06-07
status: approved
---

## Goal

Move the temperature line from the combined temp+wind weather sub-chart into the elevation chart (shared canvas, right Y-axis). The weather sub-chart beneath elevation becomes wind-only. Both remaining weather sub-charts (wind, precip) shrink to 40px height.

## Current layout

```
ElevationChart          height: 300   left Y: elevation (m)
WeatherLineChart        height: 80    line1=temp, line2=windSpeed   hideAxes
WeatherLineChart        height: 80    line1=precipProb, line2=precipitation   hideAxes
```

## Target layout

```
ElevationChart          height: 300   left Y: elevation (m), right Y: temp (°C)
WeatherLineChart        height: 40    line1=windSpeed only   hideAxes
WeatherLineChart        height: 40    line1=precipProb, line2=precipitation   hideAxes
```

## Changes

### 1. `ElevationPoint` type (`ElevationChart.tsx`)

Add optional field:

```ts
export interface ElevationPoint {
  distance: number;
  elevation: number;
  temp?: number;
}
```

### 2. `ElevationChart.tsx` — temperature overlay

Inside the existing `ComposedChart`, conditionally render temperature when data contains it:

```ts
const hasTemp = data.some(d => d.temp != null);
```

- Right `YAxis`: `yAxisId="temp"`, `orientation="right"`, `width={45}`, `stroke="#ff7300"`, `tickFormatter={(v) => \`${Math.round(v)}°C\`}`, `fontSize={10}`, `axisLine={false}`, `tickLine={false}`
- `Line`: `yAxisId="temp"`, `dataKey="temp"`, `stroke="#ff7300"`, `dot={false}`, `isAnimationActive={false}`, `type="monotone"`
- Both wrapped in `{hasTemp && ...}`
- The existing hover `ReferenceLine` is anchored to `yAxisId="elevation"` — no change needed

### 3. `WeatherLineChart.tsx` — make `line2` and `line2Config` optional

`WeatherLinePoint.line2` becomes optional so callers can omit it without TypeScript errors:

```ts
export interface WeatherLinePoint {
  time: number;
  distance: number;
  line1: number | undefined;
  line2?: number | undefined;   // was required
}
```

### 4. `WeatherLineChart.tsx` — make `line2Config` optional

```ts
interface WeatherLineChartProps {
  ...
  line2Config?: WeatherLineConfig;   // was required
  ...
}
```

The second `YAxis` and second `Line` are conditionally rendered:

```tsx
{line2Config && (
  <YAxis yAxisId={line2Config.yAxisId} orientation="right" ... />
)}
{line2Config && (
  <Line yAxisId={line2Config.yAxisId} dataKey="line2" ... />
)}
```

### 4. `App.tsx`

**`elevationData` memo** — include `temp`:

```ts
const elevationData = useMemo(
  () => chartData.map(({ distance, elevation, temp }) => ({ distance, elevation, temp })),
  [chartData]
);
```

**Replace `tempWindData` with `windData`** — wind only, no temp:

```ts
const windData = useMemo(
  () => chartData.map(({ time, distance, windSpeed }) => ({ time, distance, line1: windSpeed })),
  [chartData]
);
```

**Remove `TEMP_LINE` const** — no longer used.

**Update the first weather sub-chart** — wind only:

```tsx
<div className="border-t border-base-200" style={{ height: 40 }}>
  <WeatherLineChart
    data={windData}
    line1Config={WIND_LINE}
    hoveredIndex={hoveredIndex}
    onHoverIndex={onHoverIndex}
    weatherAvailable={weatherAvailable}
    hideAxes
  />
</div>
```

**Update the second weather sub-chart** — precip, new height:

```tsx
<div className="border-t border-base-200" style={{ height: 40 }}>
  <WeatherLineChart
    data={precipData}
    line1Config={PROB_LINE}
    line2Config={AMOUNT_LINE}
    ...
  />
</div>
```

## Testing

- Unit tests for `ElevationChart` and `WeatherLineChart` should continue to pass without changes (new prop is optional; `line2Config` absence is handled conditionally).
- Visual check: upload a GPX, confirm temperature line appears in the elevation chart with a right Y-axis labeled in °C, and the two weather sub-charts are visibly shorter.
- Check "weather unavailable" overlay still appears on wind and precip sub-charts when no weather data is loaded.
