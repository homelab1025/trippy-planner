# Douglas-Peucker Polyline Decimation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decimate route points at parse time using Douglas-Peucker, replacing the full raw point set with a simplified set everywhere in the app, and surface compression metrics in a new "Tech Details" sidebar panel.

**Architecture:** A new `douglasPeucker.ts` utility owns the algorithm and exports `DP_EPSILON_METERS`; `gpxParser.ts` calls it after building the point array and adds `originalPointCount` to `RouteData`; all consumers (`MapComponent`, `WeatherTimeline`, weather sampling in `App.tsx`) automatically receive the decimated set because the field name stays `points` — no consumer changes are needed except the UI panel.

**Tech Stack:** TypeScript, React, Vitest (unit tests), Vite

---

## File map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/utils/douglasPeucker.ts` | DP algorithm + `DP_EPSILON_METERS` constant |
| Create | `src/utils/douglasPeucker.test.ts` | Unit tests for DP |
| Modify | `src/utils/gpxParser.ts` | Add `originalPointCount` to `RouteData`; call DP after parsing |
| Modify | `src/utils/gpxParser.test.ts` | Assert `originalPointCount`; add collinear-points fixture |
| Modify | `src/App.tsx` | Remove Track Points from stats; add Tech Details panel |

---

### Task 1: douglasPeucker utility

**Files:**
- Create: `src/utils/douglasPeucker.test.ts`
- Create: `src/utils/douglasPeucker.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/utils/douglasPeucker.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { douglasPeucker, DP_EPSILON_METERS } from './douglasPeucker';
import type { RoutePoint } from './gpxParser';

function pt(lat: number, lng: number): RoutePoint {
  return { lat, lng, ele: 0, distance: 0 };
}

describe('DP_EPSILON_METERS', () => {
  it('is 5', () => {
    expect(DP_EPSILON_METERS).toBe(5);
  });
});

describe('douglasPeucker', () => {
  it('returns empty array for empty input', () => {
    expect(douglasPeucker([], 5)).toEqual([]);
  });

  it('returns single point unchanged', () => {
    const p = pt(0, 0);
    const result = douglasPeucker([p], 5);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(p);
  });

  it('returns two points unchanged', () => {
    const a = pt(0, 0);
    const b = pt(1, 1);
    const result = douglasPeucker([a, b], 5);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe(a);
    expect(result[1]).toBe(b);
  });

  it('removes collinear intermediate points on a meridian', () => {
    // Points on the same meridian (lng=10) lie on a great circle — cross-track distance is 0
    const a = pt(0, 10);
    const mid1 = pt(0.25, 10);
    const mid2 = pt(0.5, 10);
    const mid3 = pt(0.75, 10);
    const b = pt(1, 10);
    const result = douglasPeucker([a, mid1, mid2, mid3, b], 5);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe(a);
    expect(result[1]).toBe(b);
  });

  it('keeps a point whose cross-track distance exceeds epsilon', () => {
    // pt(0.001, 0.5) is ~111 m north of the equatorial segment A→B
    const a = pt(0, 0);
    const p = pt(0.001, 0.5);
    const b = pt(0, 1);
    const result = douglasPeucker([a, p, b], 50); // 111 m > 50 m → kept
    expect(result).toHaveLength(3);
    expect(result).toContain(p);
  });

  it('removes a point whose cross-track distance is below epsilon', () => {
    // Same geometry — different epsilon
    const a = pt(0, 0);
    const p = pt(0.001, 0.5); // ~111 m cross-track
    const b = pt(0, 1);
    const result = douglasPeucker([a, p, b], 200); // 111 m < 200 m → removed
    expect(result).toHaveLength(2);
    expect(result).not.toContain(p);
  });

  it('always preserves first and last points regardless of epsilon', () => {
    const points = [pt(0, 0), pt(0, 0.5), pt(0, 1)];
    const result = douglasPeucker(points, 1_000_000);
    expect(result[0]).toBe(points[0]);
    expect(result[result.length - 1]).toBe(points[points.length - 1]);
  });

  it('returns same object references as the input array — no copies', () => {
    const points = [pt(0, 0), pt(0.001, 0.5), pt(0, 1)];
    const result = douglasPeucker(points, 50);
    for (const p of result) {
      expect(points).toContain(p);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/utils/douglasPeucker.test.ts
```

