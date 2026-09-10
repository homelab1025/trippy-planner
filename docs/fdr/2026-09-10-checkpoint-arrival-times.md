# FDR: Pin arrival times at checkpoints along the route

**Date:** 2026-09-10
**Status:** Shipped
**Related:** [ADR: Checkpoint-based arrival-time model](../adr/2026-09-10-checkpoint-arrival-time-model.md), [design spec](../superpowers/specs/2026-09-05-checkpoint-arrival-times-design.md)

## Problem

One constant average speed drove every arrival-time and weather estimate for
the whole ride, which doesn't reflect reality — issue #38.

## Decision (highlights)

- Riders drop checkpoints on the elevation chart and set an arrival time for
  each; speed between checkpoints is derived, not set directly (no gradient
  modeling this iteration).
- Editing a checkpoint's time can now push it past the next checkpoint's
  current time; a cascade prompt then asks to shift all downstream
  checkpoints by the same delta or keep their times (keeping is disabled
  when it would reorder checkpoints).
- Changing Start Date/Time shifts already-pinned checkpoints by the same
  delta, so gaps between checkpoints don't silently change.
- Checkpoints persist through localStorage, save/load, and share links
  alongside the rest of the route data.

## Outcome vs. spec

Two behaviors shipped beyond the original design spec: allowing a time edit
past the next checkpoint's time, and shifting pinned checkpoints on Start
Date/Time change. Drag-performance work (frame-throttled updates, a
locally-held preview until mouse release, memoized chart rows) was also
added during implementation and isn't in the spec. Everything the spec
marked out of scope (gradient modeling, weather-sample injection at
checkpoints, mobile drag ergonomics, a normalized checkpoints table) is
still out of scope.

**Process note:** the spec above wasn't updated to reflect these changes —
going forward, update the spec once a feature is deemed done, before
merging to master, so it stays a reliable record instead of drifting from
the implementation.
