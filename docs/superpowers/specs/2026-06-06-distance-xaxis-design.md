# Distance X Axis

**Date:** 2026-06-06
**Status:** Approved

## Problem

All charts (elevation, precipitation, temp/wind) use time as the X axis. This works now because time is a monotonic function of distance (uniform average speed). Long-term, the user will be able to set arrival times per waypoint independently, decoupling time from distance. Distance is the stable, route-invariant reference; time is derived from it. The axis should reflect that.

## Goal

Switch the X axis on all recharts-based charts from `time` (ms timestamp) to `distance` (km). Retain time display in the HoverPane, controlled by the existing 'Clock / Elapsed' toggle (renamed 'Time Display').

## Data Model

No changes. `ChartDataPoint` already carries both `distance` (km) and `time` (ms). The switch is purely which field is used as the axis key and for positional reference lookups.

## Component Changes

### `ElevationChart`

- **Remove props:** `avgSpeed`, `startTime`, `totalDistance`, `xAxisMode` — none are needed once distance drives the axis
- **Simplify climb range computation:** replace `climbTimeRanges` memo (which converts distances to timestamps using speed) with `climbRanges`: `x1 = climb.startDistance / 1000`, `x2 = climb.endDistance / 1000` (km directly from `Climb`)
- **XAxis:** `dataKey="distance"`, `tickFormatter={(v) => \`${Math.round(v)} km\`}`
- **ReferenceLine / ReferenceDot:** `x={data[hoveredIndex].distance}`

### `ClimbOverlay`

- Rename `ClimbTimeRange` → `ClimbRange`; `x1`/`x2` are km floats (not ms)
- `ElevDataPoint` interface: replace `time: number` with `distance: number`
- All internal lookups (elevPoints mapping, span filtering, peak finding) use `p.distance` instead of `p.time`

### `WeatherLineChart`

- **Remove prop:** `xAxisMode`
- **XAxis:** `dataKey="distance"`, same `Math.round(v) km` formatter
- **ReferenceLine:** `x={data[hoveredIndex].distance}`

### `App.tsx`

- Strip `xAxisMode`, `avgSpeed`, `startTime`, `totalDistance` from `ElevationChart` props
- Strip `xAxisMode` from both `WeatherLineChart` instances
- Keep `xAxisMode` state — it flows only to `HoverPane`
- Relabel the sidebar toggle section: "X Axis Mode" → "Time Display"

### `HoverPane`

No structural change. `xAxisMode` still controls how the `⏱` time row is formatted (clock vs. elapsed).

## Tests

- `ElevationChart.test.tsx` — remove assertions referencing time-based axis props (`avgSpeed`, `startTime`, `xAxisMode`)
- `WeatherLineChart.test.tsx` — remove `xAxisMode` from test renders
- `HoverPane.test.tsx` — no change expected

## Edge Cases

- **Degenerate GPX (distance = 0 everywhere):** recharts domain `[0, 0]` — same behaviour as with time
- **Very short routes (< 1 km):** `Math.round(v) km` shows "0 km" for most ticks; acceptable
- **Zero-width climbs (`x1 === x2`):** existing `spanPoints.length < 2` guard in `ClimbOverlay` handles this already
