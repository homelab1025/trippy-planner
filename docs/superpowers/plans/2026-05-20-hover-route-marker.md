# Hover Route Marker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 11 weather pin markers on the map with small static dots and a moving bright-orange circle that tracks the user's hover position along the route.

**Architecture:** WeatherTimeline reports the hovered distance in km (not a sample index). App resolves that distance to lat/lng via binary search on `route.points.distance` (meters). MapComponent renders a `CircleMarker` for the hover position and 11 `CircleMarker` dots for the weather sample positions — both from react-leaflet's built-in component.

**Tech Stack:** React 19, TypeScript, react-leaflet v5, recharts, Playwright for E2E tests.

---

## File Map

| File | Change |
|------|--------|
| `tests/app.spec.ts` | Add 3 new E2E tests |
| `src/components/WeatherTimeline.tsx` | Rename `onHoverIndex` → `onHoverDistance`; simplify mouse handler |
| `src/App.tsx` | Replace `hoveredIndex` state with `hoveredPoint`; add `resolveDistanceToPoint`; update props |
| `src/components/MapComponent.tsx` | Remove pins/refs/icon helpers; add `CircleMarker` dots and hover marker |

---

## Task 1: Write failing E2E tests

**Files:**
- Modify: `tests/app.spec.ts`

- [ ] **Step 1: Append three new tests to `tests/app.spec.ts`**

Add after the last existing test:

```typescript
test('no pin markers on map after uploading GPX', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type="file"]', 'public/sample-route.gpx');
  await expect(page.getByText('Sample Ride')).toBeVisible();
  await expect(page.locator('.leaflet-overlay-pane svg path')).toBeVisible();
  // Wait for weather API to respond so markers would appear in the pre-change implementation
  await page.waitForTimeout(3000);
  await expect(page.locator('.leaflet-marker-pane .leaflet-marker-icon')).toHaveCount(0);
});

test('subtle weather dots visible on map after uploading GPX', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type="file"]', 'public/sample-route.gpx');
  await expect(page.getByText('Sample Ride')).toBeVisible();
  await expect(page.locator('.leaflet-overlay-pane svg circle[fill="#888"]')).toHaveCount(11, { timeout: 10000 });
});

test('hover over timeline shows orange marker on map', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type="file"]', 'public/sample-route.gpx');
  await expect(page.getByText('Sample Ride')).toBeVisible();
  await expect(page.locator('.leaflet-overlay-pane svg path')).toBeVisible();
  const timeline = page.locator('.timeline-container');
  await timeline.hover({ position: { x: 200, y: 100 } });
  await expect(page.locator('.leaflet-overlay-pane svg circle[fill="#FF6B00"]')).toBeVisible();
});
```

- [ ] **Step 2: Run the new tests to confirm they all fail**

```bash
npx playwright test tests/app.spec.ts --grep "no pin markers|subtle weather dots|orange marker" -v
```

Expected: all 3 FAIL.
- "no pin markers" fails because 11 `.leaflet-marker-icon` elements are present
- "subtle weather dots" fails because no `circle[fill="#888"]` elements exist
- "hover over timeline" fails because no `circle[fill="#FF6B00"]` element exists

---

## Task 2: Update WeatherTimeline

**Files:**
- Modify: `src/components/WeatherTimeline.tsx`

- [ ] **Step 1: Replace the props interface**

Change:
```typescript
interface WeatherTimelineProps {
  route: RouteData;
  weatherPoints: any[];
  onHoverIndex: (index: number | null) => void;
  xAxisMode: 'clock' | 'elapsed';
}
```
To:
```typescript
interface WeatherTimelineProps {
  route: RouteData;
  weatherPoints: any[];
  onHoverDistance: (distanceKm: number | null) => void;
  xAxisMode: 'clock' | 'elapsed';
}
```

- [ ] **Step 2: Update the component signature**

