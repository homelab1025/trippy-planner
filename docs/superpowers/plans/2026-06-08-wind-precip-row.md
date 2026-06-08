# Wind Arrow Row & Precipitation Bar Row — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two `WeatherLineChart` sub-rows with bespoke SVG components: `WindArrowRow` (directional arrows + speed labels) and `PrecipBarRow` (variable-height opacity bars).

**Architecture:** Two new pure-SVG React components receive the ~11 weather sample points and `chartWidth`, compute pixel positions using the same 55px left/right offsets as the recharts charts above, and render directly via SVG. `windDeg` is added to `ChartDataPoint` and interpolated alongside the other weather fields. `WeatherLineChart` and its test file are deleted; `weatherAvailable` state and all related dead code in `App.tsx`/`App.test.tsx` are removed.

**Tech Stack:** React, TypeScript, SVG (no recharts for new components), Vitest + @testing-library/react, Lucide icons (`Wind`, `CloudRain`)

---

## File Map

| Action | File |
|--------|------|
| Modify | `src/hooks/useWeatherChartData.ts` |
| Modify | `src/hooks/useWeatherChartData.test.ts` |
| Create | `src/components/WindArrowRow.tsx` |
| Create | `src/components/WindArrowRow.test.tsx` |
| Create | `src/components/PrecipBarRow.tsx` |
| Create | `src/components/PrecipBarRow.test.tsx` |
| Modify | `src/App.tsx` |
| Modify | `src/App.test.tsx` |
| Delete | `src/components/WeatherLineChart.tsx` |
| Delete | `src/components/WeatherLineChart.test.tsx` |

---

### Task 1: Create feature branch

- [ ] **Step 1: Create and switch to branch**

```bash
git checkout -b feat/wind-precip-rows
```

---

### Task 2: Add `windDeg` to `ChartDataPoint`

**Files:**
- Modify: `src/hooks/useWeatherChartData.ts`
- Modify: `src/hooks/useWeatherChartData.test.ts`

- [ ] **Step 1: Write failing test for windDeg interpolation**

Add this test to `src/hooks/useWeatherChartData.test.ts`, after the existing interpolation tests:

```ts
it('interpolates windDeg between sample points', () => {
  const pts = [
    { distance: 0, ele: 100 },
    { distance: 1000, ele: 100 },
    { distance: 2000, ele: 100 },
  ];
  const route = makeRoute(pts);
  const makeWP = (idx: number, windDeg: number) => ({
    point: route.points[idx],
    arrivalTime: new Date(START.getTime() + idx * 3_600_000),
    label: String(idx),
    temp: 0, precipProb: 0, precipitation: 0, windSpeed: 0, windDeg,
  });
  const result = buildChartData({
    route,
    weatherPoints: [makeWP(0, 0), makeWP(2, 180)],
    chartWidth: 1000,
    avgSpeed: 20,
    startTime: START,
  });
  const mid = result.find(p => Math.abs(p.distance - 1) < 0.01);
  expect(mid?.windDeg).toBeCloseTo(90, 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/hooks/useWeatherChartData.test.ts
```

Expected: FAIL — `mid?.windDeg` is `undefined`.

- [ ] **Step 3: Add `windDeg` to the `ChartDataPoint` interface**

In `src/hooks/useWeatherChartData.ts`, update the interface:

```ts
export interface ChartDataPoint {
  distance: number;
  elevation: number;
  temp: number | undefined;
  precipProb: number | undefined;
  precipitation: number | undefined;
  windSpeed: number | undefined;
  windDeg: number | undefined;
  time: number;
  isSample: boolean;
}
```

- [ ] **Step 4: Initialise `windDeg` in the points map call**

In `buildChartData`, the `route.points.map(...)` call builds the initial array. Add `windDeg: undefined` alongside the other `undefined` fields:

```ts
const d: ChartDataPoint[] = route.points.map(pt => ({
  distance: pt.distance / 1000,
  elevation: Math.round(pt.ele),
  temp: undefined,
  precipProb: undefined,
  precipitation: undefined,
  windSpeed: undefined,
  windDeg: undefined,
  time: startTime.getTime() + (pt.distance / (avgSpeed * 1000)) * 3_600_000,
  isSample: false,
}));
```

- [ ] **Step 5: Populate `windDeg` from weather samples**

In the `weatherPoints.forEach(wp => { ... })` block, add alongside `windSpeed`:

```ts
d[rIdx].windDeg = wp.windDeg;
```

