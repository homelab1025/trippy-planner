# Configurable DP Epsilon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Douglas-Peucker epsilon value editable in the Tech Details sidebar panel before GPX upload and frozen (disabled) after.

**Architecture:** Epsilon flows from `App.tsx` state → `parseGPXAsync(xml, epsilon)` → worker message `{ xml, epsilon }` → `parseGPX(xml, epsilon)`. The `DP_EPSILON_METERS` constant remains the default. The Tech Details panel is always visible; the input is disabled once a route is loaded.

**Tech Stack:** TypeScript, React, Vitest

---

## File map

| Action | File | Change |
|--------|------|--------|
| Modify | `src/utils/gpxParser.ts` | `parseGPX` accepts `epsilon: number` parameter |
| Modify | `src/utils/gpxParser.test.ts` | Pass `DP_EPSILON_METERS` as second arg to all `parseGPX` calls |
| Modify | `src/workers/gpxWorker.ts` | Accept `{ xml, epsilon }` message; pass epsilon to `parseGPX` |
| Modify | `src/workers/gpxWorkerClient.ts` | `parseGPXAsync(xml, epsilon)` sends `{ xml, epsilon }` |
| Modify | `src/workers/gpxWorkerClient.test.ts` | Update tests for new signature and message format |
| Modify | `src/App.tsx` | Add `dpEpsilon` state; wire to upload; always-visible editable Tech Details panel |

---

### Task 1: Make `parseGPX` accept epsilon as a parameter

**Files:**
- Modify: `src/utils/gpxParser.ts`
- Modify: `src/utils/gpxParser.test.ts`

- [ ] **Step 1: Add `DP_EPSILON_METERS` import to the test file and update all `parseGPX` calls to pass it as the second argument**

In `src/utils/gpxParser.test.ts`, add the import on line 2:

```typescript
import { DP_EPSILON_METERS } from './douglasPeucker';
```

Then update every `parseGPX(...)` call to pass `DP_EPSILON_METERS` as the second argument. The full updated test file:

```typescript
import { describe, it, expect } from 'vitest';
import { parseGPX } from './gpxParser';
import { DP_EPSILON_METERS } from './douglasPeucker';

// Build a minimal GPX XML string from parts
const gpx = (name: string, trkpts: string) => `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1">
  <trk>
    ${name ? `<name>${name}</name>` : ''}
    <trkseg>${trkpts}</trkseg>
  </trk>
</gpx>`;

const pt = (lat: number, lon: number, ele?: number) =>
  `<trkpt lat="${lat}" lon="${lon}">${ele !== undefined ? `<ele>${ele}</ele>` : ''}</trkpt>`;

// Five points: gains are 35→40 (+5) and 38→45 (+7), descents are ignored → totalElevationGain = 12m
const VALID = gpx('Test Route', [
  pt(48.8566, 2.3522, 35),
  pt(48.8600, 2.3600, 40),
  pt(48.8550, 2.3650, 38),
  pt(48.8520, 2.3700, 45),
  pt(48.8500, 2.3750, 42),
].join('\n'));

describe('parseGPX', () => {
  it('returns correct name, point count, and elevation gain for a valid GPX', () => {
    const result = parseGPX(VALID, DP_EPSILON_METERS);
    expect(result.name).toBe('Test Route');
    expect(result.points).toHaveLength(5);
    expect(result.originalPointCount).toBe(5);
    expect(result.totalElevationGain).toBeCloseTo(12, 0);
  });

  it('first point has distance 0 and subsequent distances increase monotonically', () => {
    const { points } = parseGPX(VALID, DP_EPSILON_METERS);
    expect(points[0].distance).toBe(0);
    for (let i = 1; i < points.length; i++) {
      expect(points[i].distance).toBeGreaterThan(points[i - 1].distance);
    }
  });

  it('elevation gain only counts positive deltas — descents are not subtracted', () => {
    const descending = gpx('Descent', [
      pt(48.85, 2.35, 100),
      pt(48.86, 2.36, 80),
      pt(48.87, 2.37, 60),
    ].join('\n'));
    expect(parseGPX(descending, DP_EPSILON_METERS).totalElevationGain).toBe(0);
  });

  it('defaults elevation to 0 when ele attribute is absent', () => {
    const noEle = gpx('No Ele', [
      pt(48.85, 2.35),
      pt(48.86, 2.36),
    ].join('\n'));
    const { points } = parseGPX(noEle, DP_EPSILON_METERS);
    expect(points[0].ele).toBe(0);
    expect(points[1].ele).toBe(0);
  });

  it('falls back to "Untitled Route" when track name is missing', () => {
    const noName = gpx('', [
      pt(48.85, 2.35, 10),
      pt(48.86, 2.36, 10),
    ].join('\n'));
    expect(parseGPX(noName, DP_EPSILON_METERS).name).toBe('Untitled Route');
  });

  it('throws when the GPX file contains no tracks', () => {
    expect(() => parseGPX(`<?xml version="1.0"?><gpx version="1.1"></gpx>`, DP_EPSILON_METERS))
      .toThrow('No tracks found in GPX file');
  });

  it('computes haversine distance to within 1 m for a two-point route', () => {
    const twoPoint = gpx('D', [pt(1, 1), pt(2, 2)].join('\n'));
    expect(parseGPX(twoPoint, DP_EPSILON_METERS).totalDistance).toBeCloseTo(157_225.43, 0);
  });

  it('records original point count and decimates collinear points on a meridian', () => {
    const MERIDIAN = gpx('Meridian', [
      pt(0, 10, 0),
      pt(0.25, 10, 0),
      pt(0.5, 10, 0),
      pt(0.75, 10, 0),
      pt(1, 10, 0),
    ].join('\n'));
    const result = parseGPX(MERIDIAN, DP_EPSILON_METERS);
    expect(result.originalPointCount).toBe(5);
    expect(result.points.length).toBeLessThan(result.originalPointCount);
    expect(result.points[0].lat).toBeCloseTo(0, 5);
    expect(result.points[result.points.length - 1].lat).toBeCloseTo(1, 5);
  });
});
```

