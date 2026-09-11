# FDR: Tech Details panel for point-reduction tuning

**Date:** 2026-05-23
**Status:** Shipped
**Related:** [ADR: Douglas-Peucker route decimation with configurable epsilon and max-gap fill](../adr/2026-05-23-douglas-peucker-decimation.md), [design spec](../superpowers/specs/done/2026-05-23-douglas-peucker-design.md), [epsilon design spec](../superpowers/specs/done/2026-05-23-configurable-dp-epsilon-design.md), [max-gap design spec](../superpowers/specs/done/2026-05-23-dp-max-gap-design.md)

## Problem

Route decimation (Douglas-Peucker + gap-fill) ran with fixed constants and
no visibility — users couldn't see how much a route had been simplified
or adjust the trade-off between fidelity and point count.

## Decision (highlights)

- Add a **Tech Details** panel showing DP Epsilon, Max Gap, and the
  resulting point-compression stats (original vs. decimated point count)
  for the currently loaded route.
- Both **DP Epsilon** and **Max Gap** are editable inputs, guarded against
  invalid input (NaN guard, label association for accessibility).
- Once a route is uploaded, the inputs freeze — changing epsilon or max
  gap requires re-uploading the file to see the effect, rather than
  re-decimating the already-loaded route in place.
- Epsilon input placed in its own input-group (not the stats grid) for
  visual separation from the read-only stats.

## Outcome vs. spec

Shipped per the linked design specs. The "frozen after upload" behavior
was a deliberate simplification for this iteration — editing an
already-loaded route's decimation live was left out of scope.
