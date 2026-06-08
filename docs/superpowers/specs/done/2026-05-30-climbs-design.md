---
title: Climbs in Weather Timeline
date: 2026-05-30
status: approved
---

## Overview

Detect climbs along the route using the Strava climb scoring formula and display them in the `WeatherTimeline` chart as colored elevation segments with peak labels.

## Climb Categorization

Source: [Strava Climb Categorization](https://support.strava.com/hc/en-us/articles/216917057-Climb-Categorization)

**Score formula:** `length_meters × avg_grade_percent`

| Score threshold | Category |
|----------------|----------|
| > 80,000 | HC (Hors Catégorie) |
| > 64,000 | Cat 1 |
| > 32,000 | Cat 2 |
| > 16,000 | Cat 3 |
| > 8,000 | Cat 4 |
| ≤ 8,000 | Not a climb |

## Detection Algorithm

**Location:** `src/utils/climbDetector.ts`

**Input:** `RoutePoint[]` (DP-simplified points, each with `ele` and `distance` in meters)

**Output:**
```ts
interface Climb {
  startDistance: number;  // meters from route start
  endDistance: number;
  elevationGain: number;  // meters (net gain, start to end)
  lengthM: number;
  avgGrade: number;       // percent
  score: number;          // lengthM × avgGrade
  category: 'Cat4' | 'Cat3' | 'Cat2' | 'Cat1' | 'HC';
}
```

**Steps:**

1. Compute point-to-point grade: `(ele[i+1] - ele[i]) / (dist[i+1] - dist[i]) * 100`
2. Build ascending runs: contiguous spans where grade > `MIN_GRADE_PCT` (1%)
3. Merge runs in a single left-to-right pass: when the gap between the current run's end and the next run's start has **net descent < `MAX_GAP_DESCENT_M` (30m) AND gap distance < `MAX_GAP_DISTANCE_M` (500m)**, extend the current run to absorb the next. This handles chains (A→B→C) naturally.
4. For each merged candidate: `lengthM = end.distance - start.distance`, `elevationGain = end.ele - start.ele` (net), `avgGrade = elevationGain / lengthM * 100`, `score = lengthM × avgGrade`. Discard if score ≤ `MIN_SCORE` (8000).
5. Assign category from the table above

**Named constants (not magic numbers):**
```ts
const MIN_GRADE_PCT = 1;
const MAX_GAP_DESCENT_M = 30;
const MAX_GAP_DISTANCE_M = 500;
const MIN_SCORE = 8000;
```

## Data Flow

- `climbDetector` is called in `App.tsx` via `useMemo` keyed on `route.points` — climbs are independent of weather and should not recompute on weather changes.
- `climbs` is passed to `WeatherTimeline` as a new optional prop: `climbs?: Climb[]`.
- Time-axis conversion (chart X values are milliseconds) happens inside `WeatherTimeline`, using the same formula as existing chart data:
  ```
  timeMs = startTime.getTime() + (distanceM / (avgSpeed * 1000)) * 3_600_000
  ```

## Display

The existing green elevation fill is preserved. Climb spans render on top of it using Recharts primitives inside `ComposedChart`.

**Colored segments:** one `ReferenceArea` per climb with `x1`/`x2` set to the climb's start/end time in ms, `yAxisId="elevation"`, semi-transparent fill.

| Category | Color |
|----------|-------|
| Cat 4 | `#F5C518` (yellow) |
| Cat 3 | `#F5A623` (amber) |
| Cat 2 | `#E8601C` (orange-red) |
| Cat 1 | `#D0021B` (red) |
| HC | `#7B0099` (purple) |

**Peak labels:** one `ReferenceLine` per climb at `x = endTimeMs`, `yAxisId="elevation"`, with a custom label component rendering a badge above the elevation line:

```
HC  ↑ 1240m  8.2%  15.3km
```

The badge anchors to the top of the chart area and does not overlap the temperature/precipitation lines.

## Edge Cases

- **No climbs detected:** empty arrays — no `ReferenceArea`/`ReferenceLine` rendered, chart unchanged.
- **Overlapping climbs:** impossible by construction — each point belongs to at most one merged ascending run.
- **Flat routes:** no ascending runs found, empty result.
- **Below-threshold hills:** discarded at step 4, not rendered.
- **Badge overlap on closely-spaced climbs:** accepted visual limitation in v1; no collision handling.

## Testing

Unit tests in `src/utils/climbDetector.test.ts` (Vitest):

| Test | What it verifies |
|------|-----------------|
| Single clean climb | Monotonically rising points → correct category |
| Gap merging | Two runs separated by dip < 30m / < 500m → merged into one climb |
| Gap not merged | Dip > 30m descent → two separate climbs (or none) |
| Score boundary values | Inputs at exactly 8000, 16000, 32000, 64000, 80000 → correct category boundaries |
| Below threshold | Short shallow hill → empty array |
| Flat route | All same elevation → empty array |
| Multiple climbs | Three qualifying climbs → all three returned in distance order |

No E2E tests needed — climb rendering is pure derived display from `route.points`.
