# Climbs Visual Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat ReferenceArea/ReferenceLine climb markers with a `ClimbOverlay` component that renders gradient fills clipped below the elevation profile, highlighted strokes within climb spans, and interactive pill-badge flags at each climb peak.

**Architecture:** A `ClimbOverlay` component renders inside `ComposedChart` as a `<Customized>` element. Recharts injects `formattedGraphicalItems` (pixel positions of elevation points) and `offset` (plot area bounds) so ClimbOverlay can build an SVG clip path and paint all three layers without a separate DOM layer. `WeatherTimeline` holds `hoveredClimbIdx` state and passes it down.

**Tech Stack:** React, TypeScript, Recharts v2, SVG

---

## File Structure

| File | Change |
|------|--------|
| `src/components/ClimbOverlay.tsx` | CREATE — all climb SVG rendering (fills, strokes, flags, popup) |
| `src/components/WeatherTimeline.tsx` | MODIFY — export `ClimbTimeRange`, add hover state, wire `<Customized>`, delete old renderers |

---

### Task 1: Wire up ClimbOverlay stub

Export the `ClimbTimeRange` type from `WeatherTimeline`, remove the old climb renderers, and wire in a no-op `ClimbOverlay` via `<Customized>` so the interface is established before any visual work begins.

**Files:**
- Create: `src/components/ClimbOverlay.tsx`
- Modify: `src/components/WeatherTimeline.tsx`

- [ ] **Step 1: Create stub ClimbOverlay.tsx**

Create `src/components/ClimbOverlay.tsx`:

```tsx
import React from 'react';
import type { ClimbTimeRange } from './WeatherTimeline';

interface ClimbOverlayProps {
  climbTimeRanges: ClimbTimeRange[];
  hoveredClimbIdx: number | null;
  onHoverClimb: (idx: number | null) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  formattedGraphicalItems?: any[];
  offset?: { top: number; left: number; width: number; height: number };
}

const ClimbOverlay: React.FC<ClimbOverlayProps> = () => null;

export default ClimbOverlay;
```

- [ ] **Step 2: Replace WeatherTimeline.tsx**

Replace the entire file. Key changes vs. current: add `Customized` to recharts import (remove `ReferenceArea`, `ReferenceLine`); export `ClimbTimeRange`; add `hoveredClimbIdx` state; import `ClimbOverlay`; delete `ClimbPeakLabel`; replace the two climb renderer blocks with a single `<Customized>`.

