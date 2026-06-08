# Recharts Migration for WindArrowRow and PrecipBarRow

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace manual SVG coordinate math in WindArrowRow and PrecipBarRow with Recharts-managed axis scaling, eliminating the duplicated 55px offset constants.

**Architecture:** Export two constants from `ElevationChart`, then convert each row to `ResponsiveContainer` + `ComposedChart` with a hidden `XAxis`. A module-level layer component (`WindArrowsLayer` / `PrecipBarsLayer`) uses the `useXAxisScale()` hook — the same pattern as `ClimbOverlay` — to map distances to pixel x-coordinates. The `chartWidth` prop is dropped from both row components; `ResponsiveContainer` handles width.

**Tech Stack:** React 18, Recharts (`ComposedChart`, `ResponsiveContainer`, `XAxis`, `YAxis`, `ReferenceLine`, `useXAxisScale`), Vitest + @testing-library/react

---

## File Map

| File | Change |
|---|---|
| `src/components/ElevationChart.tsx` | export `CHART_MARGIN_LEFT = 10` and `CHART_YAXIS_LEFT_WIDTH = 45` |
| `src/components/WindArrowRow.tsx` | replace SVG impl with Recharts; add `WindArrowsLayer`; drop `chartWidth` prop |
| `src/components/WindArrowRow.test.tsx` | remove `chartWidth={800}`; add recharts mock; tighten baseline selector |
| `src/components/PrecipBarRow.tsx` | replace SVG impl with Recharts; add `PrecipBarsLayer`; drop `chartWidth` prop |
| `src/components/PrecipBarRow.test.tsx` | remove `chartWidth={800}`; add recharts mock; use `[data-testid="precip-bar"]` selector |
| `src/App.tsx` | remove `chartWidth={chartWidth}` from both row JSX invocations |

`chartWidth` state, `setChartWidth`, and `onResize={setChartWidth}` on `ElevationChart` **must stay** — `useWeatherChartData` at App.tsx:57 still uses `chartWidth` for LTTB downsampling.

---

### Task 1: Export shared constants from ElevationChart

**Files:**
- Modify: `src/components/ElevationChart.tsx`

- [ ] **Step 1: Add named constant exports and use them**

In `src/components/ElevationChart.tsx`, add two named exports before the component, then use them in the `ComposedChart` margin and `YAxis` width:

```tsx
export const CHART_MARGIN_LEFT = 10;
export const CHART_YAXIS_LEFT_WIDTH = 45;
```

Change line 41 from:
```tsx
margin={{ top: 10, right: hasTemp ? 10 : 55, left: 10, bottom: 0 }}
```
to:
```tsx
margin={{ top: 10, right: hasTemp ? 10 : 55, left: CHART_MARGIN_LEFT, bottom: 0 }}
```

Change line 69 from:
```tsx
width={45}
```
to:
```tsx
width={CHART_YAXIS_LEFT_WIDTH}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`

Expected: exits 0, no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ElevationChart.tsx
git commit -m "refactor(ElevationChart): export CHART_MARGIN_LEFT and CHART_YAXIS_LEFT_WIDTH as named constants"
```

---

### Task 2: Migrate WindArrowRow (TDD)

**Files:**
- Modify: `src/components/WindArrowRow.tsx`
- Test: `src/components/WindArrowRow.test.tsx`

- [ ] **Step 1: Replace test file**

Replace `src/components/WindArrowRow.test.tsx` entirely:

```tsx
// @vitest-environment jsdom
import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import WindArrowRow from './WindArrowRow';
import type { ChartDataPoint } from '../hooks/useWeatherChartData';

afterEach(cleanup);

vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    ComposedChart: ({ children }: { children: React.ReactNode }) =>
      React.createElement('svg', null, children),
    XAxis: () => null,
    YAxis: () => null,
    ReferenceLine: ({ x, stroke, strokeDasharray }: { x?: number; stroke?: string; strokeDasharray?: string }) =>
      x != null
        ? React.createElement('line', { x1: x, x2: x, y1: 0, y2: 40, stroke, 'stroke-dasharray': strokeDasharray })
        : null,
    useXAxisScale: () => (v: number) => v * 69 + 55,
  };
});

const makeSample = (distance: number, windSpeed: number, windDeg: number): ChartDataPoint => ({
  distance, elevation: 100, temp: 20, precipProb: 50, precipitation: 1,
  windSpeed, windDeg, time: 0, isSample: true,
});

