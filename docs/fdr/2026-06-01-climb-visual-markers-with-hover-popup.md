# FDR: Visual climb markers with hover detail popup

**Date:** 2026-06-01
**Status:** Shipped
**Related:** [ADR: Climb detection via Strava scoring, rendered as a Recharts-injected SVG overlay](../adr/2026-06-01-climb-detection-and-overlay-rendering.md), [visual redesign spec](../superpowers/specs/done/2026-05-31-climbs-visual-redesign.md)

## Problem

The initial flat `ReferenceArea`/`ReferenceLine` climb markers, added as part
of the same detection work, needed a richer and more legible presentation —
riders should be able to see a climb's severity at a glance and its exact
stats on demand.

## Decision (highlights)

- Each detected climb gets a category-colored gradient fill clipped under the
  elevation line, plus a highlighted stroke over the elevation line for the
  climb's span.
- A pill badge with a dashed pole marks each climb's peak, labeled with its
  category (e.g. "Cat 2"); badge horizontal position is double-clamped so it
  never clips at the plot area's edges.
- Hovering a badge shows a popup with length and average grade, positioned to
  flip to the opposite side when it would otherwise clip past the chart edge.

## Outcome vs. spec

Matches the 2026-05-31 visual redesign spec. Badge-to-badge overlap on
closely-spaced climbs is an explicitly accepted v1 limitation, not a gap
against the spec.
