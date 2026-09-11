# ADR: Render wind/precip rows as hand-built SVG instead of Recharts

**Date:** 2026-06-08
**Status:** Accepted
**Related:** [design spec](../superpowers/specs/done/2026-06-07-wind-precip-row-design.md), [FDR: Directional wind arrows and precipitation bars replace the wind/precip line rows](../fdr/2026-06-08-wind-arrow-and-precip-bar-rows.md)

## Context

The wind and precipitation sub-charts under the elevation chart were
`WeatherLineChart` instances — thin Recharts `LineChart`s with axes hidden
(`hideAxes`), synced to the elevation chart's hover via a shared
`hoveredIndex`. Recharts' `Line`/`YAxis` primitives have no mark for a
rotated directional glyph (wind arrows) or a bar whose width follows
uneven inter-sample gaps (precipitation) — both needed per-point geometry
outside what Recharts' declarative chart model offers.

## Decision

- `WindArrowRow` and `PrecipBarRow` render a raw `<svg>` inside a 40px-tall
  `div`, with x-coordinates computed by hand (`plotLeft = 55`,
  `plotRight = chartWidth - 55`) to match Recharts' own margin math on the
  elevation chart above, rather than routing through any charting library.
- Wind direction renders as an SVG `<g transform="rotate(deg, cx, cy)">`
  arrow — an exact-angle primitive Recharts doesn't expose — with a speed
  label under each arrow.
- Precipitation renders as one `<rect>` per inter-sample segment (N+1 bars
  for N samples), height mapped to amount and opacity mapped to
  probability, so two data dimensions render in a single mark instead of
  two overlapping lines.
- `WeatherLineChart` itself is left in the tree (not deleted, since nothing
  else used it yet at this point), but both of its remaining callers (wind,
  precip) are removed by this change; it and its test file are deleted
  outright once that leaves it with zero callers.

## Alternatives considered

- **Keep `WeatherLineChart`** with two separate lines for wind speed and
  direction — rejected per the design spec: a line can show position, not
  rotation-as-direction or bar semantics.
- **A Recharts `Scatter` layer with a custom `shape` render prop** — not
  evaluated in the spec; the chosen approach bypasses Recharts for these
  two rows entirely rather than working around its API for one custom mark
  type.

## Consequences

- Alignment between the SVG rows and the Recharts elevation chart above is
  maintained by duplicating the same margin numbers (55px) in both places
  rather than sharing a layout constant — a future change to the elevation
  chart's margins would silently desync the rows underneath it.
- Losing Recharts' built-in hover/tooltip wiring for these two rows means
  hover sync is wired manually via the shared `hoveredIndex` prop — the
  same mechanism already used for hover sync across the split chart set
  introduced by the 2026-06-05 chart-split redesign.