Change:
```typescript
const WeatherTimeline: React.FC<WeatherTimelineProps> = ({ route, weatherPoints, onHoverIndex, xAxisMode }) => {
```
To:
```typescript
const WeatherTimeline: React.FC<WeatherTimelineProps> = ({ route, weatherPoints, onHoverDistance, xAxisMode }) => {
```

- [ ] **Step 3: Replace the mouse handlers on `ComposedChart`**

Change:
```typescript
onMouseMove={(state) => {
  const rIdx = state.activeTooltipIndex != null ? Number(state.activeTooltipIndex) : NaN;
  if (isNaN(rIdx)) { onHoverIndex(null); return; }
  let nearest: number | null = null;
  let nearestDist = Infinity;
  data.forEach((pt, dsIdx) => {
    if (pt.isSample && pt.weatherIdx != null) {
      const dist = Math.abs(dsIdx - rIdx);
      if (dist < nearestDist) { nearestDist = dist; nearest = pt.weatherIdx; }
    }
  });
  onHoverIndex(nearest);
}}
onMouseLeave={() => onHoverIndex(null)}
```
To:
```typescript
onMouseMove={(state) => {
  const rIdx = state.activeTooltipIndex != null ? Number(state.activeTooltipIndex) : NaN;
  if (isNaN(rIdx) || !data[rIdx]) { onHoverDistance(null); return; }
  onHoverDistance(data[rIdx].distance);
}}
onMouseLeave={() => onHoverDistance(null)}
```

- [ ] **Step 4: Confirm TypeScript finds the expected error in App.tsx**

```bash
npm run build 2>&1 | head -20
```

Expected: error in `App.tsx` — `onHoverIndex` prop does not exist on `WeatherTimeline`. This is expected and will be fixed in Task 3.

---

## Task 3: Update App

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Replace the `hoveredIndex` state with `hoveredPoint`**

Change:
```typescript
const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
```
To:
```typescript
const [hoveredPoint, setHoveredPoint] = useState<{ lat: number; lng: number } | null>(null);
```

- [ ] **Step 2: Add `resolveDistanceToPoint` inside the `App` component**

Add this function after the `updateWeather` useCallback, before the `return` statement:

```typescript
function resolveDistanceToPoint(distanceKm: number): { lat: number; lng: number } {
  const targetM = distanceKm * 1000;
  const points = route!.points;
  let lo = 0, hi = points.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid].distance < targetM) lo = mid + 1;
    else hi = mid;
  }
  return { lat: points[lo].lat, lng: points[lo].lng };
}
```

- [ ] **Step 3: Update the `WeatherTimeline` JSX**

Change:
```tsx
<WeatherTimeline route={route} weatherPoints={weatherPoints} onHoverIndex={setHoveredIndex} xAxisMode={xAxisMode} />
```
To:
```tsx
<WeatherTimeline
  route={route}
  weatherPoints={weatherPoints}
  onHoverDistance={(distanceKm) => {
    if (distanceKm === null || !route) { setHoveredPoint(null); return; }
    setHoveredPoint(resolveDistanceToPoint(distanceKm));
  }}
  xAxisMode={xAxisMode}
/>
```

- [ ] **Step 4: Update the `MapComponent` JSX**

Change:
```tsx
<MapComponent route={route} weatherPoints={weatherPoints} hoveredIndex={hoveredIndex} />
```
To:
```tsx
<MapComponent route={route} weatherPoints={weatherPoints} hoveredPoint={hoveredPoint} />
```

- [ ] **Step 5: Confirm TypeScript finds the expected error in MapComponent.tsx**

```bash
npm run build 2>&1 | head -20
```

Expected: error in `MapComponent.tsx` — `hoveredIndex` prop does not exist. This is expected and will be fixed in Task 4.

---

## Task 4: Update MapComponent

**Files:**
- Modify: `src/components/MapComponent.tsx`

- [ ] **Step 1: Replace the imports**