```tsx
import React, { useMemo, useState } from 'react';
import { ComposedChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, Customized } from 'recharts';
import type { RouteData } from '../utils/gpxParser';
import { lttbWithPinnedPoints } from '../utils/lttb';
import type { Climb } from '../utils/climbDetector';
import ClimbOverlay from './ClimbOverlay';

interface WeatherTimelineProps {
  route: RouteData;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  weatherPoints: any[];
  onHoverDistance: (distanceKm: number | null) => void;
  xAxisMode: 'clock' | 'elapsed';
  weatherAvailable?: boolean | null;
  avgSpeed: number;
  startTime: Date;
  climbs?: Climb[];
}

export interface ClimbTimeRange extends Climb {
  x1: number;
  x2: number;
}

function formatElapsed(ms: number): string {
  const totalMinutes = Math.round(ms / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

const WeatherTimeline: React.FC<WeatherTimelineProps> = ({ route, weatherPoints, onHoverDistance, xAxisMode, weatherAvailable, avgSpeed, startTime, climbs }) => {
  const [chartWidth, setChartWidth] = useState(800);
  const [hoveredClimbIdx, setHoveredClimbIdx] = useState<number | null>(null);

  const climbTimeRanges = useMemo((): ClimbTimeRange[] => {
    if (!climbs || climbs.length === 0 || avgSpeed <= 0) return [];
    const startMs = startTime.getTime();
    const speedFactor = avgSpeed * 1000;
    const domainMax = startMs + (route.totalDistance / speedFactor) * 3_600_000;
    return climbs.map(climb => ({
      ...climb,
      x1: Math.max(startMs, Math.min(startMs + (climb.startDistance / speedFactor) * 3_600_000, domainMax)),
      x2: Math.max(startMs, Math.min(startMs + (climb.endDistance / speedFactor) * 3_600_000, domainMax)),
    }));
  }, [climbs, startTime, avgSpeed, route.totalDistance]);

  const data = useMemo(() => {
    const d = route.points.map(pt => ({
      distance: pt.distance / 1000,
      elevation: Math.round(pt.ele),
      temp: undefined as number | undefined,
      precipProb: undefined as number | undefined,
      precipitation: undefined as number | undefined,
      time: startTime.getTime() + (pt.distance / (avgSpeed * 1000)) * 3_600_000,
      isSample: false,
      weatherIdx: undefined as number | undefined,
    }));

    weatherPoints.forEach((wp, wIdx) => {
      const rIdx = route.points.indexOf(wp.point);
      if (rIdx >= 0) {
        d[rIdx].temp = wp.temp;
        d[rIdx].precipProb = wp.precipProb;
        d[rIdx].precipitation = wp.precipitation;
        d[rIdx].time = wp.arrivalTime.getTime();
        d[rIdx].isSample = true;
        d[rIdx].weatherIdx = wIdx;
      }
    });

    const downsampled = lttbWithPinnedPoints(
      d,
      Math.max(chartWidth, weatherPoints.length),
      p => p.isSample,
      p => p.distance,
      p => p.elevation
    );

    const sampleIdxs = downsampled
      .map((p, i) => (p.isSample ? i : -1))
      .filter(i => i >= 0)
      .sort((a, b) => a - b);
    for (let i = 0; i < sampleIdxs.length - 1; i++) {
      const lo = sampleIdxs[i], hi = sampleIdxs[i + 1];
      const tLo = downsampled[lo].temp, tHi = downsampled[hi].temp;
      const ppLo = downsampled[lo].precipProb, ppHi = downsampled[hi].precipProb;
      const pLo = downsampled[lo].precipitation, pHi = downsampled[hi].precipitation;
      const timeLo = downsampled[lo].time, timeHi = downsampled[hi].time;
      if (tLo == null || tHi == null || ppLo == null || ppHi == null ||
          pLo == null || pHi == null || timeLo == null || timeHi == null) continue;
      for (let j = lo + 1; j < hi; j++) {
        const t = (j - lo) / (hi - lo);
        downsampled[j].temp = tLo + (tHi - tLo) * t;
        downsampled[j].precipProb = ppLo + (ppHi - ppLo) * t;
        downsampled[j].precipitation = pLo + (pHi - pLo) * t;
        downsampled[j].time = timeLo + (timeHi - timeLo) * t;
      }
    }

    return downsampled;
  }, [route, weatherPoints, chartWidth, avgSpeed, startTime]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <ResponsiveContainer width="100%" height="100%" onResize={(w) => setChartWidth(w)}>
        <ComposedChart
          data={data}
          margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
          onMouseMove={(state) => {
            const rIdx = state.activeTooltipIndex != null ? Number(state.activeTooltipIndex) : NaN;
            if (isNaN(rIdx) || !data[rIdx]) { onHoverDistance(null); return; }
            onHoverDistance(data[rIdx].distance);
          }}
          onMouseLeave={() => onHoverDistance(null)}
        >
          <defs>
            <linearGradient id="colorEle" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2d5a27" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#2d5a27" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
          <XAxis
            dataKey="time"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(v) => xAxisMode === 'clock'
              ? new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : formatElapsed(v - (data[0]?.time ?? v))
            }
            fontSize={11}
            tickLine={false}
            axisLine={false}
            stroke="#888"
          />
          <YAxis
            yAxisId="elevation"
            domain={[(dataMin: number) => dataMin - 10, 'auto']}
            axisLine={false}
            tickLine={false}
            fontSize={10}
            stroke="#888"
            tickFormatter={(v) => `${Math.round(v)}m`}
          />
          <YAxis
            yAxisId="temp"
            orientation="right"
            axisLine={false}
            tickLine={false}
            fontSize={10}
            stroke="#888"
            tickFormatter={(v) => `${Math.round(v)}°C`}
          />
          <YAxis
            yAxisId="precip"
            domain={[0, 100]}
            hide={true}
          />
          <Tooltip
            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
            labelFormatter={(label, payload) => {
              const km = (payload?.[0]?.payload?.distance as number | undefined)?.toFixed(1) ?? '?';
              const timeStr = xAxisMode === 'clock'
                ? new Date(Number(label)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : formatElapsed(Number(label) - (data[0]?.time ?? Number(label)));
              return `${timeStr} · ${km} km`;
            }}
            formatter={(value, name) => {
              if (name === 'Temp') return [`${Math.round(Number(value))}°C`, name];
              if (name === 'Precip Prob') return [`${Math.round(Number(value))}%`, name];
              if (name === 'Precip') return [`${Number(value).toFixed(1)} mm`, name];
              return [value, name];
            }}
          />
          <Area
            yAxisId="elevation"
            type="monotone"
            dataKey="elevation"
            stroke="#2d5a27"
            fillOpacity={1}
            fill="url(#colorEle)"
            name="Elevation"
            dot={false}
            isAnimationActive={false}
          />
          <Line
            yAxisId="temp"
            type="monotone"
            dataKey="temp"
            stroke="#ff7300"
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            dot={(props: any) => {
              if (!props.payload.isSample) return <g key={props.index} />;
              return <circle key={props.index} cx={props.cx} cy={props.cy} r={4} fill="#ff7300" stroke="white" strokeWidth={1.5} />;
            }}
            name="Temp"
            isAnimationActive={false}
          />
          <Line
            yAxisId="precip"
            type="monotone"
            dataKey="precipProb"
            stroke="#4A90D9"
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            dot={(props: any) => {
              if (!props.payload.isSample) return <g key={props.index} />;
              return <circle key={props.index} cx={props.cx} cy={props.cy} r={4} fill="#4A90D9" stroke="white" strokeWidth={1.5} />;
            }}
            name="Precip Prob"
            isAnimationActive={false}
          />
          <Line
            yAxisId="precip"
            type="monotone"
            dataKey="precipitation"
            stroke="none"
            strokeWidth={0}
            activeDot={false}
            dot={false}
            legendType="none"
            name="Precip"
            isAnimationActive={false}
          />
          <Customized
            component={ClimbOverlay}
            climbTimeRanges={climbTimeRanges}
            hoveredClimbIdx={hoveredClimbIdx}
            onHoverClimb={setHoveredClimbIdx}
          />
        </ComposedChart>
      </ResponsiveContainer>
      {weatherAvailable === false && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <span style={{ color: '#888', fontSize: '0.875rem', fontWeight: 500 }}>
            Weather data unavailable for the selected date
          </span>
        </div>
      )}
    </div>
  );
};

export default React.memo(WeatherTimeline);
```

