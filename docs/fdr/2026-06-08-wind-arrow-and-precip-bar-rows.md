# FDR: Directional wind arrows and precipitation bars replace the wind/precip line rows

**Date:** 2026-06-08
**Status:** Shipped
**Related:** [design spec](../superpowers/specs/done/2026-06-07-wind-precip-row-design.md), [ADR: Render wind/precip rows as hand-built SVG instead of Recharts](../adr/2026-06-08-svg-wind-precip-rows.md), [FDR: Move temperature into the elevation chart](2026-06-07-temp-into-elevation-chart.md)

## Problem

The wind and precip sub-charts were thin line charts: a wind-speed-only
line (direction wasn't shown at all), and a two-line precip
probability/amount chart whose two overlapping lines didn't read
intuitively at a glance.

## Decision (highlights)

- `WindArrowRow` draws a rotated arrow at each weather sample point, angled
  to the meteorological wind direction (arrow points toward the wind's
  source; 0°/north = straight up), with a rounded speed label under each
  arrow.
- `PrecipBarRow` draws one bar per inter-sample segment: bar height encodes
  precipitation amount (scaled to the route's worst segment), bar opacity
  encodes precipitation probability — both dimensions visible in one mark.
- Both rows render nothing when there are no sample points, replacing the
  separate `weatherAvailable` state that used to gate an overlay message on
  the old line charts.
- `WeatherLineChart` and its test file are deleted as dead code once both
  remaining callers (wind, precip) migrate off it.

## Outcome vs. spec

Matches the 2026-06-07 wind/precip-row design spec, including its decision
log (arrow-points-toward-source convention; height = amount, opacity =
probability bar encoding). The same PR also adds an unrelated `windDeg`
interpolation accuracy TODO and a map-card min-height CSS fix, bundled in
rather than split out as separate changes.
