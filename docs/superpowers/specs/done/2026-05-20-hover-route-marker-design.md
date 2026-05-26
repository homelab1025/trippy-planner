# Hover Route Marker

**Date:** 2026-05-20  
**Status:** Approved

## Overview

Replace the existing weather pin markers on the map with a moving orange circle that tracks the user's hover position across the weather timeline. Static subtle dots mark the 11 weather sample positions permanently.

## Requirements

- Remove the 11 teardrop weather pin markers from the map
- Show small subtle dots at the 11 weather sample positions (always visible, no interaction)
- Show a plain bright-orange filled circle that moves along the route as the user hovers the timeline
- When the user is not hovering, no hover marker is shown

## Data Flow

```
WeatherTimeline onMouseMove
  → onHoverDistance(distanceKm: number | null)
  → App resolves distanceKm to {lat, lng} via binary search on route.points
  → MapComponent receives hoveredPoint: {lat, lng} | null
  → renders CircleMarker at hoveredPoint
```

The signal between components changes shape:

| Before | After |
|--------|-------|
| `hoveredIndex: number \| null` (index into `weatherPoints[]`) | `hoveredPoint: {lat: number, lng: number} \| null` |

## Component Changes

### WeatherTimeline

- Prop rename: `onHoverIndex` → `onHoverDistance`, typed `(distanceKm: number | null) => void`
- `onMouseMove` handler: replace the nearest-sample scan loop with a single read of `data[state.activeTooltipIndex].distance`, pass it to `onHoverDistance`
- `onMouseLeave`: call `onHoverDistance(null)`
- No other changes — tooltip, axes, chart data all unchanged

### App

- State: `hoveredIndex: number | null` → `hoveredPoint: {lat: number, lng: number} | null`
- New helper `resolveDistanceToPoint(distanceKm: number, route: RouteData): {lat, lng}`:
  - Binary-searches `route.points` on the `distance` field (stored in meters)
  - Returns the nearest GPS point
  - Called inline in the `onHoverDistance` handler; no memoization needed (O(log n))
- Prop updates: pass `hoveredPoint` to `MapComponent`; pass `onHoverDistance` to `WeatherTimeline`

### MapComponent

**Remove:**
- `pinIcon` helper, `DefaultIcon`, `RedIcon`
- All 11 `<Marker>` + `<Popup>` components
- `markerRefs` ref array
- `useEffect` that swapped icons on hover
- `hoveredIndex: number | null` prop

**Add:**
- Prop: `hoveredPoint: {lat: number, lng: number} | null`
- 11 subtle dots (always rendered):
  ```
  <CircleMarker radius={4} fillColor="#888" fillOpacity={0.7} stroke={false} />
  ```
- 1 hover tracker (rendered only when `hoveredPoint !== null`):
  ```
  <CircleMarker radius={9} fillColor="#FF6B00" fillOpacity={1} stroke={false} />
  ```
- Both use `react-leaflet`'s `CircleMarker` — no new dependencies

## Out of Scope

- Popups or labels on the hover marker
- Animation or pulsing on the hover marker
- Changes to the timeline chart appearance