- [ ] **Step 6: Add `windDeg` to the interpolation loop**

Find the block that starts `const tLo = downsampled[lo].temp ...`. Extend it:

```ts
const tLo = downsampled[lo].temp,    tHi = downsampled[hi].temp;
const ppLo = downsampled[lo].precipProb, ppHi = downsampled[hi].precipProb;
const pLo = downsampled[lo].precipitation, pHi = downsampled[hi].precipitation;
const wsLo = downsampled[lo].windSpeed,  wsHi = downsampled[hi].windSpeed;
const wdLo = downsampled[lo].windDeg,    wdHi = downsampled[hi].windDeg;
const timeLo = downsampled[lo].time,    timeHi = downsampled[hi].time;
if (
  tLo == null || tHi == null || ppLo == null || ppHi == null ||
  pLo == null || pHi == null || wsLo == null || wsHi == null ||
  wdLo == null || wdHi == null ||
  timeLo == null || timeHi == null
) continue;
for (let j = lo + 1; j < hi; j++) {
  const t = (j - lo) / (hi - lo);
  downsampled[j].temp          = tLo  + (tHi  - tLo)  * t;
  downsampled[j].precipProb    = ppLo + (ppHi - ppLo) * t;
  downsampled[j].precipitation = pLo  + (pHi  - pLo)  * t;
  downsampled[j].windSpeed     = wsLo + (wsHi - wsLo) * t;
  downsampled[j].windDeg       = wdLo + (wdHi - wdLo) * t;
  downsampled[j].time          = timeLo + (timeHi - timeLo) * t;
}
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
npx vitest run src/hooks/useWeatherChartData.test.ts
```

Expected: all tests PASS.

- [ ] **Step 8: Commit**

```bash
git add src/hooks/useWeatherChartData.ts src/hooks/useWeatherChartData.test.ts
git commit -m "feat: add windDeg to ChartDataPoint and interpolate it"
```

---

### Task 3: Create `WindArrowRow`

**Files:**
- Create: `src/components/WindArrowRow.tsx`
- Create: `src/components/WindArrowRow.test.tsx`

The component renders an SVG containing:
- A dashed baseline at y=22
- One `<g data-arrow="true">` per sample point, SVG-rotated by `windDeg` degrees, containing an upward arrow (↑ tip at y=8, tail at y=22)
- A `<text>` per sample showing `Math.round(windSpeed)` at y=37

**X alignment:** The recharts charts above use `marginLeft=10 + leftYAxisWidth=45 = 55px` from the left edge and `marginRight=55px` from the right. The SVG uses the same offsets so arrows align with the data points in the elevation chart.

```
plotLeft        = 55
plotRightOffset = 55
plotWidth       = chartWidth - 110
xOf(distance)  = plotLeft + ((distance - distanceRange[0]) / (distanceRange[1] - distanceRange[0])) * plotWidth
```

**Arrow rotation:** SVG `transform="rotate(windDeg, x, 15)"` — `windDeg=0` (north) keeps the arrow pointing ↑; `windDeg=90` (east) rotates it to →. Arrow center is at y=15.

- [ ] **Step 1: Write failing tests**

Create `src/components/WindArrowRow.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import WindArrowRow from './WindArrowRow';
import type { ChartDataPoint } from '../hooks/useWeatherChartData';

afterEach(cleanup);

const makeSample = (distance: number, windSpeed: number, windDeg: number): ChartDataPoint => ({
  distance, elevation: 100, temp: 20, precipProb: 50, precipitation: 1,
  windSpeed, windDeg, time: 0, isSample: true,
});

describe('WindArrowRow', () => {
  it('renders nothing when samplePoints is empty', () => {
    const { container } = render(
      <WindArrowRow samplePoints={[]} distanceRange={[0, 10]} chartWidth={800} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders one arrow group per sample point', () => {
    const { container } = render(
      <WindArrowRow
        samplePoints={[makeSample(2, 15, 90), makeSample(5, 20, 180)]}
        distanceRange={[0, 10]}
        chartWidth={800}
      />
    );
    expect(container.querySelectorAll('g[data-arrow]')).toHaveLength(2);
  });

  it('applies windDeg as the rotation angle in each arrow group transform', () => {
    const { container } = render(
      <WindArrowRow
        samplePoints={[makeSample(5, 20, 135)]}
        distanceRange={[0, 10]}
        chartWidth={800}
      />
    );
    const g = container.querySelector('g[data-arrow]');
    expect(g?.getAttribute('transform')).toMatch(/rotate\(135[^)]*\)/);
  });

  it('renders a rounded speed label for each sample', () => {
    const { getByText } = render(
      <WindArrowRow
        samplePoints={[makeSample(5, 17.6, 0)]}
        distanceRange={[0, 10]}
        chartWidth={800}
      />
    );
    expect(getByText('18')).toBeTruthy();
  });

  it('renders a dashed baseline line', () => {
    const { container } = render(
      <WindArrowRow
        samplePoints={[makeSample(5, 10, 0)]}
        distanceRange={[0, 10]}
        chartWidth={800}
      />
    );
    const baseline = container.querySelector('line');
    expect(baseline?.getAttribute('stroke-dasharray')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/components/WindArrowRow.test.tsx
```

