---
title: Wind Arrow Row & Precipitation Bar Row
date: 2026-06-07
status: approved
---

## Goal

Replace the two `WeatherLineChart` sub-rows (wind line, precip lines) with two bespoke SVG components that match the reference design: directional wind arrows with speed labels, and variable-height opacity bars for precipitation.

## Current state

```
ElevationChart          height: 300   left Y: elevation, right Y: temp
WeatherLineChart        height: 40    line1=windSpeed   hideAxes
WeatherLineChart        height: 40    line1=precipProb, line2=precipitation   hideAxes
```

## Target state

```
ElevationChart          height: 300   left Y: elevation, right Y: temp   (unchanged)
WindArrowRow            height: 40    direction arrows + speed labels at each sample point
PrecipBarRow            height: 40    bars per segment: height=amount, opacity=probability
```

## Data changes

### `ChartDataPoint` (`useWeatherChartData.ts`)

Add `windDeg: number | undefined` field — currently present in `WeatherData` and `WeatherSample` but dropped when building chart data.

```ts
export interface ChartDataPoint {
  distance: number;
  elevation: number;
  temp: number | undefined;
  precipProb: number | undefined;
  precipitation: number | undefined;
  windSpeed: number | undefined;
  windDeg: number | undefined;   // ← new
  time: number;
  isSample: boolean;
}
```

Populate it in `buildChartData`:
```ts
d[rIdx].windDeg = wp.windDeg;
```

Add `windDeg` to the existing null guard in `buildChartData` (the `if (tLo == null || ...)` block that already covers all weather fields) and interpolate alongside the others:
```ts
// in the null guard: add wdLo == null || wdHi == null
const wdLo = downsampled[lo].windDeg, wdHi = downsampled[hi].windDeg;
downsampled[j].windDeg = wdLo! + (wdHi! - wdLo!) * t;
```

### `App.tsx` — sample points memo

Filter chart data to actual weather sample positions:

```ts
const samplePoints = useMemo(
  () => chartData.filter(p => p.isSample),
  [chartData]
);
```

And derive the distance range:
```ts
const distanceRange = useMemo(
  (): [number, number] => chartData.length
    ? [chartData[0].distance, chartData[chartData.length - 1].distance]
    : [0, 1],
  [chartData]
);
```

## New component: `WindArrowRow`

**File:** `src/components/WindArrowRow.tsx`

```ts
interface WindArrowRowProps {
  samplePoints: ChartDataPoint[];
  distanceRange: [number, number];
  chartWidth: number;
}
```

**Layout:** full-width `div` at height 40px, position `relative`. A Lucide `Wind` icon is absolutely positioned at left ~16px, vertically centred. An SVG fills `100%` width × `100%` height.

**X alignment:** The plot area inside recharts uses `marginLeft(10) + leftYAxisWidth(45) = 55px` from the left edge, and `marginRight(55)` from the right edge. The SVG uses the same offsets:

```
plotLeft  = 55
plotRight = chartWidth - 55
plotWidth = chartWidth - 110

xOf(distance) = plotLeft + ((distance - distanceRange[0]) / (distanceRange[1] - distanceRange[0])) * plotWidth
```

**Dashed baseline:** SVG `<line>` from `(plotLeft, 20)` to `(plotRight, 20)` with `strokeDasharray="4 4"` and `stroke="#bfdbfe"`.

**Per sample point:**
- Arrow SVG: an upward-pointing arrow `↑` rendered as a `<g>` with SVG `transform="rotate(windDeg, x, 20)"`. 14×14, centred at `(x, 20)`.
  - `windDeg=0` (from north) → arrow points up (↑) — shows wind coming from the top.
  - `windDeg=90` (from east) → arrow points right (→).
  - Use SVG `transform="rotate(deg, cx, cy)"` — not CSS — so the pivot point is exact.
- Speed label: `<text>` at `(x, 34)`, `fontSize=9`, `textAnchor="middle"`, `fill="#3b82f6"`, value = `Math.round(windSpeed)`.

