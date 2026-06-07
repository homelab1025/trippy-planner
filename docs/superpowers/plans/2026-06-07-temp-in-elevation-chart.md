# Temperature in Elevation Chart — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the temperature line into the elevation chart (right Y-axis), make the weather sub-charts wind-only and precip-only, and shrink both to 40px height.

**Architecture:** Three surgical edits: (1) `WeatherLineChart` — make `line2`/`line2Config` optional so it can render a single line; (2) `ElevationChart` — add an optional temperature `Line` + right `YAxis` guarded by `hasTemp`; (3) `App` — rewire the derived data memos and chart props.

**Tech Stack:** React, recharts, Vitest + React Testing Library

---

## File Map

| File | Change |
|------|--------|
| `src/components/WeatherLineChart.tsx` | `line2?: number \| undefined` in `WeatherLinePoint`; `line2Config?` optional in props; conditional second YAxis + Line |
| `src/components/WeatherLineChart.test.tsx` | Add test: single-line render (no line2Config) |
| `src/components/ElevationChart.tsx` | `temp?: number` on `ElevationPoint`; `hasTemp` guard; right YAxis + Line for temp |
| `src/components/ElevationChart.test.tsx` | Add `Line` to recharts mock; add tests for temp line presence/absence |
| `src/App.tsx` | `elevationData` includes `temp`; replace `tempWindData` → `windData`; remove `TEMP_LINE`; update chart props + heights |
| `src/App.test.tsx` | Fix mock detection (Wind label, not Temp); rename `capturedTempWindData` → `capturedWindData`; rename test-id `tempwind-chart` → `wind-chart` |

---

## Task 1: Make `line2` and `line2Config` optional in WeatherLineChart

**Files:**
- Modify: `src/components/WeatherLineChart.test.tsx`
- Modify: `src/components/WeatherLineChart.tsx`

- [ ] **Step 1: Write the failing test**

Add this test inside the existing `describe('WeatherLineChart', ...)` block in `src/components/WeatherLineChart.test.tsx`, after the last existing test:

```tsx
it('renders only line1 when line2Config is absent', () => {
  const { line2Config: _omit, ...propsWithoutLine2 } = defaultProps;
  render(<WeatherLineChart {...propsWithoutLine2} />);
  expect(screen.getByTestId('line-line1')).toBeInTheDocument();
  expect(screen.queryByTestId('line-line2')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/components/WeatherLineChart.test.tsx
```

Expected: FAIL — TypeScript error or `line-line2` is found in the DOM.

- [ ] **Step 3: Implement**

Replace the contents of `src/components/WeatherLineChart.tsx` with:

```tsx
import React from 'react';
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine, ResponsiveContainer,
} from 'recharts';

export interface WeatherLinePoint {
  time: number;
  distance: number;
  line1: number | undefined;
  line2?: number | undefined;
}

export interface WeatherLineConfig {
  label: string;
  color: string;
  format: (v: number) => string;
  yAxisId: string;
  domain?: [number, number];
}

// TODO: refactor line1Config/line2Config into a single array of line configs
interface WeatherLineChartProps {
  data: WeatherLinePoint[];
  line1Config: WeatherLineConfig;
  line2Config?: WeatherLineConfig;
  hoveredIndex: number | null;
  onHoverIndex: (index: number | null) => void;
  weatherAvailable: boolean | null;
  hideAxes?: boolean;
}

const WeatherLineChart: React.FC<WeatherLineChartProps> = React.memo(({
  data, line1Config, line2Config, hoveredIndex, onHoverIndex, weatherAvailable, hideAxes = false,
}) => (
  <div style={{ width: '100%', height: '100%', position: 'relative' }}>
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart
        data={data}
        margin={hideAxes ? { top: 4, right: 10, left: 10, bottom: 0 } : { top: 10, right: 10, left: 10, bottom: 0 }}
        onMouseMove={(state) => {
          const idx = state.activeTooltipIndex != null ? Number(state.activeTooltipIndex) : NaN;
          if (isNaN(idx) || !data[idx]) { onHoverIndex(null); return; }
          onHoverIndex(idx);
        }}
        onMouseLeave={() => onHoverIndex(null)}
      >
        {!hideAxes && <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />}
        <XAxis
          dataKey="distance"
          type="number"
          domain={['dataMin', 'dataMax']}
          height={hideAxes ? 0 : undefined}
          tick={hideAxes ? false : undefined}
          tickFormatter={(v) => `${Math.round(v)} km`}
          fontSize={11}
          tickLine={false}
          axisLine={false}
          stroke="#888"
        />
        <YAxis
          yAxisId={line1Config.yAxisId}
          width={hideAxes ? 45 : undefined}
          domain={line1Config.domain}
          tick={hideAxes ? false : undefined}
          axisLine={false}
          tickLine={false}
          fontSize={10}
          stroke="#888"
          tickFormatter={(v) => line1Config.format(v)}
        />
        {line2Config && (
          <YAxis
            yAxisId={line2Config.yAxisId}
            orientation="right"
            width={hideAxes ? 0 : undefined}
            domain={line2Config.domain}
            tick={hideAxes ? false : undefined}
            axisLine={false}
            tickLine={false}
            fontSize={10}
            stroke="#888"
            tickFormatter={(v) => line2Config.format(v)}
          />
        )}
        {hoveredIndex !== null && data[hoveredIndex] != null && (
          <ReferenceLine
            x={data[hoveredIndex].distance}
            yAxisId={line1Config.yAxisId}
            stroke="#aaa"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}
        <Line
          yAxisId={line1Config.yAxisId}
          type="monotone"
          dataKey="line1"
          stroke={line1Config.color}
          dot={false}
          name={line1Config.label}
          isAnimationActive={false}
        />
        {line2Config && (
          <Line
            yAxisId={line2Config.yAxisId}
            type="monotone"
            dataKey="line2"
            stroke={line2Config.color}
            dot={false}
            name={line2Config.label}
            isAnimationActive={false}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
    {weatherAvailable === false && (
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        <span style={{ color: '#888', fontSize: '0.875rem', fontWeight: 500 }}>
          Weather data unavailable for the selected date
        </span>
      </div>
    )}
  </div>
));

export default WeatherLineChart;
```

- [ ] **Step 4: Run tests to verify they all pass**

```bash
npx vitest run src/components/WeatherLineChart.test.tsx
```

Expected: all tests pass (including the new one).

- [ ] **Step 5: Commit**

```bash
git add src/components/WeatherLineChart.tsx src/components/WeatherLineChart.test.tsx
git commit -m "feat: make line2/line2Config optional in WeatherLineChart"
```

---

## Task 2: Add temperature overlay to ElevationChart

**Files:**
- Modify: `src/components/ElevationChart.test.tsx`
- Modify: `src/components/ElevationChart.tsx`

- [ ] **Step 1: Add `Line` to the recharts mock and write failing tests**

In `src/components/ElevationChart.test.tsx`, update the `vi.mock('recharts', ...)` block to include `Line`, and add two new tests after the last existing test.

Update the mock (add `Line` alongside the existing stubs):

```tsx
vi.mock('recharts', () => ({
  ComposedChart: ({ children, onMouseMove, onMouseLeave }: {
    children: React.ReactNode;
    onMouseMove?: (state: { activeTooltipIndex?: number | null }) => void;
    onMouseLeave?: () => void;
  }) => {
    capturedMouseMove = onMouseMove ?? null;
    capturedMouseLeave = onMouseLeave ?? null;
    return <div>{children}</div>;
  },
  Area: ({ dataKey }: { dataKey: string }) => <div data-testid={`area-${dataKey}`} />,
  Line: ({ dataKey }: { dataKey: string }) => <div data-testid={`line-${dataKey}`} />,
  ReferenceLine: ({ x }: { x: number }) => <div data-testid="reference-line" data-x={x} />,
  ReferenceDot: ({ x, y }: { x: number; y: number }) => <div data-testid="reference-dot" data-x={x} data-y={y} />,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
```

Then add these two tests at the end of the `describe` block:

