# ADR: Douglas-Peucker route decimation with configurable epsilon and max-gap fill

**Date:** 2026-05-23
**Status:** Accepted
**Related:** [FDR: Tech Details panel for point-reduction tuning](../fdr/2026-05-23-douglas-peucker-tech-details.md), [design spec](../superpowers/specs/done/2026-05-23-douglas-peucker-design.md), [epsilon design spec](../superpowers/specs/done/2026-05-23-configurable-dp-epsilon-design.md), [max-gap design spec](../superpowers/specs/done/2026-05-23-dp-max-gap-design.md)

## Context

GPX files with tens of thousands of points slowed map rendering and
inflated payloads with no visual benefit — most consecutive points lie
almost exactly on the line between their neighbors. The route needed to be
decimated at parse time before render or persistence, in a way that stays
visually faithful to the original track.

## Decision

- Decimate route points with the **Douglas-Peucker algorithm**, using
  `haversineMeters` cross-track distance (not planar distance) as the
  point-to-segment error metric, since routes span real-world geographic
  coordinates.
- Implement DP **iteratively** (explicit stack) rather than recursively,
  after hitting a stack overflow on large real-world GPX files with the
  initial recursive version.
- Add a **`fillGaps` post-processing pass** (`DP_MAX_GAP_METERS`) that
  reinserts points into any gap DP leaves wider than a configured max,
  since DP alone can silently drop the sampling density needed for smooth
  elevation/weather interpolation along long straight-ish stretches.
  `fillGaps` is documented as single-pass — it does not recheck gaps it
  creates while filling others.
- Make both **epsilon** (DP's distance threshold) and **max gap** explicit
  parameters threaded end-to-end: `parseGPX(text, epsilon, maxGapMeters)` →
  worker message → `gpxWorkerClient` → UI, rather than hard-coded
  constants, so the values can later be exposed to users (see FDR).
- Default max gap lowered from 500m to 50m for finer gap-fill granularity
  by default, based on visual inspection during implementation.

## Alternatives considered

- **Planar (Euclidean) cross-track distance** — rejected; would distort
  error measurement at latitude extremes since GPX coordinates are
  lat/lng, not a flat plane.
- **Recursive DP** — initial implementation; rejected after it
  stack-overflowed on large files, replaced with an iterative version
  doing the same algorithm.
- **Hard-coded epsilon/max-gap constants** — rejected in favor of threaded
  parameters, specifically to unblock making them user-editable in the
  same PR.

## Consequences

- `EARTH_RADIUS_METERS` was extracted out of `haversineMeters` to
  eliminate a duplicated constant once DP's cross-track distance needed
  the same radius.
- Every downstream consumer of `RouteData` now sees post-DP,
  post-`fillGaps` points, not the raw GPX trackpoints — any future feature
  needing the original untouched point count/spacing needs a separate
  path.
- `fillGaps` being single-pass is a known, documented limitation: a
  gap-filling insertion is never itself re-checked against the max-gap
  threshold. Acceptable for the granularities in use, but a future
  max-gap value chosen close to a single fill step's output could still
  leave an over-wide gap.
