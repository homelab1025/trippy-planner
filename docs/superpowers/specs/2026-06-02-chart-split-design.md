# Chart Split Design

**Date:** 2026-06-02  
**Status:** Approved

## Problem

The current `WeatherTimeline` is a single `ComposedChart` mixing elevation, temperature, and precipitation probability on one canvas. Wind speed is fetched but never displayed. The elevation profile — the most useful reference for cyclists — has no visual prominence and shares space with weather data.

## Goal

Split the single chart into three focused charts arranged so the elevation profile is the central spatial reference, with weather data in dedicated panels alongside it. No page scroll; everything fits the viewport.

---

## Layout

The `display-area` becomes a **flex row** with two sub-columns.

```
.display-area  (flex row, fills all available height)
├── .display-left  (flex: 1, flex column)
│   ├── .map-container        (flex: 2  → ~67% of left-column height)
│   └── .elevation-container  (flex: 1  → ~33% of left-column height)
└── .display-right  (fixed width, flex column)
    ├── .precip-container     (fixed height: --chart-weather-height)
    ├── .tempwind-container   (fixed height: --chart-weather-height)
    └── (remaining space: dead space inside glass panel)
```

### Tuning knobs — single location

All layout dimensions live in one block at the top of `App.css`:

```css
/* -- Layout tuning knobs -- */
--sidebar-width:         320px;
--chart-right-col-width: 340px;
--chart-weather-height:  210px;
--elevation-flex:          1;   /* relative to map's flex: 2 */
```

These are the **only** values to change when adjusting proportions.

### Resize behaviour

- Map and elevation chart resize proportionally with window height (flex-based, no pixel heights).
- Right-column charts are fixed-height; leftover space in the column is empty panel background.
- No scrolling. The `height: 100vh` constraint is preserved.

### Mobile (≤1024px)

All panels stack as a single column, same as today. Right-column charts each get a fixed px height when stacked, matching the current timeline behaviour.

---

## Components

### Deleted

- `src/components/WeatherTimeline.tsx` — replaced entirely.
- `src/components/WeatherTimeline.test.tsx` — replaced by hook unit tests.

### New: `src/hooks/useWeatherChartData.ts`

Pure data hook, no rendering.

**Inputs:** `{ route, weatherPoints, chartWidth, avgSpeed, startTime }`  
**Output:** processed `data` array (LTTB-downsampled, weather samples pinned, temp/precip/wind interpolated between sample points).

Contains all logic currently in `WeatherTimeline`'s `useMemo`. Called once in `App.tsx`; result shared by all three charts. Memoised — same inputs produce same output with no re-computation.

### New: `src/components/ElevationChart.tsx`

**Shows:** elevation profile (green area fill) + `ClimbOverlay`.  
**Temperature moves out** of this chart.  
**Props:** `route, climbs, avgSpeed, startTime, xAxisMode, data, onHoverDistance, onResize`  
The `climbTimeRanges` computation moves here (depends only on climbs + timing).  
Reports its pixel width via `onResize` → `App.tsx` → `useWeatherChartData` (determines LTTB target density).

### New: `src/components/PrecipChart.tsx`

**Shows:** precipitation probability (line, left axis 0–100%) + precipitation amount (line, right axis mm).  
**Props:** `data, xAxisMode, onHoverDistance, weatherAvailable`  
Shows "Weather data unavailable" overlay when `weatherAvailable === false`.

### New: `src/components/TempWindChart.tsx`

**Shows:** temperature (line, left axis °C) + wind speed (line, right axis km/h).  
`windSpeed` is already present in `WeatherData` but currently unused — this chart surfaces it.  
**Props:** `data, xAxisMode, onHoverDistance, weatherAvailable`  
Shows "Weather data unavailable" overlay when `weatherAvailable === false`.

---

## Data Flow

`App.tsx` gains `chartWidth` state (default `800`), updated via `onResize` from `ElevationChart`.

```ts
const chartData = useWeatherChartData({ route, weatherPoints, chartWidth, avgSpeed, startTime });
```

`chartData` is passed as `data` to all three chart components. `App.tsx` continues to own `route`, `weatherPoints`, `avgSpeed`, `startTime`, `xAxisMode`, `weatherAvailable`, and `onHoverDistance`. The hook is a pure memoised transform with no side effects.

### Hover sync

All three charts call `onHoverDistance` → `App` sets `hoveredPoint` → `MapComponent` moves the pin. Hovering any chart moves the map marker.

---

## Testing

**`src/hooks/useWeatherChartData.test.ts`**  
Unit tests for the extracted data logic:
- LTTB downsampling pins weather sample points.
- Interpolation fills temp, precip, and wind between samples.
- Edge cases: empty route, no weather points, single point.

**`src/components/ElevationChart.test.tsx`**  
**`src/components/PrecipChart.test.tsx`**  
**`src/components/TempWindChart.test.tsx`**  
Smoke tests only: renders without crashing, shows unavailable overlay when `weatherAvailable === false`. No recharts internals testing.

**`src/App.test.tsx`** — no changes required.  
**Playwright E2E tests** — no changes required.
