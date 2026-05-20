# Waypoint Pins Design

**Date:** 2026-05-20
**Status:** Approved

## Problem

The app models the entire ride at a constant average speed. Users who know they'll be faster on descents or slower on climbs — or who have checkpoint time targets — have no way to express that. The result is inaccurate arrival times at weather sample points, especially over long or varied routes.

## Goal

Let the user click the timeline to pin a time estimate to any point along the route. Pins divide the route into segments, each with its own implied speed. Weather sample point arrival times are recomputed from the piecewise model and trigger fresh weather fetches.

## Scope

Three files change: `src/utils/timingModel.ts` (new), `src/App.tsx`, `src/components/WeatherTimeline.tsx`. No changes to `weatherService.ts`, `gpxParser.ts`, or `MapComponent.tsx`. No new CSS files.

---

## Design

### Data Model

```ts
interface Pin {
  distance: number; // meters — matches route point distances from GPX parser
  time: Date;
}
```

Pins are keyed by route distance in meters, not by array index, because LTTB downsampling makes indices unstable. When the user clicks the timeline, recharts provides `activeTooltipIndex` into the downsampled data array; the clicked point's `distance` field (already in km in the chart data, converted back to meters) is used directly as the pin's distance key.

### Timing Model — `src/utils/timingModel.ts`

A new pure utility with one exported function:

```ts
export function computeArrivalTime(
  distance: number,   // meters
  startTime: Date,
  avgSpeedKmh: number,
  pins: Pin[]
): Date
```

The algorithm treats `{ distance: 0, time: startTime }` as an implicit anchor. Together with sorted user pins, these form an ordered sequence of anchors. For any query distance:

- **Between two anchors**: linearly interpolate between their timestamps. This implicitly derives the per-segment speed without storing it explicitly.
- **Past the last anchor**: apply `avgSpeedKmh` forward from the last anchor's time and position.

A single pin splits the route into two segments: `[start → pin]` with user-defined pacing, and `[pin → end]` using `avgSpeed`. Two pins give three segments, and so on. If the user pins the finish, `avgSpeed` is never applied to the tail.

### App.tsx Changes

**New state:**

```ts
const [pins, setPins] = useState<Pin[]>([]);
const [selectedPinDistance, setSelectedPinDistance] = useState<number | null>(null);
```

**`updateWeather` update:**

Replace the inline constant-speed formula:
```ts
// before
const travelTimeHours = distance / (speed * 1000);
const arrivalTime = new Date(start.getTime() + travelTimeHours * 3600 * 1000);
```
with:
```ts
// after
const arrivalTime = computeArrivalTime(distance, start, speed, pins);
```

Add `pins` to `updateWeather`'s signature and `useEffect` dependency array. No other changes to the weather-fetching logic — re-fetches happen automatically via the existing `useEffect`.

**Timeline click handler:**

```ts
const handleTimelineClick = (distance: number) => {
  const existing = pins.find(p => p.distance === distance);
  if (existing) {
    setSelectedPinDistance(distance);
    return;
  }
  const initialTime = computeArrivalTime(distance, startTime, avgSpeed, pins);
  setPins(prev => [...prev, { distance, time: initialTime }]);
  setSelectedPinDistance(distance);
};
```

Clicking an already-pinned point selects it rather than duplicating it. The initial time is computed from the current model so the user sees a meaningful starting value.

**Pin edit/delete handlers:**

```ts
const handlePinTimeChange = (distance: number, newTime: Date) => {
  setPins(prev => prev.map(p => p.distance === distance ? { ...p, time: newTime } : p));
};

const handlePinDelete = (distance: number) => {
  setPins(prev => prev.filter(p => p.distance !== distance));
  if (selectedPinDistance === distance) setSelectedPinDistance(null);
};
```

### Sidebar UI

A new `glass-panel` card titled **"Waypoint Pins"** appears in the sidebar below "Ride Details", only when a route is loaded.

**Empty state:** `"Click the timeline to pin a waypoint time."`

**Pin list:** Pins sorted by distance ascending. Each row:

```
km 34.5    [time input]    [×]
```

- **Distance label**: `km {(pin.distance / 1000).toFixed(1)}` — read-only
- **Time input**: branches on `xAxisMode`:
  - `clock` mode: `<input type="time">` bound to the pin's wall-clock time
  - `elapsed` mode: text input showing `"Xh YYm"` elapsed from `startTime`; parsed back to absolute `Date` on change
- **Delete button**: `×`, calls `handlePinDelete`

The row matching `selectedPinDistance` gets a left border accent using `#2d5a27`. Clicking any row sets `selectedPinDistance`. No new CSS classes or variables needed.

### Timeline Visualization

**New props on `WeatherTimeline`:**

```ts
pins: Pin[];
selectedPinDistance: number | null;
onPointClick: (distance: number) => void;
```

**Click handling:** `ComposedChart` `onClick` fires `onPointClick` with the clicked data point's distance (converted from km back to meters).

**Pin markers:** A synthetic `pinTime` field is added to the chart data array — set to the pin's timestamp (ms) for points whose distance matches a pin, otherwise `undefined`. A second `Line` series renders with `dataKey="pinTime"`, `connectNulls={false}`, and a custom dot:

- Shape: diamond (rotated square) — visually distinct from the orange weather dots
- Color: `#2d5a27`
- Selected pin: larger radius + white stroke ring

No connecting line is drawn between pin markers (gaps in data ensure this).

---

## Files Changed

| File | Change |
|------|--------|
| `src/utils/timingModel.ts` | New — `Pin` type + `computeArrivalTime` |
| `src/App.tsx` | `pins` + `selectedPinDistance` state; updated `updateWeather`; click/edit/delete handlers; sidebar pins panel; new props to `WeatherTimeline` |
| `src/components/WeatherTimeline.tsx` | `pins`, `selectedPinDistance`, `onPointClick` props; click handler on chart; pin marker overlay series |
