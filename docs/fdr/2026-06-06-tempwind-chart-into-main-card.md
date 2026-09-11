# FDR: Move the temp+wind chart into the main elevation card, remove the sidebar Weather panel

**Date:** 2026-06-06
**Status:** Shipped
**Related:** [design spec](../superpowers/specs/done/2026-06-06-weather-chart-relayout-design.md), [FDR: Sidebar weather accordion and persistent hover pane](2026-06-05-sidebar-weather-accordion-and-hover-pane.md) (Weather-panel portion superseded by this record), [FDR: Move the precipitation chart under the elevation chart](2026-06-06-precip-chart-under-elevation.md)

## Problem

The temp+wind chart lived in the sidebar Weather accordion, competing for
space with the ride controls and visually disconnected from the elevation
and precipitation charts in the main card — the same problem the precip
chart had just been moved to fix.

## Decision (highlights)

- The temp+wind `WeatherLineChart` (80px, `hideAxes`) moves into the main
  card's elevation row, between `ElevationChart` and the precip strip, each
  separated by a thin top border.
- The sidebar "Weather" collapse panel is removed entirely from `App.tsx` —
  no placeholder is left in its place, the section simply disappears.
- No changes to `WeatherLineChart` itself or to any chart height beyond
  matching the existing precip strip.

## Outcome vs. spec

Matches the 2026-06-06 weather-chart-relayout-design spec. The same commit
also fixed unrelated lint errors and an E2E flake (a conditional accordion
re-open when the speed input isn't visible after upload) — mechanical
side-fixes bundled into the change, not decisions in their own right.

With this and the precip-chart move on the same day, the sidebar Weather
panel introduced by the 2026-06-05 chart-split redesign no longer exists;
the Ride Details/Tech Details two-panel accordion from that record is
unaffected.
