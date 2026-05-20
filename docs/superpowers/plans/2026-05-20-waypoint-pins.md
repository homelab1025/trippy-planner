# Waypoint Pins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user click the timeline to pin arrival-time estimates to arbitrary route points, refining the piecewise pacing model and triggering accurate weather re-fetches.

**Architecture:** A new pure utility `timingModel.ts` owns `computeArrivalTime`, which replaces the constant-speed formula in `updateWeather`. `App.tsx` holds pin state and a sidebar panel for editing/deleting pins. `WeatherTimeline.tsx` fires click events and renders green diamond markers at pinned points.

**Tech Stack:** React 19, TypeScript, recharts (existing), vitest (new, for unit tests on the pure timing model), Playwright (existing E2E tests).

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/utils/timingModel.ts` | **Create** | `Pin` type + `computeArrivalTime` pure function |
| `src/utils/timingModel.test.ts` | **Create** | vitest unit tests for `computeArrivalTime` |
| `vitest.config.ts` | **Create** | minimal vitest config |
| `src/App.tsx` | **Modify** | pin state, updateWeather, handlers, sidebar panel, new WeatherTimeline props |
| `src/components/WeatherTimeline.tsx` | **Modify** | `rawDistance`/`pinElevation` fields, click handler, pin marker overlay |
| `tests/app.spec.ts` | **Modify** | E2E tests for the full pin workflow |
| `package.json` | **Modify** | add vitest devDependency + `test:unit` script |

---

### Task 1: Add vitest

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Install vitest**

```bash
npm install -D vitest
```

Expected: vitest appears in `package.json` devDependencies.

- [ ] **Step 2: Add test script to package.json**

In `package.json`, add to `"scripts"`:
```json
"test:unit": "vitest run"
```

- [ ] **Step 3: Create vitest config**

Create `vitest.config.ts` at the project root:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
  },
});
```

- [ ] **Step 4: Verify the runner works**

```bash
npm run test:unit
```

Expected: "No test files found" (zero failures) — vitest runs and exits cleanly.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add vitest for unit tests"
```

---

### Task 2: timingModel utility (TDD)

**Files:**
- Create: `src/utils/timingModel.ts`
- Create: `src/utils/timingModel.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/utils/timingModel.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { computeArrivalTime } from './timingModel';

const t = (h: number, m = 0) => new Date(2026, 4, 20, h, m, 0, 0);