Expected: FAIL — `WindArrowRow` module not found.

- [ ] **Step 3: Implement `WindArrowRow`**

Create `src/components/WindArrowRow.tsx`:

```tsx
import React from 'react';
import { Wind } from 'lucide-react';
import type { ChartDataPoint } from '../hooks/useWeatherChartData';

interface WindArrowRowProps {
  samplePoints: ChartDataPoint[];
  distanceRange: [number, number];
  chartWidth: number;
}

const PLOT_LEFT = 55;
const PLOT_RIGHT_OFFSET = 55;

const WindArrowRow: React.FC<WindArrowRowProps> = ({ samplePoints, distanceRange, chartWidth }) => {
  if (!samplePoints.length || chartWidth < 1) return null;

  const [dMin, dMax] = distanceRange;
  const plotWidth = chartWidth - PLOT_LEFT - PLOT_RIGHT_OFFSET;
  const xOf = (d: number) => PLOT_LEFT + ((d - dMin) / (dMax - dMin)) * plotWidth;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div style={{
        position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
        color: '#94a3b8', pointerEvents: 'none',
      }}>
        <Wind size={14} />
      </div>
      <svg width={chartWidth} height={40}>
        {/* Dashed baseline */}
        <line
          x1={PLOT_LEFT} y1={22}
          x2={chartWidth - PLOT_RIGHT_OFFSET} y2={22}
          stroke="#bfdbfe" strokeWidth={1.5} strokeDasharray="4 4"
        />
        {samplePoints.map((pt, i) => {
          if (pt.windSpeed == null || pt.windDeg == null) return null;
          const x = xOf(pt.distance);
          return (
            <g key={i} data-arrow="true" transform={`rotate(${pt.windDeg}, ${x}, 15)`}>
              <line x1={x} y1={22} x2={x} y2={8} stroke="#3b82f6" strokeWidth={2} />
              <polyline
                points={`${x - 4},13 ${x},8 ${x + 4},13`}
                fill="none" stroke="#3b82f6" strokeWidth={2}
              />
            </g>
          );
        })}
        {samplePoints.map((pt, i) => {
          if (pt.windSpeed == null) return null;
          return (
            <text
              key={i}
              x={xOf(pt.distance)} y={37}
              textAnchor="middle" fontSize={9}
              fill="#3b82f6" fontWeight="600"
            >
              {Math.round(pt.windSpeed)}
            </text>
          );
        })}
      </svg>
    </div>
  );
};

export default WindArrowRow;
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/components/WindArrowRow.test.tsx
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/WindArrowRow.tsx src/components/WindArrowRow.test.tsx
git commit -m "feat: add WindArrowRow component"
```

---

### Task 4: Create `PrecipBarRow`

**Files:**
- Create: `src/components/PrecipBarRow.tsx`
- Create: `src/components/PrecipBarRow.test.tsx`

The component renders N+1 `<rect>` bars for N sample points (segments: `[dMin, s0], [s0, s1], …, [sN-1, dMax]`). Each bar's height is proportional to `precipitation` (relative to the route maximum), and opacity equals `precipProb / 100`. Same 55px left/right plot offsets as `WindArrowRow`.

Segment-to-sample mapping (0-indexed segment `i`, N sample points):
```
sample index = Math.max(0, i - 1)
```
This gives segment 0 the first sample's values, and each subsequent segment the left-boundary sample's values.

- [ ] **Step 1: Write failing tests**

