# Recharts Migration for WindArrowRow and PrecipBarRow

## Context

`WindArrowRow` and `PrecipBarRow` are raw SVG components that sit below the Recharts-based `ElevationChart`. To align with ElevationChart's plot area, both components duplicate the same magic constants (`PLOT_LEFT = 55`, `PLOT_RIGHT_OFFSET = 55`) and manually implement the same coordinate mapping function (`xOf`). This creates two risks:

- **Misalignment**: if ElevationChart's margins or axis widths change, the constants in the two row components silently go out of sync
- **Duplication**: both components repeat identical boilerplate for coordinate math, prop shapes, and the hover line

The fix is to convert both rows to use Recharts `ComposedChart` with the same margin and axis configuration as `ElevationChart`, delegating coordinate mapping to Recharts and eliminating the duplicated constants.

## Shared Constants

Extract two constants from `ElevationChart.tsx` into the same file as named exports:

```ts
export const CHART_MARGIN_LEFT = 10;    // margin.left in ComposedChart
export const CHART_YAXIS_LEFT_WIDTH = 45; // width of the left YAxis
```

`ElevationChart` already uses these values — the refactor just makes them explicit. The combined left offset is always `55px` regardless of whether the temperature axis is present, because when `hasTemp=true` the right axis (width 45) + `margin.right=10` also totals 55px. The rows therefore always use `margin.right=55` with no right axis and remain aligned in both cases.

## WindArrowRow

**Props dropped:** `chartWidth` — `ResponsiveContainer` handles width internally.

**Props kept:** `samplePoints`, `distanceRange`, `hoveredDistance`.

**Implementation:**
- Wrap in `ResponsiveContainer width="100%" height="100%"`
- Use `ComposedChart margin={{ top: 0, right: 55, left: CHART_MARGIN_LEFT, bottom: 0 }}`
- Add `<XAxis hide type="number" dataKey="distance" domain={distanceRange} />`
- Add `<YAxis hide width={CHART_YAXIS_LEFT_WIDTH} />`
- Render wind arrows and speed labels via `<Customized component={WindArrows} />` — the custom component receives `xAxisMap` from Recharts and uses `xAxisMap[0].scale(pt.distance)` instead of the manual `xOf` function
- Render the hover vertical line via `<ReferenceLine x={hoveredDistance} stroke="#aaa" strokeDasharray="3 3" />`
- Arrow `<g>` elements keep the `data-arrow="true"` attribute for test compatibility

## PrecipBarRow

**Props dropped:** `chartWidth`.

**Props kept:** `samplePoints`, `distanceRange`, `hoveredDistance`.

**Implementation:**
- Same `ResponsiveContainer` / `ComposedChart` / axis setup as WindArrowRow
- Render precip bars via `<Customized component={PrecipBars} />` — custom component receives `xAxisMap` and reproduces the same edge-spanning bar logic using `xAxisMap[0].scale` instead of `xOf`
- Each `<rect>` gets `data-testid="precip-bar"` to distinguish it from any Recharts-internal rects
- Render hover line via `<ReferenceLine>`

## App.tsx

Remove the `chartWidth` and `onResize` wiring for both rows. `distanceRange` remains — it's the x-axis domain and the rows only receive 11 sample points, not the full route.

Wait — `onResize` feeds `chartWidth` into `App` state which is then passed to the rows. After the migration, `chartWidth` is only needed if anything else consumes it. Check: `ElevationChart` still calls `onResize={setChartWidth}` for its own `ResponsiveContainer`, but if `chartWidth` is no longer passed to the rows, the state and handler may become dead code. Verify and remove if unused.

## Tests

**WindArrowRow tests:**
- Remove `chartWidth={800}` from all render calls
- Recharts renders SVG differently in jsdom (no layout engine), so `ResponsiveContainer` collapses to zero size. Mock it: `vi.mock('recharts', ...)` with a pass-through or use `resizeObserverMock`. Alternatively, switch to rendering the inner `ComposedChart` directly by exporting it — but this leaks internals. Preferred: mock `ResizeObserver` and set a fixed container size via `Object.defineProperty`.
- Keep existing behavioral assertions (`data-arrow` count, rotation angle, speed label text) — these survive the migration since the custom SVG elements are preserved inside `<Customized>`
- Update the baseline line test: the dashed line is now a Recharts `<ReferenceLine>` — query it or drop the test if the baseline moves to a simple CSS border

**PrecipBarRow tests:**
- Remove `chartWidth={800}`
- Replace `container.querySelectorAll('rect')` with `container.querySelectorAll('[data-testid="precip-bar"]')` to avoid counting Recharts internal rects
- Keep opacity and height comparison assertions — these test the data-driven logic, which is unchanged

## Verification

1. `npx vitest run` — all unit tests pass
2. `npm run dev` → open the elevation panel with a GPX loaded — wind arrows and precip bars visually align with the elevation chart's x-axis
3. Hover over the chart — the vertical line extends through all three rows in sync
4. Toggle a route with temperature data vs. without — alignment holds in both cases
5. Resize the browser window — all three rows remain aligned