Change:
```typescript
import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { RouteData } from '../utils/gpxParser';
const pinIcon = (color: string) => L.divIcon({
  className: '',
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="25" height="41" viewBox="0 0 25 41">
    <path d="M12.5 0C5.6 0 0 5.6 0 12.5c0 9.2 12.5 28.5 12.5 28.5S25 21.7 25 12.5C25 5.6 19.4 0 12.5 0z"
      fill="${color}" stroke="rgba(0,0,0,0.3)" stroke-width="1"/>
    <circle cx="12.5" cy="12.5" r="4.5" fill="white" opacity="0.8"/>
  </svg>`,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const DefaultIcon = pinIcon('#2A81CB');
const RedIcon = pinIcon('#e63946');

L.Marker.prototype.options.icon = DefaultIcon;
```
With:
```typescript
import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { RouteData } from '../utils/gpxParser';
```

- [ ] **Step 2: Replace the props interface**

Change:
```typescript
interface MapComponentProps {
  route: RouteData;
  weatherPoints: any[];
  hoveredIndex: number | null;
}
```
To:
```typescript
interface MapComponentProps {
  route: RouteData;
  weatherPoints: any[];
  hoveredPoint: { lat: number; lng: number } | null;
}
```

- [ ] **Step 3: Replace the component body**

Change:
```typescript
const MapComponent: React.FC<MapComponentProps> = ({ route, weatherPoints, hoveredIndex }) => {
  const positions = route.points.map(p => [p.lat, p.lng] as [number, number]);
  const center = positions[0];
  const markerRefs = useRef<(L.Marker | null)[]>([]);

  useEffect(() => {
    markerRefs.current.forEach((marker, idx) => {
      if (marker) marker.setIcon(idx === hoveredIndex ? RedIcon : DefaultIcon);
    });
  }, [hoveredIndex]);

  return (
    <MapContainer 
      center={center} 
      zoom={13} 
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds route={route} />
      <Polyline positions={positions} color="#2d5a27" weight={5} opacity={0.7} />
      
      {weatherPoints.map((wp, idx) => (
        <Marker key={idx} position={[wp.point.lat, wp.point.lng]} ref={(m) => { markerRefs.current[idx] = m; }}>
          <Popup>
            <div style={{ textAlign: 'center' }}>
              <strong>{Math.round(wp.temp)}°C</strong><br />
              {wp.condition}<br />
              <small>Wind: {wp.windSpeed} km/h</small>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
};
```
With:
```typescript
const MapComponent: React.FC<MapComponentProps> = ({ route, weatherPoints, hoveredPoint }) => {
  const positions = route.points.map(p => [p.lat, p.lng] as [number, number]);
  const center = positions[0];

  return (
    <MapContainer
      center={center}
      zoom={13}
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds route={route} />
      <Polyline positions={positions} color="#2d5a27" weight={5} opacity={0.7} />

      {weatherPoints.map((wp, idx) => (
        <CircleMarker
          key={idx}
          center={[wp.point.lat, wp.point.lng]}
          radius={4}
          pathOptions={{ fillColor: '#888', fillOpacity: 0.7, stroke: false }}
        />
      ))}

      {hoveredPoint && (
        <CircleMarker
          center={[hoveredPoint.lat, hoveredPoint.lng]}
          radius={9}
          pathOptions={{ fillColor: '#FF6B00', fillOpacity: 1, stroke: false }}
        />
      )}
    </MapContainer>
  );
};
```

- [ ] **Step 4: Confirm the build is clean**

```bash
npm run build 2>&1 | head -20
```

Expected: no TypeScript errors, build succeeds.

---

## Task 5: Run all tests and commit

**Files:** none

- [ ] **Step 1: Run the full Playwright test suite**

```bash
npx playwright test tests/app.spec.ts -v
```

Expected: all 7 tests pass, including the 3 new ones.

- [ ] **Step 2: Commit**

```bash
git add tests/app.spec.ts src/components/WeatherTimeline.tsx src/App.tsx src/components/MapComponent.tsx
git commit -m "feat: replace weather pins with subtle dots and moving hover marker"
```
