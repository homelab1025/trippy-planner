# Douglas-Peucker Polyline Decimation — Design Spec

**Date:** 2026-05-23
**Status:** Approved

## Problem

`<Polyline>` in `MapComponent.tsx` receives every raw route point without thinning. Large GPX files (50k+ points, common on long rides) may make Leaflet slow. `WeatherTimeline.tsx` also builds its chart data from the full point array before LTTB downsampling.

## Goal

Decimate the route's point set once at parse time using Douglas-Peucker, then use the decimated set everywhere. Keep only the raw point count (not the full raw array) for display purposes.

---

## Data Model

`RouteData` in `src/utils/gpxParser.ts` gains one field and changes the meaning of `points`:

```typescript
export interface RouteData {
  points: RoutePoint[];         // DP-decimated — used for polyline, LTTB, weather sampling
  originalPointCount: number;   // raw count before decimation, for Tech Details panel only
  totalDistance: number;
  totalElevationGain: number;
  name: string;
}
```

`points` was previously the full raw set. It is now the DP-decimated subset. This is transparent to all consumers — they continue reading `route.points` unchanged.

`originalPointCount` is the only memory held from the pre-decimation array. The full raw array is discarded after DP runs inside the parser.

---

## New Utility: `src/utils/douglasPeucker.ts`

```typescript
export const DP_EPSILON_METERS = 5;

export function douglasPeucker(points: RoutePoint[], epsilon: number): RoutePoint[]
```

### Perpendicular distance

Distance from point P to segment AB is computed as the **cross-track distance** in meters:

```
d_xt = asin( sin(d_AP / R) × sin(θ_AP − θ_AB) ) × R
```

where `d_AP` is the haversine distance A→P (meters), `θ_AB` and `θ_AP` are the haversine bearings A→B and A→P, and R = 6 371 000 m.

If the foot of the perpendicular falls outside the AB segment, the distance falls back to `min(d_AP, d_BP)` — identical to the standard Euclidean DP fallback, computed in meters.

### Properties

- Recursive implementation.
- Returns a strict subset of the input array (same object references, no copies).
- Always includes the first and last point.

### Epsilon choice

`DP_EPSILON_METERS = 5`. At 5 m a 50k-point 100 km ride typically yields 500–2 000 map points (~97% reduction) while preserving every meaningful bend. The constant is exported so `App.tsx` can display it in the Tech Details panel without a magic number.

---

## `gpxParser.ts` Changes

After the point-building loop, before returning:

```typescript
const originalPointCount = points.length;
const decimated = douglasPeucker(points, DP_EPSILON_METERS);
return { points: decimated, originalPointCount, totalDistance, totalElevationGain, name };
```

`gpxWorker.ts` requires no changes — it calls `parseGPX` and posts the result; `originalPointCount` travels through the worker message automatically via structured clone.

---

## Consumer Changes

### `MapComponent.tsx`
No changes. `positions` useMemo already reads `route.points`; it now receives the decimated set.

### `WeatherTimeline.tsx`
No changes. `route.points.map(...)` and `route.points.indexOf(wp.point)` continue to work because all three sides — the `data` array, weather sampling, and `wp.point` references — come from the same `route.points` array. The `indexOf` reference-equality lookup is unaffected.

### `App.tsx` — weather sampling
No changes to the sampling logic. `currentRoute.points.find(...)` already reads `route.points`; it now samples from the decimated set.

### `App.tsx` — sidebar UI

**Route stats panel:** remove the "Track Points" stat item.

**New "Tech Details" panel** (shown when a route is loaded, below the stats panel):

| Label | Value |
|---|---|
| DP Epsilon | `{DP_EPSILON_METERS} m` |
| Original Points | `{route.originalPointCount.toLocaleString()}` |
| Map Points | `{route.points.length.toLocaleString()}` |

`DP_EPSILON_METERS` is imported from `douglasPeucker.ts` — no magic numbers in JSX.

---

## Testing

### `src/utils/douglasPeucker.test.ts` (new)

- **Collinear points:** all intermediate points removed (perpendicular distance = 0).
- **Single point / two points:** returned unchanged.
- **Epsilon boundary:** a known bend where the perpendicular distance is just above and just below epsilon — verifies the threshold is respected.
- **Subset guarantee:** every returned point is reference-equal to an element of the input array.

### `src/utils/gpxParser.test.ts` (update)

- Assert `originalPointCount` equals the raw input point count.
- Assert `points.length < originalPointCount` for a multi-point fixture.
- Assert every element of `points` appears in the original parsed set (by distance value, since object references don't survive structured clone in tests that simulate round-trips).

---

## Out of Scope

- **Avoid full-array allocation in WeatherTimeline before LTTB.** LTTB now starts from the decimated `route.points` rather than the original 50k array, which already reduces allocation cost significantly. Further optimisation (e.g. streaming LTTB) is a possible future improvement.

---

## Possible Future Improvements

- **Tune `DP_EPSILON_METERS` per zoom level.** Render coarser at low zoom, finer at high zoom. Not needed until performance profiling shows a bottleneck.