- [ ] **Step 2: Run tests — they must still pass (extra JS argument is silently ignored until Step 4 changes the signature)**

```bash
npx vitest run src/utils/gpxParser.test.ts
```

Expected: All 8 tests pass.

- [ ] **Step 3: Update `parseGPX` to require epsilon and use it**

In `src/utils/gpxParser.ts`:

Change line 3 from:
```typescript
import { douglasPeucker, DP_EPSILON_METERS } from './douglasPeucker';
```
To:
```typescript
import { douglasPeucker } from './douglasPeucker';
```

Change line 29 (the function signature) from:
```typescript
export const parseGPX = (xmlText: string): RouteData => {
```
To:
```typescript
export const parseGPX = (xmlText: string, epsilon: number): RouteData => {
```

Change line 70 from:
```typescript
  const decimated = douglasPeucker(points, DP_EPSILON_METERS);
```
To:
```typescript
  const decimated = douglasPeucker(points, epsilon);
```

- [ ] **Step 4: Run the full test suite**

```bash
npx vitest run
```

Expected: All 41 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/utils/gpxParser.ts src/utils/gpxParser.test.ts
git commit -m "refactor: make parseGPX accept epsilon as explicit parameter"
```

---

### Task 2: Update worker message format

**Files:**
- Modify: `src/workers/gpxWorker.ts`
- Modify: `src/workers/gpxWorkerClient.ts`
- Modify: `src/workers/gpxWorkerClient.test.ts`

- [ ] **Step 1: Update the worker client test to expect the new `{ xml, epsilon }` message format**

Replace `src/workers/gpxWorkerClient.test.ts` with:

```typescript
import { describe, it, expect, vi } from 'vitest';
import type { RouteData } from '../utils/gpxParser';

let workerInstance: FakeWorker;

class FakeWorker {
  private listeners: Map<string, Set<(e: unknown) => void>> = new Map();
  postMessage = vi.fn();
  terminate = vi.fn();

  addEventListener(type: string, handler: (e: unknown) => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(handler);
  }

  removeEventListener(type: string, handler: (e: unknown) => void) {
    this.listeners.get(type)?.delete(handler);
  }

  emit(type: string, payload: unknown) {
    this.listeners.get(type)?.forEach(h => h(payload));
  }
}

vi.mock('./gpxWorker?worker', () => ({
  default: function GpxWorkerMock() {
    workerInstance = new FakeWorker();
    return workerInstance;
  },
}));

const { parseGPXAsync } = await import('./gpxWorkerClient');

const minimalRoute: RouteData = {
  name: 'Test Route',
  originalPointCount: 1,
  totalDistance: 1000,
  totalElevationGain: 50,
  points: [{ lat: 48.8, lng: 2.3, ele: 100, distance: 0 }],
};

