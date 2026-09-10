# ADR: Checkpoint-based arrival-time model

**Date:** 2026-09-10
**Status:** Accepted
**Related:** [FDR: Pin arrival times at checkpoints along the route](../fdr/2026-09-10-checkpoint-arrival-times.md), [design spec](../superpowers/specs/2026-09-05-checkpoint-arrival-times-design.md)

## Context

Every arrival-time estimate in the app (weather sample points, chart time
axis) was computed from a single constant `avgSpeed`, duplicated inline in
`App.tsx` and `useWeatherChartData.ts`. This didn't reflect real rides
(breaks, hills, traffic) — tracked as issue #38. Modeling per-segment speed
without a full gradient/terrain model was the constraint: something more
accurate than one flat speed, without taking on gradient-based intra-segment
shaping in the same change.

## Decision

- Represent ride timing as an ordered list of **checkpoints**
  (`{id, distanceM, arrivalTime, pinned}`, `frontend/src/utils/speedProfile.ts`),
  plus the route start (synthesized from the existing `startTime` state, never
  stored, to avoid a second source of truth) and a mandatory, undeletable
  `end` checkpoint. `computeArrivalTime` linearly interpolates between the
  bracketing pair and is now the single function every arrival-time
  calculation in the app funnels through.
- `pinned: true` means a checkpoint holds a user-set absolute time, detached
  from `avgSpeed`; only `end` is ever created `pinned: false`.
- Persist checkpoints as one opaque `checkpoints_json` TEXT column on `routes`
  (migration `V5__add_route_checkpoints.sql`), nullable, no server-side
  validation of its contents — the same treatment already given `gpx_content`.

## Alternatives considered

- **Gradient-based intra-segment speed** (issue's Proposal A) — rejected for
  this iteration; no gradient data source is in scope yet, and it would have
  significantly expanded the change for a first pass.
- **Normalized `route_checkpoints` table** instead of a JSON blob — rejected;
  checkpoints are always read and written as a whole array, never queried by
  field, so a table buys queryability the app doesn't use yet at the cost of
  a second migration path. Matches the existing `gpx_content` precedent.
- **Injecting extra weather-sample points at checkpoint distances** — rejected
  for this change; the weather-sampling grid stays purely distance-based and
  independent of checkpoints, keeping this feature additive rather than
  entangled with sampling logic.

## Consequences

- `speedProfile.test.ts` pins `computeArrivalTime` to exactly match the old
  constant-speed formula when only `end` exists, so the new model is a
  regression-tested superset of the old one, not a parallel path.
- `checkpoints_json` being opaque to the backend means any future need to
  query or filter on checkpoint data server-side (e.g. "routes with a
  checkpoint after 6pm") requires a real migration later — this decision
  defers that cost rather than eliminating it.
- A user can now deliberately create long slow segments that push a
  late-route arrival time outside Open-Meteo's 7-day forecast window. No new
  handling was added — the existing null/"unavailable" per-point fallback
  already covers it — but it's easier to trigger than under the old
  constant-speed model.
- Moving arrival-time computation into per-drag-frame and per-render code
  paths (chart overlay, track row, sidebar) made drag and chart-update
  performance a real concern during implementation, driving follow-up work
  not anticipated in the original design: rAF-throttled drag updates, a
  locally-held drag preview until mouse release, and memoizing
  `MapComponent`/`PrecipBarRow`/`WindArrowRow`.