Expected: FAIL — `Cannot find module './douglasPeucker'`

- [ ] **Step 3: Implement `src/utils/douglasPeucker.ts`**

```typescript
import type { RoutePoint } from './gpxParser';

export const DP_EPSILON_METERS = 5;

const R = 6_371_000;

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function haversineBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = Math.PI / 180;
  const dLng = (lng2 - lng1) * rad;
  const y = Math.sin(dLng) * Math.cos(lat2 * rad);
  const x =
    Math.cos(lat1 * rad) * Math.sin(lat2 * rad) -
    Math.sin(lat1 * rad) * Math.cos(lat2 * rad) * Math.cos(dLng);
  return Math.atan2(y, x);
}

function perpDistanceMeters(p: RoutePoint, a: RoutePoint, b: RoutePoint): number {
  const dAB = haversineMeters(a.lat, a.lng, b.lat, b.lng);
  if (dAB === 0) return haversineMeters(a.lat, a.lng, p.lat, p.lng);

  const dAP = haversineMeters(a.lat, a.lng, p.lat, p.lng);
  const thetaAP = haversineBearing(a.lat, a.lng, p.lat, p.lng);
  const thetaAB = haversineBearing(a.lat, a.lng, b.lat, b.lng);

  const sinXT = Math.sin(dAP / R) * Math.sin(thetaAP - thetaAB);
  const dXT = Math.asin(Math.max(-1, Math.min(1, sinXT))) * R;

  const cosXT = Math.cos(dXT / R);
  const dAT =
    cosXT === 0
      ? 0
      : Math.acos(Math.max(-1, Math.min(1, Math.cos(dAP / R) / cosXT))) * R;

  if (dAT > dAB) {
    const dBP = haversineMeters(b.lat, b.lng, p.lat, p.lng);
    return Math.min(dAP, dBP);
  }

  return Math.abs(dXT);
}

function simplify(
  points: RoutePoint[],
  start: number,
  end: number,
  epsilon: number,
  keep: boolean[]
): void {
  if (end - start <= 1) return;

  let maxDist = 0;
  let maxIdx = start + 1;
  for (let i = start + 1; i < end; i++) {
    const d = perpDistanceMeters(points[i], points[start], points[end]);
    if (d > maxDist) {
      maxDist = d;
      maxIdx = i;
    }
  }

  if (maxDist > epsilon) {
    keep[maxIdx] = true;
    simplify(points, start, maxIdx, epsilon, keep);
    simplify(points, maxIdx, end, epsilon, keep);
  }
}

export function douglasPeucker(points: RoutePoint[], epsilon: number): RoutePoint[] {
  if (points.length === 0) return [];

  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;

  simplify(points, 0, points.length - 1, epsilon, keep);

  return points.filter((_, i) => keep[i]);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/utils/douglasPeucker.test.ts
```