**No-data state:** When `samplePoints` is empty, render nothing (empty SVG). Caller is responsible for not rendering the row if weather is unavailable.

## New component: `PrecipBarRow`

**File:** `src/components/PrecipBarRow.tsx`

```ts
interface PrecipBarRowProps {
  samplePoints: ChartDataPoint[];
  distanceRange: [number, number];
  chartWidth: number;
}
```

**Layout:** full-width `div` at height 40px, position `relative`. A Lucide `CloudRain` icon absolutely positioned at left ~16px, vertically centred. SVG fills `100%` × `100%`.

**Bar segments:** N sample points → N+1 bars. Segments are: route start → sample[0], sample[0] → sample[1], …, sample[N-2] → sample[N-1], sample[N-1] → route end. Each segment uses the starting boundary's sample point values (the edge segments use the nearest sample point).

For each segment `[a, b]` using the starting point's weather values:
```
x1 = xOf(a.distance)
x2 = xOf(b.distance)
barWidth = x2 - x1 - 2   (2px gap between bars)
maxBarHeight = 28
barHeight = Math.min((precipitation / maxPrecip) * maxBarHeight, maxBarHeight)
opacity = precipProb / 100
```

`maxPrecip` is computed as `Math.max(...samplePoints.map(p => p.precipitation ?? 0), 1)` so bars scale relative to the route's worst rainfall.

Bar SVG element: `<rect>` with `fill="#3b82f6"`, `opacity`, positioned with bottom edge at SVG y=36, height growing upward.

**No-data state:** When `samplePoints` is empty, render nothing.

## `App.tsx` changes

Remove `WIND_LINE`, `PROB_LINE`, `AMOUNT_LINE` consts — no longer used. Remove the `WeatherLineChart` import (used only for these two rows; the component file itself is kept). Import `WindArrowRow` and `PrecipBarRow`.

Replace:
```tsx
<div className="border-t border-base-200" style={{ height: 40 }}>
  <WeatherLineChart data={windData} line1Config={WIND_LINE} ... />
</div>
<div className="border-t border-base-200" style={{ height: 40 }}>
  <WeatherLineChart data={precipData} line1Config={PROB_LINE} line2Config={AMOUNT_LINE} ... />
</div>
```

With:
```tsx
<div className="border-t border-base-200" style={{ height: 40 }}>
  <WindArrowRow samplePoints={samplePoints} distanceRange={distanceRange} chartWidth={chartWidth} />
</div>
<div className="border-t border-base-200" style={{ height: 40 }}>
  <PrecipBarRow samplePoints={samplePoints} distanceRange={distanceRange} chartWidth={chartWidth} />
</div>
```

The existing `windData` and `precipData` memos can be removed. `WeatherLineChart` import and `hoveredIndex`/`onHoverIndex` props are no longer needed for these two rows (hover is handled by the elevation chart above).

## Testing

- **`WindArrowRow.test.tsx`**: render with sample points, assert SVG arrows present, assert rotation attribute matches `windDeg`, assert speed label text, assert empty render when no sample points.
- **`PrecipBarRow.test.tsx`**: render with sample points, assert correct number of `<rect>` elements (N+1 for N sample points), assert `opacity` and `height` scale correctly with input values, assert empty render when no sample points.
- **`useWeatherChartData.test.ts`**: assert `windDeg` is populated on sample points and interpolated between them.
- Visual: upload GPX, confirm arrows rotate correctly for different wind directions, confirm bars grow taller for higher precipitation, confirm both rows align horizontally with the elevation chart above.

## Decision log

- Arrow direction: points toward wind source (meteorological convention). windDeg=0 → ↑.
- Bar encoding: height = precipitation amount (mm, relative scale), opacity = probability (0–100%).
- Implementation: pure SVG components, no recharts. X alignment via hardcoded 55px left/right offsets matching recharts margins.
- `WeatherLineChart` removed for wind and precip rows; component stays for any future use.
