# Chart Split Redesign

**Date:** 2026-06-03
**Status:** Approved
**Supersedes:** `docs/superpowers/specs/2026-06-02-chart-split-design.md`

## Problem

The current `WeatherTimeline` is a single `ComposedChart` mixing elevation, temperature, and precipitation on one canvas. Wind speed is fetched but never displayed. The sidebar wastes space on a stats card that duplicates information easily surfaced in the header. There is no persistent value readout — hover tooltips vanish the moment the cursor leaves.

## Goal

Split the single chart into three focused charts. Move weather charts into the left sidebar (freed by removing the stats card). Add a persistent hover pane beside the elevation chart showing all values at the hovered point. No page scroll; everything fits the viewport.

---

## Layout

```
Header: [Logo · "Trippy Planner"] ["Route Name: X km · Y m of character-building"] [Upload]

main-content (grid: 320px | 1fr)
├── sidebar (320px, flex column, scrollable above sidebar-bottom)
│   ├── .ride-details-panel   ← collapsible; auto-collapses on route load
│   ├── .tempwind-container   ← fixed height; only renders when route loaded
│   └── .precip-container     ← fixed height; only renders when route loaded
│
├── sidebar-bottom (grid row 2, 320px)
│   └── .tech-details-card    ← pinned to bottom; absorbs version + build date
│
└── display-area (grid col 2, rows 1–2, flex column)
    ├── .map-container        ← flex: 2
    └── .elevation-row        ← flex: 1, flex row, single glass panel
        ├── ElevationChart    ← flex: 1
        └── .hover-pane       ← fixed ~110px right strip, inside the same glass panel
```

### Tuning knobs — single location

All layout dimensions live in one block at the top of `App.css`:

```css
/* -- Layout tuning knobs -- */
--sidebar-width:        320px;
--chart-sidebar-height: 180px;   /* TempWind and Precip each */
--hover-pane-width:     110px;
```

### Sidebar overflow

When both Ride Details and Tech Details are expanded simultaneously, the area above the pinned Tech Details scrolls (`overflow-y: auto`). Tech Details remains pinned to the bottom regardless.

### Resize behaviour

- Map and elevation row resize proportionally with window height (flex-based).
- Sidebar weather charts are fixed height (`--chart-sidebar-height`).
- No scrolling on the display area. The `height: 100vh` constraint is preserved.

### Mobile (≤1024px)

All panels stack as a single column. Sidebar weather charts each get a fixed px height when stacked.

---

## Header

Three flex zones:

| Zone | Content | Condition |
|------|---------|-----------|
| Left | Logo + "Trippy Planner" | Always |
| Center | `"[Route Name]: [X] km · [Y] m of character-building"` | Route loaded only |
| Right | Upload GPX button | Always |

The center zone is absent (no placeholder) before a route is loaded.

---

## Sidebar Behaviour

### Ride Details panel

- **Before route loaded:** expanded. Shows average speed, start date/time, x-axis toggle.
- **After route loaded:** auto-collapses. User can re-open manually at any time.

### Weather charts (TempWind + Precip)

Only mount after a route is loaded. Before that, the sidebar shows only Ride Details and Tech Details.

### Tech Details panel

Absorbs `BuildInfoPanel` — version number and build date move into the Tech Details collapsible body, below the existing DP epsilon/max-gap/weather provider/debug controls. `BuildInfoPanel.tsx` is deleted.

---

## Hover Pane

A `~110px` right strip inside the elevation glass panel (flex row: `ElevationChart` + `.hover-pane`).

**When hovering any chart:**

```
12:34 · 42.1 km
───────────────
↑    1 240 m
🌡    18°C
💨    23 km/h
🌧    40% · 0.2 mm
```

- Icon column is fixed width; value text starts at the same horizontal position for all rows (CSS grid: `grid-template-columns: 20px 1fr` per row).
- Driven by the same hover event that moves the map pin.
- Shows elevation, temperature, wind speed, precipitation probability + amount.

**When not hovering:**

> Hover over charts to see values here

Styled the same as the empty-state messages in the map and elevation panels.

---

## Components

### Deleted

- `src/components/WeatherTimeline.tsx`
- `src/components/WeatherTimeline.test.tsx`
- `src/components/BuildInfoPanel.tsx`
- `src/components/BuildInfoPanel.test.tsx`

### New