- [ ] **Step 3: Verify build and tests**

```bash
npx vitest run
```

Expected: all tests pass (114 passing).

```bash
npm run build
```

Expected: no TypeScript errors, build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/ClimbOverlay.tsx src/components/WeatherTimeline.tsx
git commit -m "refactor(WeatherTimeline): wire ClimbOverlay stub, extract ClimbTimeRange type"
```

---

### Task 2: Gradient fills clipped to elevation profile

Build the clip path from the elevation Area's rendered pixel points, then render per-climb gradient-filled rects constrained to that shape.

`formattedGraphicalItems[0].props.points` is the elevation Area — it is the first series in `ComposedChart` and Recharts populates `formattedGraphicalItems` with graphical series in render order (Area/Line/Bar only, not axes or grid). Each point has `{x, y, payload}` where x/y are absolute SVG pixel coordinates.

`offset` gives `{top, left, width, height}` of the plot area. `left + width` is the right edge in SVG coordinates.

**Files:**
- Modify: `src/components/ClimbOverlay.tsx`

- [ ] **Step 1: Replace stub with gradient fill implementation**

Replace the entire `src/components/ClimbOverlay.tsx`:

```tsx
import React from 'react';
import type { ClimbTimeRange } from './WeatherTimeline';
import type { Climb } from '../utils/climbDetector';

const CATEGORY_COLORS: Record<Climb['category'], string> = {
  Cat4: '#F5C518',
  Cat3: '#F5A623',
  Cat2: '#E8601C',
  Cat1: '#D0021B',
  HC:   '#7B0099',
};

const CATEGORY_FILL_OPACITY: Record<Climb['category'], number> = {
  Cat4: 0.30,
  Cat3: 0.40,
  Cat2: 0.50,
  Cat1: 0.60,
  HC:   0.70,
};