Expected: All 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/utils/douglasPeucker.ts src/utils/douglasPeucker.test.ts
git commit -m "feat: add douglasPeucker utility with haversine cross-track distance"
```

---

### Task 2: Update `RouteData` and `gpxParser`

**Files:**
- Modify: `src/utils/gpxParser.ts`
- Modify: `src/utils/gpxParser.test.ts`

- [ ] **Step 1: Add `originalPointCount` to the `RouteData` interface**

In `src/utils/gpxParser.ts`, update the `RouteData` interface (lines 11–16):

```typescript
export interface RouteData {
  points: RoutePoint[];
  originalPointCount: number;
  totalDistance: number;
  totalElevationGain: number;
  name: string;
}
```

- [ ] **Step 2: Write the failing parser tests**

In `src/utils/gpxParser.test.ts`:

Update the first test to assert `originalPointCount`:
```typescript
it('returns correct name, point count, and elevation gain for a valid GPX', () => {
  const result = parseGPX(VALID);
  expect(result.name).toBe('Test Route');
  expect(result.points).toHaveLength(5);
  expect(result.originalPointCount).toBe(5);
  expect(result.totalElevationGain).toBeCloseTo(12, 0);
});
```

Add a new test at the end of the `describe('parseGPX')` block (before the final `}`):
```typescript
it('records original point count and decimates collinear points on a meridian', () => {
  const MERIDIAN = gpx('Meridian', [
    pt(0, 10, 0),
    pt(0.25, 10, 0),
    pt(0.5, 10, 0),
    pt(0.75, 10, 0),
    pt(1, 10, 0),
  ].join('\n'));
  const result = parseGPX(MERIDIAN);
  expect(result.originalPointCount).toBe(5);
  expect(result.points.length).toBeLessThan(result.originalPointCount);
  expect(result.points[0].lat).toBeCloseTo(0, 5);
  expect(result.points[result.points.length - 1].lat).toBeCloseTo(1, 5);
});
```

- [ ] **Step 3: Run tests to verify the new tests fail**

```bash
npx vitest run src/utils/gpxParser.test.ts
```

Expected: FAIL — TypeScript error: `originalPointCount` is missing from the object returned by `parseGPX`.

- [ ] **Step 4: Update `parseGPX` to call DP and return `originalPointCount`**

In `src/utils/gpxParser.ts`:

Add the import after the existing `XMLParser` import:
```typescript
import { douglasPeucker, DP_EPSILON_METERS } from './douglasPeucker';
```

Replace the final `return` block (currently lines 75–81) with:
```typescript
  const totalDistance = points[points.length - 1].distance;
  const originalPointCount = points.length;
  const decimated = douglasPeucker(points, DP_EPSILON_METERS);

  return {
    points: decimated,
    originalPointCount,
    totalDistance,
    totalElevationGain,
    name,
  };
```

- [ ] **Step 5: Run all parser and DP tests**

```bash
npx vitest run src/utils/gpxParser.test.ts src/utils/douglasPeucker.test.ts
```

Expected: All tests pass. The VALID fixture (5 Paris points with clear direction changes) survives DP intact — `points.length` remains 5 and `originalPointCount` is 5. The MERIDIAN fixture collapses to 2 points.

- [ ] **Step 6: Run the full suite and type-check**

```bash
npx vitest run && npm run build
```

Expected: All tests pass, build succeeds with no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/utils/gpxParser.ts src/utils/gpxParser.test.ts
git commit -m "feat: decimate route points with Douglas-Peucker at parse time"
```

---

### Task 3: Tech Details sidebar panel

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add the `DP_EPSILON_METERS` import**

In `src/App.tsx`, add to the existing imports after the `gpxParser` import:
```typescript
import { DP_EPSILON_METERS } from './utils/douglasPeucker';
```

- [ ] **Step 2: Remove Track Points from the route stats panel**

In `src/App.tsx`, find the stats grid inside the `{route && (...)}` block (around line 221). Remove the Track Points `stat-item` div. The stats grid becomes:

```jsx
<div className="stats-grid">
  <div className="stat-item">
    <span className="stat-label">Distance</span>
    <span className="stat-value">{(route.totalDistance / 1000).toFixed(1)} km</span>
  </div>
  <div className="stat-item">
    <span className="stat-label">Elevation Gain</span>
    <span className="stat-value">{Math.round(route.totalElevationGain)} m</span>
  </div>
</div>
```

- [ ] **Step 3: Add the Tech Details panel**

After the closing `)}` of the route stats `{route && (...)}` block (around line 235), add:

```jsx
{route && (
  <div className="glass-panel stats-card">
    <h3>Tech Details</h3>
    <div className="stats-grid">
      <div className="stat-item">
        <span className="stat-label">DP Epsilon</span>
        <span className="stat-value">{DP_EPSILON_METERS} m</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">Original Points</span>
        <span className="stat-value">{route.originalPointCount.toLocaleString()}</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">Map Points</span>
        <span className="stat-value">{route.points.length.toLocaleString()}</span>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 4: Type-check and run the full test suite**

```bash
npm run build && npx vitest run
```

Expected: Build passes, all tests pass.

- [ ] **Step 5: Visual verification**

```bash
npm run dev
```

Open http://localhost:5173, upload a GPX file, and confirm:
- Sidebar shows a **Tech Details** panel with three rows: DP Epsilon, Original Points, Map Points
- **Track Points** no longer appears in the route stats panel
- Map polyline renders correctly
- Weather timeline and hover marker work as before

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add Tech Details panel showing DP epsilon and point compression"
```