Create `src/components/PrecipBarRow.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import PrecipBarRow from './PrecipBarRow';
import type { ChartDataPoint } from '../hooks/useWeatherChartData';

afterEach(cleanup);

const makeSample = (distance: number, precipProb: number, precipitation: number): ChartDataPoint => ({
  distance, elevation: 100, temp: 20, precipProb, precipitation,
  windSpeed: 10, windDeg: 0, time: 0, isSample: true,
});

describe('PrecipBarRow', () => {
  it('renders nothing when samplePoints is empty', () => {
    const { container } = render(
      <PrecipBarRow samplePoints={[]} distanceRange={[0, 10]} chartWidth={800} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders N+1 rect bars for N sample points', () => {
    const { container } = render(
      <PrecipBarRow
        samplePoints={[makeSample(3, 50, 1), makeSample(7, 80, 2)]}
        distanceRange={[0, 10]}
        chartWidth={800}
      />
    );
    expect(container.querySelectorAll('rect')).toHaveLength(3);
  });

  it('sets rect opacity equal to precipProb / 100', () => {
    const { container } = render(
      <PrecipBarRow
        samplePoints={[makeSample(5, 60, 1)]}
        distanceRange={[0, 10]}
        chartWidth={800}
      />
    );
    const rects = container.querySelectorAll('rect');
    rects.forEach(rect => {
      expect(Number(rect.getAttribute('opacity'))).toBeCloseTo(0.6, 2);
    });
  });

  it('renders a taller bar for the segment with higher precipitation', () => {
    const { container } = render(
      <PrecipBarRow
        samplePoints={[makeSample(3, 80, 1), makeSample(7, 80, 4)]}
        distanceRange={[0, 10]}
        chartWidth={800}
      />
    );
    const rects = Array.from(container.querySelectorAll('rect'));
    const heights = rects.map(r => Number(r.getAttribute('height')));
    // segment 2 ([s1, dMax]) uses samplePoints[1].precipitation=4, max=4 → full height
    // segment 0 ([dMin, s0]) uses samplePoints[0].precipitation=1, max=4 → 1/4 height
    expect(heights[2]).toBeGreaterThan(heights[0]);
  });

  it('renders a single sample point as 2 bars', () => {
    const { container } = render(
      <PrecipBarRow
        samplePoints={[makeSample(5, 40, 0.5)]}
        distanceRange={[0, 10]}
        chartWidth={800}
      />
    );
    expect(container.querySelectorAll('rect')).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/components/PrecipBarRow.test.tsx
```

Expected: FAIL — `PrecipBarRow` module not found.

- [ ] **Step 3: Implement `PrecipBarRow`**

Create `src/components/PrecipBarRow.tsx`:

```tsx
import React from 'react';
import { CloudRain } from 'lucide-react';
import type { ChartDataPoint } from '../hooks/useWeatherChartData';

interface PrecipBarRowProps {
  samplePoints: ChartDataPoint[];
  distanceRange: [number, number];
  chartWidth: number;
}

const PLOT_LEFT = 55;
const PLOT_RIGHT_OFFSET = 55;
const MAX_BAR_HEIGHT = 28;
const BAR_BOTTOM_Y = 36;
const BAR_GAP = 2;

const PrecipBarRow: React.FC<PrecipBarRowProps> = ({ samplePoints, distanceRange, chartWidth }) => {
  if (!samplePoints.length || chartWidth < 1) return null;

  const [dMin, dMax] = distanceRange;
  const plotWidth = chartWidth - PLOT_LEFT - PLOT_RIGHT_OFFSET;
  const xOf = (d: number) => PLOT_LEFT + ((d - dMin) / (dMax - dMin)) * plotWidth;

  const maxPrecip = Math.max(...samplePoints.map(p => p.precipitation ?? 0), 1);
  const edges = [dMin, ...samplePoints.map(p => p.distance), dMax];

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div style={{
        position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
        color: '#94a3b8', pointerEvents: 'none',
      }}>
        <CloudRain size={14} />
      </div>
      <svg width={chartWidth} height={40}>
        {edges.slice(0, -1).map((startDist, i) => {
          const endDist = edges[i + 1];
          const sample = samplePoints[Math.max(0, i - 1)];
          const precip = sample.precipitation ?? 0;
          const prob = sample.precipProb ?? 0;
          const barHeight = Math.max((precip / maxPrecip) * MAX_BAR_HEIGHT, 2);
          const opacity = Math.max(prob / 100, 0.05);
          const x1 = xOf(startDist);
          const barWidth = Math.max(xOf(endDist) - x1 - BAR_GAP, 1);
          return (
            <rect
              key={i}
              x={x1}
              y={BAR_BOTTOM_Y - barHeight}
              width={barWidth}
              height={barHeight}
              fill="#3b82f6"
              opacity={opacity}
              rx={2}
            />
          );
        })}
      </svg>
    </div>
  );
};

export default PrecipBarRow;
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/components/PrecipBarRow.test.tsx
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/PrecipBarRow.tsx src/components/PrecipBarRow.test.tsx
git commit -m "feat: add PrecipBarRow component"
```