| Path | Responsibility |
|------|----------------|
| `src/hooks/useWeatherChartData.ts` | Pure `buildChartData` function + hook wrapper. LTTB downsampling with pinned weather samples; linear interpolation of temp, precip, wind between samples. Exports `ChartDataPoint` type. Also owns `formatElapsed` helper (moved from `WeatherTimeline`). |
| `src/hooks/useWeatherChartData.test.ts` | Unit tests for `buildChartData` (no jsdom). |
| `src/components/ClimbOverlay.tsx` | **Modified:** `ClimbTimeRange` type moves here (currently exported from `WeatherTimeline`); `ClimbOverlay` becomes the source of truth for that type. |
| `src/components/ElevationChart.tsx` | Elevation area + ClimbOverlay. Reports pixel width via `onResize`. Owns `climbTimeRanges` computation. Imports `ClimbTimeRange` from `ClimbOverlay`. |
| `src/components/ElevationChart.test.tsx` | Verifies elevation `Area` dataKey and domain; ClimbOverlay receives correct climbTimeRanges; onResize fires. |
| `src/components/TempWindChart.tsx` | Temperature line (left axis °C) + wind speed line (right axis km/h). Fixed `--chart-sidebar-height`. Unavailable overlay. |
| `src/components/TempWindChart.test.tsx` | Verifies `temp` and `windSpeed` dataKeys wired; unavailable overlay on `weatherAvailable === false`. |
| `src/components/PrecipChart.tsx` | Precipitation probability line (left axis 0–100%) + precipitation amount line (right axis mm). Fixed `--chart-sidebar-height`. Unavailable overlay. |
| `src/components/PrecipChart.test.tsx` | Verifies `precipProb` and `precipitation` dataKeys wired; correct axis domains. |
| `src/components/HoverPane.tsx` | Pure display component. Receives `hoveredData: ChartDataPoint \| null`. Renders placeholder when null; renders all six labeled rows (time, distance, elevation, temp, wind, precip prob+amount) with consistent icon-column alignment when data is present. |
| `src/components/HoverPane.test.tsx` | Placeholder renders when null; all six rows render with correct formatted values when data is provided. |

---

## Data Flow

### `App.tsx` changes

- Gains `hoveredData: ChartDataPoint | null` state (replaces the `hoveredPoint` lat/lng for chart hover).
- Calls `useWeatherChartData` once; fans `chartData` to all three chart components and `HoverPane`.
- `onHoverIndex(index: number | null)` callback replaces `onHoverDistance`: charts report the active data-point index; `App` resolves lat/lng for the map pin and sets `hoveredData` for `HoverPane` from `chartData[index]`.

```ts
const chartData = useWeatherChartData({ route, weatherPoints, chartWidth, avgSpeed, startTime });

// on hover:
const point = chartData[index];
setHoveredPoint({ lat: ..., lng: ... }); // map pin
setHoveredData(point);                   // hover pane
```

### Hover sync

All three charts call `onHoverIndex` → `App` resolves both the map pin position and `hoveredData` → `MapComponent` moves the pin; `HoverPane` updates. Hovering any chart moves the map marker and populates the pane.

---

## Testing

### Unit

| File | What is verified |
|------|-----------------|
| `useWeatherChartData.test.ts` | LTTB pins weather samples; interpolation fills temp/precip/wind between samples; edge cases (empty route, no weather, single point) |
| `ElevationChart.test.tsx` | Elevation `Area` has correct `dataKey` and domain `[dataMin - 10, auto]`; `ClimbOverlay` receives correct `climbTimeRanges`; `onResize` fires |
| `TempWindChart.test.tsx` | Both `Line` components have correct `dataKey`; unavailable overlay visible when `weatherAvailable === false` |
| `PrecipChart.test.tsx` | Both `Line` components have correct `dataKey`; prob axis domain `[0, 100]` |
| `HoverPane.test.tsx` | Placeholder renders when `hoveredData` is null; all six labeled rows render with correctly formatted values when data is present; icon column is fixed-width grid column |

### Playwright E2E (updates required)

Tests that break due to removed/renamed DOM elements — selectors must be updated:

| Test | Breaking change |
|------|----------------|
| `can upload GPX and see route details` | Stats move to header; `.stats-card` context gone |
| `uploading a 2-point GPX renders map and shows ~0 elevation gain` | `.stat-item` / `.stat-value` selectors gone from sidebar |
| `Tech Details shows parse time and file size` | `.stats-card` filter for Tech Details panel no longer valid |
| `hover over timeline shows polished orange marker on map` | `.timeline-container` deleted |
| `version panel is always visible on page load` | `.build-info-panel` deleted |
| `version panel remains visible after GPX upload` | `.build-info-panel` deleted |
| `changing speed rerenders timeline without crash` | `.timeline-container` deleted |

**New Playwright test:** after GPX upload, hover over a chart and verify the hover pane shows non-empty values (not the placeholder text).
