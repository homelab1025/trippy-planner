# FDR: Move temperature into the elevation chart, shrink weather sub-charts to 40px

**Date:** 2026-06-07
**Status:** Shipped
**Related:** [design spec](../superpowers/specs/done/2026-06-07-temp-in-elevation-chart-design.md), [FDR: Move the temp+wind chart into the main elevation card](2026-06-06-tempwind-chart-into-main-card.md)

## Problem

The temp+wind sub-chart (moved into the main card the day before) still read
temperature as a separate line sharing an axis with wind speed, one visual
step removed from the elevation profile it correlates with most directly.

## Decision (highlights)

- Temperature moves out of the temp+wind sub-chart and into `ElevationChart`
  itself, as a `Line` on a new right-hand Y-axis (`°C`), rendered only when
  the data actually has `temp` values (`hasTemp` guard).
- The now temp-less sub-chart becomes wind-only, and both remaining weather
  sub-charts (wind, precip) shrink from 80px to 40px.
- `WeatherLineChart`'s `line2`/`line2Config` become optional so a caller (the
  new wind-only row) can render a single line without a second axis.

## Outcome vs. spec

Matches the 2026-06-07 temp-in-elevation-chart design spec. The same commit
also fixed an unrelated chart-alignment bug (right boundaries drifting the
hover crosshair) — a side-fix bundled into the change, not a decision of
this record.

**Note (2026-06-08):** the wind-only sub-chart this record shrank to 40px
was itself replaced the next day by a purpose-built `WindArrowRow`, and the
precip sub-chart by `PrecipBarRow` — see [FDR: Directional wind arrows and
precipitation bars](2026-06-08-wind-arrow-and-precip-bar-rows.md). The
temperature-into-elevation-chart decision above was not affected and is
still the current layout.