interface ElevPoint {
  x: number;
  y: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
}

interface ClimbOverlayProps {
  climbTimeRanges: ClimbTimeRange[];
  hoveredClimbIdx: number | null;
  onHoverClimb: (idx: number | null) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  formattedGraphicalItems?: any[];
  offset?: { top: number; left: number; width: number; height: number };
}

function timeToPixelX(time: number, points: ElevPoint[]): number {
  if (time <= points[0].payload.time) return points[0].x;
  if (time >= points[points.length - 1].payload.time) return points[points.length - 1].x;
  for (let i = 0; i < points.length - 1; i++) {
    const lo = points[i], hi = points[i + 1];
    if (time >= lo.payload.time && time <= hi.payload.time) {
      const t = (time - lo.payload.time) / (hi.payload.time - lo.payload.time);
      return lo.x + t * (hi.x - lo.x);
    }
  }
  return points[points.length - 1].x;
}

const ClimbOverlay: React.FC<ClimbOverlayProps> = ({
  climbTimeRanges,
  hoveredClimbIdx,
  onHoverClimb,
  formattedGraphicalItems,
  offset,
}) => {
  if (!formattedGraphicalItems?.length || !offset) return null;
  const elevPoints: ElevPoint[] = formattedGraphicalItems[0]?.props?.points ?? [];
  if (elevPoints.length < 2 || !climbTimeRanges.length) return null;

  const { top, left, width, height } = offset;
  const bottom = top + height;
  const right = left + width;

  const clipPoints = [
    ...elevPoints.map(p => `${p.x},${p.y}`),
    `${right},${bottom}`,
    `${left},${bottom}`,
  ].join(' ');

  return (
    <g>
      <defs>
        <clipPath id="climb-elev-clip">
          <polygon points={clipPoints} />
        </clipPath>
        {climbTimeRanges.map((cr, i) => (
          <linearGradient key={`grad-${i}`} id={`climb-grad-${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CATEGORY_COLORS[cr.category]} stopOpacity={CATEGORY_FILL_OPACITY[cr.category]} />
            <stop offset="100%" stopColor={CATEGORY_COLORS[cr.category]} stopOpacity={0} />
          </linearGradient>
        ))}
      </defs>

      {/* Gradient fills clipped to below the elevation profile */}
      {climbTimeRanges.map((cr, i) => {
        const px1 = timeToPixelX(cr.x1, elevPoints);
        const px2 = timeToPixelX(cr.x2, elevPoints);
        return (
          <rect
            key={`fill-${i}`}
            x={px1}
            y={top}
            width={Math.max(0, px2 - px1)}
            height={height}
            fill={`url(#climb-grad-${i})`}
            clipPath="url(#climb-elev-clip)"
          />
        );
      })}
    </g>
  );
};

export default ClimbOverlay;
```

- [ ] **Step 2: Start dev server and visually verify**

```bash
npm run dev
```

Open http://localhost:5173. Load a GPX file with hills. Expected:
- Each climb span has a colored gradient fill that stops at the elevation line (not the full chart height).
- Cat 4 fill is faint yellow. HC fill is a deeper purple. The opacity gradient goes from stronger at top to transparent at bottom.
- The green elevation fill and temperature/precipitation lines are unchanged.

If no fills appear at all, open browser DevTools → Console and check for errors from ClimbOverlay (e.g. `formattedGraphicalItems` being undefined).

- [ ] **Step 3: Run tests**

```bash
npx vitest run
```

Expected: all 114 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/ClimbOverlay.tsx
git commit -m "feat(ClimbOverlay): gradient fills clipped to elevation profile"
```

---

### Task 3: Highlighted elevation strokes within climb spans

Filter the elevation points to those within each climb's time range and render a colored polyline over the existing green Area stroke.

**Files:**
- Modify: `src/components/ClimbOverlay.tsx`

- [ ] **Step 1: Add highlighted strokes to the return block**

The return block in `ClimbOverlay` currently has `<defs>` and the fills map. Add the strokes map after the fills, inside the same `<g>`. Replace only the `return (...)` block — everything above `return` stays identical:

```tsx
  return (
    <g>
      <defs>
        <clipPath id="climb-elev-clip">
          <polygon points={clipPoints} />
        </clipPath>
        {climbTimeRanges.map((cr, i) => (
          <linearGradient key={`grad-${i}`} id={`climb-grad-${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CATEGORY_COLORS[cr.category]} stopOpacity={CATEGORY_FILL_OPACITY[cr.category]} />
            <stop offset="100%" stopColor={CATEGORY_COLORS[cr.category]} stopOpacity={0} />
          </linearGradient>
        ))}
      </defs>

      {/* Gradient fills */}
      {climbTimeRanges.map((cr, i) => {
        const px1 = timeToPixelX(cr.x1, elevPoints);
        const px2 = timeToPixelX(cr.x2, elevPoints);
        return (
          <rect
            key={`fill-${i}`}
            x={px1}
            y={top}
            width={Math.max(0, px2 - px1)}
            height={height}
            fill={`url(#climb-grad-${i})`}
            clipPath="url(#climb-elev-clip)"
          />
        );
      })}

      {/* Highlighted strokes over elevation line within climb spans */}
      {climbTimeRanges.map((cr, i) => {
        const spanPoints = elevPoints.filter(
          p => p.payload.time >= cr.x1 && p.payload.time <= cr.x2
        );
        if (spanPoints.length < 2) return null;
        return (
          <polyline
            key={`stroke-${i}`}
            points={spanPoints.map(p => `${p.x},${p.y}`).join(' ')}
            stroke={CATEGORY_COLORS[cr.category]}
            strokeWidth={2.5}
            fill="none"
          />
        );
      })}
    </g>
  );
