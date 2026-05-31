---
title: Climbs Visual Redesign
date: 2026-05-31
status: approved
---

## Overview

Replace the flat `ReferenceArea` + `ReferenceLine` climb markers in `WeatherTimeline` with a richer visual layer: gradient fills clipped below the elevation profile, highlighted elevation strokes within climb spans, and interactive pill-badge flags at each climb peak.

## Architecture

A new `ClimbOverlay` component renders inside `ComposedChart` as a `<Customized>` element. Recharts injects coordinate data (pixel positions of elevation points, axis scale functions, plot area margins) so the component can paint directly in the chart's SVG without a separate DOM layer.

`ClimbOverlay` paints three layers:
1. **Gradient fills** — category-colored, clipped to below the elevation profile
2. **Highlighted strokes** — category-colored `<polyline>` segments over the elevation line within each climb span
3. **Pill flags** — dashed vertical pole + rounded badge at each climb peak, with a hover popup

The existing `ReferenceArea` and `ReferenceLine` climb renderers in `WeatherTimeline` are removed. `ClimbPeakLabel` is deleted.

## Components

### `src/components/ClimbOverlay.tsx` (new file)

A functional component used as `<Customized component={ClimbOverlay} ... />`. Receives Recharts-injected props plus:

```ts
interface ClimbOverlayProps {
  climbTimeRanges: ClimbTimeRange[];   // climbs with x1/x2 in ms
  hoveredClimbIdx: number | null;
  onHoverClimb: (idx: number | null) => void;
  // Recharts-injected (always present at render):
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  formattedGraphicalItems?: any[];
  xAxisMap?: Record<string, { scale: (v: number) => number }>;
  offset?: { top: number; left: number; width: number; height: number };
}
```

`ClimbTimeRange` must be extracted as a named interface in `WeatherTimeline.tsx` (currently inline in the `useMemo`) so `ClimbOverlay` can import it:

```ts
export interface ClimbTimeRange extends Climb {
  x1: number;  // timestamp ms
  x2: number;
}
```

### `src/components/WeatherTimeline.tsx` (modified)

- Add `useState<number | null>(null)` → `hoveredClimbIdx`
- Replace climb `ReferenceArea` + `ReferenceLine` blocks with a single `<Customized component={ClimbOverlay} ... />`
- Delete `ClimbPeakLabel`

## SVG Rendering Details

### Clip path

From `formattedGraphicalItems[0].props.points` (the elevation Area's rendered pixel coordinates), build a closed polygon:

```
elevation points (left → right) + [bottomRight, bottomLeft]
```

Register as `<clipPath id="climb-elev-clip">` inside a `<defs>` block. All gradient fills reference this clip path, ensuring color never extends above the elevation line. One chart per page — no ID collision risk.

### Gradient fills

For each climb, `xAxisMap['0'].scale(x1)` and `xAxisMap['0'].scale(x2)` give pixel bounds `px1` and `px2`. Recharts uses string keys in `xAxisMap`; the default xAxisId is `'0'`. A vertical `<linearGradient>` (top → bottom) uses the category color with top opacity:

| Category | Top opacity |
|----------|------------|
| Cat 4    | 0.30       |
| Cat 3    | 0.40       |
| Cat 2    | 0.50       |
| Cat 1    | 0.60       |
| HC       | 0.70       |

Bottom stop is always `opacity={0}`. A `<rect x={px1} width={px2-px1} y={offset.top} height={offset.height}/>` with that gradient, `clipPath="url(#climb-elev-clip)"`, produces the fill.

### Highlighted strokes

Filter elevation points to those where `point.payload.time >= x1 && point.payload.time <= x2`. Render as `<polyline points={...} stroke={color} strokeWidth={2.5} fill="none"/>`. The existing green Area stroke remains; the colored polyline paints over it within the climb span.

### Pill flags

At each climb, find the elevation point with `payload.time` closest to `x2` — that gives `(peakPx, peakPy)`.

```
dashed pole:  line from (peakPx, peakPy) to (peakPx, peakPy - 28)
pill badge:   rect at (bx - w/2, peakPy - 44), height=16, rx=8, fill=color
label text:   category string ("Cat 2"), white, bold, 10px, centered in pill
```

Badge horizontal position is double-clamped to avoid clipping. Pixel coordinates from Recharts include the left margin, so the right bound is `offset.left + offset.width`:
```ts
bx = clamp(peakPx, offset.left + badgeWidth/2 + 2, offset.left + offset.width - badgeWidth/2 - 2)
```

The pole always stays at `peakPx`; only the badge shifts.

### Hover popup

The pill badge `<g>` element gets `onMouseEnter={() => onHoverClimb(i)}` and `onMouseLeave={() => onHoverClimb(null)}`. When `hoveredClimbIdx === i`, render a tooltip box:

```
<rect> with drop shadow, rx=5, white fill
<text> line 1: "{lengthKm} km · {avgGrade}%"
```

Positioned to the right of the badge, clamped so it never clips past the right edge of the plot area. Rendered last in the SVG so it sits above all other elements.

## Colors

Unchanged from current implementation:

| Category | Color     |
|----------|-----------|
| Cat 4    | `#F5C518` |
| Cat 3    | `#F5A623` |
| Cat 2    | `#E8601C` |
| Cat 1    | `#D0021B` |
| HC       | `#7B0099` |

## Data Flow

`climbTimeRanges` (already computed in `WeatherTimeline` via `useMemo`) is passed directly to `ClimbOverlay`. No new props to `WeatherTimeline` or `App.tsx` are required.

## Edge Cases

- **No climbs:** `climbTimeRanges` is empty — `ClimbOverlay` renders nothing, chart is unchanged.
- **Elevation points not yet available:** Guard on `formattedGraphicalItems` being non-empty before rendering any SVG.
- **Closely-spaced climbs:** Badge overlap is an accepted visual limitation; no collision handling in v1.
- **Badge near chart edges:** Double-clamp on `bx` prevents horizontal clip.
- **Popup near right edge:** Popup flips to left of badge when `peakPx + popupWidth > offset.width`.

## Testing

`climbDetector.ts` is unchanged — existing 22 unit tests cover all detection logic.

No unit tests for `ClimbOverlay` — Recharts internals are not amenable to unit testing and the value is visual. The existing Playwright E2E test baseline covers regression detection once the redesign is in place.
