# FDR: Edit DP Epsilon/Max Gap after a route is loaded

**Date:** 2026-08-23
**Status:** Shipped
**Related:** [ADR: Custom Tooltip component; live tech-params re-parse](../adr/2026-08-23-custom-tooltip-and-live-tech-params.md)

## Problem

DP Epsilon and Max Gap, in the Tech Details panel, could only be set before
a GPX file was uploaded — they locked once a route existed, so trying a
different simplification setting meant re-uploading the same file.

## Decision (highlights)

- Both inputs stay editable after a route is loaded. Blurring a changed
  field, or pressing Enter, re-parses the already-uploaded GPX with the new
  values and re-fetches weather (weather samples are matched to route
  points by reference, so a re-parse without a re-fetch would leave them
  orphaned).
- Help text for both fields moved onto a help icon using the new `Tooltip`
  component instead of native `title`.
- Both values persist to `localStorage` (mirroring the existing
  avgSpeed/startTime session persistence) so a page refresh restores the
  last-set values instead of resetting to defaults. This is purely the
  client-side session mirror — routes saved to the backend still don't
  carry these params.
- A "Reset to defaults" button, placed after Max Gap, restores both to
  `DP_EPSILON_METERS`/`DP_MAX_GAP_METERS` and immediately re-parses, same
  as blurring an edited field.

## Outcome vs. spec

No design spec preceded this change; it shipped directly as a sequence of
incremental commits (edit-after-load → tooltips → custom Tooltip component
→ localStorage persistence → reset button). Nothing was descoped along the
way.