```

- [ ] **Step 2: Visual verification**

The elevation line within each climb span should now appear thicker and in the category color (e.g. orange-red for Cat 2). Outside climb spans the original 1.5px green line from the Area component remains. If a climb span shows no colored stroke, check that the elevation data points include points in that time range (LTTB downsampling keeps sample points, so this should always work for reasonable routes).

- [ ] **Step 3: Run tests**

```bash
npx vitest run
```

Expected: all 114 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/ClimbOverlay.tsx
git commit -m "feat(ClimbOverlay): highlighted elevation strokes within climb spans"
```

---

### Task 4: Pill flags at climb peaks

Add a `CATEGORY_LABELS` constant and render a dashed pole + rounded pill badge at each climb peak (the point nearest to `x2`).

**Files:**
- Modify: `src/components/ClimbOverlay.tsx`

- [ ] **Step 1: Add CATEGORY_LABELS constant**

After the `CATEGORY_FILL_OPACITY` const block, add:

```ts
const CATEGORY_LABELS: Record<Climb['category'], string> = {
  Cat4: 'Cat 4',
  Cat3: 'Cat 3',
  Cat2: 'Cat 2',
  Cat1: 'Cat 1',
  HC:   'HC',
};
```

- [ ] **Step 2: Add pill flag rendering to the return block**

After the highlighted strokes map, inside the same `<g>`, add:

```tsx
      {/* Pill flags at climb peak */}
      {climbTimeRanges.map((cr, i) => {
        const peakPt = elevPoints.reduce((best, p) =>
          Math.abs(p.payload.time - cr.x2) < Math.abs(best.payload.time - cr.x2) ? p : best
        , elevPoints[0]);
        const peakPx = peakPt.x;
        const peakPy = peakPt.y;
        const color = CATEGORY_COLORS[cr.category];
        const label = CATEGORY_LABELS[cr.category];
        const badgeWidth = label.length <= 2 ? 28 : 42;
        const badgeHeight = 16;
        const poleHeight = 28;
        const bx = Math.min(
          Math.max(peakPx, left + badgeWidth / 2 + 2),
          right - badgeWidth / 2 - 2
        );
        const badgeTop = peakPy - poleHeight - badgeHeight;
        return (
          <g key={`flag-${i}`} style={{ cursor: 'default' }}>
            <line
              x1={peakPx} y1={peakPy}
              x2={peakPx} y2={peakPy - poleHeight}
              stroke={color}
              strokeWidth={1.5}
              strokeDasharray="3 2"
            />
            <rect
              x={bx - badgeWidth / 2}
              y={badgeTop}
              width={badgeWidth}
              height={badgeHeight}
              rx={8}
              fill={color}
            />
            <text
              x={bx}
              y={badgeTop + badgeHeight - 4}
              textAnchor="middle"
              fill="white"
              fontSize={10}
              fontWeight="bold"
            >
              {label}
            </text>
          </g>
        );
      })}
```

