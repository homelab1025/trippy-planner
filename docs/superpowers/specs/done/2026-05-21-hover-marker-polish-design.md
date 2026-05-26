# Hover Marker Polish Design

**Date:** 2026-05-21

## Summary

Replace the single solid orange `CircleMarker` used for the timeline hover position with two stacked `CircleMarker`s: a large low-opacity glow ring behind a smaller white-bordered core dot.

## Change

**File:** `src/components/MapComponent.tsx` only.

**Before:**
```jsx
{hoveredPoint && (
  <CircleMarker
    center={[hoveredPoint.lat, hoveredPoint.lng]}
    radius={9}
    pathOptions={{ fillColor: '#FF6B00', fillOpacity: 1, stroke: false }}
  />
)}
```

**After:**
```jsx
{hoveredPoint && (<>
  <CircleMarker
    center={[hoveredPoint.lat, hoveredPoint.lng]}
    radius={24}
    pathOptions={{ fillColor: '#FF6B00', fillOpacity: 0.12, stroke: false }}
  />
  <CircleMarker
    center={[hoveredPoint.lat, hoveredPoint.lng]}
    radius={10}
    pathOptions={{ fillColor: '#FF6B00', fillOpacity: 1, stroke: true, color: 'white', weight: 2.5 }}
  />
</>)}
```

## Visual effect

- Soft radial glow (large translucent circle) provides spatial context.
- Crisp white-bordered core dot sits on top, readable against any map tile.
- No animation — completely static.

## Constraints

- No new dependencies.
- The existing Playwright test (`path[fill="#FF6B00"]`) continues to pass — both circles carry that fill.
- No changes to `WeatherTimeline.tsx`, `App.tsx`, or any other file.
