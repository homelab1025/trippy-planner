# FDR: Move the precipitation chart under the elevation chart

**Date:** 2026-06-06
**Status:** Shipped
**Related:** [design spec](../superpowers/specs/done/2026-06-06-precip-chart-under-elevation-design.md)

## Problem

The precipitation chart lived in the sidebar Weather accordion, visually
disconnected from the elevation profile it should be read alongside.

## Decision (highlights)

- The precip chart moves into the main elevation card, stacked directly
  below `ElevationChart` (300px elevation + 80px precip, divided by a thin
  border), instead of living in the sidebar.
- Both charts share the same `hoveredIndex`, so their `ReferenceLine` hover
  indicators land at the same pixel position and read as one continuous
  vertical line spanning both stacked charts.
- `WeatherLineChart` gains a `hideAxes` prop: no `XAxis`/`CartesianGrid`, but
  both `YAxis` elements stay in the tree (just hidden) so Recharts still
  reserves the same axis width the elevation chart above uses — keeping the
  plot areas aligned without a shared layout component.
- The temp/wind chart is left in the sidebar accordion for now — that
  placement was undone separately the same day, see [FDR: Move the temp+wind
  chart into the main elevation card](2026-06-06-tempwind-chart-into-main-card.md).

## Outcome vs. spec

Matches the 2026-06-06 design spec. The sidebar Weather accordion shrinks
from two fixed-height chart blocks to one now that precip has moved out.