```tsx
it('does not render temp line when no data points have temp', () => {
  render(<ElevationChart {...defaultProps} />);
  expect(screen.queryByTestId('line-temp')).not.toBeInTheDocument();
});

it('renders temp line when at least one data point has a temp value', () => {
  const dataWithTemp = [
    { distance: 0, elevation: 100, temp: 18 },
    { distance: 1, elevation: 200, temp: 20 },
  ];
  render(<ElevationChart {...defaultProps} data={dataWithTemp} />);
  expect(screen.getByTestId('line-temp')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify the new ones fail as expected**

```bash
npx vitest run src/components/ElevationChart.test.tsx
```

Expected: `'renders temp line when at least one data point has a temp value'` FAILS — `line-temp` not found. The `'does not render temp line'` test passes trivially (line not rendered yet).

- [ ] **Step 3: Implement temperature overlay in ElevationChart**

Replace the contents of `src/components/ElevationChart.tsx` with:

```tsx
import React, { useMemo } from 'react';
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, ReferenceLine, ReferenceDot, ResponsiveContainer,
} from 'recharts';
import type { Climb } from '../utils/climbDetector';
import ClimbOverlay, { type ClimbRange } from './ClimbOverlay';

export interface ElevationPoint {
  distance: number;
  elevation: number;
  temp?: number;
}

interface ElevationChartProps {
  data: ElevationPoint[];
  climbs: Climb[];
  onHoverIndex: (index: number | null) => void;
  onResize: (width: number) => void;
  hoveredIndex: number | null;
}