describe('computeArrivalTime', () => {
  it('no pins: matches constant-speed formula', () => {
    // 50km at 25km/h = 2 hours travel
    const result = computeArrivalTime(50_000, t(8), 25, []);
    expect(result.getTime()).toBe(t(10).getTime());
  });

  it('no pins, distance 0: returns startTime', () => {
    const result = computeArrivalTime(0, t(8), 25, []);
    expect(result.getTime()).toBe(t(8).getTime());
  });

  it('one pin: interpolates correctly before the pin', () => {
    // pin at 60km = 12:00 (start 8:00), query at 30km = halfway
    const result = computeArrivalTime(30_000, t(8), 25, [
      { distance: 60_000, time: t(12) },
    ]);
    expect(result.getTime()).toBe(t(10).getTime()); // 2h into the 4h segment
  });

  it('one pin: uses avgSpeed after the last pin', () => {
    // pin at 60km = 12:00, avgSpeed 25km/h, query at 90km
    // 30km at 25km/h = 1.2h = 1h12m → 13:12
    const result = computeArrivalTime(90_000, t(8), 25, [
      { distance: 60_000, time: t(12) },
    ]);
    expect(result.getTime()).toBe(t(13, 12).getTime());
  });

  it('two pins: interpolates between them correctly', () => {
    // pin1 at 40km = 10:00, pin2 at 80km = 14:00, query at 60km = midpoint
    const result = computeArrivalTime(60_000, t(8), 25, [
      { distance: 40_000, time: t(10) },
      { distance: 80_000, time: t(14) },
    ]);
    expect(result.getTime()).toBe(t(12).getTime());
  });

  it('query exactly at pin: returns pin time', () => {
    const result = computeArrivalTime(60_000, t(8), 25, [
      { distance: 60_000, time: t(12) },
    ]);
    expect(result.getTime()).toBe(t(12).getTime());
  });

  it('pins passed out of order are handled correctly', () => {
    // Same as two-pin test but pins given in reverse order
    const result = computeArrivalTime(60_000, t(8), 25, [
      { distance: 80_000, time: t(14) },
      { distance: 40_000, time: t(10) },
    ]);
    expect(result.getTime()).toBe(t(12).getTime());
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test:unit
```

Expected: FAIL — "Cannot find module './timingModel'"

- [ ] **Step 3: Implement timingModel**

Create `src/utils/timingModel.ts`:
```ts
export interface Pin {
  distance: number; // meters
  time: Date;
}

export function computeArrivalTime(
  distance: number,
  startTime: Date,
  avgSpeedKmh: number,
  pins: Pin[]
): Date {
  const sorted = [...pins].sort((a, b) => a.distance - b.distance);
  const anchors = [{ distance: 0, time: startTime }, ...sorted];

  let prev = anchors[0];
  for (let i = 1; i < anchors.length; i++) {
    const next = anchors[i];
    if (distance <= next.distance) {
      const segDist = next.distance - prev.distance;
      const segMs = next.time.getTime() - prev.time.getTime();
      const frac = segDist > 0 ? (distance - prev.distance) / segDist : 0;
      return new Date(prev.time.getTime() + frac * segMs);
    }
    prev = next;
  }

  // Past last anchor — apply avgSpeed
  const deltaM = distance - prev.distance;
  const hours = deltaM / (avgSpeedKmh * 1000);
  return new Date(prev.time.getTime() + hours * 3_600_000);
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm run test:unit
```

Expected: 6 tests PASS, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add src/utils/timingModel.ts src/utils/timingModel.test.ts
git commit -m "feat: add timingModel utility with computeArrivalTime"
```

---

### Task 3: Wire timingModel into App.tsx updateWeather

**Files:**
- Modify: `src/App.tsx` (lines ~80-106 — the `updateWeather` callback and its `useEffect`)

- [ ] **Step 1: Add the import and empty pins state**

At the top of `src/App.tsx`, add the import after the existing utility imports:
```ts
import { computeArrivalTime } from './utils/timingModel';
import type { Pin } from './utils/timingModel';
```

Inside the `App` function, after the `xAxisMode` state line (~line 32), add:
```ts
const [pins, setPins] = useState<Pin[]>([]);
```

- [ ] **Step 2: Update updateWeather signature and body**

Replace the `updateWeather` callback (currently lines ~80-106) with:
```ts
const updateWeather = useCallback(async (
  currentRoute: RouteData,
  speed: number,
  start: Date,
  currentPins: Pin[]
) => {
  if (!currentRoute) return;

  const pointsToQuery = [];
  const interval = currentRoute.totalDistance / 10;
  const seen = new Set();

  for (let i = 0; i <= 10; i++) {
    const idealDist = i * interval;
    const point = currentRoute.points.find(p => p.distance >= idealDist)
      ?? currentRoute.points[currentRoute.points.length - 1];
    if (seen.has(point)) continue;
    seen.add(point);

    const arrivalTime = computeArrivalTime(point.distance, start, speed, currentPins);
    pointsToQuery.push({ point, arrivalTime });
  }

  const weatherResults = await Promise.all(
    pointsToQuery.map(async ({ point, arrivalTime }) => {
      const weather = await fetchWeatherForPoint(point.lat, point.lng, arrivalTime.getTime() / 1000);
      return { ...weather, point, arrivalTime };
    })
  );

  setWeatherPoints(weatherResults);
}, []);
```

- [ ] **Step 3: Update the useEffect call**

Replace the existing `useEffect` (~lines 108-112) with:
```ts
React.useEffect(() => {
  if (route) {
    updateWeather(route, avgSpeed, startTime, pins);
  }
}, [route, avgSpeed, startTime, pins, updateWeather]);
```

Also update the `handleFileUpload` call to pass `pins`:
```ts
await updateWeather(parsedRoute, avgSpeed, startTime, pins);
```

- [ ] **Step 4: Verify the app still works**

```bash
npm run dev
```

Open http://localhost:5173, upload `public/sample-route.gpx`, confirm the weather timeline still renders. No visible change in behaviour — this step only swaps the formula.

- [ ] **Step 5: Run existing E2E tests**

```bash
npx playwright test
```

Expected: all existing tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "feat: use timingModel for arrival time computation in updateWeather"
```

---

### Task 4: Timeline click → pin creation

**Files:**
- Modify: `src/components/WeatherTimeline.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Add rawDistance to chart data in WeatherTimeline**

In `WeatherTimeline.tsx`, update the `data` useMemo map (currently line ~24) to include `rawDistance`:
```ts
const d = route.points.map(pt => ({
  distance: pt.distance / 1000,
  rawDistance: pt.distance,          // meters — used for pin matching
  elevation: Math.round(pt.ele),
  temp: undefined as number | undefined,
  time: undefined as number | undefined,
  isSample: false,
  weatherIdx: undefined as number | undefined,
  pinElevation: undefined as number | undefined, // set later if pinned
}));
```

- [ ] **Step 2: Add onPointClick prop to WeatherTimeline**

Update `WeatherTimelineProps`:
```ts
interface WeatherTimelineProps {
  route: RouteData;
  weatherPoints: any[];
  onHoverIndex: (index: number | null) => void;
  xAxisMode: 'clock' | 'elapsed';
  onPointClick: (distanceMeters: number) => void;
}
```

Add `onPointClick` to the destructured props:
```ts
const WeatherTimeline: React.FC<WeatherTimelineProps> = ({
  route, weatherPoints, onHoverIndex, xAxisMode, onPointClick
}) => {
```

- [ ] **Step 3: Wire onClick on ComposedChart**

Add an `onClick` handler to the `<ComposedChart>` element, immediately after the existing `onMouseLeave` prop:
```tsx
onClick={(state) => {
  if (!state?.activePayload?.[0]) return;
  const rawDist = state.activePayload[0].payload.rawDistance as number;
  if (rawDist != null) onPointClick(rawDist);
}}
```

Also add `style={{ cursor: 'crosshair' }}` to the `<ComposedChart>` element so clicking intent is clear.

- [ ] **Step 4: Add pin state and handlers to App.tsx**

After the `pins` state line (added in Task 3), add:
```ts
const [selectedPinDistance, setSelectedPinDistance] = useState<number | null>(null);
```

Add the click handler inside the `App` function (after `handleTimeChange`):
```ts
const handleTimelineClick = (distanceMeters: number) => {
  if (!route) return;
  // Snap to exact route point distance
  let nearest = route.points[0];
  let nearestDiff = Infinity;
  for (const pt of route.points) {
    const diff = Math.abs(pt.distance - distanceMeters);
    if (diff < nearestDiff) { nearestDiff = diff; nearest = pt; }
  }
  const distance = nearest.distance;

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

Add edit and delete handlers:
```ts
const handlePinTimeChange = (distance: number, newTime: Date) => {
  setPins(prev => prev.map(p => p.distance === distance ? { ...p, time: newTime } : p));
};

const handlePinDelete = (distance: number) => {
  setPins(prev => prev.filter(p => p.distance !== distance));
  if (selectedPinDistance === distance) setSelectedPinDistance(null);
};
```

- [ ] **Step 5: Pass onPointClick to WeatherTimeline in JSX**

Find the `<WeatherTimeline ... />` call in `App.tsx` and add the prop:
```tsx
<WeatherTimeline
  route={route}
  weatherPoints={weatherPoints}
  onHoverIndex={setHoveredIndex}
  xAxisMode={xAxisMode}
  onPointClick={handleTimelineClick}
/>
```

- [ ] **Step 6: Verify click fires without errors**

```bash
npm run dev
```

Upload the sample GPX. Click somewhere on the timeline. Open the browser console — no errors should appear. Clicking the same spot twice should not create a duplicate (check the React DevTools to see `pins` state).

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/components/WeatherTimeline.tsx
git commit -m "feat: timeline click creates waypoint pins"
```

---

### Task 5: Sidebar pins panel

**Files:**
- Modify: `src/App.tsx` (JSX sidebar section, ~lines 143-221)

The sidebar panel uses `formatElapsed` (currently private to `WeatherTimeline.tsx`). Export it first, then use it in App.tsx alongside a parser.

- [ ] **Step 1: Add formatElapsed and elapsed parser to App.tsx**

Add these two helper functions inside the `App` function in `src/App.tsx`, after the handler functions. `formatElapsed` is a local copy — short enough not to warrant extracting to a shared module:

```ts
const formatElapsed = (ms: number): string => {
  const totalMinutes = Math.round(ms / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
};
```

Add this helper function inside the `App` function (after formatElapsed):
```ts
const parseElapsedToMs = (str: string): number | null => {
  const hourMatch = str.match(/(\d+)\s*h/);
  const minMatch = str.match(/(\d+)\s*m/);
  if (!hourMatch && !minMatch) return null;
  const hours = hourMatch ? parseInt(hourMatch[1]) : 0;
  const mins = minMatch ? parseInt(minMatch[1]) : 0;
  return (hours * 60 + mins) * 60_000;
};
```

- [ ] **Step 3: Add clock and elapsed pin time change handlers**

Add inside the `App` function:
```ts
const handlePinClockChange = (distance: number, timeStr: string) => {
  if (!timeStr) return;
  const [hours, minutes] = timeStr.split(':').map(Number);
  const pin = pins.find(p => p.distance === distance);
  if (!pin) return;
  const newTime = new Date(pin.time);
  newTime.setHours(hours, minutes, 0, 0);
  handlePinTimeChange(distance, newTime);
};

const handlePinElapsedBlur = (distance: number, value: string) => {
  const ms = parseElapsedToMs(value);
  if (ms === null) return;
  handlePinTimeChange(distance, new Date(startTime.getTime() + ms));
};
```

- [ ] **Step 4: Add the Waypoint Pins panel to the sidebar JSX**

In `App.tsx`, locate the `{route && (` block that renders the stats card (~line 203). Add the Waypoint Pins panel **before** the stats card (but still inside `<aside className="sidebar">`):

```tsx
{route && (
  <div className="glass-panel control-card">
    <h3>Waypoint Pins</h3>
    {pins.length === 0 ? (
      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
        Click the timeline to pin a waypoint time.
      </p>
    ) : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {[...pins].sort((a, b) => a.distance - b.distance).map(pin => (
          <div
            key={pin.distance}
            onClick={() => setSelectedPinDistance(pin.distance)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 8px',
              borderRadius: 'var(--radius-md)',
              borderLeft: pin.distance === selectedPinDistance
                ? '3px solid #2d5a27'
                : '3px solid transparent',
              background: pin.distance === selectedPinDistance
                ? 'rgba(45, 90, 39, 0.06)'
                : 'transparent',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', minWidth: '52px' }}>
              km {(pin.distance / 1000).toFixed(1)}
            </span>
            {xAxisMode === 'clock' ? (
              <input
                type="time"
                defaultValue={`${String(pin.time.getHours()).padStart(2, '0')}:${String(pin.time.getMinutes()).padStart(2, '0')}`}
                key={`clock-${pin.distance}-${pin.time.getTime()}`}
                onChange={(e) => handlePinClockChange(pin.distance, e.target.value)}
                style={{ flex: 1, fontSize: '0.85rem' }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <input
                type="text"
                defaultValue={formatElapsed(pin.time.getTime() - startTime.getTime())}
                key={`elapsed-${pin.distance}-${pin.time.getTime()}-${startTime.getTime()}`}
                onBlur={(e) => handlePinElapsedBlur(pin.distance, e.target.value)}
                style={{ flex: 1, fontSize: '0.85rem' }}
                onClick={(e) => e.stopPropagation()}
              />
            )}
            <button
              onClick={(e) => { e.stopPropagation(); handlePinDelete(pin.distance); }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                fontSize: '1rem',
                lineHeight: 1,
                padding: '0 2px',
              }}
              aria-label="Delete pin"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    )}
  </div>
)}
```

- [ ] **Step 5: Verify sidebar panel in the browser**

```bash
npm run dev
```

1. Upload `public/sample-route.gpx`.
2. Click on the timeline — a "Waypoint Pins" panel should appear in the sidebar with one row showing a `km X.X` label and a time input.
3. Click the × button — the row disappears and the panel shows the hint text.
4. Add two pins at different positions — they appear sorted by distance.
5. Toggle between Clock and Elapsed — the input type switches.
6. Edit an elapsed value (e.g., change to "3h 00m"), tab away — the pin row reflects the new time.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/components/WeatherTimeline.tsx
git commit -m "feat: sidebar waypoint pins panel with clock/elapsed editing"
```

---

### Task 6: Timeline pin markers

**Files:**
- Modify: `src/components/WeatherTimeline.tsx`

- [ ] **Step 1: Add pins and selectedPinDistance props**

Update `WeatherTimelineProps`:
```ts
interface WeatherTimelineProps {
  route: RouteData;
  weatherPoints: any[];
  onHoverIndex: (index: number | null) => void;
  xAxisMode: 'clock' | 'elapsed';
  onPointClick: (distanceMeters: number) => void;
  pins: Pin[];
  selectedPinDistance: number | null;
}
```

Add the import at the top:
```ts
import type { Pin } from '../utils/timingModel';
```

Update the destructured props:
```ts
const WeatherTimeline: React.FC<WeatherTimelineProps> = ({
  route, weatherPoints, onHoverIndex, xAxisMode, onPointClick, pins, selectedPinDistance
}) => {
```

- [ ] **Step 2: Populate pinElevation in the useMemo**

Inside the `useMemo`, after the interpolation loop and before `return downsampled;`, add:
```ts
if (pins.length > 0) {
  downsampled.forEach(pt => {
    const pin = pins.find(p => p.distance === pt.rawDistance);
    if (pin) pt.pinElevation = pt.elevation;
  });
}
```

Add `pins` to the `useMemo` dependency array:
```ts
}, [route, weatherPoints, chartWidth, pins]);
```

- [ ] **Step 3: Add pin marker Line series to the chart**

Inside `<ComposedChart>`, after the temperature `<Line>` element, add:
```tsx
<Line
  yAxisId="elevation"
  type="monotone"
  dataKey="pinElevation"
  stroke="none"
  dot={(props: any) => {
    if (props.payload.pinElevation == null) return <g key={props.index} />;
    const isSelected = props.payload.rawDistance === selectedPinDistance;
    const r = isSelected ? 7 : 5;
    const { cx, cy } = props;
    return (
      <g key={props.index}>
        <polygon
          points={`${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`}
          fill="#2d5a27"
          stroke="white"
          strokeWidth={isSelected ? 2 : 1}
        />
      </g>
    );
  }}
  connectNulls={false}
  isAnimationActive={false}
  name="Pin"
/>
```

- [ ] **Step 4: Pass pins and selectedPinDistance from App.tsx**

In `App.tsx`, update the `<WeatherTimeline />` JSX call:
```tsx
<WeatherTimeline
  route={route}
  weatherPoints={weatherPoints}
  onHoverIndex={setHoveredIndex}
  xAxisMode={xAxisMode}
  onPointClick={handleTimelineClick}
  pins={pins}
  selectedPinDistance={selectedPinDistance}
/>
```

- [ ] **Step 5: Verify pin markers in the browser**

```bash
npm run dev
```

1. Upload `public/sample-route.gpx`.
2. Click on the timeline — a green diamond marker should appear at the clicked position on the elevation curve.
3. Click a second position — a second diamond appears.
4. Click the first pin's row in the sidebar — the corresponding diamond becomes larger.
5. Delete a pin from the sidebar — its diamond disappears.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/components/WeatherTimeline.tsx
git commit -m "feat: render pin diamond markers on elevation curve"
```

---

### Task 7: E2E tests

**Files:**
- Modify: `tests/app.spec.ts`

- [ ] **Step 1: Add pin workflow E2E tests**

Append to `tests/app.spec.ts`:
```ts
test('clicking timeline creates a waypoint pin in the sidebar', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type="file"]', 'public/sample-route.gpx');
  await expect(page.getByText('Sample Ride')).toBeVisible();

  // Wait for timeline to render
  const timeline = page.locator('.timeline-container');
  await expect(timeline).toBeVisible();
  await timeline.click({ position: { x: 200, y: 100 } });

  // Waypoint Pins panel should appear with one entry
  await expect(page.getByText('Waypoint Pins')).toBeVisible();
  await expect(page.locator('input[type="time"]')).toBeVisible();
});

test('deleting a pin removes it from the sidebar', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type="file"]', 'public/sample-route.gpx');
  await expect(page.getByText('Sample Ride')).toBeVisible();

  const timeline = page.locator('.timeline-container');
  await timeline.click({ position: { x: 200, y: 100 } });
  await expect(page.getByText('Waypoint Pins')).toBeVisible();

  // Click the × delete button
  await page.getByRole('button', { name: 'Delete pin' }).click();

  // Panel reverts to hint text
  await expect(page.getByText('Click the timeline to pin a waypoint time.')).toBeVisible();
});

test('clicking same spot twice selects existing pin without duplicating', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type="file"]', 'public/sample-route.gpx');
  await expect(page.getByText('Sample Ride')).toBeVisible();

  const timeline = page.locator('.timeline-container');
  await timeline.click({ position: { x: 200, y: 100 } });
  await timeline.click({ position: { x: 200, y: 100 } });

  // Still only one pin row
  await expect(page.locator('[aria-label="Delete pin"]')).toHaveCount(1);
});

test('pin panel shows hint text before any pins are added', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type="file"]', 'public/sample-route.gpx');
  await expect(page.getByText('Sample Ride')).toBeVisible();

  // Panel exists but shows hint, no delete buttons
  await expect(page.getByText('Waypoint Pins')).toBeVisible();
  await expect(page.getByText('Click the timeline to pin a waypoint time.')).toBeVisible();
  await expect(page.locator('[aria-label="Delete pin"]')).toHaveCount(0);
});
```

- [ ] **Step 2: Run all E2E tests**

```bash
npx playwright test
```

Expected: all tests PASS (both existing and new).

- [ ] **Step 3: Commit**

```bash
git add tests/app.spec.ts
git commit -m "test: add E2E tests for waypoint pin workflow"
```
