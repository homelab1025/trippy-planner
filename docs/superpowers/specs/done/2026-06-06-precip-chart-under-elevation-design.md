# Precip Chart Under Elevation — Design

**Date:** 2026-06-06

## Goal

Move the precipitation/probability chart from the sidebar Weather accordion into the main elevation card, positioned directly below the elevation chart. The vertical hover line from the elevation chart extends visually into the precip chart. No axes are drawn on the precip chart — values are already shown in the HoverPane on the right.

## Card Structure (`App.tsx`)

The elevation+hover card changes layout:

**Before:**
```
card [h-[350px] flex-row]
├── ElevationChart (flex-1)
└── HoverPane (110px)
```

**After:**
```
card [flex-shrink-0 flex-row]  ← drop fixed height
├── flex-col flex-1 min-w-0
│   ├── ElevationChart      h-[300px]
│   ├── div border-t border-base-200
│   └── PrecipChart         h-[80px]   (WeatherLineChart with hideAxes=true)
└── HoverPane (110px, self-stretch)
```

The precip chart uses existing `precipData` (precipProb + precipitation), already computed in `App.tsx`. No new data derivation needed.

The temp/wind chart remains in the sidebar Weather accordion, unchanged.

## WeatherLineChart Changes

Add optional prop `hideAxes?: boolean`.

When `hideAxes={true}`:
- Do not render `XAxis`
- Render both `YAxis` components with `hide={true}` (keep them in the tree so Recharts reserves axis space and the plot area X extent stays consistent with the elevation chart above)
- Do not render `CartesianGrid`
- Set chart `margin` to `{ top: 4, right: 10, left: 10, bottom: 0 }` (vs default `{ top: 10, right: 10, left: 10, bottom: 0 }`)

Note: the left YAxis auto-width will approximately match the elevation chart's YAxis width, giving near-pixel hover line alignment. Exact alignment is not guaranteed without a fixed `width` on both axes, but the visual result is close enough given the chart heights.

When `hideAxes` is `false` or omitted: no change to existing behaviour.

`ReferenceLine` (hover indicator) is always rendered regardless of `hideAxes`.

The `weatherAvailable === false` overlay text is always rendered regardless of `hideAxes`.

## Hover Line Continuity

Both `ElevationChart` and the precip `WeatherLineChart` receive the same `hoveredIndex` prop. Both draw a `ReferenceLine` at `data[hoveredIndex].time`. Since both charts share the same time domain and the same left/right margins, the lines visually align — producing a single continuous vertical indicator across the two stacked charts within the same card.

## Sidebar Weather Accordion

The precip `WeatherLineChart` is removed from the sidebar. The temp/wind `WeatherLineChart` remains. If the accordion only has one chart, reduce its height container from two `h-[180px]` blocks to a single `h-[180px]` block.

## Affected Files

- `src/components/WeatherLineChart.tsx` — add `hideAxes` prop
- `src/App.tsx` — restructure elevation card, add precip chart inside it, remove precip from sidebar