const ElevationChart: React.FC<ElevationChartProps> = ({
  data, climbs, onHoverIndex, onResize, hoveredIndex,
}) => {
  const climbRanges = useMemo((): ClimbRange[] =>
    climbs.map(climb => ({
      ...climb,
      x1: climb.startDistance / 1000,
      x2: climb.endDistance / 1000,
    })),
    [climbs]
  );

  const hasTemp = data.some(d => d.temp != null);

  return (
    <div style={{ flex: 1, minWidth: 0, height: '100%', position: 'relative' }}>
      <ResponsiveContainer width="100%" height="100%" onResize={(w) => onResize(w)}>
        <ComposedChart
          data={data}
          margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
          onMouseMove={(state) => {
            const idx = state.activeTooltipIndex != null ? Number(state.activeTooltipIndex) : NaN;
            if (isNaN(idx) || !data[idx]) { onHoverIndex(null); return; }
            onHoverIndex(idx);
          }}
          onMouseLeave={() => onHoverIndex(null)}
        >
          <defs>
            <linearGradient id="colorEle" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2d5a27" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#2d5a27" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
          <XAxis
            dataKey="distance"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(v) => `${Math.round(v)} km`}
            fontSize={11}
            tickLine={false}
            axisLine={false}
            stroke="#888"
          />
          <YAxis
            yAxisId="elevation"
            width={45}
            domain={[(dataMin: number) => dataMin - 10, 'auto']}
            axisLine={false}
            tickLine={false}
            fontSize={10}
            stroke="#888"
            tickFormatter={(v) => `${Math.round(v)}m`}
          />
          {hasTemp && (
            <YAxis
              yAxisId="temp"
              orientation="right"
              width={45}
              axisLine={false}
              tickLine={false}
              fontSize={10}
              stroke="#ff7300"
              tickFormatter={(v) => `${Math.round(v)}°C`}
            />
          )}
          <Area
            yAxisId="elevation"
            type="monotone"
            dataKey="elevation"
            stroke="#2d5a27"
            fillOpacity={1}
            fill="url(#colorEle)"
            name="Elevation"
            dot={false}
            activeDot={false}
            isAnimationActive={false}
          />
          {hasTemp && (
            <Line
              yAxisId="temp"
              type="monotone"
              dataKey="temp"
              stroke="#ff7300"
              dot={false}
              name="Temperature"
              isAnimationActive={false}
            />
          )}
          <ClimbOverlay climbRanges={climbRanges} data={data} />
          {hoveredIndex !== null && data[hoveredIndex] != null && (
            <>
              <ReferenceLine
                x={data[hoveredIndex].distance}
                yAxisId="elevation"
                stroke="#aaa"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <ReferenceDot
                x={data[hoveredIndex].distance}
                y={data[hoveredIndex].elevation}
                yAxisId="elevation"
                r={4}
                fill="#2d5a27"
                stroke="white"
                strokeWidth={2}
              />
            </>
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default React.memo(ElevationChart);
```

- [ ] **Step 4: Run tests to verify they all pass**

```bash
npx vitest run src/components/ElevationChart.test.tsx
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/ElevationChart.tsx src/components/ElevationChart.test.tsx
git commit -m "feat: add temperature line to elevation chart with right Y-axis"
```

---

## Task 3: Wire up App.tsx and fix App tests

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Update `App.tsx`**

Make the following changes to `src/App.tsx`:

**a) Remove the `TEMP_LINE` constant** (lines 19–21):

```ts
// DELETE these three lines:
const TEMP_LINE: WeatherLineConfig = {
  label: 'Temp', color: '#ff7300', format: (v) => `${Math.round(v)}°C`, yAxisId: 'left',
};
```

**b) Update the `elevationData` memo** to include `temp` (currently around line 73):

```ts
const elevationData = useMemo(
  () => chartData.map(({ distance, elevation, temp }) => ({ distance, elevation, temp })),
  [chartData]
);
```

**c) Replace the `tempWindData` memo** with `windData` (currently around line 78):

```ts
// DELETE:
// const tempWindData = useMemo(
//   () => chartData.map(({ time, distance, temp, windSpeed }) => ({ time, distance, line1: temp, line2: windSpeed })),
//   [chartData]
// );

// ADD:
const windData = useMemo(
  () => chartData.map(({ time, distance, windSpeed }) => ({ time, distance, line1: windSpeed })),
  [chartData]
);
```

**d) Update the first weather sub-chart** in the JSX (find the `<div ... style={{ height: 80 }}>` containing the temp+wind `WeatherLineChart`):

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
```

**e) Update the second weather sub-chart** (precip) height:

```tsx
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

- [ ] **Step 2: Update `App.test.tsx`**

The existing mock identifies charts by `line1Config.label === 'Temp'` and uses `data-testid="tempwind-chart"`. After the change the wind chart uses `WIND_LINE` (label `'Wind'`). Update the mock and all references.

**a) Rename the capture variable** at the top of the file (line 33):

```ts
// BEFORE:
let capturedTempWindData: Array<{ line1?: number; line2?: number }> = [];
// AFTER:
let capturedWindData: Array<{ line1?: number; line2?: number }> = [];
```

**b) Update the `WeatherLineChart` mock** (around line 95):

```tsx
vi.mock('./components/WeatherLineChart', () => ({
  default: ({ data, line1Config, weatherAvailable }: {
    data: Array<{ line1?: number; line2?: number; time: number; distance: number }>;
    line1Config: { label: string };
    line2Config?: { label: string };
    hoveredIndex: number | null;
    onHoverIndex: (index: number | null) => void;
    weatherAvailable: boolean | null;
  }) => {
    const isWind = line1Config.label === 'Wind';
    if (isWind) {
      capturedWindData = data;
    } else {
      capturedPrecipData = data;
    }
    return (
      <div
        data-testid={isWind ? 'wind-chart' : 'precip-chart'}
        data-weather-available={String(weatherAvailable)}
      />
    );
  },
}));
```

**c) Reset the renamed variable in `beforeEach`** (around line 155):

```ts
// BEFORE:
capturedTempWindData = [];
// AFTER:
capturedWindData = [];
```

**d) Update all test references** — replace every occurrence of `tempwind-chart` with `wind-chart` and `capturedTempWindData` with `capturedWindData` throughout the file. Affected tests:

- `'shows upload button and no stats panel initially'` — `queryByTestId('tempwind-chart')` → `queryByTestId('wind-chart')`
- `'upload shows route stats, map, and charts'` — `getByTestId('tempwind-chart')` → `getByTestId('wind-chart')`
- `'changing avg speed re-fetches weather and updates charts'` — two occurrences
- `'weather precipProb flows from service through chart data'` — one occurrence
- `'weather precipitation flows from service through chart data'` — one occurrence
- `'changing start date re-fetches weather and updates display'` — one occurrence
- `'parse error shows alert...'` — `queryByTestId('tempwind-chart')` → `queryByTestId('wind-chart')`
- `'passes weatherAvailable=true to TempWindChart...'` — test description + `getByTestId('tempwind-chart')`
- `'passes weatherAvailable=false to TempWindChart...'` — test description + `getByTestId('tempwind-chart')`

- [ ] **Step 3: Run all tests**

```bash
npx vitest run
```

Expected: 14 test files, all passing.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat: wire temp into elevation chart, wind-only sub-chart at 40px"
```
