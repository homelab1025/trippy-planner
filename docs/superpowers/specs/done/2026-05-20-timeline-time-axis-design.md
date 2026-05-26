# Timeline Time Axis Design

**Date:** 2026-05-20
**Status:** Approved

## Problem

The WeatherTimeline chart X axis shows distance (km) but the README specifies it should show time. The tooltip is also missing arrival time.

## Goal

Replace the distance X axis with a time axis. Add a toggle in Ride Details to switch between clock time (14:30) and elapsed duration (1h 30m). Tooltip shows km + elevation + temperature + time in the active mode.

## Scope

Two files change: `src/App.tsx` and `src/components/WeatherTimeline.tsx`. No new files, no new data fetching.

---

## Design

### State

`xAxisMode: 'clock' | 'elapsed'` added to `App.tsx` state, initialized to `'clock'`. Passed as a prop to `WeatherTimeline`.

`WeatherTimelineProps` gains one new field:
```ts
xAxisMode: 'clock' | 'elapsed';
```

### Toggle UI

A two-button segmented control added to the "Ride Details" glass panel in `App.tsx`, below the date/time inputs. Buttons: "Clock" | "Elapsed". The active button uses the existing primary style; the inactive one uses a muted style. No new CSS classes.

### Chart Data

A `time?: number` field (ms timestamp) is added to each chart data point in `WeatherTimeline`.

Population:
- For weather sample points: `time = wp.arrivalTime.getTime()`
- After LTTB downsampling: time is linearly interpolated between adjacent sample points using the same loop pattern already used for temperature

Because sampling always includes the first and last route points, and LTTB always preserves first and last, every downsampled point will have `time` defined after interpolation.

### X Axis

- `dataKey="time"`, `type="number"`, `domain={['dataMin', 'dataMax']}`
- `tickFormatter` branches on `xAxisMode`:
  - `'clock'`: `new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })`
  - `'elapsed'`: `formatElapsed(v - data[0].time!)` → e.g. `"1h 30m"` or `"45m"`

`formatElapsed` helper (module-level):
```ts
function formatElapsed(ms: number): string {
  const totalMinutes = Math.round(ms / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}
```

### Tooltip

`labelFormatter(label, payload)` branches on `xAxisMode`:
- `'clock'`: formats timestamp as HH:mm, appends km from `payload[0]?.payload?.distance`
- `'elapsed'`: formats as elapsed string, appends km

Example clock output: `"14:30 · 23.4 km"`
Example elapsed output: `"1h 30m · 23.4 km"`

Tooltip value formatters (elevation, temperature) are unchanged.

---

## Files Changed

| File | Change |
|------|--------|
| `src/App.tsx` | Add `xAxisMode` state; add toggle UI in sidebar; pass `xAxisMode` prop to `WeatherTimeline` |
| `src/components/WeatherTimeline.tsx` | Add `time` field + interpolation; add `formatElapsed`; update X axis + tooltip |