describe('parseGPXAsync', () => {
  it('resolves with RouteData when the worker posts a success response', async () => {
    const promise = parseGPXAsync('<gpx/>', 5);
    workerInstance.emit('message', { data: { type: 'success', data: minimalRoute } });
    await expect(promise).resolves.toEqual(minimalRoute);
  });

  it('rejects with the error message when the worker posts an error response', async () => {
    const promise = parseGPXAsync('<bad/>', 5);
    workerInstance.emit('message', { data: { type: 'error', message: 'No tracks found' } });
    await expect(promise).rejects.toThrow('No tracks found');
  });

  it('rejects when the worker fires an error event', async () => {
    const promise = parseGPXAsync('<gpx/>', 5);
    workerInstance.emit('error', { message: 'Worker crashed' });
    await expect(promise).rejects.toThrow('Worker crashed');
  });

  it('sends xml and epsilon to the worker as a structured message', async () => {
    const xml = '<gpx version="1.1"/>';
    const promise = parseGPXAsync(xml, 10);
    workerInstance.emit('message', { data: { type: 'success', data: minimalRoute } });
    await promise;
    expect(workerInstance.postMessage).toHaveBeenCalledWith({ xml, epsilon: 10 });
  });

  it('terminates the worker after a successful response', async () => {
    const promise = parseGPXAsync('<gpx/>', 5);
    workerInstance.emit('message', { data: { type: 'success', data: minimalRoute } });
    await promise;
    expect(workerInstance.terminate).toHaveBeenCalledOnce();
  });

  it('terminates the worker after an error response', async () => {
    const promise = parseGPXAsync('<bad/>', 5);
    workerInstance.emit('message', { data: { type: 'error', message: 'No tracks found' } });
    await expect(promise).rejects.toThrow('No tracks found');
    expect(workerInstance.terminate).toHaveBeenCalledOnce();
  });

  it('terminates the worker after a worker error event', async () => {
    const promise = parseGPXAsync('<gpx/>', 5);
    workerInstance.emit('error', { message: 'Worker crashed' });
    await expect(promise).rejects.toThrow('Worker crashed');
    expect(workerInstance.terminate).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run the worker client tests to confirm the new message-format test fails**

```bash
npx vitest run src/workers/gpxWorkerClient.test.ts
```

Expected: `sends xml and epsilon to the worker as a structured message` fails — `postMessage` was called with the raw XML string, not `{ xml, epsilon: 10 }`.

- [ ] **Step 3: Update `src/workers/gpxWorkerClient.ts`**

Replace the full file with:

```typescript
import GpxWorker from './gpxWorker?worker';
import type { RouteData } from '../utils/gpxParser';

type WorkerResponse =
  | { type: 'success'; data: RouteData }
  | { type: 'error'; message: string };

export function parseGPXAsync(gpxContent: string, epsilon: number): Promise<RouteData> {
  return new Promise((resolve, reject) => {
    const worker = new GpxWorker();
    worker.addEventListener('message', (e: MessageEvent<WorkerResponse>) => {
      worker.terminate();
      if (e.data.type === 'success') resolve(e.data.data);
      else reject(new Error(e.data.message));
    });
    worker.addEventListener('error', (e: ErrorEvent) => {
      worker.terminate();
      reject(new Error(e.message));
    });
    worker.postMessage({ xml: gpxContent, epsilon });
  });
}
```

- [ ] **Step 4: Update `src/workers/gpxWorker.ts`**

Replace the full file with:

```typescript
/// <reference lib="WebWorker" />
import { parseGPX } from '../utils/gpxParser';

type WorkerMessage = { xml: string; epsilon: number };

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  try {
    const data = parseGPX(e.data.xml, e.data.epsilon);
    self.postMessage({ type: 'success', data });
  } catch (err) {
    self.postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
```

- [ ] **Step 5: Run the full test suite**

```bash
npx vitest run
```

Expected: All 41 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/workers/gpxWorker.ts src/workers/gpxWorkerClient.ts src/workers/gpxWorkerClient.test.ts
git commit -m "feat: pass epsilon through worker message to parseGPX"
```

---

### Task 3: Wire epsilon state and update Tech Details panel in `App.tsx`

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add `dpEpsilon` state**

In `src/App.tsx`, find the existing state declarations (around line 26). Add `dpEpsilon` after the existing `useState` calls:

```typescript
const [dpEpsilon, setDpEpsilon] = useState(DP_EPSILON_METERS);
```

- [ ] **Step 2: Pass `dpEpsilon` to `parseGPXAsync` in the upload handler**

In `src/App.tsx`, find the `handleFileUpload` function. Change the `parseGPXAsync` call from:

```typescript
const parsedRoute = await parseGPXAsync(text);
```

To:

```typescript
const parsedRoute = await parseGPXAsync(text, dpEpsilon);
```

- [ ] **Step 3: Replace the Tech Details panel**

In `src/App.tsx`, find the existing Tech Details panel block (lines 234–252):

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

Replace it entirely with (no `{route && (...)}` guard — always visible):

```jsx
<div className="glass-panel stats-card">
  <h3>Tech Details</h3>
  <div className="stats-grid">
    <div className="stat-item">
      <span className="stat-label">DP Epsilon</span>
      <span className="stat-value">
        <input
          type="number"
          min="1"
          step="1"
          value={dpEpsilon}
          disabled={route !== null}
          onChange={(e) => setDpEpsilon(Math.max(1, Number(e.target.value)))}
          style={{ width: '60px' }}
        />
        {' '}m
      </span>
    </div>
    <div className="stat-item">
      <span className="stat-label">Original Points</span>
      <span className="stat-value">{route ? route.originalPointCount.toLocaleString() : '—'}</span>
    </div>
    <div className="stat-item">
      <span className="stat-label">Map Points</span>
      <span className="stat-value">{route ? route.points.length.toLocaleString() : '—'}</span>
    </div>
  </div>
</div>
```

- [ ] **Step 4: Run the full test suite and type-check**

```bash
npx vitest run && npm run build
```

Expected: All 41 tests pass. Build has the same pre-existing `vite.config.ts` error only — no new type errors.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat: make DP epsilon editable in Tech Details panel, frozen after upload"
```
