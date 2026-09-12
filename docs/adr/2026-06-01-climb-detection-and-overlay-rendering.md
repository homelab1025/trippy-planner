# ADR: Climb detection via Strava scoring, rendered as a Recharts-injected SVG overlay

**Date:** 2026-06-01
**Status:** Accepted
**Related:** [FDR: Visual climb markers with hover detail popup](../fdr/2026-06-01-climb-visual-markers-with-hover-popup.md), [detection design spec](../superpowers/specs/done/2026-05-30-climbs-design.md), [visual redesign spec](../superpowers/specs/done/2026-05-31-climbs-visual-redesign.md)

## Context

The app had no way to identify or highlight notable climbs on a route's
elevation profile. Both the detection algorithm and its on-chart rendering
shipped together in this PR.

## Decision

- `src/utils/climbDetector.ts` computes point-to-point grade, builds
  contiguous ascending runs above `MIN_GRADE_PCT` (1%), then merges runs
  across gaps whose net descent is under `MAX_GAP_DESCENT_M` (30m) and whose
  distance is under `MAX_GAP_DISTANCE_M` (500m) — handling chained climbs in
  a single left-to-right pass. Each merged run is scored
  `lengthM × avgGrade` and categorized against Strava's published
  categorization thresholds (Cat4 through HC), discarding anything scoring
  at or below `MIN_SCORE` (8000). All four thresholds are named constants.
- Rather than a separate DOM layer, `ClimbOverlay` renders inside the
  Recharts `ComposedChart` via `<Customized component={ClimbOverlay} />`,
  using the coordinates and axis-scale functions Recharts injects at render
  time to paint gradient fills (clipped to the elevation area's own polygon),
  category-colored highlight strokes over each climb span, and pill-badge
  peak flags directly into the chart's SVG — instead of computing an
  independent pixel layout.
- `climbDetector` runs once per route via `useMemo` keyed only on
  `route.points`, independent of weather state.

## Consequences

- Badge overlap on closely-spaced climbs and popup collisions near the chart
  edge are accepted v1 limitations (explicit in the visual-redesign spec) —
  double-clamping keeps a single badge on-screen but does nothing for two
  badges competing for the same space.
- A follow-up fix five days later
  (`64d27ee`, "merge false-flat gaps that are net uphill") removed the
  `gapDescent >= 0` pre-check in the merge condition: routes with a
  slightly-uphill false flat between two steep sections (e.g. La Barillette)
  were being reported as multiple separate climbs. Any gap under the 1%
  grade threshold and under 500m gains at most 5m of elevation, so the
  existing 30m descent ceiling was already sufficient protection against
  genuine descents — the extra pre-check was redundant and actively wrong
  for this case.
- The visual redesign left `climbDetector.ts` itself untouched; its 22 unit
  tests kept passing unchanged.
