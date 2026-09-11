# ADR: Use distance, not time, as the chart X-axis reference

**Date:** 2026-06-06
**Status:** Accepted
**Related:** [design spec](../superpowers/specs/done/2026-06-06-distance-xaxis-design.md)

## Context

Every chart (`ElevationChart`, `WeatherLineChart`) keyed its X axis on time
(a millisecond timestamp). This only worked because time was a monotonic
function of distance under the single constant `avgSpeed` model in use at
the time. The spec explicitly anticipated that per-waypoint arrival times
would eventually decouple time from distance, which a time-keyed axis
couldn't survive.

## Decision

- Switch the `dataKey` and every `ReferenceLine`/`ReferenceDot` x-lookup on
  `ElevationChart` and `WeatherLineChart` from `time` to `distance` (km).
  `ChartDataPoint` already carried both fields — no data-model change, only
  which field drives the axis.
- `ClimbTimeRange` is renamed `ClimbRange`; its `x1`/`x2` become km floats
  instead of ms timestamps, and `ClimbOverlay`'s internal point lookups
  switch from `payload.time` to `payload.distance`.
- `ElevationChart` drops the `avgSpeed`, `startTime`, `totalDistance`, and
  `xAxisMode` props entirely — none are needed once distance drives the
  axis directly.
- `HoverPane` keeps its own time display, controlled by the existing
  Clock/Elapsed toggle (relabeled "Time Display" in the sidebar) — only the
  chart axes stop being time-based, not the hover readout.

## Alternatives considered

None recorded in the spec. The "Problem" section frames this as a one-way
correction — distance is the stable, route-invariant reference and time is
derived from it — rather than a choice between options.

## Consequences

- This is the axis model the later checkpoint-based arrival-time feature
  depends on: once per-checkpoint times can diverge from a single
  `avgSpeed`-derived time, a time-keyed axis could no longer have served as
  a stable, route-invariant reference. See [ADR: Checkpoint-based
  arrival-time model](2026-09-10-checkpoint-arrival-time-model.md).
- Chart components lost several props (`avgSpeed`, `startTime`,
  `totalDistance`, `xAxisMode`) they no longer need, simplifying their
  interfaces ahead of that later change.
