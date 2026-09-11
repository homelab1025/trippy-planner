# FDR: Sidebar weather accordion and persistent hover pane

**Date:** 2026-06-05
**Status:** Shipped
**Related:** [ADR: Split the single weather chart into focused components sharing one data hook](../adr/2026-06-05-chart-split-architecture.md), [redesign spec](../superpowers/specs/done/2026-06-03-chart-split-redesign.md)

## Problem

The sidebar spent space on a stats card that duplicated information already
shown in the header, and hover tooltips gave no persistent way to read all
of a point's values at once.

## Decision (highlights)

- The sidebar becomes a single-open accordion — Ride Details, Weather, Tech
  Details — via one `activePanel` union state, removing the previous two
  independent collapsibles plus a pinned bottom panel.
- Ride Details starts open and auto-collapses once a route loads (still
  manually re-openable); the Weather panel (TempWind + Precip charts) only
  mounts after a route loads; Tech Details absorbs the deleted
  `BuildInfoPanel`'s version/build-date display.
- A persistent ~110px `HoverPane` sits beside the elevation chart, showing
  time, distance, elevation, temperature, wind, and precipitation
  probability/amount for whichever point is hovered on any of the three
  charts — with a placeholder message when nothing is hovered.
- Header gains a center zone showing the loaded route's name, distance, and
  elevation gain, freeing the sidebar stats card this replaces.

## Outcome vs. spec

Matches the 2026-06-03 chart-split-redesign spec, which itself supersedes
the earlier 2026-06-02 chart-split-design.

**Note (2026-06-06):** the Weather panel specifically — TempWind and Precip
charts docked in the sidebar accordion — was undone the next day. The precip
chart moved into the main elevation card
([FDR](2026-06-06-precip-chart-under-elevation.md)), and the temp/wind chart
followed it a few hours later
([FDR](2026-06-06-tempwind-chart-into-main-card.md)), which removed the
sidebar Weather panel entirely. The Ride Details/Tech Details two-panel
accordion and the `HoverPane` introduced here were not affected.
