# ADR: Split the single weather chart into focused components sharing one data hook

**Date:** 2026-06-05
**Status:** Accepted
**Related:** [FDR: Sidebar weather accordion and persistent hover pane](../fdr/2026-06-05-sidebar-weather-accordion-and-hover-pane.md), [redesign spec](../superpowers/specs/done/2026-06-03-chart-split-redesign.md) (supersedes [original chart-split spec](../superpowers/specs/done/2026-06-02-chart-split-design.md))

## Context

`WeatherTimeline` was a single `ComposedChart` mixing elevation, temperature,
and precipitation on one canvas; wind speed was fetched but never displayed.
Hover tooltips vanished the instant the cursor left a chart, with no
persistent readout of the hovered point's values.

## Decision

- `WeatherTimeline.tsx` (and its test file) is deleted, replaced by three
  focused components: `ElevationChart` (elevation + `ClimbOverlay`),
  `TempWindChart` (temperature + wind), and `PrecipChart` (precipitation
  probability + amount).
- A single pure `useWeatherChartData` hook — LTTB-downsampled data, weather
  samples pinned, temperature/precipitation/wind linearly interpolated
  between samples — is computed once in `App.tsx` and fanned out to all
  three charts and the new `HoverPane`, replacing three separate copies of
  the same memoized transform.
- The hover model changes from a per-chart hovered-distance callback plus a
  hovered lat/lng to a single `onHoverIndex` reported by whichever chart is
  hovered; `App` resolves both the map pin position and a `ChartDataPoint`
  for `HoverPane` from `chartData[index]`.
- `ClimbTimeRange`'s type ownership moves to `ClimbOverlay.tsx` (the single
  source of truth) instead of living inline inside the now-deleted
  `WeatherTimeline`.
- `BuildInfoPanel` is deleted; version and build date are absorbed into the
  Tech Details collapsible body instead of a separate pinned panel.

## Alternatives considered

- **The original 2026-06-02 chart-split-design** — kept the sidebar
  unchanged and arranged the three new charts in a left/right column split
  (map + elevation on the left, fixed-height precip/temp-wind boxes on the
  right), with no persistent hover readout. This spec is marked as
  superseded by the 2026-06-03 redesign before implementation began: the
  redesign instead reclaimed sidebar space by removing a stats card and
  added `HoverPane` specifically to solve the vanishing-tooltip problem, at
  the cost of moving the weather charts into the sidebar behind an accordion
  rather than keeping them always visible beside the map.

## Consequences

- Playwright selectors tied to `.stats-card`, `.stat-item`,
  `.timeline-container`, and `.build-info-panel` broke and needed updating —
  seven named E2E tests, enumerated in the redesign spec's own breaking-change
  table.
- Because `useWeatherChartData` is the single place chart data is shaped,
  later charting changes (moving temperature into the elevation chart,
  switching the X axis from time to distance) only had to change this one
  function instead of three duplicated ones.
