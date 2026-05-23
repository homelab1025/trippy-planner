# DP Max-Gap Constraint Design

**Date:** 2026-05-23
**Branch:** feat/douglas-peucker-decimation

## Problem

The Douglas-Peucker algorithm collapses long straight-line segments to two points (start and end). On a GPS track with a straight road section, all intermediate points fall within `epsilon` of the AB line and are dropped. The surviving point set — shared by the map polyline, the LTTB elevation chart, and weather sampling — then has large distance gaps in those sections. This causes two visible symptoms:

1. **Sudden elevation jumps** in the weather timeline: LTTB has no intermediate elevation points to work with between the two endpoints of the collapsed segment.
2. **Hover cursor skipping**: the timeline's x-axis has no data points across the gap, so hovering skips large distance ranges.

## Solution

Add a `fillGaps` post-processing step after RDP that enforces a maximum distance between consecutive kept points. Both `epsilon` and `maxGap` become configurable parameters, consistent with the in-progress configurable-epsilon plan.

## Architecture

### New export: `fillGaps` in `douglasPeucker.ts`

```typescript
export const DP_MAX_GAP_METERS = 500;

export function fillGaps(
  original: RoutePoint[],
  simplified: RoutePoint[],
  maxGapMeters: number
): RoutePoint[]
```

**Algorithm:**
1. Build `Map<RoutePoint, number>` (object reference → index in `original`) in one O(n) pass.
2. Walk consecutive pairs in `simplified`. For each pair `[a, b]` where `b.distance - a.distance > maxGapMeters`:
   - `numInserts = ceil(gap / maxGapMeters) - 1`
   - Clamp `numInserts` to the number of available original points between a and b.
   - For each insert k (1…numInserts), binary-search the original array for the point closest to `a.distance + k * (gap / (numInserts + 1))`.
3. Return the merged array in distance order (simplified points + inserted originals, interleaved correctly by construction).

**Edge cases:**
- `maxGapMeters <= 0`: return `simplified` unchanged.
- `simplified.length < 2`: return `simplified` unchanged.
- Fewer original points between a pair than `numInserts`: insert as many as are available (no duplicates).

### `parseGPX` chains both

```typescript
export const parseGPX = (xmlText: string, epsilon: number, maxGapMeters: number): RouteData => {
  // ...
  const simplified = douglasPeucker(points, epsilon);
  const decimated  = fillGaps(points, simplified, maxGapMeters);
  // ...
};
```

### Parameter chain (mirrors epsilon plan exactly)

```
App.tsx: dpMaxGap state (default: DP_MAX_GAP_METERS)
  → parseGPXAsync(xml, epsilon, maxGap)
  → worker postMessage: { xml, epsilon, maxGap }
  → gpxWorker.ts: parseGPX(e.data.xml, e.data.epsilon, e.data.maxGap)
```

### Tech Details panel (App.tsx)

Two inputs, always visible, both disabled after a route is loaded:

| Label | State | Default | Input attrs |
|---|---|---|---|
| DP Epsilon | `dpEpsilon` | 5 | `min="1" step="1"` |
| Max Gap | `dpMaxGap` | 500 | `min="1" step="10"` |

## Files Changed

| File | Change |
|---|---|
| `src/utils/douglasPeucker.ts` | Add `DP_MAX_GAP_METERS` constant + `fillGaps` export |
| `src/utils/douglasPeucker.test.ts` | Add `fillGaps` unit tests |
| `src/utils/gpxParser.ts` | Add `maxGapMeters` param; chain `fillGaps` after `douglasPeucker` |
| `src/utils/gpxParser.test.ts` | Pass `DP_MAX_GAP_METERS` to all `parseGPX` calls; add straight-line gap test |
| `src/workers/gpxWorker.ts` | Destructure `maxGap` from message; forward to `parseGPX` |
| `src/workers/gpxWorkerClient.ts` | Add `maxGap` to `parseGPXAsync` signature and `postMessage` payload |
| `src/workers/gpxWorkerClient.test.ts` | Update message-format test to include `maxGap` |
| `src/App.tsx` | Add `dpMaxGap` state; pass to `parseGPXAsync`; add Max Gap input to Tech Details panel |

## Key Tests

**`fillGaps` unit tests (`douglasPeucker.test.ts`):**
- 5 collinear points spanning 1000 km, maxGap 500 km → simplified has 2 points (DP keeps endpoints only), fillGaps inserts 1 intermediate → result has 3 points
- Gap exactly equal to maxGap → no insertion
- Gap slightly over maxGap → one insertion
- `maxGapMeters <= 0` → returns simplified unchanged
- No gap exceeds maxGap → returns simplified unchanged (reference equality or same contents)

**`gpxParser.test.ts`:**
- All existing `parseGPX` calls gain a third argument. Existing tests that are not testing gap-filling pass `Infinity` as `maxGapMeters` to keep current behaviour (this is especially important for the MERIDIAN test: its ~111 km route with `DP_MAX_GAP_METERS = 500 m` would insert ~221 points and break the `length < originalPointCount` assertion).
- New test: straight-meridian with `maxGapMeters` set to half the total distance → result has more than 2 points (gap-filling fired).

## Dependency

This spec assumes the configurable-epsilon plan (`2026-05-23-configurable-dp-epsilon.md`) is implemented in the same branch. The two sets of changes are additive and do not conflict.

## Verification

1. `npx vitest run` — all tests pass (currently 41; new fillGaps tests add to this count)
2. `npm run build` — no new type errors
3. Manual: load a GPX with a long straight road section. Before: timeline shows a cliff or flat gap. After: elevation profile is continuous across that section with no skipping.
4. Manual: hover across the timeline over a previously-gapped section — cursor moves continuously without jumping.