---

### Task 5: Wire new components into `App.tsx` and update `App.test.tsx`

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Update `App.tsx` imports and consts**

Replace the WeatherLineChart import block and the three line config consts at the top of `App.tsx`.

Remove these lines:
```ts
import WeatherLineChart from './components/WeatherLineChart';
import type { WeatherLineConfig } from './components/WeatherLineChart';

const WIND_LINE: WeatherLineConfig = {
  label: 'Wind', color: '#4A9FD9', format: (v) => `${Math.round(v)} km/h`, yAxisId: 'left',
};
const PROB_LINE: WeatherLineConfig = {
  label: 'Prob', color: '#4A90D9', format: (v) => `${Math.round(v)}%`, yAxisId: 'left', domain: [0, 100],
};
const AMOUNT_LINE: WeatherLineConfig = {
  label: 'Amount', color: '#A0C8F0', format: (v) => `${v.toFixed(1)} mm`, yAxisId: 'right',
};
```

Add in their place:
```ts
import WindArrowRow from './components/WindArrowRow';
import PrecipBarRow from './components/PrecipBarRow';
```

- [ ] **Step 2: Remove `weatherAvailable` state from `App.tsx`**

Remove this line from the state declarations:
```ts
const [weatherAvailable, setWeatherAvailable] = useState<boolean | null>(null);
```

Remove all three calls to `setWeatherAvailable(...)` in `updateWeather`:
```ts
// remove (line ~135, start of updateWeather):
setWeatherAvailable(null);
// remove (line ~161, after filtering weather results):
setWeatherAvailable(filtered.length > 0);
// remove (line ~165, catch block):
setWeatherAvailable(false);
```

- [ ] **Step 3: Replace `windData` and `precipData` memos with `samplePoints` and `distanceRange`**

Remove:
```ts
const windData = useMemo(
  () => chartData.map(({ time, distance, windSpeed }) => ({ time, distance, line1: windSpeed })),
  [chartData]
);

const precipData = useMemo(
  () => chartData.map(({ time, distance, precipProb, precipitation }) => ({ time, distance, line1: precipProb, line2: precipitation })),
  [chartData]
);
```

Add:
```ts
const samplePoints = useMemo(
  () => chartData.filter(p => p.isSample),
  [chartData]
);

const distanceRange = useMemo(
  (): [number, number] => chartData.length
    ? [chartData[0].distance, chartData[chartData.length - 1].distance]
    : [0, 1],
  [chartData]
);
```

- [ ] **Step 4: Replace the two `WeatherLineChart` JSX blocks**

Find and replace:
```tsx
<div className="border-t border-base-200" style={{ height: 40 }}>
  <WeatherLineChart
    data={windData}
    line1Config={WIND_LINE}
    hoveredIndex={hoveredIndex}
    onHoverIndex={onHoverIndex}
    weatherAvailable={weatherAvailable}
    hideAxes
  />
</div>
<div className="border-t border-base-200" style={{ height: 40 }}>
  <WeatherLineChart
    data={precipData}
    line1Config={PROB_LINE}
    line2Config={AMOUNT_LINE}
    hoveredIndex={hoveredIndex}
    onHoverIndex={onHoverIndex}
    weatherAvailable={weatherAvailable}
    hideAxes
  />
</div>
```

With:
```tsx
<div className="border-t border-base-200" style={{ height: 40 }}>
  <WindArrowRow
    samplePoints={samplePoints}
    distanceRange={distanceRange}
    chartWidth={chartWidth}
  />
</div>
<div className="border-t border-base-200" style={{ height: 40 }}>
  <PrecipBarRow
    samplePoints={samplePoints}
    distanceRange={distanceRange}
    chartWidth={chartWidth}
  />
</div>
```

- [ ] **Step 5: Update `App.test.tsx` — replace WeatherLineChart mock**

Remove the entire `vi.mock('./components/WeatherLineChart', ...)` block (lines 95–117) and the two module-level captured-data variables above it:

```ts
// Remove these two variable declarations:
let capturedWindData: Array<{ line1?: number; line2?: number }> = [];
let capturedPrecipData: Array<{ line1?: number; line2?: number }> = [];
```

```ts
// Remove this entire mock:
vi.mock('./components/WeatherLineChart', () => ({
  default: ({ data, line1Config, weatherAvailable }: { ... }) => { ... },
}));
```

Add two new mocks after the `ElevationChart` mock:

```ts
vi.mock('./components/WindArrowRow', () => ({
  default: ({ samplePoints }: { samplePoints: unknown[] }) => (
    <div data-testid="wind-chart" data-sample-count={samplePoints.length} />
  ),
}));

vi.mock('./components/PrecipBarRow', () => ({
  default: ({ samplePoints }: { samplePoints: unknown[] }) => (
    <div data-testid="precip-chart" data-sample-count={samplePoints.length} />
  ),
}));
```

- [ ] **Step 6: Clean up `beforeEach` in `App.test.tsx`**

Remove the two reset lines from `beforeEach`:
```ts
capturedWindData = [];
capturedPrecipData = [];
```

- [ ] **Step 7: Replace captured-data assertions with sample-count assertions**

There are three test blocks that assert `capturedWindData.length > 0` / `capturedPrecipData.length > 0` (around lines 201–228). Replace each pair with:

```ts
// before: expect(capturedWindData.length).toBeGreaterThan(0);
// before: expect(capturedPrecipData.length).toBeGreaterThan(0);
// after:
expect(Number(screen.getByTestId('wind-chart').dataset.sampleCount)).toBeGreaterThan(0);
expect(Number(screen.getByTestId('precip-chart').dataset.sampleCount)).toBeGreaterThan(0);
```

- [ ] **Step 8: Remove the two `weatherAvailable` tests**

Delete the two `it(...)` blocks:
- `'passes weatherAvailable=true to wind chart when weather fetch succeeds'`
- `'passes weatherAvailable=false to wind chart when weather fetch returns null'`

- [ ] **Step 9: Run the full test suite**

```bash
npx vitest run
```

Expected: all tests PASS (zero failures). TypeScript errors about `toBeInTheDocument` in `ElevationChart.test.tsx` and `WeatherLineChart.test.tsx` are pre-existing and unrelated to this change.

- [ ] **Step 10: Commit**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat: wire WindArrowRow and PrecipBarRow into App, remove WeatherLineChart usage"
```

---

### Task 6: Delete `WeatherLineChart` files

**Files:**
- Delete: `src/components/WeatherLineChart.tsx`
- Delete: `src/components/WeatherLineChart.test.tsx`

- [ ] **Step 1: Delete both files**

```bash
git rm src/components/WeatherLineChart.tsx src/components/WeatherLineChart.test.tsx
```

- [ ] **Step 2: Verify no remaining references**

```bash
grep -r "WeatherLineChart" src/
```

Expected: no output (zero references).

- [ ] **Step 3: Run full test suite to confirm no breakage**

```bash
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 4: Run type-check**

```bash
npm run build
```

Expected: build succeeds with no type errors.

- [ ] **Step 5: Commit**

```bash
git commit -m "chore: delete WeatherLineChart — replaced by WindArrowRow and PrecipBarRow"
```

---

### Task 7: Visual verification

- [ ] **Step 1: Start dev server and open app**

```bash
npm run dev
```

Open http://localhost:5173. Upload a GPX file (e.g. `samples/saint-cergue to faucille.gpx`).

- [ ] **Step 2: Verify wind row**

- Wind row appears below the elevation chart as a 40px strip
- A dashed blue baseline is visible across the full chart width
- ~11 arrows appear at evenly-spaced positions; each arrow is rotated to reflect wind direction (↑ = from north, → = from east, etc.)
- A wind speed number (km/h) appears below each arrow
- Arrows X-align with the elevation chart above (same left/right boundaries)

- [ ] **Step 3: Verify precipitation row**

- Precipitation row appears below the wind row as a 40px strip
- ~12 blue bars appear, growing from the bottom
- Bars vary in height (taller = more mm) and opacity (darker = higher probability)
- Bars align horizontally with the elevation chart above

- [ ] **Step 4: Commit spec and plan**

```bash
git add docs/superpowers/specs/2026-06-07-wind-precip-row-design.md docs/superpowers/plans/2026-06-08-wind-precip-row.md
git commit -m "docs: add spec and plan for wind/precip row redesign"
```