- [ ] **Step 3: Visual verification**

Each climb peak should now show a small dashed vertical line rising from the elevation profile with a colored pill badge above it (e.g. "Cat 2" in orange-red). Near chart edges, the badge should shift horizontally to stay visible while the pole stays at the peak pixel.

- [ ] **Step 4: Run tests**

```bash
npx vitest run
```

Expected: all 114 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/ClimbOverlay.tsx
git commit -m "feat(ClimbOverlay): pill flag at climb peak with dashed pole"
```

---

### Task 5: Hover popup on pill flag

Add `onMouseEnter` / `onMouseLeave` handlers to each flag group and render a popup tooltip when hovered, showing length and average grade.

**Files:**
- Modify: `src/components/ClimbOverlay.tsx`

- [ ] **Step 1: Replace the pill flags block with the version that includes hover handlers and popup**

Replace the entire `{/* Pill flags at climb peak */}` block (from Task 4) with:

```tsx
      {/* Pill flags at climb peak */}
      {climbTimeRanges.map((cr, i) => {
        const peakPt = elevPoints.reduce((best, p) =>
          Math.abs(p.payload.time - cr.x2) < Math.abs(best.payload.time - cr.x2) ? p : best
        , elevPoints[0]);
        const peakPx = peakPt.x;
        const peakPy = peakPt.y;
        const color = CATEGORY_COLORS[cr.category];
        const label = CATEGORY_LABELS[cr.category];
        const badgeWidth = label.length <= 2 ? 28 : 42;
        const badgeHeight = 16;
        const poleHeight = 28;
        const bx = Math.min(
          Math.max(peakPx, left + badgeWidth / 2 + 2),
          right - badgeWidth / 2 - 2
        );
        const badgeTop = peakPy - poleHeight - badgeHeight;

        const popupWidth = 96;
        const popupHeight = 28;
        const popupX = peakPx + 4 + popupWidth > right - 4
          ? peakPx - 4 - popupWidth
          : peakPx + 4;
        const popupY = badgeTop - popupHeight - 2;
        const lengthKm = (cr.lengthM / 1000).toFixed(1);
        const grade = cr.avgGrade.toFixed(1);

        return (
          <g
            key={`flag-${i}`}
            onMouseEnter={() => onHoverClimb(i)}
            onMouseLeave={() => onHoverClimb(null)}
            style={{ cursor: 'default' }}
          >
            <line
              x1={peakPx} y1={peakPy}
              x2={peakPx} y2={peakPy - poleHeight}
              stroke={color}
              strokeWidth={1.5}
              strokeDasharray="3 2"
            />
            <rect
              x={bx - badgeWidth / 2}
              y={badgeTop}
              width={badgeWidth}
              height={badgeHeight}
              rx={8}
              fill={color}
            />
            <text
              x={bx}
              y={badgeTop + badgeHeight - 4}
              textAnchor="middle"
              fill="white"
              fontSize={10}
              fontWeight="bold"
            >
              {label}
            </text>
            {hoveredClimbIdx === i && (
              <g>
                <rect
                  x={popupX}
                  y={popupY}
                  width={popupWidth}
                  height={popupHeight}
                  rx={5}
                  fill="white"
                  style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.18))' }}
                />
                <text x={popupX + 8} y={popupY + 18} fontSize={11} fill="#444">
                  {lengthKm} km · {grade}%
                </text>
              </g>
            )}
          </g>
        );
      })}
```

- [ ] **Step 2: Visual verification — hover interaction**

In the dev server:
1. Hover over a pill badge. A small white card should appear showing e.g. "8.9 km · 5.6%".
2. Move the mouse off the badge — popup disappears.
3. Test a climb near the right edge of the chart — popup should appear to the left of the badge.
4. Test with no climbs loaded (flat route or no GPX) — chart should look identical to before.

- [ ] **Step 3: Run full test suite**

```bash
npx vitest run
```

Expected: all 114 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/ClimbOverlay.tsx
git commit -m "feat(ClimbOverlay): hover popup on pill flag showing length and grade"
```