describe('WindArrowRow', () => {
  it('renders nothing when samplePoints is empty', () => {
    const { container } = render(
      <WindArrowRow samplePoints={[]} distanceRange={[0, 10]} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders one arrow group per sample point', () => {
    const { container } = render(
      <WindArrowRow
        samplePoints={[makeSample(2, 15, 90), makeSample(5, 20, 180)]}
        distanceRange={[0, 10]}
      />
    );
    expect(container.querySelectorAll('g[data-arrow]')).toHaveLength(2);
  });

  it('applies windDeg as the rotation angle in each arrow group transform', () => {
    const { container } = render(
      <WindArrowRow
        samplePoints={[makeSample(5, 20, 135)]}
        distanceRange={[0, 10]}
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
      />
    );
    expect(getByText('18')).toBeTruthy();
  });

  it('renders a dashed baseline line', () => {
    const { container } = render(
      <WindArrowRow
        samplePoints={[makeSample(5, 10, 0)]}
        distanceRange={[0, 10]}
      />
    );
    const baseline = container.querySelector('line[stroke="#bfdbfe"]');
    expect(baseline?.getAttribute('stroke-dasharray')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests (red phase)**

Run: `npx vitest run src/components/WindArrowRow.test.tsx`

Expected: the "renders dashed baseline line" test may fail (new selector `line[stroke="#bfdbfe"]` looks for a Recharts-rendered line that the old pure-SVG component doesn't produce in the recharts mock context). Other tests may pass with NaN coordinates. Note: the primary goal of this step is confirming the test file compiles and the mock is wired correctly — full green requires the new implementation.

- [ ] **Step 3: Replace WindArrowRow implementation**

Replace `src/components/WindArrowRow.tsx` entirely:

```tsx
import React from 'react';
import { Wind } from 'lucide-react';
import {
  ResponsiveContainer, ComposedChart, XAxis, YAxis, ReferenceLine, useXAxisScale,
} from 'recharts';
import type { ChartDataPoint } from '../hooks/useWeatherChartData';
import { CHART_MARGIN_LEFT, CHART_YAXIS_LEFT_WIDTH } from './ElevationChart';

interface WindArrowRowProps {
  samplePoints: ChartDataPoint[];
  distanceRange: [number, number];
  hoveredDistance?: number | null;
}

interface WindArrowsLayerProps {
  samplePoints: ChartDataPoint[];
  distanceRange: [number, number];
}

const WindArrowsLayer: React.FC<WindArrowsLayerProps> = ({ samplePoints, distanceRange }) => {
  const xScale = useXAxisScale();
  if (!xScale) return null;
  const [dMin, dMax] = distanceRange;
  return (
    <>
      <line
        x1={xScale(dMin)} y1={22}
        x2={xScale(dMax)} y2={22}
        stroke="#bfdbfe" strokeWidth={1.5} strokeDasharray="4 4"
      />
      {samplePoints.map((pt, i) => {
        if (pt.windSpeed == null || pt.windDeg == null) return null;
        const x = xScale(pt.distance);
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
            x={xScale(pt.distance)} y={37}
            textAnchor="middle" fontSize={9}
            fill="#3b82f6" fontWeight="600"
          >
            {Math.round(pt.windSpeed)}
          </text>
        );
      })}
    </>
  );
};

const WindArrowRow: React.FC<WindArrowRowProps> = ({ samplePoints, distanceRange, hoveredDistance }) => {
  if (!samplePoints.length) return null;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div style={{
        position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
        color: '#94a3b8', pointerEvents: 'none',
      }}>
        <Wind size={14} />
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart margin={{ top: 0, right: 55, left: CHART_MARGIN_LEFT, bottom: 0 }}>
          <XAxis hide type="number" domain={distanceRange} />
          <YAxis hide width={CHART_YAXIS_LEFT_WIDTH} />
          <WindArrowsLayer samplePoints={samplePoints} distanceRange={distanceRange} />
          {hoveredDistance != null && (
            <ReferenceLine x={hoveredDistance} stroke="#aaa" strokeDasharray="3 3" />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default WindArrowRow;
```

- [ ] **Step 4: Run tests (green phase)**

Run: `npx vitest run src/components/WindArrowRow.test.tsx`

Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/WindArrowRow.tsx src/components/WindArrowRow.test.tsx
git commit -m "feat(WindArrowRow): migrate to Recharts ComposedChart, drop chartWidth prop"
```

---

### Task 3: Migrate PrecipBarRow (TDD)

**Files:**
- Modify: `src/components/PrecipBarRow.tsx`
- Test: `src/components/PrecipBarRow.test.tsx`

- [ ] **Step 1: Replace test file**

Replace `src/components/PrecipBarRow.test.tsx` entirely:

```tsx
// @vitest-environment jsdom
import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import PrecipBarRow from './PrecipBarRow';
import type { ChartDataPoint } from '../hooks/useWeatherChartData';

afterEach(cleanup);

vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    ComposedChart: ({ children }: { children: React.ReactNode }) =>
      React.createElement('svg', null, children),
    XAxis: () => null,
    YAxis: () => null,
    ReferenceLine: ({ x, stroke, strokeDasharray }: { x?: number; stroke?: string; strokeDasharray?: string }) =>
      x != null
        ? React.createElement('line', { x1: x, x2: x, y1: 0, y2: 40, stroke, 'stroke-dasharray': strokeDasharray })
        : null,
    useXAxisScale: () => (v: number) => v * 69 + 55,
  };
});

const makeSample = (distance: number, precipProb: number, precipitation: number): ChartDataPoint => ({
  distance, elevation: 100, temp: 20, precipProb, precipitation,
  windSpeed: 10, windDeg: 0, time: 0, isSample: true,
});

describe('PrecipBarRow', () => {
  it('renders nothing when samplePoints is empty', () => {
    const { container } = render(
      <PrecipBarRow samplePoints={[]} distanceRange={[0, 10]} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders N+1 rect bars for N sample points', () => {
    const { container } = render(
      <PrecipBarRow
        samplePoints={[makeSample(3, 50, 1), makeSample(7, 80, 2)]}
        distanceRange={[0, 10]}
      />
    );
    expect(container.querySelectorAll('[data-testid="precip-bar"]')).toHaveLength(3);
  });

  it('sets rect opacity equal to precipProb / 100', () => {
    const { container } = render(
      <PrecipBarRow
        samplePoints={[makeSample(5, 60, 1)]}
        distanceRange={[0, 10]}
      />
    );
    const rects = container.querySelectorAll('[data-testid="precip-bar"]');
    rects.forEach(rect => {
      expect(Number(rect.getAttribute('opacity'))).toBeCloseTo(0.6, 2);
    });
  });

  it('renders a taller bar for the segment with higher precipitation', () => {
    const { container } = render(
      <PrecipBarRow
        samplePoints={[makeSample(3, 80, 1), makeSample(7, 80, 4)]}
        distanceRange={[0, 10]}
      />
    );
    const rects = Array.from(container.querySelectorAll('[data-testid="precip-bar"]'));
    const heights = rects.map(r => Number(r.getAttribute('height')));
    // segment 2 ([s1, dMax]) uses samplePoints[1].precipitation=4 → full MAX_BAR_HEIGHT
    // segment 0 ([dMin, s0]) uses samplePoints[0].precipitation=1 → 1/4 height
    expect(heights[2]).toBeGreaterThan(heights[0]);
  });

  it('renders a single sample point as 2 bars', () => {
    const { container } = render(
      <PrecipBarRow
        samplePoints={[makeSample(5, 40, 0.5)]}
        distanceRange={[0, 10]}
      />
    );
    expect(container.querySelectorAll('[data-testid="precip-bar"]')).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run tests (red phase)**

Run: `npx vitest run src/components/PrecipBarRow.test.tsx`

Expected: tests 2–5 fail — `querySelectorAll('[data-testid="precip-bar"]')` returns 0 elements because the current `<rect>` elements have no `data-testid`.

- [ ] **Step 3: Replace PrecipBarRow implementation**

Replace `src/components/PrecipBarRow.tsx` entirely:

```tsx
import React from 'react';
import { CloudRain } from 'lucide-react';
import {
  ResponsiveContainer, ComposedChart, XAxis, YAxis, ReferenceLine, useXAxisScale,
} from 'recharts';
import type { ChartDataPoint } from '../hooks/useWeatherChartData';
import { CHART_MARGIN_LEFT, CHART_YAXIS_LEFT_WIDTH } from './ElevationChart';

const MAX_BAR_HEIGHT = 28;
const BAR_BOTTOM_Y = 36;
const BAR_GAP = 2;

interface PrecipBarRowProps {
  samplePoints: ChartDataPoint[];
  distanceRange: [number, number];
  hoveredDistance?: number | null;
}

interface PrecipBarsLayerProps {
  samplePoints: ChartDataPoint[];
  distanceRange: [number, number];
}

const PrecipBarsLayer: React.FC<PrecipBarsLayerProps> = ({ samplePoints, distanceRange }) => {
  const xScale = useXAxisScale();
  if (!xScale) return null;
  const [dMin, dMax] = distanceRange;

  const maxPrecip = Math.max(...samplePoints.map(p => p.precipitation ?? 0), 1);
  const edges = [dMin, ...samplePoints.map(p => p.distance), dMax];

  return (
    <>
      {edges.slice(0, -1).map((startDist, i) => {
        const endDist = edges[i + 1];
        const sample = samplePoints[Math.max(0, i - 1)];
        const precip = sample.precipitation ?? 0;
        const prob = sample.precipProb ?? 0;
        const barHeight = Math.max((precip / maxPrecip) * MAX_BAR_HEIGHT, 2);
        const opacity = Math.max(prob / 100, 0.05);
        const x1 = xScale(startDist);
        const barWidth = Math.max(xScale(endDist) - x1 - BAR_GAP, 1);
        return (
          <rect
            key={i}
            data-testid="precip-bar"
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
    </>
  );
};

const PrecipBarRow: React.FC<PrecipBarRowProps> = ({ samplePoints, distanceRange, hoveredDistance }) => {
  if (!samplePoints.length) return null;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div style={{
        position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
        color: '#94a3b8', pointerEvents: 'none',
      }}>
        <CloudRain size={14} />
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart margin={{ top: 0, right: 55, left: CHART_MARGIN_LEFT, bottom: 0 }}>
          <XAxis hide type="number" domain={distanceRange} />
          <YAxis hide width={CHART_YAXIS_LEFT_WIDTH} />
          <PrecipBarsLayer samplePoints={samplePoints} distanceRange={distanceRange} />
          {hoveredDistance != null && (
            <ReferenceLine x={hoveredDistance} stroke="#aaa" strokeDasharray="3 3" />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PrecipBarRow;
```

- [ ] **Step 4: Run tests (green phase)**

Run: `npx vitest run src/components/PrecipBarRow.test.tsx`

Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/PrecipBarRow.tsx src/components/PrecipBarRow.test.tsx
git commit -m "feat(PrecipBarRow): migrate to Recharts ComposedChart, drop chartWidth prop"
```

---

### Task 4: Remove chartWidth prop from rows in App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Remove chartWidth from both row elements**

In `src/App.tsx` around lines 442–455, remove `chartWidth={chartWidth}` from both rows:

Before:
```tsx
<WindArrowRow
  samplePoints={samplePoints}
  distanceRange={distanceRange}
  chartWidth={chartWidth}
  hoveredDistance={hoveredIndex !== null ? (chartData[hoveredIndex]?.distance ?? null) : null}
/>
```

After:
```tsx
<WindArrowRow
  samplePoints={samplePoints}
  distanceRange={distanceRange}
  hoveredDistance={hoveredIndex !== null ? (chartData[hoveredIndex]?.distance ?? null) : null}
/>
```

Before:
```tsx
<PrecipBarRow
  samplePoints={samplePoints}
  distanceRange={distanceRange}
  chartWidth={chartWidth}
  hoveredDistance={hoveredIndex !== null ? (chartData[hoveredIndex]?.distance ?? null) : null}
/>
```

After:
```tsx
<PrecipBarRow
  samplePoints={samplePoints}
  distanceRange={distanceRange}
  hoveredDistance={hoveredIndex !== null ? (chartData[hoveredIndex]?.distance ?? null) : null}
/>
```

Do NOT remove `chartWidth` state, `setChartWidth`, or `onResize={setChartWidth}` — they are still consumed by `useWeatherChartData` at line 57.

- [ ] **Step 2: Run full test suite and TypeScript build**

Run: `npm run build && npx vitest run`

Expected: build exits 0, all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "refactor(App): remove chartWidth prop from WindArrowRow and PrecipBarRow"
```

---

## Verification

1. `npx vitest run` — all unit tests pass
2. `npm run dev` → load the app with a GPX file → wind arrows and precip bars visually align with the elevation chart's x-axis ticks
3. Hover over the elevation chart — the vertical line extends through all three rows in sync
4. Load a route that has temperature data (`temp` present) — verify alignment holds with the right temperature axis visible
5. Load a route without temperature data — verify alignment still holds (right margin = 55 in all three rows)
6. Resize the browser window to a narrow width — all three rows stay aligned as the chart reflows
