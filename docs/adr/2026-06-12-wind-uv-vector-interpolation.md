# ADR: u/v vector decomposition for wind interpolation, time-based interpolation factor

**Date:** 2026-06-12
**Status:** Accepted
**Related:** [design spec](../superpowers/specs/done/2026-06-10-wind-interpolation-accuracy-design.md)

## Context

Wind values at chart points between the 11 fetched weather samples were
linearly interpolated as two independent scalars, `windSpeed` and
`windDeg`. This is wrong two ways: direction wraps circularly at the
0°/360° boundary (interpolating 350°→10° gives 180°, not 0°), and
interpolating speed independently of direction gives a physically wrong
magnitude partway through a direction change. Separately, the
interpolation fraction `t` was computed from chart-array index position
rather than elapsed time, which only tracked time correctly under a
constant-`avgSpeed` model.

## Decision

- Decompose each pair of bracketing samples into Cartesian wind components
  (`u = -speed·sin(deg)`, `v = -speed·cos(deg)`, meteorological "wind is
  named for where it's from" convention), linearly interpolate `u`/`v`
  directly, then reconstruct `windSpeed = √(u²+v²)` and
  `windDeg = atan2(-u,-v)` — circular wrap-around falls out for free, with
  no modular-arithmetic special case needed.
- Switch the interpolation fraction `t` from `(j - lo) / (hi - lo)` (index
  position) to `(time[j] - timeLo) / (timeHi - timeLo)` (elapsed time),
  falling back to the old index-based formula only when `timeHi === timeLo`
  (a zero-duration segment — not expected in practice, but guarded).
- Of the spec's three options for the underlying sample-density problem
  (A: raise the sample count above 11, B: elevation-aware extra sampling
  around climbs, C: accept the gap and fix only the interpolation math),
  this PR implements only the Phase 1 bug fixes above and leaves the
  sample-density question unresolved.

## Consequences

- Wind arrows and speed labels away from the 11 sample points are now
  physically consistent through direction changes and correctly
  time-aligned once per-segment speed varies — a correctness precondition
  the later checkpoint/pinned-arrival-time work depends on. See [ADR:
  Checkpoint-based arrival-time model](2026-09-10-checkpoint-arrival-time-model.md).
- Sample density itself (~15 km gaps on a 150 km route) is unchanged: a
  wind feature entirely between two samples is still invisible to the
  interpolation, correctness bugs aside.
- The open question about visually distinguishing interpolated from fetched
  wind values remains open; the UI still presents both identically.
